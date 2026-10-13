import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.shapes import MSO_SHAPE
from pptx.dml.color import RGBColor

def create_presentation_en():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Color Palette: Pure White, Deep Charcoal, Professional Blue
    BG_WHITE = RGBColor(255, 255, 255)
    TEXT_TITLE = RGBColor(15, 23, 42)      # Deep Charcoal
    TEXT_ACCENT = RGBColor(3, 105, 161)    # Professional Blue
    TEXT_BODY = RGBColor(51, 65, 85)       # High-Contrast Slate
    TEXT_MUTED = RGBColor(100, 116, 139)   # Medium Gray
    CARD_BG = RGBColor(248, 250, 252)      # Soft Clean Off-White
    CARD_BORDER = RGBColor(203, 213, 225)  # Light Subtle Gray Border

    # Asset directories
    BRAIN_DIR = r"C:\Users\Pongo\.gemini\antigravity\brain\06bf9c7b-247d-44d0-a660-4c440fd1ce9d"
    STEP4_DIR = os.path.join(BRAIN_DIR, "step4_visuals")
    STEP5_DIR = os.path.join(BRAIN_DIR, "step5_visuals")

    IMG_FLIR_CLEAN = os.path.join(BRAIN_DIR, "flir_cleaning_comparison_3modes.png")
    IMG_GRID9X9 = os.path.join(STEP4_DIR, "step4_grid9x9_detail.png")
    IMG_SYNC = os.path.join(STEP4_DIR, "step4_dynamic_distance_sync.png")
    IMG_UPGRADE = os.path.join(STEP4_DIR, "step4_legacy_upgrade_comparison.png")

    IMG_FIG1 = os.path.join(STEP5_DIR, "step5_fig1_publication_figure.png")
    IMG_COMPASS = os.path.join(STEP5_DIR, "step5_directional_compass_heatmap.png")
    IMG_TABLE = os.path.join(STEP5_DIR, "step5_tabular_metrics_table.png")
    IMG_ZIP = os.path.join(STEP5_DIR, "step5_zip_archive_package.png")

    def set_slide_background(slide):
        bg = slide.background
        fill = bg.fill
        fill.solid()
        fill.fore_color.rgb = BG_WHITE

    def add_header(slide, step_tag, title_text, subtitle_text):
        tb = slide.shapes.add_textbox(Inches(0.8), Inches(0.5), Inches(11.733), Inches(1.2))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p1 = tf.paragraphs[0]
        if step_tag:
            r_step = p1.add_run()
            r_step.text = step_tag + "  "
            r_step.font.name = "Arial"
            r_step.font.size = Pt(14)
            r_step.font.bold = True
            r_step.font.color.rgb = TEXT_ACCENT

        r_title = p1.add_run()
        r_title.text = title_text
        r_title.font.name = "Arial"
        r_title.font.size = Pt(28)
        r_title.font.bold = True
        r_title.font.color.rgb = TEXT_TITLE

        p2 = tf.add_paragraph()
        p2.space_before = Pt(4)
        r_sub = p2.add_run()
        r_sub.text = subtitle_text
        r_sub.font.name = "Arial"
        r_sub.font.size = Pt(15)
        r_sub.font.color.rgb = TEXT_MUTED

    # ==========================================
    # SLIDE 1: TITLE SLIDE
    # ==========================================
    s1 = prs.slides.add_slide(blank_layout)
    set_slide_background(s1)

    t_box = s1.shapes.add_textbox(Inches(1.0), Inches(1.8), Inches(11.333), Inches(4.2))
    tf1 = t_box.text_frame
    tf1.word_wrap = True

    p = tf1.paragraphs[0]
    r = p.add_run()
    r.text = "ThermalSight v1.8.0"
    r.font.name = "Arial"
    r.font.size = Pt(44)
    r.font.bold = True
    r.font.color.rgb = TEXT_TITLE

    p2 = tf1.add_paragraph()
    p2.space_before = Pt(12)
    r2 = p2.add_run()
    r2.text = "Foot Thermal Image Processing & Diagnostic Workflow"
    r2.font.name = "Arial"
    r2.font.size = Pt(24)
    r2.font.bold = True
    r2.font.color.rgb = TEXT_ACCENT

    p3 = tf1.add_paragraph()
    p3.space_before = Pt(16)
    r3 = p3.add_run()
    r3.text = "A Simple & Clear Guide: From FLIR Thermal Camera Capture to Ready-to-Publish Medical Analysis"
    r3.font.name = "Arial"
    r3.font.size = Pt(16)
    r3.font.color.rgb = TEXT_BODY

    p4 = tf1.add_paragraph()
    p4.space_before = Pt(36)
    r4 = p4.add_run()
    r4.text = "Designed for high clarity, large legibility, and straightforward understanding for senior audiences, physicians, and professors."
    r4.font.name = "Arial"
    r4.font.size = Pt(13)
    r4.font.color.rgb = TEXT_MUTED

    # Common layout measurements
    col_w = Inches(3.64)
    col_gap = Inches(0.4)
    y_top = Inches(1.9)
    card_h = Inches(5.0)

    c1_left = Inches(0.8)
    c2_left = c1_left + col_w + col_gap
    c3_left = c2_left + col_w + col_gap

    # ==========================================
    # SLIDE 2: INPUT DATA
    # ==========================================
    s2 = prs.slides.add_slide(blank_layout)
    set_slide_background(s2)
    add_header(s2, "STEP 1", "Input Data: What Goes Into the System?", "The types of thermal images accepted by ThermalSight")

    # Card 1: FLIR Thermal Photos
    b1 = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, c1_left, y_top, col_w, card_h)
    b1.fill.solid()
    b1.fill.fore_color.rgb = CARD_BG
    b1.line.color.rgb = CARD_BORDER
    b1.line.width = Pt(1)
    tf = b1.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = Inches(0.3)

    p = tf.paragraphs[0]
    r = p.add_run()
    r.text = "1. FLIR Thermal Images\n"
    r.font.name = "Arial"
    r.font.size = Pt(20)
    r.font.bold = True
    r.font.color.rgb = TEXT_TITLE

    p_body = tf.add_paragraph()
    p_body.space_before = Pt(12)
    r = p_body.add_run()
    r.text = "• Uses genuine radiometric images from FLIR cameras (.jpg, .png, or .tiff).\n\n• These are not ordinary photos: every single pixel carries true, calibrated physical temperature values in degrees Celsius.\n\n• Works with handheld FLIR E-series, ONE, and clinical station cameras."
    r.font.name = "Arial"
    r.font.size = Pt(15)
    r.font.color.rgb = TEXT_BODY

    # Card 2: Flexible Ingestion Modes
    b2 = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, c2_left, y_top, col_w, card_h)
    b2.fill.solid()
    b2.fill.fore_color.rgb = CARD_BG
    b2.line.color.rgb = CARD_BORDER
    b2.line.width = Pt(1)
    tf = b2.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = Inches(0.3)

    p = tf.paragraphs[0]
    r = p.add_run()
    r.text = "2. Flexible Input Modes\n"
    r.font.name = "Arial"
    r.font.size = Pt(20)
    r.font.bold = True
    r.font.color.rgb = TEXT_TITLE

    p_body = tf.add_paragraph()
    p_body.space_before = Pt(12)
    r = p_body.add_run()
    r.text = "• Single Image Mode: Select 1 photo for immediate clinical inspection.\n\n• Sequence Folder Mode: Select an entire folder of 10–50 consecutive patient walking or cooling frames.\n\n• Or simply Drag & Drop image files directly into the software window."
    r.font.name = "Arial"
    r.font.size = Pt(15)
    r.font.color.rgb = TEXT_BODY

    # Card 3: Smart Subfolder Filter
    b3 = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, c3_left, y_top, col_w, card_h)
    b3.fill.solid()
    b3.fill.fore_color.rgb = CARD_BG
    b3.line.color.rgb = CARD_BORDER
    b3.line.width = Pt(1)
    tf = b3.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = Inches(0.3)

    p = tf.paragraphs[0]
    r = p.add_run()
    r.text = "3. Smart Root Filter\n"
    r.font.name = "Arial"
    r.font.size = Pt(20)
    r.font.bold = True
    r.font.color.rgb = TEXT_TITLE

    p_body = tf.add_paragraph()
    p_body.space_before = Pt(12)
    r = p_body.add_run()
    r.text = "• If the patient folder contains previous result subfolders (_Result or _analysis), the app automatically skips them.\n\n• Only primary patient photos in the root directory are processed, avoiding any duplicate or corrupted data."
    r.font.name = "Arial"
    r.font.size = Pt(15)
    r.font.color.rgb = TEXT_BODY

    # ==========================================
    # SLIDE 3: FLIR PROCESSING (CLEANING)
    # ==========================================
    s3 = prs.slides.add_slide(blank_layout)
    set_slide_background(s3)
    add_header(s3, "STEP 2", "FLIR Image Cleaning (Pure Radiometric Sensor)", "How the system extracts clean, natural foot images without artificial blur")

    # If comparison image exists, show Left text card + Right comparison image
    if os.path.exists(IMG_FLIR_CLEAN):
        w_left = Inches(5.6)
        b_left = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), y_top, w_left, card_h)
        b_left.fill.solid()
        b_left.fill.fore_color.rgb = CARD_BG
        b_left.line.color.rgb = CARD_BORDER
        b_left.line.width = Pt(1)
        tf = b_left.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = Inches(0.3)

        p = tf.paragraphs[0]
        r = p.add_run()
        r.text = "Why 'Pristine Mode' (Mode Mula-mula)?\n"
        r.font.name = "Arial"
        r.font.size = Pt(19)
        r.font.bold = True
        r.font.color.rgb = TEXT_TITLE

        p_body = tf.add_paragraph()
        p_body.space_before = Pt(8)
        r = p_body.add_run()
        r.text = "• FLIR cameras burn logos, temperature tags ('35°C'), and colorbars directly over the images.\n\n" \
                 "• Old Method (Inpainting/Blur): Erased stamps but blurred skin margins and distorted temperature values.\n\n" \
                 "• ThermalSight v1.8.0 Solution: Direct 16-bit radiometric byte decoding via Planck equations.\n\n" \
                 "✓ All overlays vanish naturally at the byte level.\n" \
                 "✓ Zero artificial blurring or pixel interpolation.\n" \
                 "✓ 100% true physical temperature accuracy preserved."
        r.font.name = "Arial"
        r.font.size = Pt(14)
        r.font.color.rgb = TEXT_BODY

        # Right: Image frame
        w_right = Inches(5.7)
        b_img = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.8), y_top, w_right, card_h)
        b_img.fill.solid()
        b_img.fill.fore_color.rgb = CARD_BG
        b_img.line.color.rgb = TEXT_ACCENT
        b_img.line.width = Pt(2)

        s3.shapes.add_picture(IMG_FLIR_CLEAN, Inches(6.95), y_top + Inches(0.5), Inches(5.4), Inches(4.0))

        tb_lbl = s3.shapes.add_textbox(Inches(6.95), y_top + Inches(0.12), Inches(5.4), Inches(0.35))
        p_lbl = tb_lbl.text_frame.paragraphs[0]
        r_lbl = p_lbl.add_run()
        r_lbl.text = "Visual Comparison: Mode Mula-mula vs Inpainting"
        r_lbl.font.name = "Arial"
        r_lbl.font.size = Pt(13)
        r_lbl.font.bold = True
        r_lbl.font.color.rgb = TEXT_ACCENT

    # ==========================================
    # SLIDE 4: APP WORKFLOW
    # ==========================================
    s4 = prs.slides.add_slide(blank_layout)
    set_slide_background(s4)
    add_header(s4, "STEP 3", "Application Workflow (4 Practical Stages)", "The simple step-by-step user journey from start to finish")

    step_w = Inches(2.7)
    step_gap = Inches(0.3)
    step_h = Inches(5.0)

    steps_data_en = [
        ("STAGE 1", "Upload Images", "Open 1 single photo or an entire sequence folder.\n\nThe system safely reads and validates all files with a clear progress bar."),
        ("STAGE 2", "Calibrate Scale", "Draw a line or box over a known reference ruler (e.g., 10 cm).\n\nMatches computer screen pixels exactly to real human anatomy (px to cm)."),
        ("STAGE 3", "Mark Foot Points", "Single-click on clinical landmarks (big toe, ball of foot, heel).\n\nA standardized 9×9 circle forms instantly with radial heat spread vectors."),
        ("STAGE 4", "Save & Export", "Click 'Save & Export'.\n\nThe app automatically compiles journal-quality figures, numeric CSV spreadsheets, and a ZIP archive.")
    ]

    for i, (tag, stitle, sdesc) in enumerate(steps_data_en):
        left_pos = Inches(0.8) + i * (step_w + step_gap)
        s_box = s4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left_pos, y_top, step_w, step_h)
        s_box.fill.solid()
        s_box.fill.fore_color.rgb = CARD_BG
        s_box.line.color.rgb = CARD_BORDER
        s_box.line.width = Pt(1)

        tf = s_box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = Inches(0.25)

        p = tf.paragraphs[0]
        r_tag = p.add_run()
        r_tag.text = tag + "\n"
        r_tag.font.name = "Arial"
        r_tag.font.size = Pt(12)
        r_tag.font.bold = True
        r_tag.font.color.rgb = TEXT_ACCENT

        r_title = p.add_run()
        r_title.text = stitle + "\n"
        r_title.font.name = "Arial"
        r_title.font.size = Pt(18)
        r_title.font.bold = True
        r_title.font.color.rgb = TEXT_TITLE

        p_body = tf.add_paragraph()
        p_body.space_before = Pt(8)
        r_desc = p_body.add_run()
        r_desc.text = sdesc
        r_desc.font.name = "Arial"
        r_desc.font.size = Pt(14)
        r_desc.font.color.rgb = TEXT_BODY

    # ==========================================
    # SLIDE 5: 9x9 GRID STANDARDIZATION (WITH IMAGES)
    # ==========================================
    s5 = prs.slides.add_slide(blank_layout)
    set_slide_background(s5)
    add_header(s5, "STEP 4", "9×9 Grid Standardization System", "Physical calibration, 81 sub-cell matrix, and seamless legacy session auto-upgrade")

    # Card 1: Precision 9x9 Size
    box1 = s5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, c1_left, y_top, col_w, card_h)
    box1.fill.solid()
    box1.fill.fore_color.rgb = CARD_BG
    box1.line.color.rgb = CARD_BORDER
    box1.line.width = Pt(1)

    tb1 = s5.shapes.add_textbox(c1_left + Inches(0.15), y_top + Inches(0.15), col_w - Inches(0.3), Inches(0.7))
    p1 = tb1.text_frame.paragraphs[0]
    r = p1.add_run()
    r.text = "1. Exact 9×9 Cell Dimension"
    r.font.name = "Arial"
    r.font.size = Pt(17)
    r.font.bold = True
    r.font.color.rgb = TEXT_TITLE

    if os.path.exists(IMG_GRID9X9):
        s5.shapes.add_picture(IMG_GRID9X9, c1_left + Inches(0.3), y_top + Inches(0.75), col_w - Inches(0.6), Inches(2.2))

    tb1_desc = s5.shapes.add_textbox(c1_left + Inches(0.2), y_top + Inches(3.05), col_w - Inches(0.4), Inches(1.75))
    tf1_desc = tb1_desc.text_frame
    tf1_desc.word_wrap = True
    p = tf1_desc.paragraphs[0]
    r = p.add_run()
    r.text = "• Standardizes each landmark circle to exactly 9 grid cells in diameter (radius = 4.5 cells).\n• Contains 81 subcells for micro-gradient tracking across the plantar sole."
    r.font.name = "Arial"
    r.font.size = Pt(13)
    r.font.color.rgb = TEXT_BODY

    # Card 2: Distance Adaptation
    box2 = s5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, c2_left, y_top, col_w, card_h)
    box2.fill.solid()
    box2.fill.fore_color.rgb = CARD_BG
    box2.line.color.rgb = CARD_BORDER
    box2.line.width = Pt(1)

    tb2 = s5.shapes.add_textbox(c2_left + Inches(0.15), y_top + Inches(0.15), col_w - Inches(0.3), Inches(0.7))
    p2 = tb2.text_frame.paragraphs[0]
    r = p2.add_run()
    r.text = "2. Dynamic Distance Sync"
    r.font.name = "Arial"
    r.font.size = Pt(17)
    r.font.bold = True
    r.font.color.rgb = TEXT_TITLE

    if os.path.exists(IMG_SYNC):
        s5.shapes.add_picture(IMG_SYNC, c2_left + Inches(0.2), y_top + Inches(0.85), col_w - Inches(0.4), Inches(2.0))

    tb2_desc = s5.shapes.add_textbox(c2_left + Inches(0.2), y_top + Inches(3.05), col_w - Inches(0.4), Inches(1.75))
    tf2_desc = tb2_desc.text_frame
    tf2_desc.word_wrap = True
    p = tf2_desc.paragraphs[0]
    r = p.add_run()
    r.text = "• Camera distances vary across clinical sessions (closer vs farther).\n• The software dynamically scales on-screen pixels so the physical skin footprint stays constant: exactly 1.2 cm."
    r.font.name = "Arial"
    r.font.size = Pt(13)
    r.font.color.rgb = TEXT_BODY

    # Card 3: Auto-Upgrade Legacy Data
    box3 = s5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, c3_left, y_top, col_w, card_h)
    box3.fill.solid()
    box3.fill.fore_color.rgb = CARD_BG
    box3.line.color.rgb = TEXT_ACCENT
    box3.line.width = Pt(2)

    tb3 = s5.shapes.add_textbox(c3_left + Inches(0.15), y_top + Inches(0.15), col_w - Inches(0.3), Inches(0.7))
    p3 = tb3.text_frame.paragraphs[0]
    r = p3.add_run()
    r.text = "3. Seamless Auto-Upgrade"
    r.font.name = "Arial"
    r.font.size = Pt(17)
    r.font.bold = True
    r.font.color.rgb = TEXT_ACCENT

    if os.path.exists(IMG_UPGRADE):
        s5.shapes.add_picture(IMG_UPGRADE, c3_left + Inches(0.2), y_top + Inches(0.85), col_w - Inches(0.4), Inches(2.0))

    tb3_desc = s5.shapes.add_textbox(c3_left + Inches(0.2), y_top + Inches(3.05), col_w - Inches(0.4), Inches(1.75))
    tf3_desc = tb3_desc.text_frame
    tf3_desc.word_wrap = True
    p = tf3_desc.paragraphs[0]
    r = p.add_run()
    r.text = "• When loading older sessions (v1.6 / v1.7 with 6×6 circles), the app auto-enlarges the radius to standard 9×9.\n• Center points stay locked in place: historical annotations are instantly modernized."
    r.font.name = "Arial"
    r.font.size = Pt(13)
    r.font.color.rgb = TEXT_BODY

    # ==========================================
    # SLIDE 6: STEP 5 DELIVERABLES OVERVIEW (ALL 4 WITH PICTURES)
    # ==========================================
    s6 = prs.slides.add_slide(blank_layout)
    set_slide_background(s6)
    add_header(s6, "STEP 5", "Final Deliverables & Results (Output Package)", "Comprehensive visual overview: 4 standardized publication and clinical outputs")

    grid_w = Inches(5.66)
    grid_h = Inches(2.35)
    gx1 = Inches(0.8)
    gx2 = gx1 + grid_w + Inches(0.4)
    gy1 = Inches(1.9)
    gy2 = gy1 + grid_h + Inches(0.25)

    deliverables_meta = [
        ("1. Journal Publication Figure 1", 
         "• High-contrast monochrome foot with false-color ROIs.\n• Precision hairline grids ready for journal submission.",
         IMG_FIG1, gx1, gy1),
        ("2. Directional Heat Spread (Compass)", 
         "• Samples thermal propagation in 8 compass directions.\n• Localized 9×9 vector grid reveals inflammation flow.",
         IMG_COMPASS, gx2, gy1),
        ("3. Automated Metrics (CSV / Excel)", 
         "• Min, max, mean temps per landmark with asymmetry.\n• Flags hotspots exceeding clinical ulcer risk threshold.",
         IMG_TABLE, gx1, gy2),
        ("4. 1-Click Portable Archive (ZIP)", 
         "• Bundles figures, matrices (.npy), and metadata (.json).\n• Portable package for complete research reproducibility.",
         IMG_ZIP, gx2, gy2)
    ]

    for title, desc, img_path, bx, by in deliverables_meta:
        b = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, bx, by, grid_w, grid_h)
        b.fill.solid()
        b.fill.fore_color.rgb = CARD_BG
        b.line.color.rgb = CARD_BORDER
        b.line.width = Pt(1)

        # Add image on left
        if os.path.exists(img_path):
            s6.shapes.add_picture(img_path, bx + Inches(0.18), by + Inches(0.2), Inches(2.35), Inches(1.95))

        # Add text on right
        tb = s6.shapes.add_textbox(bx + Inches(2.65), by + Inches(0.15), Inches(2.85), Inches(2.05))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0

        p = tf.paragraphs[0]
        r = p.add_run()
        r.text = title + "\n"
        r.font.name = "Arial"
        r.font.size = Pt(15)
        r.font.bold = True
        r.font.color.rgb = TEXT_ACCENT

        p_desc = tf.add_paragraph()
        p_desc.space_before = Pt(4)
        r_d = p_desc.add_run()
        r_d.text = desc
        r_d.font.name = "Arial"
        r_d.font.size = Pt(12)
        r_d.font.color.rgb = TEXT_BODY

    # ==========================================
    # SLIDE 7: DELIVERABLE 1 DEEP DIVE (FIGURE 1)
    # ==========================================
    s7 = prs.slides.add_slide(blank_layout)
    set_slide_background(s7)
    add_header(s7, "STEP 5 — DELIVERABLE 1", "Plantar Overview Figure 1 (Publication Grade)", "Bilateral comparison: Visible-light anatomy vs calibrated thermal map")

    b7_img = s7.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), y_top, Inches(6.8), card_h)
    b7_img.fill.solid()
    b7_img.fill.fore_color.rgb = CARD_BG
    b7_img.line.color.rgb = CARD_BORDER
    b7_img.line.width = Pt(1)

    if os.path.exists(IMG_FIG1):
        s7.shapes.add_picture(IMG_FIG1, Inches(0.95), y_top + Inches(0.3), Inches(6.5), Inches(4.4))

    b7_txt = s7.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(7.8), y_top, Inches(4.733), card_h)
    b7_txt.fill.solid()
    b7_txt.fill.fore_color.rgb = CARD_BG
    b7_txt.line.color.rgb = CARD_BORDER
    b7_txt.line.width = Pt(1)

    tf7 = b7_txt.text_frame
    tf7.word_wrap = True
    tf7.margin_left = tf7.margin_right = tf7.margin_top = tf7.margin_bottom = Inches(0.35)

    p = tf7.paragraphs[0]
    r = p.add_run()
    r.text = "Key Scientific Features\n"
    r.font.name = "Arial"
    r.font.size = Pt(20)
    r.font.bold = True
    r.font.color.rgb = TEXT_TITLE

    p_body = tf7.add_paragraph()
    p_body.space_before = Pt(12)
    r = p_body.add_run()
    r.text = "• Panel A (PPP): Visible grayscale foot contour with locked aspect ratio and millimeter scale bar.\n\n" \
             "• Panel B (Thermal): Calibrated temperature map with 9×9 ROI circles rendered in high-contrast Ironbow palette.\n\n" \
             "• Dynamic Colorbar: Embedded temperature scale (°C) with calibrated min/max limits.\n\n" \
             "• Journal Compliance: Exported at 300 DPI, ready for direct submission to medical journals (IEEE, Elsevier, Springer)."
    r.font.name = "Arial"
    r.font.size = Pt(14)
    r.font.color.rgb = TEXT_BODY

    # ==========================================
    # SLIDE 8: DELIVERABLE 2 DEEP DIVE (COMPASS)
    # ==========================================
    s8 = prs.slides.add_slide(blank_layout)
    set_slide_background(s8)
    add_header(s8, "STEP 5 — DELIVERABLE 2", "8-Directional Heat Spread Maps (Compass)", "Quantifying radial heat propagation vectors across plantar tissue")

    b8_img = s8.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), y_top, Inches(7.2), card_h)
    b8_img.fill.solid()
    b8_img.fill.fore_color.rgb = CARD_BG
    b8_img.line.color.rgb = CARD_BORDER
    b8_img.line.width = Pt(1)

    if os.path.exists(IMG_COMPASS):
        s8.shapes.add_picture(IMG_COMPASS, Inches(0.95), y_top + Inches(0.4), Inches(6.9), Inches(4.2))

    b8_txt = s8.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(8.2), y_top, Inches(4.333), card_h)
    b8_txt.fill.solid()
    b8_txt.fill.fore_color.rgb = CARD_BG
    b8_txt.line.color.rgb = CARD_BORDER
    b8_txt.line.width = Pt(1)

    tf8 = b8_txt.text_frame
    tf8.word_wrap = True
    tf8.margin_left = tf8.margin_right = tf8.margin_top = tf8.margin_bottom = Inches(0.35)

    p = tf8.paragraphs[0]
    r = p.add_run()
    r.text = "Directional Inflammation Analysis\n"
    r.font.name = "Arial"
    r.font.size = Pt(20)
    r.font.bold = True
    r.font.color.rgb = TEXT_TITLE

    p_body = tf8.add_paragraph()
    p_body.space_before = Pt(12)
    r = p_body.add_run()
    r.text = "• 8 Compass Vectors: Evaluates temperature flow in cardinal directions (N, NE, E, SE, S, SW, W, NW).\n\n" \
             "• Gradient Magnitudes: Detects whether heat is escaping toward the toes or radiating into the midfoot arch.\n\n" \
             "• Early Ulcer Warning: Identifies asymmetric heat plumes before physical skin breakdown occurs.\n\n" \
             "• Polar Radar Rose: Provides an intuitive visual summary for rapid clinical consultation."
    r.font.name = "Arial"
    r.font.size = Pt(14)
    r.font.color.rgb = TEXT_BODY

    # ==========================================
    # SLIDE 9: DELIVERABLE 3 DEEP DIVE (METRICS TABLE)
    # ==========================================
    s9 = prs.slides.add_slide(blank_layout)
    set_slide_background(s9)
    add_header(s9, "STEP 5 — DELIVERABLE 3", "Automated Tabular Metrics (CSV / Excel)", "Numeric temperature statistics and bilateral asymmetry screening")

    b9_img = s9.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), y_top, Inches(7.2), card_h)
    b9_img.fill.solid()
    b9_img.fill.fore_color.rgb = CARD_BG
    b9_img.line.color.rgb = CARD_BORDER
    b9_img.line.width = Pt(1)

    if os.path.exists(IMG_TABLE):
        s9.shapes.add_picture(IMG_TABLE, Inches(0.95), y_top + Inches(0.4), Inches(6.9), Inches(4.2))

    b9_txt = s9.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(8.2), y_top, Inches(4.333), card_h)
    b9_txt.fill.solid()
    b9_txt.fill.fore_color.rgb = CARD_BG
    b9_txt.line.color.rgb = CARD_BORDER
    b9_txt.line.width = Pt(1)

    tf9 = b9_txt.text_frame
    tf9.word_wrap = True
    tf9.margin_left = tf9.margin_right = tf9.margin_top = tf9.margin_bottom = Inches(0.35)

    p = tf9.paragraphs[0]
    r = p.add_run()
    r.text = "Clinical Screening Rules\n"
    r.font.name = "Arial"
    r.font.size = Pt(20)
    r.font.bold = True
    r.font.color.rgb = TEXT_TITLE

    p_body = tf9.add_paragraph()
    p_body.space_before = Pt(12)
    r = p_body.add_run()
    r.text = "• Bilateral Comparison: Calculates Delta-T (|Left - Right|) for corresponding foot landmarks.\n\n" \
             "• International Rule: Temperature asymmetry > 2.2 °C indicates high risk of acute inflammation or impending ulceration.\n\n" \
             "• Automated Flagging: Highlights high-risk zones in red for immediate clinical attention.\n\n" \
             "• Audit Trail: Exports pixel-to-cm calibration metrics alongside temperature statistics."
    r.font.name = "Arial"
    r.font.size = Pt(14)
    r.font.color.rgb = TEXT_BODY

    # ==========================================
    # SLIDE 10: DELIVERABLE 4 DEEP DIVE (PORTABLE ARCHIVE)
    # ==========================================
    s10 = prs.slides.add_slide(blank_layout)
    set_slide_background(s10)
    add_header(s10, "STEP 5 — DELIVERABLE 4", "1-Click Portable Archive (Structured ZIP & JSON)", "Complete research package: Figures, spreadsheets, and reproducible raw data")

    b10_img = s10.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), y_top, Inches(7.2), card_h)
    b10_img.fill.solid()
    b10_img.fill.fore_color.rgb = CARD_BG
    b10_img.line.color.rgb = CARD_BORDER
    b10_img.line.width = Pt(1)

    if os.path.exists(IMG_ZIP):
        s10.shapes.add_picture(IMG_ZIP, Inches(0.95), y_top + Inches(0.4), Inches(6.9), Inches(4.2))

    b10_txt = s10.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(8.2), y_top, Inches(4.333), card_h)
    b10_txt.fill.solid()
    b10_txt.fill.fore_color.rgb = CARD_BG
    b10_txt.line.color.rgb = CARD_BORDER
    b10_txt.line.width = Pt(1)

    tf10 = b10_txt.text_frame
    tf10.word_wrap = True
    tf10.margin_left = tf10.margin_right = tf10.margin_top = tf10.margin_bottom = Inches(0.35)

    p = tf10.paragraphs[0]
    r = p.add_run()
    r.text = "Complete Data Reproducibility\n"
    r.font.name = "Arial"
    r.font.size = Pt(20)
    r.font.bold = True
    r.font.color.rgb = TEXT_TITLE

    p_body = tf10.add_paragraph()
    p_body.space_before = Pt(12)
    r = p_body.add_run()
    r.text = "• Self-Contained Package: Everything needed for audits, presentations, and peer-reviewed journals in 1 archive.\n\n" \
             "• Raw Arrays (.npy): Preserves original 16-bit thermal matrices for secondary algorithm verification.\n\n" \
             "• JSON Session Backup: Allows reopening the session in ThermalSight anytime without re-annotating.\n\n" \
             "• Medical Record Friendly: Easy to attach to hospital Electronic Health Records (EHR)."
    r.font.name = "Arial"
    r.font.size = Pt(14)
    r.font.color.rgb = TEXT_BODY

    # Save with version suffix to avoid lock if user has original file open in PowerPoint
    out_path_work_v2 = r"D:\~Ideas n Innovation\~~Taiwan\AU\Aditya Thermal\ThermalSight-App-1.1.0\ThermalSight_v180_Workflow_Guide_EN_v2.pptx"
    out_path_git_v2 = r"C:\Users\Pongo\OneDrive\Documents\GitHub\ThermalSight-App\ThermalSight_v180_Workflow_Guide_EN_v2.pptx"
    
    prs.save(out_path_work_v2)
    print(f"Saved English PPTX to {out_path_work_v2}")
    prs.save(out_path_git_v2)
    print(f"Saved English PPTX to {out_path_git_v2}")

    # Attempt to overwrite primary file if not currently locked by PowerPoint
    try:
        out_path_work = r"D:\~Ideas n Innovation\~~Taiwan\AU\Aditya Thermal\ThermalSight-App-1.1.0\ThermalSight_v180_Workflow_Guide_EN.pptx"
        prs.save(out_path_work)
        print(f"Saved English PPTX to {out_path_work}")
    except PermissionError:
        print(f"Notice: Primary file is currently open in PowerPoint. Saved updated deck as v2 instead.")

    try:
        out_path_git = r"C:\Users\Pongo\OneDrive\Documents\GitHub\ThermalSight-App\ThermalSight_v180_Workflow_Guide_EN.pptx"
        prs.save(out_path_git)
        print(f"Saved English PPTX to {out_path_git}")
    except PermissionError:
        print(f"Notice: Primary git file is currently open. Saved updated deck as v2 instead.")

if __name__ == '__main__':
    create_presentation_en()
