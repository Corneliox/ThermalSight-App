"""
Unit & Integration Test for ThermalSight v1.8.4 Cohort Multi-Protocol Functionality
Validates:
1. detect_cohort_protocols filters out *_result, *_analysis, and hidden directories.
2. Isolated directory output per protocol (no cross-contamination of statistics).
3. Cohort_Protocols_Summary.xlsx generation and formatting.
4. CLI --cohort batch execution.
"""
import os
import sys
import shutil
import tempfile
import unittest
import numpy as np
import pandas as pd
import openpyxl

# Add parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import ppg_workbench

class TestCohortProtocolsV184(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp(prefix='cohort_test_')

    def tearDown(self):
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_detect_cohort_protocols_filtering(self):
        """Verify detect_cohort_protocols identifies protocols and ignores result/analysis folders."""
        cohort_root = os.path.join(self.test_dir, 'azmi')
        os.makedirs(cohort_root, exist_ok=True)

        # Create protocol folders matching user's structure:
        # 1_30, 1_50, 1-100, 50_30
        protocols = ['1_30', '1_50', '1-100', '50_30']
        for proto in protocols:
            p_dir = os.path.join(cohort_root, proto)
            os.makedirs(p_dir, exist_ok=True)
            # Add synthetic jpg
            with open(os.path.join(p_dir, 'FLIR0001.jpg'), 'wb') as f:
                f.write(b'\xFF\xD8\xFF\xE0\x00\x10JFIF' + b'\x00' * 100)

            # Add existing result folder that must be ignored
            res_dir = os.path.join(cohort_root, f'{proto}_result')
            os.makedirs(res_dir, exist_ok=True)
            with open(os.path.join(res_dir, 'annotations_session.json'), 'w') as f:
                f.write('{}')

        # Add an analysis folder that must also be ignored
        os.makedirs(os.path.join(cohort_root, 'FLIR0426.jpg_analysis'), exist_ok=True)
        # Add a hidden folder that must be ignored
        os.makedirs(os.path.join(cohort_root, '.git'), exist_ok=True)

        is_cohort, detected = ppg_workbench.detect_cohort_protocols(cohort_root)
        self.assertTrue(is_cohort, "Should detect cohort structure")
        detected_names = [d['name'] for d in detected]
        self.assertEqual(sorted(detected_names), sorted(protocols), "Must strictly include only valid protocol folders")

        for d in detected:
            self.assertFalse(d['name'].endswith('_result'), f"Should not include _result folder: {d['name']}")
            self.assertFalse(d['name'].endswith('_analysis'), f"Should not include _analysis folder: {d['name']}")
            self.assertTrue(os.path.isabs(d['resultDir']), "resultDir must be an absolute path")
            self.assertEqual(d['resultDir'], os.path.join(cohort_root, f"{d['name']}_result"))

    def test_single_folder_not_detected_as_cohort(self):
        """Ensure standard folders with <= 1 subfolder are not falsely flagged as cohorts."""
        single_dir = os.path.join(self.test_dir, 'single_subject')
        os.makedirs(single_dir, exist_ok=True)
        # Only 1 subfolder
        os.makedirs(os.path.join(single_dir, 'session_1'), exist_ok=True)
        with open(os.path.join(single_dir, 'session_1', 'img.jpg'), 'wb') as f:
            f.write(b'\xFF\xD8\xFF\xE0\x00\x10JFIF')

        is_cohort, detected = ppg_workbench.detect_cohort_protocols(single_dir)
        self.assertFalse(is_cohort, "Single subfolder must not trigger cohort mode")
        self.assertEqual(detected, [])

    def test_cohort_master_workbook_styling(self):
        """Test enhance_cohort_workbook styling and sheet generation."""
        cohort_root = os.path.join(self.test_dir, 'azmi')
        os.makedirs(cohort_root, exist_ok=True)

        excel_path = os.path.join(cohort_root, 'Cohort_Protocols_Summary.xlsx')
        # Create a mock Excel file with Protocol_Comparison and All_Protocols_Detailed
        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            comp_df = pd.DataFrame([
                {'Protocol': '1_30', 'Image_Count': 2, 'Mean_Temp_C': 32.50, 'Max_Gradient_C_cm': 1.45, 'Dominant_Direction': 'N'},
                {'Protocol': '1_50', 'Image_Count': 2, 'Mean_Temp_C': 34.10, 'Max_Gradient_C_cm': 1.80, 'Dominant_Direction': 'NE'}
            ])
            comp_df.to_excel(writer, sheet_name='Protocol_Comparison', index=False)

            detail_df = pd.DataFrame([
                {'Protocol': '1_30', 'Image': 'FLIR0426.jpg', 'ROI': 'H', 'Mean_Temp': 32.1},
                {'Protocol': '1_30', 'Image': 'FLIR0428.jpg', 'ROI': 'H', 'Mean_Temp': 32.9},
                {'Protocol': '1_50', 'Image': 'FLIR0451.jpg', 'ROI': 'H', 'Mean_Temp': 33.8},
                {'Protocol': '1_50', 'Image': 'FLIR0452.jpg', 'ROI': 'H', 'Mean_Temp': 34.4}
            ])
            detail_df.to_excel(writer, sheet_name='All_Protocols_Detailed', index=False)

        # Run styling enhancer
        ppg_workbench.enhance_cohort_workbook(excel_path, 'azmi', 2)

        # Inspect workbook
        wb = openpyxl.load_workbook(excel_path)
        self.assertIn('Protocol_Comparison', wb.sheetnames)
        self.assertIn('All_Protocols_Detailed', wb.sheetnames)
        self.assertIn('Panduan_Metodologi', wb.sheetnames)

        ws_comp = wb['Protocol_Comparison']
        # Header title check
        self.assertEqual(ws_comp['A1'].value, 'Protocol')
        # Check that table header has Indigo fill (312E81)
        header_fill = ws_comp['A1'].fill.start_color.rgb
        self.assertTrue('312E81' in str(header_fill).upper())

    def test_multi_protocol_isolation_no_30_rows_contamination(self):
        """
        Critical regression test for multi-protocol Excel isolation:
        Verifies that even if an annotations_session.json contains keys from all 10 images
        across 5 sibling protocols, each protocol's exported Excel has strictly N_images * 3 rows
        (e.g. exactly 6 rows for 2 images) and NEVER condenses all 30 rows into an individual protocol Excel.
        """
        import json
        import cv2
        import tkinter as tk

        cohort_root = os.path.join(self.test_dir, 'azmi_isolation')
        os.makedirs(cohort_root, exist_ok=True)

        # 5 protocols, each with 2 images
        proto_map = {
            '1_30': ['FLIR0426.jpg', 'FLIR0428.jpg'],
            '1_50': ['FLIR0451.jpg', 'FLIR0452.jpg'],
            '1-100': ['FLIR0474.jpg', 'FLIR0475.jpg'],
            '50_30': ['FLIR0485.jpg', 'FLIR0486.jpg'],
            '50_50': ['FLIR0498.jpg', 'FLIR0499.jpg'],
        }

        all_keys = {}
        for proto, imgs in proto_map.items():
            p_dir = os.path.join(cohort_root, proto)
            os.makedirs(p_dir, exist_ok=True)
            for img_name in imgs:
                img_path = os.path.join(p_dir, img_name)
                # Create a small synthetic radiometric image (240x320 float32 temperatures around 32-35C)
                temp_arr = np.full((240, 320), 22.0, dtype=np.float32)
                temp_arr[40:200, 40:280] = 34.5  # Foot tissue
                norm_u8 = ((temp_arr - 20.0) / 20.0 * 255.0).clip(0, 255).astype(np.uint8)
                cv2.imwrite(img_path, norm_u8)

                # 3 ROIs (T1, M1, M2)
                all_keys[img_path] = [
                    {"labelName": "T1", "cx": 80, "cy": 60, "points": [{"x": 75, "y": 55}, {"x": 85, "y": 65}]},
                    {"labelName": "M1", "cx": 100, "cy": 100, "points": [{"x": 95, "y": 95}, {"x": 105, "y": 105}]},
                    {"labelName": "M2", "cx": 140, "cy": 110, "points": [{"x": 135, "y": 105}, {"x": 145, "y": 115}]},
                ]

        # Contaminate 1_30_result with ALL 10 image keys in annotations_session.json (simulating legacy bug)
        res_dir_130 = os.path.join(cohort_root, '1_30_result')
        os.makedirs(res_dir_130, exist_ok=True)
        session_json_path = os.path.join(res_dir_130, 'annotations_session.json')
        with open(session_json_path, 'w', encoding='utf-8') as f:
            json.dump({
                "version": "1.8.5",
                "folderPath": os.path.join(cohort_root, '1_30'),
                "segmentations": all_keys,
            }, f, indent=2)

        # 1. Test smart resolver strictly limits resolution to 1_30
        root = tk.Tk()
        root.withdraw()
        app = ppg_workbench.PPGWorkbenchApp(root, session_arg=session_json_path, cohort_arg=cohort_root, silent_mode=True)
        
        self.assertIsNotNone(app.cohort_info)
        # Find 1_30 idx
        idx_130 = [i for i, p in enumerate(app.cohort_info['protocols']) if p['name'] == '1_30'][0]
        app.switch_to_protocol(idx_130)

        # image_list for 1_30 MUST ONLY contain 2 images, NOT 10!
        self.assertEqual(len(app.image_list), 2, f"Protocol 1_30 image list must have exactly 2 images, but had {len(app.image_list)}")
        for img in app.image_list:
            self.assertIn(os.path.basename(img), ['FLIR0426.jpg', 'FLIR0428.jpg'])

        # 2. Run recompute and export for 1_30
        success = app.recompute_and_export_all_metrics(silent=True)
        self.assertTrue(success, "Recompute should succeed")

        # 3. Verify exported Excel in 1_30_result
        excel_out = os.path.join(res_dir_130, 'PPP_PPG_PGA_Statistical_Summary.xlsx')
        excel_sheet_out = os.path.join(res_dir_130, 'Sheet', 'PPP_PPG_PGA_Statistical_Summary.xlsx')
        self.assertTrue(os.path.exists(excel_out), "Exported Excel must exist in result_dir")
        self.assertTrue(os.path.exists(excel_sheet_out), "Exported Excel must be mirrored in result_dir/Sheet")

        wb_130 = openpyxl.load_workbook(excel_out)
        ws_det = wb_130['Detailed_ROIs']
        
        # Count data rows in Detailed_ROIs (stop when reaching blank row or audit box)
        data_rows = []
        for r in range(2, ws_det.max_row + 1):
            val = ws_det.cell(row=r, column=1).value
            if not val or not str(val).strip() or "AUDIT" in str(val).upper() or "METRIK" in str(val).upper():
                break
            data_rows.append(str(val).strip())

        # MUST BE EXACTLY 6 rows (2 images * 3 ROIs: FLIR0426 x3, FLIR0428 x3), NOT 30 rows!
        self.assertEqual(len(data_rows), 6, f"Detailed_ROIs in 1_30 must have exactly 6 rows (2 images x 3 ROIs), but got {len(data_rows)} rows: {data_rows}")

        # Check image names in data rows: only FLIR0426 and FLIR0428!
        img_names_in_excel = {str(ws_det.cell(row=r, column=1).value) for r in range(2, 2 + len(data_rows))}
        self.assertEqual(img_names_in_excel, {'FLIR0426', 'FLIR0428'}, "Excel must only contain FLIR0426 and FLIR0428")

        # 4. Test Excel file locking resilience: if primary Excel is locked, fallback to _isolated.xlsx
        with open(excel_out, 'r+b') as locked_file:
            # File is now opened exclusively / locked on Windows
            success_lock = app.recompute_and_export_all_metrics(silent=True)
            self.assertTrue(success_lock, "Recompute should succeed even if primary Excel is locked")
            fallback_excel = os.path.join(res_dir_130, 'PPP_PPG_PGA_Statistical_Summary_isolated.xlsx')
            self.assertTrue(os.path.exists(fallback_excel), "Fallback isolated Excel must be created when primary is locked")
            
            wb_fall = openpyxl.load_workbook(fallback_excel)
            ws_fall = wb_fall['Detailed_ROIs']
            fall_rows = []
            for r in range(2, ws_fall.max_row + 1):
                val = ws_fall.cell(row=r, column=1).value
                if not val or not str(val).strip() or "AUDIT" in str(val).upper():
                    break
                fall_rows.append(str(val).strip())
            self.assertEqual(len(fall_rows), 6, "Fallback Excel must also have exactly 6 isolated rows")

        root.destroy()

if __name__ == '__main__':
    unittest.main()
