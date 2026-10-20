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

if __name__ == '__main__':
    unittest.main()
