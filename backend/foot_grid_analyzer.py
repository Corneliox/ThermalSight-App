"""
Thermal Right Foot Discrete Grid Matrix Analyzer (PPP & PPG/PGA Suite)
----------------------------------------------------------------------
Workflow:
  1. Load radiometric Float32 temperature matrix (from _temp.csv or FLIR .jpg)
  2. Isolate Right Foot cluster (automatic segmentation of right foot)
  3. Discretize right foot into an M x N block grid matrix (default: 12 rows x 6 cols)
  4. Compute per-block:
     - PPP: Peak Plantar Parameter (Mean/Peak Temperature in °C)
     - PPG: Peak Plantar Gradient (Spatial Gradient Magnitude in °C/cm)
     - PGA: Plantar Gradient Angle (Dominant Gradient Direction in degrees)
  5. Generate publication-ready outputs:
     - {stem}_right_foot_grid_ppp.png (Discrete Block Heatmap of PPP)
     - {stem}_right_foot_grid_ppg_pga.png (Discrete Block Heatmap of PPG with PGA Vector Flow Arrows)
     - {stem}_right_foot_grid_metrics.csv (Tabular metrics per grid cell)
  6. Supports batch processing across all subjects in a directory.
"""

import sys, os, glob, argparse
import numpy as np
import pandas as pd
import cv2
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from pathlib import Path

try:
    import flyr
    FLYR_AVAILABLE = True
except ImportError:
    FLYR_AVAILABLE = False


def load_temp_matrix(source_path: Path) -> tuple[np.ndarray, str]:
    """Loads Float32 temperature matrix from either .csv or FLIR .jpg."""
    p = Path(source_path)
    stem = p.stem.replace("_temp", "")
    
    if p.suffix.lower() == ".csv":
        df = pd.read_csv(str(p), header=None)
        return df.values.astype(np.float32), stem
    
    # Check if pre-extracted _temp.csv exists in sibling analysis folder
    analysis_csv = p.parent / f"{p.name}_analysis" / f"{p.stem}_temp.csv"
    if analysis_csv.exists():
        df = pd.read_csv(str(analysis_csv), header=None)
        return df.values.astype(np.float32), stem

    if FLYR_AVAILABLE and p.suffix.lower() in [".jpg", ".jpeg"]:
        try:
            temp = flyr.unpack(str(p)).celsius.astype(np.float32)
            return temp, stem
        except Exception as e:
            print(f"[WARN] flyr unpack failed for {p.name}: {e}", file=sys.stderr)
            
    raw = cv2.imread(str(p), cv2.IMREAD_GRAYSCALE)
    if raw is not None:
        return raw.astype(np.float32), stem
        
    raise ValueError(f"Unable to load temperature data from: {source_path}")


def isolate_right_foot(temp: np.ndarray) -> tuple[np.ndarray, dict]:
    """
    Detects and isolates the Right Foot cluster.
    In plantar thermal photography (soles facing camera),
    the right foot is situated on the right side of the image (X > midpoint).
    """
    H, W = temp.shape
    col_prof = np.mean(temp, axis=0)
    
    # Locate central inter-foot valley between col 35% and 65%
    c_start = int(W * 0.35)
    c_end = int(W * 0.65)
    valley_idx = int(np.argmin(col_prof[c_start:c_end])) + c_start
    
    # Extract right side patch
    right_patch = temp[:, valley_idx:]
    
    # Dynamic thresholding for warm foot tissue
    p35 = float(np.percentile(right_patch, 35))
    thresh = max(26.0, p35)
    mask = right_patch > thresh
    
    ys, xs = np.where(mask)
    if len(ys) < 100:
        # Fallback to simple right-half crop
        ymin, ymax = 0, H - 1
        xmin, xmax = valley_idx, W - 1
    else:
        pad_y = 4
        pad_x = 4
        ymin = max(0, int(np.min(ys)) - pad_y)
        ymax = min(H - 1, int(np.max(ys)) + pad_y)
        xmin = max(valley_idx, int(np.min(xs)) + valley_idx - pad_x)
        xmax = min(W - 1, int(np.max(xs)) + valley_idx + pad_x)
        
    foot_crop = temp[ymin:ymax+1, xmin:xmax+1]
    bbox_info = {
        "ymin": ymin, "ymax": ymax,
        "xmin": xmin, "xmax": xmax,
        "valley_x": valley_idx,
        "height_px": ymax - ymin + 1,
        "width_px": xmax - xmin + 1
    }
    return foot_crop, bbox_info


def compute_discrete_foot_grid(foot_crop: np.ndarray, n_rows=12, n_cols=6, px_per_cm=10.0):
    """
    Divides the isolated right foot into an M x N grid and computes
    PPP, PPG, and PGA per cell.
    """
    H_f, W_f = foot_crop.shape
    dx_cm = 1.0 / max(0.1, px_per_cm)
    dy_cm = 1.0 / max(0.1, px_per_cm)
    
    # Smooth slightly to eliminate sensor grain
    smooth = cv2.GaussianBlur(foot_crop, (5, 5), 1.2)
    
    # Spatial derivatives in °C / cm
    sobel_x = (cv2.Sobel(smooth, cv2.CV_64F, 1, 0, ksize=3) / 8.0) / dx_cm
    sobel_y = (cv2.Sobel(smooth, cv2.CV_64F, 0, 1, ksize=3) / 8.0) / dy_cm
    grad_mag_map = np.sqrt(sobel_x**2 + sobel_y**2)
    grad_ang_map = np.arctan2(sobel_y, sobel_x) # Radians
    
    ppp_grid  = np.full((n_rows, n_cols), np.nan)
    ppp_peak  = np.full((n_rows, n_cols), np.nan)
    ppg_grid  = np.full((n_rows, n_cols), np.nan)
    pga_grid  = np.full((n_rows, n_cols), np.nan) # degrees
    pga_rad   = np.full((n_rows, n_cols), np.nan)
    
    r_step = H_f / float(n_rows)
    c_step = W_f / float(n_cols)
    
    foot_min = float(np.percentile(foot_crop, 20))
    threshold = max(26.0, foot_min)
    
    table_rows = []
    
    # Anatomical zone mapping based on row index
    def get_zone_name(r, nr):
        pct = (r + 0.5) / nr
        if pct <= 0.25:   return "Toes & Hallux"
        elif pct <= 0.50: return "Metatarsals (MT 1-5)"
        elif pct <= 0.75: return "Midfoot Arch"
        else:             return "Heel (Calcaneus)"

    for r in range(n_rows):
        r1, r2 = int(round(r * r_step)), int(round((r + 1) * r_step))
        r2 = max(r1 + 1, min(H_f, r2))
        
        for c in range(n_cols):
            c1, c2 = int(round(c * c_step)), int(round((c + 1) * c_step))
            c2 = max(c1 + 1, min(W_f, c2))
            
            blk_temp = foot_crop[r1:r2, c1:c2]
            blk_gx   = sobel_x[r1:r2, c1:c2]
            blk_gy   = sobel_y[r1:r2, c1:c2]
            
            act_mask = blk_temp >= threshold
            num_act = int(np.sum(act_mask))
            
            # Require at least 25% of block or 8 active pixels
            if num_act >= max(8, int(0.25 * blk_temp.size)):
                mean_t = float(np.mean(blk_temp[act_mask]))
                peak_t = float(np.max(blk_temp[act_mask]))
                gx_m   = float(np.mean(blk_gx[act_mask]))
                gy_m   = float(np.mean(blk_gy[act_mask]))
                mag_m  = float(np.sqrt(gx_m**2 + gy_m**2))
                ang_rad = float(np.arctan2(gy_m, gx_m))
                ang_deg = float(np.degrees(ang_rad))
                
                ppp_grid[r, c] = mean_t
                ppp_peak[r, c] = peak_t
                ppg_grid[r, c] = mag_m
                pga_grid[r, c] = ang_deg
                pga_rad[r, c]  = ang_rad
                
                table_rows.append({
                    "Row": r + 1,
                    "Col": c + 1,
                    "Zone": get_zone_name(r, n_rows),
                    "PPP_Mean_Temp_C": round(mean_t, 2),
                    "PPP_Peak_Temp_C": round(peak_t, 2),
                    "PPG_Gradient_C_cm": round(mag_m, 3),
                    "PGA_Angle_Deg": round(ang_deg, 1)
                })
            else:
                table_rows.append({
                    "Row": r + 1,
                    "Col": c + 1,
                    "Zone": get_zone_name(r, n_rows),
                    "PPP_Mean_Temp_C": np.nan,
                    "PPP_Peak_Temp_C": np.nan,
                    "PPG_Gradient_C_cm": np.nan,
                    "PGA_Angle_Deg": np.nan
                })
                
    return {
        "ppp_grid": ppp_grid,
        "ppp_peak": ppp_peak,
        "ppg_grid": ppg_grid,
        "pga_grid": pga_grid,
        "pga_rad": pga_rad,
        "table_df": pd.DataFrame(table_rows),
        "n_rows": n_rows,
        "n_cols": n_cols
    }


def render_ppp_heatmap(grid_data: dict, out_path: Path, stem: str):
    """
    Renders Image 1: Discrete Grid Matrix Heatmap of PPP (Peak Plantar Parameter / Temperature).
    Displays discrete colored blocks with clear cell borders and numerical temperature text.
    """
    ppp = grid_data["ppp_grid"]
    n_rows, n_cols = ppp.shape
    
    fig, ax = plt.subplots(figsize=(6.5, 9.5), dpi=160, facecolor="#0e1117")
    ax.set_facecolor("#0e1117")
    
    masked_ppp = np.ma.masked_invalid(ppp)
    
    cmap = plt.colormaps["inferno"].resampled(256)
    cmap.set_bad("#1c2230")
    
    vmin = np.nanmin(ppp) if not np.all(np.isnan(ppp)) else 25.0
    vmax = np.nanmax(ppp) if not np.all(np.isnan(ppp)) else 35.0
    
    im = ax.imshow(masked_ppp, cmap=cmap, vmin=vmin, vmax=vmax, aspect="auto")
    
    # Cell grid borders
    ax.set_xticks(np.arange(-0.5, n_cols, 1), minor=True)
    ax.set_yticks(np.arange(-0.5, n_rows, 1), minor=True)
    ax.grid(which="minor", color="#2a3346", linestyle="-", linewidth=1.5)
    ax.tick_params(which="minor", size=0)
    
    # Add numerical text inside each block
    for r in range(n_rows):
        for c in range(n_cols):
            val = ppp[r, c]
            if not np.isnan(val):
                norm_val = (val - vmin) / max(0.1, vmax - vmin)
                txt_color = "#000000" if norm_val > 0.65 else "#ffffff"
                ax.text(c, r, f"{val:.1f}°", ha="center", va="center",
                        fontsize=9.5, fontweight="bold", color=txt_color)
                        
    # Anatomical axis guides
    ax.set_xticks(range(n_cols))
    ax.set_xticklabels([f"C{c+1}" for c in range(n_cols)], color="#a0aec0", fontsize=9, fontweight="bold")
    ax.set_yticks(range(n_rows))
    ax.set_yticklabels([f"R{r+1}" for r in range(n_rows)], color="#a0aec0", fontsize=9, fontweight="bold")
    
    # Colorbar
    cbar = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    cbar.set_label("PPP: Mean Temperature (°C)", color="white", fontsize=10, fontweight="bold", labelpad=8)
    cbar.ax.tick_params(labelsize=9, colors="white")
    
    # Header & Zone Annotations
    ax.set_title(f"{stem} — Right Foot PPP Heatmap\n(Discrete Block Matrix: {n_rows}×{n_cols})",
                 color="white", fontsize=12, fontweight="bold", pad=12)
    
    # Foot orientation badge
    ax.text(n_cols/2 - 0.5, -0.9, "▲ TOES (ANTERIOR)", color="#00ffff", fontsize=10, fontweight="bold", ha="center")
    ax.text(n_cols/2 - 0.5, n_rows - 0.15, "▼ HEEL (POSTERIOR)", color="#ffbb00", fontsize=10, fontweight="bold", ha="center")
    
    plt.tight_layout()
    fig.savefig(str(out_path), bbox_inches="tight", facecolor="#0e1117")
    plt.close(fig)
    print(f"[OK] Saved PPP Grid Heatmap: {out_path.name}")


def render_ppg_pga_heatmap(grid_data: dict, out_path: Path, stem: str):
    """
    Renders Image 2: Discrete Grid Matrix Heatmap of PPG & PGA.
    - Cell background color = PPG (Gradient Magnitude in °C/cm).
    - Centered Flow Arrow = PGA (Gradient Angle / Vector Direction).
    """
    ppg = grid_data["ppg_grid"]
    pga_rad = grid_data["pga_rad"]
    n_rows, n_cols = ppg.shape
    
    fig, ax = plt.subplots(figsize=(6.5, 9.5), dpi=160, facecolor="#0e1117")
    ax.set_facecolor("#0e1117")
    
    masked_ppg = np.ma.masked_invalid(ppg)
    cmap = plt.colormaps["viridis"].resampled(256)
    cmap.set_bad("#1c2230")
    
    vmin = 0.0
    vmax = float(np.nanpercentile(ppg, 95)) if not np.all(np.isnan(ppg)) else 1.5
    vmax = max(0.5, vmax)
    
    im = ax.imshow(masked_ppg, cmap=cmap, vmin=vmin, vmax=vmax, aspect="auto")
    
    # Cell grid borders
    ax.set_xticks(np.arange(-0.5, n_cols, 1), minor=True)
    ax.set_yticks(np.arange(-0.5, n_rows, 1), minor=True)
    ax.grid(which="minor", color="#2a3346", linestyle="-", linewidth=1.5)
    ax.tick_params(which="minor", size=0)
    
    # Draw Flow Arrows for PGA within each active block
    for r in range(n_rows):
        for c in range(n_cols):
            mag = ppg[r, c]
            ang = pga_rad[r, c]
            if not np.isnan(mag) and not np.isnan(ang):
                # Normalized arrow vector
                scale = 0.38 * min(1.0, max(0.25, mag / vmax))
                dx = np.cos(ang) * scale
                dy = np.sin(ang) * scale
                
                # Flow arrow with white/yellow glow
                ax.arrow(c, r, dx, dy,
                         head_width=0.18, head_length=0.15,
                         fc="#ffff00", ec="#000000", lw=1.2, length_includes_head=True, zorder=5)
                # Magnitude label below arrow
                ax.text(c, r + 0.36, f"{mag:.2f}", ha="center", va="center",
                        fontsize=7.5, fontweight="bold", color="#ffffff", zorder=6)
                        
    # Compass Wheel Inset
    ax_comp = fig.add_axes([0.76, 0.77, 0.16, 0.16], projection="polar")
    theta = np.linspace(0, 2*np.pi, 256)
    r_arr = np.linspace(0.5, 1.0, 8)
    T, R  = np.meshgrid(theta, r_arr)
    ax_comp.pcolormesh(T, R, T, cmap="hsv", shading="auto")
    ax_comp.set_yticklabels([])
    ax_comp.set_xticks(np.linspace(0, 2*np.pi, 8, endpoint=False))
    ax_comp.set_xticklabels(["E", "", "N", "", "W", "", "S", ""], fontsize=7, color="#ffffff", fontweight="bold")
    ax_comp.set_title("PGA Angle", fontsize=8, color="#ffffff", pad=2, fontweight="bold")
    ax_comp.spines["polar"].set_color("#4a5568")
    ax_comp.set_facecolor("#0e1117")
    
    # Axes formatting
    ax.set_xticks(range(n_cols))
    ax.set_xticklabels([f"C{c+1}" for c in range(n_cols)], color="#a0aec0", fontsize=9, fontweight="bold")
    ax.set_yticks(range(n_rows))
    ax.set_yticklabels([f"R{r+1}" for r in range(n_rows)], color="#a0aec0", fontsize=9, fontweight="bold")
    
    cbar = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    cbar.set_label("PPG: Gradient Magnitude (°C/cm)", color="white", fontsize=10, fontweight="bold", labelpad=8)
    cbar.ax.tick_params(labelsize=9, colors="white")
    
    ax.set_title(f"{stem} — Right Foot PPG & PGA Heatmap\n(Vector Field & Discrete Magnitude: {n_rows}×{n_cols})",
                 color="white", fontsize=12, fontweight="bold", pad=12)
                 
    ax.text(n_cols/2 - 0.5, -0.9, "▲ TOES (ANTERIOR)", color="#00ffff", fontsize=10, fontweight="bold", ha="center")
    ax.text(n_cols/2 - 0.5, n_rows - 0.15, "▼ HEEL (POSTERIOR)", color="#ffbb00", fontsize=10, fontweight="bold", ha="center")
    
    plt.tight_layout()
    fig.savefig(str(out_path), bbox_inches="tight", facecolor="#0e1117")
    plt.close(fig)
    print(f"[OK] Saved PPG & PGA Grid Heatmap: {out_path.name}")


def process_subject(source_path: Path, out_dir: Path = None, n_rows=12, n_cols=6, px_per_cm=10.0):
    """Processes a single subject file and exports both images and metrics CSV."""
    source_path = Path(source_path)
    temp, stem = load_temp_matrix(source_path)
    
    if out_dir is None:
        out_dir = source_path.parent / f"{stem}.jpg_Result" / f"{stem}_grid_analysis"
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. Isolate Right Foot
    foot_crop, bbox = isolate_right_foot(temp)
    
    # 2. Compute Discrete Block Matrices
    grid_res = compute_discrete_foot_grid(foot_crop, n_rows, n_cols, px_per_cm)
    
    # 3. Export Image 1: PPP Heatmap
    p1 = out_dir / f"{stem}_right_foot_grid_ppp.png"
    render_ppp_heatmap(grid_res, p1, stem)
    
    # 4. Export Image 2: PPG & PGA Vector Flow Heatmap
    p2 = out_dir / f"{stem}_right_foot_grid_ppg_pga.png"
    render_ppg_pga_heatmap(grid_res, p2, stem)
    
    # 5. Export CSV Table
    csv_p = out_dir / f"{stem}_right_foot_grid_metrics.csv"
    grid_res["table_df"].to_csv(str(csv_p), index=False)
    print(f"[OK] Saved Grid Metrics CSV: {csv_p.name}")
    
    return {
        "stem": stem,
        "ppp_img": str(p1),
        "ppg_pga_img": str(p2),
        "csv_metrics": str(csv_p),
        "bbox": bbox
    }


def main():
    parser = argparse.ArgumentParser(description="Thermal Right Foot Discrete Grid Matrix Analyzer (PPP & PPG/PGA Suite)")
    parser.add_argument("input", help="Path to a single image/.csv or directory of subjects")
    parser.add_argument("--out", default=None, help="Output directory")
    parser.add_argument("--rows", type=int, default=12, help="Number of grid rows along foot length (default: 12)")
    parser.add_argument("--cols", type=int, default=6, help="Number of grid columns along foot width (default: 6)")
    parser.add_argument("--px_cm", type=float, default=10.0, help="Pixel per cm calibration scale (default: 10.0)")
    
    args = parser.parse_args()
    inp = Path(args.input)
    
    if inp.is_dir():
        candidates = list(inp.glob("FLIR*.jpg")) or list(inp.glob("*_temp.csv")) or list(inp.glob("*.jpg"))
        if not candidates:
            candidates = list(inp.rglob("FLIR*.jpg")) or list(inp.rglob("*_temp.csv"))
            
        print(f"[*] Found {len(candidates)} subject file(s) for batch processing in {inp.name}...")
        results = []
        for f in candidates:
            if "isolated" in f.name or "quiver" in f.name or "heatmap" in f.name:
                continue
            try:
                r = process_subject(f, args.out, args.rows, args.cols, args.px_cm)
                results.append(r)
            except Exception as e:
                print(f"[ERROR] Failed processing {f.name}: {e}", file=sys.stderr)
        print(f"\n[DONE] Successfully generated discrete grid heatmaps for {len(results)} subject(s)!")
    else:
        process_subject(inp, args.out, args.rows, args.cols, args.px_cm)


if __name__ == "__main__":
    main()
