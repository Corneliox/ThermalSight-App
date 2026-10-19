#!/usr/bin/env python3
"""
Enhanced Academic Flowchart Generator (4-Stage Comprehensive Clinical Pipeline)
ThermalSight Plantar Thermobiomechanics Framework (PPP, PPG, PGA, DFU Prevention)

Menghasilkan diagram alir formal multi-tahap (4 Tahap, 13 Kotak Komprehensif)
dengan banner vertikal kiri berjenjang rapi, palet warna pastel jurnal medis,
dan panah blok vektor datar untuk publikasi IEEE / Elsevier / Springer.

Output:
- fig1_thermalsight_detailed_workflow.png (300 DPI High-Res)
- fig1_thermalsight_detailed_workflow.svg (Scalable Vector untuk Inkscape/Figma/Word)
- fig1_thermalsight_detailed_workflow.pdf (Camera-Ready Vector PDF)
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Tuple
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches


# ==============================================================================
# 1. KONFIGURASI PARAMETER VISUAL & GEOMETRI
# ==============================================================================
CONFIG = {
    # Kanvas & Resolusi
    "fig_width": 17.5,          # Lebar gambar (inci)
    "fig_height": 14.2,         # Tinggi gambar (inci)
    "dpi": 300,                 # Resolusi cetak 300 DPI
    "coord_width": 1450.0,      # Sistem koordinat internal X (0..1450)
    "coord_height": 1200.0,     # Sistem koordinat internal Y (0..1200, 0 di atas)

    # Nama File Output
    "output_png": "fig1_thermalsight_detailed_workflow.png",
    "output_svg": "fig1_thermalsight_detailed_workflow.svg",
    "output_pdf": "fig1_thermalsight_detailed_workflow.pdf",

    # Palet Warna 4 Tahap
    "bg_color": "#FFFFFF",
    "stage1_banner_fill": "#F8CECC",   # Pastel Peach (Tahap 1: Ingestion & Preprocessing)
    "stage2_banner_fill": "#BDD7EE",   # Pastel Sky Blue (Tahap 2: Segmentation & Landmarks)
    "stage3_banner_fill": "#C5E0B4",   # Pastel Sage Green (Tahap 3: Triad PPP/PPG/PGA)
    "stage4_banner_fill": "#E1D5E7",   # Pastel Soft Lavender (Tahap 4: Synthesis & Policy)
    "banner_text_color": "#0F172A",    # Slate Dark Text

    "stage1_box_fill": "#FFF2CC",      # Warm Cream
    "stage2_box_fill": "#EDF4FA",      # Cool Ice Blue
    "stage3_box_fill": "#E2F0D9",      # Soft Mint / Sage Green
    "stage4_box_fill": "#F5EEF8",      # Soft Lavender Tint
    "final_box_fill": "#FFE699",       # Warm Gold (Output Keputusan Klinis DFU)

    "box_border_color": "#CBD5E1",     # Slate Light Border
    "box_border_width": 0.8,
    "arrow_fill": "#93C5FD",           # Soft Sky Blue (Panah Blok)
    "divider_color": "#94A3B8",        # Slate Muted Divider

    # Tipografi & Ukuran Font
    "font_family": "DejaVu Sans",
    "fig_label_text": "Fig. 1. End-to-End Clinical Thermobiomechanics & DFU Screening Workflow (ThermalSight Framework)",
    "fig_label_size": 17.0,
    "banner_font_size": 9.2,
    "box_title_size": 10.6,
    "box_body_size": 9.0,
    "title_color": "#0F172A",
    "body_color": "#1E293B",
    "line_spacing_px": 19.5,

    # Ketebalan & Pola Garis Pemisah
    "divider_linewidth": 1.8,
    "divider_dash": (7, 4),
    "arrow_shaft_width": 12.0,
    "arrow_head_width": 26.0,
    "arrow_head_length": 18.0,
}


# ==============================================================================
# 2. STRUKTUR DATA
# ==============================================================================
@dataclass
class StageBanner:
    x: float
    y: float
    w: float
    h: float
    fill_color: str
    lines: List[str]
    text_color: str = CONFIG["banner_text_color"]
    font_size: float = CONFIG["banner_font_size"]


@dataclass
class DiagramBox:
    box_id: str
    x: float
    y: float
    w: float
    h: float
    fill_color: str
    title_lines: List[str]
    body_lines: List[str] = field(default_factory=list)
    title_size: float = CONFIG["box_title_size"]
    body_size: float = CONFIG["box_body_size"]


@dataclass
class BlockArrow:
    x1: float
    y1: float
    x2: float
    y2: float
    shaft_width: float = CONFIG["arrow_shaft_width"]
    head_width: float = CONFIG["arrow_head_width"]
    head_length: float = CONFIG["arrow_head_length"]
    color: str = CONFIG["arrow_fill"]


# ==============================================================================
# 3. DEFINISI 4 TAHAP (STAGE BANNERS & 13 BOXES)
# ==============================================================================
BANNERS: List[StageBanner] = [
    StageBanner(
        x=38, y=78, w=80, h=184,
        fill_color=CONFIG["stage1_banner_fill"],
        lines=[
            "Stage 1: Radiometric",
            "Ingestion, Fallback Scaling",
            "& Float32 Inpainting",
        ],
    ),
    StageBanner(
        x=38, y=294, w=80, h=184,
        fill_color=CONFIG["stage2_banner_fill"],
        lines=[
            "Stage 2: Footprint",
            "Morphology Masking &",
            "ROI Registration",
        ],
    ),
    StageBanner(
        x=38, y=510, w=80, h=184,
        fill_color=CONFIG["stage3_banner_fill"],
        lines=[
            "Stage 3: Triad Biomechanics",
            "Extraction (PPP Perfusion,",
            "PPG Slope & PGA Vector)",
        ],
    ),
    StageBanner(
        x=38, y=726, w=80, h=410,
        fill_color=CONFIG["stage4_banner_fill"],
        lines=[
            "Stage 4: Multi-Modal Topography, Automated Audit Trail",
            "& Clinical Diagnostic Decision Support (Phases 4–5)",
        ],
    ),
]

BOXES: List[DiagramBox] = [
    # --------------------------------------------------------------------------
    # STAGE 1: INGESTION, CALIBRATION & INPAINTING (Row 1: Left -> Center -> Right)
    # --------------------------------------------------------------------------
    DiagramBox(
        box_id="box_1a_ingestion",
        x=148, y=78, w=392, h=184,
        fill_color=CONFIG["stage1_box_fill"],
        title_lines=[
            "Phase 1A: Raw FLIR Ingestion",
            "& Radiometric Matrix Extraction",
        ],
        body_lines=[
            "• Direct extraction of calibrated °C via flyr FLIR unpack",
            "• True physiological temperature matrix [20.0°C–42.0°C]",
            "• Automated parsing of sensor metadata & focal parameters",
            "• High-throughput batch directory queue ingestion",
        ],
    ),
    DiagramBox(
        box_id="box_1b_fallback",
        x=580, y=78, w=392, h=184,
        fill_color=CONFIG["stage1_box_fill"],
        title_lines=[
            "Phase 1B: Adaptive Fallback Scaling",
            "& Anomaly Elimination (>100°C)",
        ],
        body_lines=[
            "• Adaptive 8-bit luminance-to-Celsius physiological mapping",
            "• Permanent prevention of raw 0–255 pixel reporting as °C",
            "• Active Python venv resolver ensuring flyr library presence",
            "• Sanitized baseline safeguarding downstream gradient metrics",
        ],
    ),
    DiagramBox(
        box_id="box_1c_inpainting",
        x=1012, y=78, w=392, h=184,
        fill_color=CONFIG["stage1_box_fill"],
        title_lines=[
            "Phase 1C: OSD Accessory Inpainting",
            "& Sub-Degree Float32 Precision",
        ],
        body_lines=[
            "• Bounding-box masking of camera crosshairs & battery OSD",
            "• Telea inpainting maintaining strict float32 decimal precision",
            "• Tissue hotspot protection (lum > 240) preventing dark holes",
            "• Clean plantar background without sub-degree quantization loss",
        ],
    ),

    # --------------------------------------------------------------------------
    # STAGE 2: SEGMENTATION & LANDMARK REGISTRATION (Row 2: Right -> Center -> Left)
    # --------------------------------------------------------------------------
    DiagramBox(
        box_id="box_2a_landmarks",
        x=148, y=294, w=392, h=184,
        fill_color=CONFIG["stage2_box_fill"],
        title_lines=[
            "Phase 2C: Standardized Clinical ROI",
            "Registration & Spatial Calibration",
        ],
        body_lines=[
            "• Landmark mapping: Hallux (T1), Metatarsals (M1–M3), Heel",
            "• 36-point boundary vertices for smooth polygonal contours",
            "• Physical distance calibration via spatial scaling (px/cm)",
            "• Session persistence via annotations_session.json",
        ],
    ),
    DiagramBox(
        box_id="box_2b_mask_dense",
        x=580, y=294, w=392, h=184,
        fill_color=CONFIG["stage2_box_fill"],
        title_lines=[
            "Phase 2B: Strict Binary Footprint Mask",
            "& Cold Edge Exclusion (mask_dense)",
        ],
        body_lines=[
            "• Strict binary footprint segmentation isolating skin tissue",
            "• Boundary masking preventing cold background leakage",
            "• Elimination of false cliff gradients on peripheral toe edges",
            "• Normalized 0.5-cell offset indexing for matrix slicing",
        ],
    ),
    DiagramBox(
        box_id="box_2c_morphology",
        x=1012, y=294, w=392, h=184,
        fill_color=CONFIG["stage2_box_fill"],
        title_lines=[
            "Phase 2A: Automated 31.0°C Cutoff",
            "& Morphological Boundary Smoothing",
        ],
        body_lines=[
            "• Automated 31.0°C thresholding separating ambient floor",
            "• Morphological structuring kernel (7x7) closing pore gaps",
            "• Dual-foot lateral distinction (Right Foot vs. Left Foot)",
            "• Continuous thermal topography ready for gradient sampling",
        ],
    ),

    # --------------------------------------------------------------------------
    # STAGE 3: QUANTITATIVE TRIAD BIOMECHANICS (Row 3: Left -> Center -> Right)
    # --------------------------------------------------------------------------
    DiagramBox(
        box_id="box_3a_ppp",
        x=148, y=510, w=392, h=184,
        fill_color=CONFIG["stage3_box_fill"],
        title_lines=[
            "Phase 3A: PPP (Plantar Peak Perfusion)",
            "& Masked 9x9 Patch Extraction",
        ],
        body_lines=[
            "• Localized absolute perfusion metrics: T_peak, T_mean, T_min, std",
            "• 9x9 ROI patch sampling strictly bounded by mask_dense",
            "• T1 toe min temperature stabilization (34.1°C vs. former 40.5°C)",
            "• Standard deviation normalization capturing focal tissue state",
        ],
    ),
    DiagramBox(
        box_id="box_3b_ppg",
        x=580, y=510, w=392, h=184,
        fill_color=CONFIG["stage3_box_fill"],
        title_lines=[
            "Phase 3B: PPG (Plantar Thermal Gradient)",
            "& 2D Sobel Boundary Steepness",
        ],
        body_lines=[
            "• Spatial thermal slope ||∇T|| = sqrt(Gx² + Gy²) via Sobel kernels",
            "• Distinction between diffuse physiological heat vs. sharp margins",
            "• Peak gradient (PPG_Peak) identifying acute inflammation summits",
            "• Normalized spatial calibration producing accurate °C/cm gradients",
        ],
    ),
    DiagramBox(
        box_id="box_3c_pga",
        x=1012, y=510, w=392, h=184,
        fill_color=CONFIG["stage3_box_fill"],
        title_lines=[
            "Phase 3C: PGA (Gradient Angle)",
            "& Circular Vector Coherence (0–100%)",
        ],
        body_lines=[
            "• Heat dissipation vector θ = arctan2(-Gy, Gx) mod 360°",
            "• Corrected compass: 90° = North (Toes), 270° = South (Heel)",
            "• Circular vector coherence quantifying directional uniformity",
            "• Magnitude-weighted vector averaging preventing 180° flip errors",
        ],
    ),

    # --------------------------------------------------------------------------
    # STAGE 4: VISUALIZATION, AUDIT, TRIAGE & CLINICAL DECISION (Row 4 & Row 5)
    # --------------------------------------------------------------------------
    DiagramBox(
        box_id="box_4a_topography",
        x=148, y=726, w=392, h=184,
        fill_color=CONFIG["stage4_box_fill"],
        title_lines=[
            "Phase 4A: Multi-Modal Topographic",
            "Visualization Suite (Fig. 1 A/B)",
        ],
        body_lines=[
            "• 2D Quiver Vector Field mapping heat dissemination trajectories",
            "• 3D Thermal Elevation Surface meshes highlighting hyperemic peaks",
            "• 8-Point Star Radar charts assessing directional steepness (N, NE...)",
            "• High-resolution vector outputs (PNG/SVG/PDF) at 300 DPI",
        ],
    ),
    DiagramBox(
        box_id="box_4b_audit",
        x=580, y=726, w=392, h=184,
        fill_color=CONFIG["stage4_box_fill"],
        title_lines=[
            "Phase 4B: Automated Audit Trail",
            "& Statistical Workbook Synthesis",
        ],
        body_lines=[
            "• Multi-sheet Excel workbook with live formulas (=AVERAGE, =MAX)",
            "• Transparent methodology guide sheet for reproducible peer review",
            "• Comprehensive cohort aggregation (Detailed Long & Wide CSVs)",
            "• Headless CLI non-blocking batch execution for automated labs",
        ],
    ),
    DiagramBox(
        box_id="box_4c_triage",
        x=1012, y=726, w=392, h=184,
        fill_color=CONFIG["stage4_box_fill"],
        title_lines=[
            "Phase 4C: Bilateral Contralateral",
            "Asymmetry Screening (ΔT > 2.2°C)",
        ],
        body_lines=[
            "• Contralateral temperature difference screening (ΔT > 2.2°C threshold)",
            "• Differentiation between osteomyelitis/Charcot foot vs. baseline heat",
            "• Identification of sub-clinical tissue stress prior to visible skin breakdown",
            "• Integrated longitudinal risk score for vascular complication tracking",
        ],
    ),

    # FINAL WIDE GOLD BOX (Phase 5: Outcome & Policy)
    DiagramBox(
        box_id="box_5_clinical_outcome",
        x=148, y=962, w=1256, h=148,
        fill_color=CONFIG["final_box_fill"],
        title_lines=[
            "Phase 5: Proactive Clinical Decision Support, Targeted Footwear Offloading & DFU Prevention Policy",
        ],
        body_lines=[
            "• Clinical Decision Support System (CDSS) providing objective thermobiomechanical evidence for multi-disciplinary diabetic foot clinics",
            "• Quantitative biomechanical hotspot mapping directly informing customized orthotic insole fabrication and targeted pressure offloading",
            "• Early-stage pre-ulcerative intervention protocol significantly reducing incidence of Diabetic Foot Ulcers (DFU) and lower-extremity amputations",
            "• Scalable tele-thermology telemedicine architecture enabling continuous remote foot temperature monitoring across home and community clinics",
        ],
        title_size=11.4,
        body_size=9.5,
    ),
]

# ==============================================================================
# PANAH BLOK PENGHUBUNG (FLOW ARROWS)
# ==============================================================================
STRAIGHT_ARROWS: List[BlockArrow] = [
    # Row 1 (Stage 1: L -> C -> R)
    BlockArrow(x1=540, y1=170, x2=580, y2=170),
    BlockArrow(x1=972, y1=170, x2=1012, y2=170),

    # Transition Stage 1 -> Stage 2 (Drop vertically on right side, crossing Divider 1)
    BlockArrow(x1=1208, y1=262, x2=1208, y2=292),

    # Row 2 (Stage 2: R -> C -> L)
    BlockArrow(x1=1012, y1=386, x2=972, y2=386),
    BlockArrow(x1=580, y1=386, x2=540, y2=386),

    # Transition Stage 2 -> Stage 3 (Drop vertically on left side, crossing Divider 2)
    BlockArrow(x1=344, y1=478, x2=344, y2=508),

    # Row 3 (Stage 3: L -> C -> R)
    BlockArrow(x1=540, y1=602, x2=580, y2=602),
    BlockArrow(x1=972, y1=602, x2=1012, y2=602),

    # Transition Stage 3 -> Stage 4 (Parallel downward branches into Row 4 across Divider 3)
    BlockArrow(x1=344, y1=694, x2=344, y2=724),
    BlockArrow(x1=776, y1=694, x2=776, y2=724),
    BlockArrow(x1=1208, y1=694, x2=1208, y2=724),

    # Row 4 -> Final Gold Box (3 Downward Arrows converging into Box 5)
    BlockArrow(x1=344, y1=910, x2=344, y2=960),
    BlockArrow(x1=776, y1=910, x2=776, y2=960),
    BlockArrow(x1=1208, y1=910, x2=1208, y2=960),
]


# ==============================================================================
# FUNGSI RENDERING MATPLOTLIB
# ==============================================================================
def to_mpl_y(y_top: float, H: float = CONFIG["coord_height"]) -> float:
    return H - y_top


def draw_block_arrow(ax: plt.Axes, arrow: BlockArrow, H: float) -> None:
    import math
    x1, y1 = arrow.x1, to_mpl_y(arrow.y1, H)
    x2, y2 = arrow.x2, to_mpl_y(arrow.y2, H)

    dx = x2 - x1
    dy = y2 - y1
    length = math.hypot(dx, dy)
    if length < 1e-3:
        return

    ux, uy = dx / length, dy / length
    px, py = -uy, ux

    hl = min(arrow.head_length, length * 0.55)
    hw = arrow.head_width / 2.0
    sw = arrow.shaft_width / 2.0

    bx = x2 - ux * hl
    by = y2 - uy * hl

    verts = [
        (x1 + px * sw, y1 + py * sw),
        (bx + px * sw, by + py * sw),
        (bx + px * hw, by + py * hw),
        (x2, y2),
        (bx - px * hw, by - py * hw),
        (bx - px * sw, by - py * sw),
        (x1 - px * sw, y1 - py * sw),
    ]
    poly = mpatches.Polygon(verts, closed=True, facecolor=arrow.color, edgecolor="none", zorder=3)
    ax.add_patch(poly)


def generate_detailed_diagram(out_dir: Optional[Path] = None) -> Tuple[Path, Path, Path]:
    W = CONFIG["coord_width"]
    H = CONFIG["coord_height"]

    fig, ax = plt.subplots(figsize=(CONFIG["fig_width"], CONFIG["fig_height"]), dpi=CONFIG["dpi"])
    fig.patch.set_facecolor(CONFIG["bg_color"])
    ax.set_facecolor(CONFIG["bg_color"])
    ax.set_xlim(0, W)
    ax.set_ylim(0, H)
    ax.set_aspect("equal")
    ax.axis("off")

    # 1. Judul Utama Gambar
    ax.text(
        38, to_mpl_y(38, H),
        CONFIG["fig_label_text"],
        fontsize=CONFIG["fig_label_size"],
        fontweight="bold",
        fontfamily=CONFIG["font_family"],
        color=CONFIG["title_color"],
        ha="left", va="center", zorder=5
    )

    # 2. Render 4 Banner Vertikal Kiri
    for banner in BANNERS:
        rect = mpatches.Rectangle(
            (banner.x, to_mpl_y(banner.y + banner.h, H)),
            banner.w, banner.h,
            facecolor=banner.fill_color,
            edgecolor="none",
            zorder=2
        )
        ax.add_patch(rect)

        cx = banner.x + banner.w / 2.0
        cy = to_mpl_y(banner.y + banner.h / 2.0, H)
        combined_text = "\n".join(banner.lines)
        ax.text(
            cx, cy,
            combined_text,
            fontsize=banner.font_size,
            fontweight="bold",
            fontfamily=CONFIG["font_family"],
            color=banner.text_color,
            rotation=90,
            ha="center", va="center",
            linespacing=1.24,
            zorder=5
        )

    # 3. Render 13 Kotak Proses
    for box in BOXES:
        clean_body = box.body_lines

        rect = mpatches.Rectangle(
            (box.x, to_mpl_y(box.y + box.h, H)),
            box.w, box.h,
            facecolor=box.fill_color,
            edgecolor=CONFIG["box_border_color"],
            linewidth=CONFIG["box_border_width"],
            zorder=2
        )
        ax.add_patch(rect)

        cx = box.x + box.w / 2.0
        total_lines = len(box.title_lines) + len(clean_body)
        step = CONFIG["line_spacing_px"]
        total_text_h = (total_lines - 1) * step
        start_y_top = box.y + (box.h - total_text_h) / 2.0

        current_line_idx = 0
        for t_line in box.title_lines:
            ly = to_mpl_y(start_y_top + current_line_idx * step, H)
            ax.text(
                cx, ly, t_line,
                fontsize=box.title_size,
                fontweight="bold",
                fontfamily=CONFIG["font_family"],
                color=CONFIG["title_color"],
                ha="center", va="center", zorder=5
            )
            current_line_idx += 1

        for b_line in clean_body:
            ly = to_mpl_y(start_y_top + current_line_idx * step, H)
            ax.text(
                cx, ly, b_line,
                fontsize=box.body_size,
                fontweight="normal",
                fontfamily=CONFIG["font_family"],
                color=CONFIG["body_color"],
                ha="center", va="center", zorder=5
            )
            current_line_idx += 1

    # 4. Render Garis Putus-Putus Pemisah 3 Tahap
    dividers_y = [278.0, 494.0, 710.0]
    for dy_top in dividers_y:
        div_y = to_mpl_y(dy_top, H)
        ax.plot(
            [38.0, 1410.0],
            [div_y, div_y],
            color=CONFIG["divider_color"],
            linewidth=CONFIG["divider_linewidth"],
            linestyle=(0, CONFIG["divider_dash"]),
            zorder=2
        )

    # 5. Render Panah Penghubung
    for arrow in STRAIGHT_ARROWS:
        draw_block_arrow(ax, arrow, H)

    plt.tight_layout(pad=0.2)

    if out_dir is None:
        out_dir = Path(__file__).resolve().parent
    out_dir.mkdir(parents=True, exist_ok=True)

    png_path = out_dir / CONFIG["output_png"]
    svg_path = out_dir / CONFIG["output_svg"]
    pdf_path = out_dir / CONFIG["output_pdf"]

    fig.savefig(png_path, dpi=CONFIG["dpi"], bbox_inches="tight", facecolor=CONFIG["bg_color"])
    fig.savefig(svg_path, bbox_inches="tight", facecolor=CONFIG["bg_color"])
    fig.savefig(pdf_path, bbox_inches="tight", facecolor=CONFIG["bg_color"])
    plt.close(fig)

    return png_path, svg_path, pdf_path


if __name__ == "__main__":
    p_png, p_svg, p_pdf = generate_detailed_diagram()
    print(f"[SUCCESS] PNG saved to: {p_png}")
    print(f"[SUCCESS] SVG saved to: {p_svg}")
    print(f"[SUCCESS] PDF saved to: {p_pdf}")
