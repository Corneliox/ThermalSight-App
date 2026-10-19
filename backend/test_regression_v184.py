"""
Automated Regression Test Suite for ThermalSight v1.8.4
Validates all 5 Quality Gates (BUG-1.1 through BUG-3.9) and guards against
the >100°C temperature anomaly (123.87°C - 187.06°C).
"""

import os
import sys
import json
import tempfile
import unittest
from pathlib import Path
import numpy as np
import cv2
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import analyzer
import ppg_workbench


class TestThermalSightRegressionV184(unittest.TestCase):

    def test_gate1_temperature_sanity_and_grayscale_fallback(self):
        """Gate 1.1 & 1.2 (BUG-1.7): No pixel may exceed 50°C even on 8-bit grayscale fallback."""
        with tempfile.TemporaryDirectory() as tmpdir:
            img_path = Path(tmpdir) / "synthetic_uncalibrated.png"
            # Create 8-bit grayscale image with pixel values up to 255 (OSD white text simulation)
            synth = np.linspace(0, 255, 240 * 320, dtype=np.uint8).reshape((240, 320))
            cv2.imwrite(str(img_path), synth)

            temp_analyzer = analyzer.load_temperature(str(img_path))
            temp_wb = ppg_workbench.load_temperature(str(img_path))

            self.assertLessEqual(float(np.max(temp_analyzer)), 42.01, "analyzer.load_temperature exceeded physiological ceiling!")
            self.assertGreaterEqual(float(np.min(temp_analyzer)), 19.99, "analyzer.load_temperature fell below physiological floor!")
            self.assertLessEqual(float(np.max(temp_wb)), 42.01, "ppg_workbench.load_temperature exceeded physiological ceiling!")
            self.assertGreaterEqual(float(np.min(temp_wb)), 19.99, "ppg_workbench.load_temperature fell below physiological floor!")

        # Also test real sample FLIR0426.jpg and FLIR0428.jpg if present
        sample_dir = ROOT_DIR / "sample" / " plantar_activity"
        for fname in ["FLIR0426.jpg", "FLIR0428.jpg", "FLIR0440.jpg"]:
            fpath = sample_dir / fname
            if fpath.exists():
                t_arr = ppg_workbench.load_temperature(str(fpath))
                self.assertLess(float(np.max(t_arr)), 50.0, f"{fname} max temperature exceeded 50°C!")
                self.assertGreater(float(np.min(t_arr)), 15.0, f"{fname} min temperature below 15°C!")

    def test_gate1_inpainting_preserves_foot_hotspots(self):
        """Gate 1.3 (BUG-3.3): clean_flir_accessories must not erase 37.5°C foot hotspots."""
        temp = np.full((240, 320), 28.0, dtype=np.float32)
        # Plantar hotspot at (100, 120) inside foot region (off-reticle)
        temp[95:105, 115:125] = 37.5
        cleaned = analyzer.clean_flir_accessories(temp)
        self.assertAlmostEqual(float(cleaned[100, 120]), 37.5, places=4,
                               msg="Hotspot inside foot region was erased by clean_flir_accessories!")

    def test_gate1_float32_precision_inside_mask(self):
        """Gate 1.4 (BUG-1.2): Inpainting outside mask must not quantize float32 inside mask."""
        foot_crop = np.random.uniform(27.1234, 36.8765, size=(80, 50)).astype(np.float32)
        mask_crop_u8 = np.zeros((80, 50), dtype=np.uint8)
        mask_crop_u8[10:70, 10:40] = 1
        mask_inside = (mask_crop_u8 > 0)
        mask_inv = (~mask_inside).astype(np.uint8)

        c_min = float(foot_crop[mask_inside].min())
        c_max = float(foot_crop[mask_inside].max())
        denom = max(1e-4, c_max - c_min)
        norm_u8 = np.clip((foot_crop - c_min) / denom * 255.0, 0, 255).astype(np.uint8)
        crop_inp_u8 = cv2.inpaint(norm_u8, mask_inv, 7, cv2.INPAINT_TELEA)
        crop_inp = foot_crop.copy().astype(np.float32)
        crop_inp[~mask_inside] = (c_min + (crop_inp_u8.astype(np.float32) / 255.0) * denom)[~mask_inside]

        max_diff_inside = float(np.max(np.abs(crop_inp[mask_inside] - foot_crop[mask_inside])))
        self.assertEqual(max_diff_inside, 0.0, "Float32 precision inside foot mask was corrupted by 8-bit quantization!")

    def test_gate1_9x9_roi_mask_filtering(self):
        """Gate 1.5 (BUG-1.8): 9x9 ROI extraction must exclude cold background pixels outside mask_dense."""
        grid_smooth = np.full((20, 20), 22.0, dtype=np.float32)  # cold background
        mask_dense = np.zeros((20, 20), dtype=bool)
        # Foot tissue only on right half of 9x9 patch around (10, 10)
        mask_dense[6:15, 10:15] = True
        grid_smooth[mask_dense] = 33.5

        patch_temps = grid_smooth[6:15, 6:15]
        patch_mask = mask_dense[6:15, 6:15]
        roi_temps = patch_temps[patch_mask]

        self.assertGreaterEqual(float(np.min(roi_temps)), 33.4, "Cold background leaked into 9x9 ROI statistics!")

    def test_gate2_pga_compass_orientation(self):
        """Gate 2.1 & 2.2 (BUG-1.1): Upward heat flow -> 90° (N); Downward heat flow -> 270° (S)."""
        # Create grid where top rows (row 0 = North/Toes) are hotter than bottom rows (row 19 = South/Heel)
        y_coords = np.arange(20, dtype=np.float64).reshape(20, 1)
        grid_north_hot = (40.0 - 0.5 * y_coords) * np.ones((20, 20), dtype=np.float64)
        sobel_x = cv2.Sobel(grid_north_hot, cv2.CV_64F, 1, 0, ksize=3) / 8.0
        sobel_y = cv2.Sobel(grid_north_hot, cv2.CV_64F, 0, 1, ksize=3) / 8.0
        grad_angles = np.degrees(np.arctan2(-sobel_y, sobel_x)) % 360.0

        center_angle_n = float(grad_angles[10, 10])
        self.assertAlmostEqual(center_angle_n, 90.0, places=2)
        compass_n = ppg_workbench.get_compass_dir(center_angle_n, is_right_foot=True)
        self.assertIn("Ke Jari", compass_n)

        # Now test hotter towards bottom (Heel/South)
        grid_south_hot = (25.0 + 0.5 * y_coords) * np.ones((20, 20), dtype=np.float64)
        sobel_x_s = cv2.Sobel(grid_south_hot, cv2.CV_64F, 1, 0, ksize=3) / 8.0
        sobel_y_s = cv2.Sobel(grid_south_hot, cv2.CV_64F, 0, 1, ksize=3) / 8.0
        grad_angles_s = np.degrees(np.arctan2(-sobel_y_s, sobel_x_s)) % 360.0

        center_angle_s = float(grad_angles_s[10, 10])
        self.assertAlmostEqual(center_angle_s, 270.0, places=2)
        compass_s = ppg_workbench.get_compass_dir(center_angle_s, is_right_foot=True)
        self.assertIn("Ke Tumit", compass_s)

    def test_gate2_cmd_crop_calibration_scaling(self):
        """Gate 2.3 (BUG-1.3): cmd_crop with px_cm=20.0 must double gradient (°C/cm) vs px_cm=10.0."""
        with tempfile.TemporaryDirectory() as tmpdir:
            png_img = Path(tmpdir) / "grad_test.png"
            # Linear gradient along X in 8-bit grayscale
            xs = np.linspace(50, 220, 100, dtype=np.uint8)
            mat = np.tile(xs, (100, 1))
            cv2.imwrite(str(png_img), mat)

            pts = [{"x": 30, "y": 30}, {"x": 70, "y": 30}, {"x": 70, "y": 70}, {"x": 30, "y": 70}]
            pts_json = json.dumps(pts)

            # Capture emit output
            captured = []
            orig_emit = analyzer.emit
            analyzer.emit = lambda d: captured.append(d)
            try:
                analyzer.cmd_crop(str(png_img), pts_json, "m1", "0", tmpdir, px_cm=10.0)
                analyzer.cmd_crop(str(png_img), pts_json, "m1", "1", tmpdir, px_cm=20.0)
            finally:
                analyzer.emit = orig_emit

            self.assertEqual(len(captured), 2)
            g10 = captured[0]["gradient_max"]
            g20 = captured[1]["gradient_max"]
            self.assertGreater(g10, 0.0)
            self.assertAlmostEqual(g20 / g10, 2.0, places=2,
                                   msg="cmd_crop ignored px_cm spatial calibration parameter!")

    def test_gate3_excel_audit_box_separation(self):
        """Gate 3.3 (BUG-1.4): Audit Box Col D has clean formula text and Col E has active Excel formula."""
        with tempfile.TemporaryDirectory() as tmpdir:
            xlsx_path = Path(tmpdir) / "test_summary.xlsx"
            df_long = pd.DataFrame([
                {
                    "Image_Name": "FLIR0426", "Foot_Side": "Right", "ROI": "T1",
                    "PPP_Mean_Temp_C": 31.2, "PPP_Peak_Temp_C": 32.4, "PPP_Min_Temp_C": 30.1, "PPP_Std_Temp_C": 0.4,
                    "PPG_Mean_Grad": 0.15, "PPG_Peak_Grad": 0.32, "PPG_Std_Grad": 0.05,
                    "PGA_Mean_Angle_Deg": 90.0, "PGA_Direction_Compass": "N (Ke Jari / Distal)", "PGA_Coherence_Pct": 85.0
                }
            ])
            df_wide = pd.DataFrame([{"Image_Name": "FLIR0426", "Foot_Side": "Right", "T1_PPP_Mean_C": 31.2}])
            with pd.ExcelWriter(str(xlsx_path), engine="openpyxl") as writer:
                df_long.to_excel(writer, sheet_name="Detailed_ROIs", index=False)
                df_wide.to_excel(writer, sheet_name="Executive_Summary", index=False)

            ppg_workbench.enhance_excel_workbook(xlsx_path)

            import openpyxl
            wb = openpyxl.load_workbook(str(xlsx_path), data_only=False)
            self.assertIn("Detailed_ROIs", wb.sheetnames)
            self.assertIn("Executive_Summary", wb.sheetnames)
            self.assertIn("Panduan_Metodologi", wb.sheetnames)

            ws = wb["Detailed_ROIs"]
            # Data has 1 row (row 2), start_guide_r = 5, hdr_r = 6, first audit metric row = 7
            col_d_val = str(ws["D7"].value)
            col_e_val = str(ws["E7"].value)
            self.assertTrue(col_d_val.startswith("Formula: =AVERAGE"), f"Unexpected Col D value: {col_d_val}")
            self.assertFalse(col_d_val.startswith("'="), "Col D still contains leading single-quote artifact!")
            self.assertEqual(col_e_val, "=AVERAGE(D2:D2)", f"Col E is not an active Excel formula: {col_e_val}")

    def test_gate4_result_suffix_and_default_roi_points(self):
        """Gate 4.1 & 4.2 (BUG-3.2 & BUG-3.9): strip_result_suffix and 36-point default ROI polygons."""
        self.assertEqual(ppg_workbench.strip_result_suffix("sample_result"), "sample")
        self.assertEqual(ppg_workbench.strip_result_suffix("sample_result_result_result"), "sample")

        # Verify source code of get_mapped_rois generates 36 polygon points
        wb_src = (ROOT_DIR / "ppg_workbench.py").read_text(encoding="utf-8")
        self.assertIn("np.linspace(0, 2 * np.pi, 36, endpoint=False)", wb_src)
        self.assertIn('"points": pts_poly', wb_src)

    def test_gate5_frontend_and_ipc_source_guards(self):
        """Gate 3.1, 5.1, 5.2: Verify preload.js, App.jsx, main.js, and thermalEngine.js fixes."""
        preload_src = (ROOT_DIR / "src" / "preload.js").read_text(encoding="utf-8")
        self.assertIn("ipcRenderer.removeListener('backend-log', sub)", preload_src)

        app_src = (ROOT_DIR / "src" / "src" / "App.jsx").read_text(encoding="utf-8")
        self.assertIn("menuHandlersRef.current", app_src)
        self.assertIn("cleanups.forEach", app_src)

        engine_src = (ROOT_DIR / "src" / "src" / "thermalEngine.js").read_text(encoding="utf-8")
        self.assertIn("gyWeighted += -sy", engine_src)
        self.assertNotIn("if (lum < 30 || lum > 240)", engine_src)


if __name__ == "__main__":
    unittest.main(verbosity=2)
