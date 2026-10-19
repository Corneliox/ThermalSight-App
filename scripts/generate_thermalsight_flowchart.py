#!/usr/bin/env python3
"""
Generator Diagram Alir Akademik Formal (Gaya Fig. 11.6 & Standard Publikasi IEEE/Elsevier)
Studi Kasus: ThermalSight Plantar Thermobiomechanics Framework (PPP, PPG, PGA)

Menghasilkan diagram alir formal multi-tahap dengan banner vertikal, kotak proses,
dan panah blok vektor berkualitas tinggi untuk publikasi jurnal.
Output: PNG (300 DPI), SVG (Vektor untuk Inkscape/Figma/Word), dan PDF (Vektor).
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Tuple
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.path import Path as MplPath


# ==============================================================================
# 1. KONFIGURASI PARAMETER VISUAL (ADJUSTABLE CONFIGURATION)
# ==============================================================================
CONFIG = {
    # Ukuran Kanvas & Resolusi Output
    "fig_width": 16.5,          # Lebar gambar (inci)
    "fig_height": 11.6,         # Tinggi gambar (inci)
    "dpi": 300,                 # Resolusi cetak 300 DPI
    "coord_width": 1340.0,      # Sistem koordinat internal X (0..1340)
    "coord_height": 930.0,      # Sistem koordinat internal Y (0..930, 0 di atas)

    # Lokasi File Output
    "output_png": "fig1_thermalsight_workflow.png",
    "output_svg": "fig1_thermalsight_workflow.svg",
    "output_pdf": "fig1_thermalsight_workflow.pdf",

    # Palet Warna Formal Akademik
    "bg_color": "#FFFFFF",
    "stage1_banner_fill": "#F8CECC",   # Pastel Peach (Banner Kiri Tahap 1)
    "stage2_banner_fill": "#C5E0B4",   # Pastel Green (Banner Kiri Tahap 2)
    "banner_text_color": "#8B1E13",    # Merah Marun Akademik
    "stage1_box_fill": "#FFF2CC",      # Warm Cream (Kotak Tahap 1)
    "stage2_box_fill": "#E2F0D9",      # Soft Sage Green (Kotak Tahap 2)
    "final_box_fill": "#FFE699",       # Warm Gold (Kotak Output Klinis Akhir)
    "box_border_color": "#D5D8DC",     # Subtle Border
    "box_border_width": 0.8,
    "arrow_fill": "#9DC3E6",           # Soft Steel Blue (Panah Blok)
    "divider_color": "#7F6000",        # Olive Brown (Garis Putus-Putus)

    # Tipografi & Ukuran Font
    "font_family": "DejaVu Sans",
    "fig_label_text": "Fig. 1. ThermalSight Clinical Thermobiomechanics & DFU Screening Workflow",
    "fig_label_size": 17,
    "banner_font_size": 11.0,
    "box_title_size": 11.2,
    "box_body_size": 9.6,
    "title_color": "#0F172A",
    "body_color": "#1E293B",
    "line_spacing_px": 21.0,

    # Geometri Garis Pemisah & Panah
    "divider_y": 472.0,                # Posisi Y pemisah tahap
    "divider_x_start": 40.0,
    "divider_x_end": 1300.0,
    "divider_linewidth": 2.2,
    "divider_dash": (8, 5),
    "arrow_shaft_width": 13.0,
    "arrow_head_width": 27.0,
    "arrow_head_length": 19.0,
}


# ==============================================================================
# 2. STRUKTUR DATA KOMPONEN
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
# 3. DEFINISI KONTEN & POSISI (DUAL-STAGE MODULAR ARCHITECTURE)
# ==============================================================================
BANNERS: List[StageBanner] = [
    StageBanner(
        x=40, y=70, w=74, h=372,
        fill_color=CONFIG["stage1_banner_fill"],
        lines=[
            "Stage 1: Radiometric Ingestion, Inpainting Artifact",
            "Removal & Plantar Anatomical Segmentation (Phases 1–3)",
        ],
    ),
    StageBanner(
        x=40, y=508, w=74, h=382,
        fill_color=CONFIG["stage2_banner_fill"],
        lines=[
            "Stage 2: Quantitative Triad Evaluation (PPP, PPG, PGA)",
            "& Clinical Diagnostic Decision Support (Phases 4–5)",
        ],
    ),
]

BOXES: List[DiagramBox] = [
    # --- STAGE 1: BARIS 1 (3 Kotak Sejajar) ---
    DiagramBox(
        box_id="phase1_radiometric",
        x=144, y=70, w=350, h=152,
        fill_color=CONFIG["stage1_box_fill"],
        title_lines=[
            "Phase 1: Radiometric FLIR Ingestion",
            "& Thermal Scale Calibration",
        ],
        body_lines=[
            "• Direct extraction of calibrated °C via flyr FLIR unpack",
            "• True physiological temperature matrix [20.0°C–42.0°C]",
            "• Adaptive luminance-to-Celsius fallback for grayscale",
            "• Automated elimination of >100°C measurement anomalies",
        ],
    ),
    DiagramBox(
        box_id="phase2a_inpainting",
        x=554, y=70, w=360, h=152,
        fill_color=CONFIG["stage1_box_fill"],
        title_lines=[
            "Phase 2A: OSD Accessory Inpainting",
            "& Sub-Degree Float32 Precision",
        ],
        body_lines=[
            "• Bounding-box masking of camera OSD & crosshairs",
            "• Telea inpainting maintaining strict float32 decimals",
            "• Hotspot protection avoiding dark-hole tissue deletion",
            "• Full preservation of subtle sub-degree plantar gradients",
        ],
    ),
    DiagramBox(
        box_id="phase2b_segmentation",
        x=974, y=70, w=326, h=152,
        fill_color=CONFIG["stage1_box_fill"],
        title_lines=[
            "Phase 2B: Plantar Morphology",
            "& Background Edge Isolation",
        ],
        body_lines=[
            "• Automated 31.0°C background cutoff segmentation",
            "• Morphological kernel (7x7) smoothing plantar boundaries",
            "• Generation of strict binary foot mask (mask_dense)",
            "• Exclusion of cold background leakage into toe borders",
        ],
    ),

    # --- STAGE 1: BARIS 2 (2 Kotak Lebar) ---
    DiagramBox(
        box_id="phase3a_rois",
        x=188, y=312, w=464, h=130,
        fill_color=CONFIG["stage1_box_fill"],
        title_lines=[
            "Phase 3A: Standardized Clinical ROI Registration & Scaling",
        ],
        body_lines=[
            "• Multi-point landmark mapping: Hallux (T1), Metatarsals (M1–M3), Heel",
            "• Multi-polygon & circular ROI delineation with 36-point boundary vertices",
            "• Physical distance calibration via spatial scale factor (pxPerCm)",
            "• Session persistence via annotations_session.json for longitudinal tracking",
        ],
    ),
    DiagramBox(
        box_id="phase3b_topography",
        x=712, y=312, w=588, h=130,
        fill_color=CONFIG["stage1_box_fill"],
        title_lines=[
            "Phase 3B: High-Resolution Spatial Thermal Topography",
        ],
        body_lines=[
            "• 1:1 Full-grid continuous temperature matrix sampling across plantar skin",
            "• 2D Gaussian kernel smoothing & 11-level isothermal contour elevation",
            "• Turbo colormap normalization establishing standardized thermal contrast",
            "• Sub-pixel coordinate registration eliminating 0.5-cell offset artifacts",
        ],
    ),

    # --- STAGE 2: BARIS 3 (2 Kotak Hijau Sejajar) ---
    DiagramBox(
        box_id="phase4a_ppp_ppg",
        x=188, y=508, w=464, h=118,
        fill_color=CONFIG["stage2_box_fill"],
        title_lines=[
            "Phase 4A: PPP & PPG Biomechanical Magnitude Extraction",
        ],
        body_lines=[
            "• PPP (Plantar Peak Perfusion): Absolute localized T_peak, T_mean, T_min, std",
            "• 9x9 local patch sampling strictly filtered within foot mask (mask_dense)",
            "• PPG (Plantar Thermal Gradient): Spatial thermal slope ||∇T|| = sqrt(Gx² + Gy²)",
            "• 2D Sobel spatial differentiation capturing acute inflammatory boundaries",
        ],
    ),
    DiagramBox(
        box_id="phase4b_pga",
        x=712, y=508, w=588, h=118,
        fill_color=CONFIG["stage2_box_fill"],
        title_lines=[
            "Phase 4B: PGA Directional Vector & Coherence Analysis",
        ],
        body_lines=[
            "• PGA (Gradient Angle): Vector orientation θ = arctan2(-Gy, Gx) mod 360°",
            "• Corrected compass orientation: 90° = North (Toes/Distal), 270° = South (Heel)",
            "• Circular vector coherence metric (0–100%) quantifying heat flow uniformity",
            "• Separation between uniform vascular dissipation vs. multidirectional anomaly",
        ],
    ),

    # --- STAGE 2: BARIS 4 (2 Kotak Hijau Sejajar) ---
    DiagramBox(
        box_id="phase5a_multimodal",
        x=188, y=656, w=464, h=114,
        fill_color=CONFIG["stage2_box_fill"],
        title_lines=[
            "Phase 5A: Multi-Modal Topographic Visualization Engine",
        ],
        body_lines=[
            "• 2D Vector Quiver Field mapping localized heat dissemination trajectories",
            "• 3D Thermal Elevation Surface meshes pinpointing focal hyperemic summits",
            "• 8-Point Star Radar charts evaluating directional steepness (N, NE, E...)",
            "• Publication-ready vector outputs (Fig 1 Panel A/B) at 300 DPI print quality",
        ],
    ),
    DiagramBox(
        box_id="phase5b_audit_reporting",
        x=712, y=656, w=588, h=114,
        fill_color=CONFIG["stage2_box_fill"],
        title_lines=[
            "Phase 5B: Automated Audit Trail & Statistical Synthesis",
        ],
        body_lines=[
            "• Cross-subject cohort aggregation exporting detailed long & wide CSV summaries",
            "• Multi-sheet Excel workbook with live formulas (=AVERAGE, =MAX, =MIN)",
            "• Transparent methodology guide sheet enabling reproducible scientific peer review",
            "• Headless CLI non-blocking batch execution for automated research pipelines",
        ],
    ),

    # --- STAGE 2: BARIS 5 (1 Kotak Hijau Kiri + 1 Kotak Emas Final Kanan) ---
    DiagramBox(
        box_id="phase5c_screening",
        x=188, y=800, w=464, h=90,
        fill_color=CONFIG["stage2_box_fill"],
        title_lines=[
            "Bilateral Asymmetry & Inflammation Triage",
        ],
        body_lines=[
            "• Contralateral temperature difference screening (ΔT > 2.2°C threshold)",
            "• Separation of diffuse physiological warmth from acute osteomyelitis borders",
            "• Identification of sub-clinical tissue stress prior to visible dermal ulceration",
        ],
    ),
    DiagramBox(
        box_id="phase5d_clinical_decision",
        x=712, y=800, w=588, h=90,
        fill_color=CONFIG["final_box_fill"],
        title_lines=[
            "Phase 5C: Clinical Decision Support & DFU Prevention Policy",
        ],
        body_lines=[
            "• Early risk stratification for proactive Diabetic Foot Ulcer (DFU) prevention",
            "• Quantitative objective biomechanical evidence guiding targeted footwear offloading",
            "• Longitudinal wound healing monitoring and tele-thermology clinical decision support",
        ],
    ),
]

STRAIGHT_ARROWS: List[BlockArrow] = [
    # Baris 1: Kotak 1 -> Kotak 2 -> Kotak 3
    BlockArrow(x1=498, y1=146, x2=548, y2=146),
    BlockArrow(x1=918, y1=146, x2=968, y2=146),

    # Baris 2: Kotak 5 (Kanan) -> Kotak 4 (Kiri)
    BlockArrow(x1=706, y1=377, x2=658, y2=377),

    # Transisi Tahap 1 -> Tahap 2 (Menembus Garis Putus-Putus)
    BlockArrow(x1=1006, y1=444, x2=1006, y2=502),

    # Baris 3: Kotak Kanan (PGA) -> Kotak Kiri (PPP/PPG)
    BlockArrow(x1=706, y1=567, x2=658, y2=567),

    # Baris 3 -> Baris 4 (Turun di Kolom Kiri & Kanan)
    BlockArrow(x1=420, y1=628, x2=420, y2=652),
    BlockArrow(x1=1006, y1=628, x2=1006, y2=652),

    # Baris 4 -> Baris 5 (Turun di Kolom Kiri & Kanan)
    BlockArrow(x1=420, y1=772, x2=420, y2=796),
    BlockArrow(x1=1006, y1=772, x2=1006, y2=796),

    # Panah Diagonal dari Baris 5 Kiri ke Baris 4 Kanan (Feedback loop)
    BlockArrow(x1=656, y1=796, x2=704, y2=762),

    # Baris 5: Kotak Kiri -> Kotak Final Emas Kanan (Clinical Decision)
    BlockArrow(x1=656, y1=845, x2=706, y2=845),
]


# ==============================================================================
# 4. FUNGSI RENDERING MATPLOTLIB
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


def draw_orthogonal_branch_arrow(ax: plt.Axes, H: float) -> None:
    color = CONFIG["arrow_fill"]
    sw = CONFIG["arrow_shaft_width"]

    # Batang horizontal penghubung antara Baris 1 dan Baris 2 (y = 256)
    y_bar_top = 252.0
    x_left_branch = 420.0
    x_right_branch = 1137.0

    # Batang vertikal turun dari Kotak 3 (x = 1137, y = 222..258)
    rect_drop_r = mpatches.Rectangle(
        (x_right_branch - sw / 2, to_mpl_y(265.0, H)),
        sw, 265.0 - 222.0,
        facecolor=color, edgecolor="none", zorder=3
    )
    ax.add_patch(rect_drop_r)

    # Batang vertikal turun dari Kotak 2 (x = 734, y = 222..258)
    rect_drop_m = mpatches.Rectangle(
        (734.0 - sw / 2, to_mpl_y(265.0, H)),
        sw, 265.0 - 222.0,
        facecolor=color, edgecolor="none", zorder=3
    )
    ax.add_patch(rect_drop_m)

    # Batang horizontal utama dari x = 420 sampai x = 1137
    rect_horiz = mpatches.Rectangle(
        (x_left_branch - sw / 2, to_mpl_y(y_bar_top + sw, H)),
        (x_right_branch - x_left_branch) + sw, sw,
        facecolor=color, edgecolor="none", zorder=3
    )
    ax.add_patch(rect_horiz)

    # Ujung panah turun ke Kotak 4 (Kiri, x = 420) dan Kotak 5 (Kanan, x = 1006)
    draw_block_arrow(ax, BlockArrow(x1=x_left_branch, y1=258, x2=x_left_branch, y2=308), H)
    draw_block_arrow(ax, BlockArrow(x1=1006, y1=258, x2=1006, y2=308), H)


def generate_thermalsight_flowchart(out_dir: Optional[Path] = None) -> Tuple[Path, Path, Path]:
    W = CONFIG["coord_width"]
    H = CONFIG["coord_height"]

    fig, ax = plt.subplots(figsize=(CONFIG["fig_width"], CONFIG["fig_height"]), dpi=CONFIG["dpi"])
    fig.patch.set_facecolor(CONFIG["bg_color"])
    ax.set_facecolor(CONFIG["bg_color"])
    ax.set_xlim(0, W)
    ax.set_ylim(0, H)
    ax.set_aspect("equal")
    ax.axis("off")

    # 1. Label Judul Utama
    ax.text(
        40, to_mpl_y(40, H),
        CONFIG["fig_label_text"],
        fontsize=CONFIG["fig_label_size"],
        fontweight="bold",
        fontfamily=CONFIG["font_family"],
        color=CONFIG["title_color"],
        ha="left", va="center", zorder=5
    )

    # 2. Render Banner Vertikal Kiri (Tahap 1 & Tahap 2)
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
            linespacing=1.35,
            zorder=5
        )

    # 3. Render Kotak-Kotak Proses
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

    # 4. Render Garis Putus-Putus Pemisah Tahap
    div_y = to_mpl_y(CONFIG["divider_y"], H)
    ax.plot(
        [CONFIG["divider_x_start"], CONFIG["divider_x_end"]],
        [div_y, div_y],
        color=CONFIG["divider_color"],
        linewidth=CONFIG["divider_linewidth"],
        linestyle=(0, CONFIG["divider_dash"]),
        zorder=2
    )

    # 5. Render Panah
    draw_orthogonal_branch_arrow(ax, H)
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
    p_png, p_svg, p_pdf = generate_thermalsight_flowchart()
    print(f"[SUCCESS] PNG saved to: {p_png}")
    print(f"[SUCCESS] SVG saved to: {p_svg}")
    print(f"[SUCCESS] PDF saved to: {p_pdf}")
