"""
Paper Figure 1 Scientific Replica Generator (Lung et al. BMC Musculoskeletal Disorders 2022)
--------------------------------------------------------------------------------------------
Features:
  - Exact Paper Headers:
      (A)
      PPP
      (B)
      PPG & PGA
  - FLIR White-Hot Colormap:
      Black (Floor/Background) -> Purple -> Magenta -> Red -> Orange -> Yellow -> White-Hot Peak (37.5°C)
  - Default Anatomical Labels:
      T1 (First Toe), M1 (Metatarsal 1), M3 (Metatarsal 3), HL (Heel)
  - Quiver vector arrows pointing along gradient steepest ascent directly towards White-Hot core
  - Generates both Right Foot and Left Foot figures and quantitative metrics tables.
"""

import sys, os, argparse
from pathlib import Path
import numpy as np
import pandas as pd
import cv2
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.patches import Circle

try:
    import flyr
    FLYR_AVAILABLE = True
except ImportError:
    FLYR_AVAILABLE = False


# FLIR Scientific White-Hot Colormap
THERMAL_WHITEHOT_COLORS = [
    (0.00, '#000000'), # 0: Black Background
    (0.12, '#180036'), # Cool: Deep Purple
    (0.28, '#4f046e'), # Low: Magenta Purple
    (0.44, '#990060'), # Medium: Dark Red
    (0.60, '#d92c20'), # Warm: Orange Red
    (0.74, '#f57a00'), # Hot: Bright Orange
    (0.85, '#fcb800'), # Very Hot: Vivid Yellow
    (0.93, '#ffea70'), # Extreme: Pale Yellow
    (1.00, '#ffffff'), # PEAK: WHITE-HOT GLOW (37.5°C)
]
CMAP_THERMAL_WHITEHOT = LinearSegmentedColormap.from_list('flir_whitehot', THERMAL_WHITEHOT_COLORS)


def load_matrix(path: Path) -> tuple[np.ndarray, str]:
    path = Path(path)
    stem = path.stem.replace("_temp", "")
    if path.suffix.lower() == ".csv":
        df = pd.read_csv(str(path), header=None)
        return df.values.astype(np.float32), stem
    
    analysis_csv = path.parent / f"{path.name}_analysis" / f"{path.stem}_temp.csv"
    if analysis_csv.exists():
        df = pd.read_csv(str(analysis_csv), header=None)
        return df.values.astype(np.float32), stem
        
    if FLYR_AVAILABLE and path.suffix.lower() in [".jpg", ".jpeg"]:
        try:
            return flyr.unpack(str(path)).celsius.astype(np.float32), stem
        except Exception:
            pass
            
    raw = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if raw is not None:
        return raw.astype(np.float32), stem
    raise ValueError(f"Cannot load matrix from {path}")


def split_feet(temp: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """
    Separates the camera image into Foot on Right (Cols >= valley) and Foot on Left (Cols < valley).
    """
    H, W = temp.shape
    col_prof = np.mean(temp, axis=0)
    c_start = int(W * 0.35)
    c_end = int(W * 0.65)
    valley_idx = int(np.argmin(col_prof[c_start:c_end])) + c_start

    # Crop Right foot on camera (Cols >= valley_idx)
    r_patch = temp[:, valley_idx:]
    mask_r = r_patch > max(26.0, float(np.percentile(r_patch, 35)))
    ys_r, xs_r = np.where(mask_r)
    pad = 4
    if len(ys_r) > 50:
        ymin_r = max(0, int(np.min(ys_r)) - pad)
        ymax_r = min(H - 1, int(np.max(ys_r)) + pad)
        xmin_r = max(valley_idx, int(np.min(xs_r)) + valley_idx - pad)
        xmax_r = min(W - 1, int(np.max(xs_r)) + valley_idx + pad)
        crop_r = temp[ymin_r:ymax_r+1, xmin_r:xmax_r+1]
    else:
        crop_r = r_patch

    # Crop Left foot on camera (Cols < valley_idx)
    l_patch = temp[:, :valley_idx]
    mask_l = l_patch > max(26.0, float(np.percentile(l_patch, 35)))
    ys_l, xs_l = np.where(mask_l)
    if len(ys_l) > 50:
        ymin_l = max(0, int(np.min(ys_l)) - pad)
        ymax_l = min(H - 1, int(np.max(ys_l)) + pad)
        xmin_l = max(0, int(np.min(xs_l)) - pad)
        xmax_l = min(valley_idx, int(np.max(xs_l)) + pad)
        crop_l = temp[ymin_l:ymax_l+1, xmin_l:xmax_l+1]
    else:
        crop_l = l_patch

    return crop_r, crop_l


def render_paper_figure(foot_patch: np.ndarray, out_path: Path, rois: list, n_rows: int = 104, n_cols: int = 54):
    grid_dense = cv2.resize(foot_patch, (n_cols, n_rows), interpolation=cv2.INTER_AREA)

    foot_mask = grid_dense > 28.5
    grid_disp = grid_dense.copy()
    grid_disp[~foot_mask] = 23.5 # Cool background baseline

    grid_smooth = cv2.GaussianBlur(grid_dense, (7, 7), 1.8)
    sobel_x = cv2.Sobel(grid_smooth, cv2.CV_64F, 1, 0, ksize=3) / 8.0
    sobel_y = cv2.Sobel(grid_smooth, cv2.CV_64F, 0, 1, ksize=3) / 8.0
    grad_mag = np.sqrt(sobel_x**2 + sobel_y**2)

    grid_contour = grid_smooth.copy()
    grid_contour[~foot_mask] = np.nan

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(8.5, 11), dpi=220, facecolor='white')

    # ──────────────────────── PANEL A: PPP ────────────────────────
    ax1.set_facecolor('#000000')
    x_edges = np.arange(0.5, n_cols + 1.5, 1)
    y_edges = np.arange(0.5, n_rows + 1.5, 1)
    X_e, Y_e = np.meshgrid(x_edges, y_edges)

    ax1.pcolormesh(X_e, Y_e, grid_disp, cmap=CMAP_THERMAL_WHITEHOT, vmin=23.5, vmax=np.max(grid_dense),
                   edgecolors='#111111', linewidth=0.20, shading='flat')

    ax1.set_xlim(1.5, n_cols + 0.5)
    ax1.set_ylim(n_rows + 0.5, 1.5)
    ax1.set_aspect('equal')
    ax1.tick_params(colors='black', labelsize=9)

    radius = 3.6
    for name, cx, cy, (tx, ty) in rois:
        c_out = Circle((cx, cy), radius, edgecolor='#00e5ff', facecolor='none', lw=2.0, zorder=10)
        c_in = Circle((cx, cy), radius * 0.82, edgecolor='red', facecolor='none', lw=1.3, zorder=11)
        ax1.add_patch(c_out)
        ax1.add_patch(c_in)
        ax1.plot(cx, cy, 'o', color='red', markeredgecolor='white', markeredgewidth=1.0, markersize=5, zorder=12)
        ax1.text(cx + tx, cy + ty, name, color='white', fontsize=16, fontweight='bold',
                 ha='center', va='center', zorder=15,
                 bbox=dict(boxstyle='round,pad=0.15', facecolor='#000000', alpha=0.6, edgecolor='none'))

    # EXACT HEADER LIKE PAPER FIG 1
    ax1.set_title('(A)\n\nPPP', fontsize=18, fontweight='bold', pad=12)

    # ──────────────────────── PANEL B: PPG & PGA ────────────────────────
    ax2.set_facecolor('white')
    levels = np.linspace(np.nanmin(grid_contour), np.nanmax(grid_contour), 16)
    ax2.contour(np.arange(1, n_cols + 1), np.arange(1, n_rows + 1), grid_contour,
                levels=levels, cmap=CMAP_THERMAL_WHITEHOT, linewidths=1.0, alpha=0.90)

    foot_outline = (foot_mask).astype(np.uint8)
    ax2.contour(np.arange(1, n_cols + 1), np.arange(1, n_rows + 1), foot_outline,
                levels=[0.5], colors='#777799', linewidths=0.7, linestyles='--')

    # Quiver vectors pointing towards heat
    step = 4
    y_q, x_q = np.mgrid[1:n_rows+1:step, 1:n_cols+1:step]
    u = sobel_x[::step, ::step]
    v = sobel_y[::step, ::step]
    m = grad_mag[::step, ::step]
    mask_q = (foot_mask[::step, ::step]) & (m > 0.04)

    nrm = np.sqrt(u**2 + v**2) + 1e-6
    u_n = u / nrm * 1.5
    v_n = v / nrm * 1.5

    ax2.quiver(x_q[mask_q], y_q[mask_q], u_n[mask_q], v_n[mask_q],
               color='#0b4db7', angles='xy', scale_units='xy', scale=1.0,
               width=0.0038, headwidth=3.4, headlength=4.2, zorder=8)

    ax2.set_xlim(1.5, n_cols + 0.5)
    ax2.set_ylim(n_rows + 0.5, 1.5)
    ax2.set_aspect('equal')
    ax2.tick_params(colors='black', labelsize=9)

    for name, cx, cy, (tx, ty) in rois:
        c_out = Circle((cx, cy), radius, edgecolor='red', facecolor='none', lw=2.0, zorder=10)
        c_in = Circle((cx, cy), radius * 0.82, edgecolor='red', facecolor='none', lw=1.2, linestyle=':', zorder=11)
        ax2.add_patch(c_out)
        ax2.add_patch(c_in)
        ax2.plot(cx, cy, 'o', color='red', markersize=4.5, zorder=12)
        ax2.text(cx + tx, cy + ty, name, color='black', fontsize=16, fontweight='bold', ha='center', va='center', zorder=15)

    # EXACT HEADER LIKE PAPER FIG 1
    ax2.set_title('(B)\n\nPPG & PGA', fontsize=18, fontweight='bold', pad=12)

    plt.tight_layout()
    fig.savefig(str(out_path), bbox_inches='tight', facecolor='white')
    plt.close(fig)
    print(f"[OK] Generated: {out_path.name}")

    # Metrics CSV
    metrics = []
    for name, cx, cy, _ in rois:
        ix = int(round(cx)) - 1
        iy = int(round(cy)) - 1
        val_ppp = float(grid_dense[iy, ix])
        gx = float(sobel_x[iy, ix])
        gy = float(sobel_y[iy, ix])
        val_ppg = float(np.sqrt(gx**2 + gy**2))
        val_pga = float(np.degrees(np.arctan2(gy, gx)))
        metrics.append({
            "ROI": name,
            "Grid_X": round(cx, 1),
            "Grid_Y": round(cy, 1),
            "PPP_Peak_Value": round(val_ppp, 2),
            "PPG_Gradient_Mag": round(val_ppg, 3),
            "PGA_Angle_Deg": round(val_pga, 1)
        })
    return pd.DataFrame(metrics)


def process_subject(source_path: Path, out_dir: Path = None):
    source_path = Path(source_path)
    temp, stem = load_matrix(source_path)
    
    if out_dir is None:
        out_dir = source_path.parent / f"{stem}.jpg_Result"
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    
    crop_right_cam, crop_left_cam = split_feet(temp)

    # 1. Foot on Camera Right (Designated Right Foot by user)
    rois_right = [
        ('T1', 17.0, 22.0, (0.0, -6.5)),
        ('M1', 14.0, 40.0, (-0.5, 7.5)),
        ('M3', 27.0, 38.0, (4.0, 7.5)),
    ]
    p_right = out_dir / f"{stem}_RightFoot_whitehot.png"
    df_right = render_paper_figure(crop_right_cam, p_right, rois_right)
    df_right.to_csv(str(out_dir / f"{stem}_RightFoot_metrics.csv"), index=False)

    # 2. Foot on Camera Left (Designated Left Foot by user)
    rois_left = [
        ('T1', 37.0, 19.0, (0.0, -6.5)),
        ('M1', 39.0, 41.0, (0.5, 7.5)),
        ('M3', 26.0, 39.0, (-4.0, 7.5)),
    ]
    p_left = out_dir / f"{stem}_LeftFoot_whitehot.png"
    df_left = render_paper_figure(crop_left_cam, p_left, rois_left)
    df_left.to_csv(str(out_dir / f"{stem}_LeftFoot_metrics.csv"), index=False)

    print(f"[SUCCESS] Finished generating figures for {stem} in {out_dir}")


def main():
    parser = argparse.ArgumentParser(description="Paper Fig 1 Scientific White-Hot Replica Generator")
    parser.add_argument("input", help="Path to CSV or image file")
    parser.add_argument("--out", default=None, help="Output directory")
    args = parser.parse_args()
    process_subject(args.input, args.out)


if __name__ == "__main__":
    main()
