"""
ThermalSight Backend — headless JSON API
Called by Electron main.js via child_process.spawn

Commands
--------
  analyze  <imagePath> <outputDir>
      Load image, compute all gradients, save PNGs + CSVs.
      Prints a single JSON object to stdout.

  roi  <imagePath> <cx> <cy> <r_cm> <px_per_cm> <outputDir>
      Recompute gradients, extract ROI circle stats, save ROI CSV.
      Prints a single JSON object to stdout.

  crop <imagePath> <pointsJson> <labelName> <roiIndex> <outputDir>
      Crop ROI polygon, mask temperature matrix, save isolated CSV + stats.

All output goes to stdout as JSON.
All log/debug goes to stderr (never stdout, or the JSON parse breaks).
Exit 0 = ok, Exit 1 = error (error key in JSON).
"""

import sys, os, json, warnings, csv
warnings.filterwarnings("ignore")

import numpy as np
import cv2
import matplotlib
matplotlib.use("Agg")          # NO GUI — headless only
import matplotlib.pyplot as plt
from pathlib import Path

try:
    import flyr
    FLYR_AVAILABLE = True
except ImportError:
    FLYR_AVAILABLE = False


# ─────────────────────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────────────────────

def log(msg):
    print(msg, file=sys.stderr, flush=True)

def emit(obj):
    """Print JSON to stdout and exit 0."""
    print(json.dumps(obj), flush=True)
    sys.exit(0)

def fail(msg):
    print(json.dumps({"error": msg}), flush=True)
    sys.exit(1)


def normalize_u8(arr):
    mn, mx = arr.min(), arr.max()
    if mx == mn:
        return np.zeros_like(arr, dtype=np.uint8)
    return (255 * (arr - mn) / (mx - mn)).astype(np.uint8)


# ─────────────────────────────────────────────────────────────────────────────
#  Load temperature
# ─────────────────────────────────────────────────────────────────────────────

def load_temperature(filepath: str) -> np.ndarray:
    if FLYR_AVAILABLE and filepath.lower().endswith((".jpg", ".jpeg")):
        try:
            log("Trying flyr FLIR unpack…")
            return flyr.unpack(filepath).celsius.astype(np.float32)
        except Exception as e:
            log(f"flyr failed ({e}), falling back to grayscale")
    raw = cv2.imread(filepath, cv2.IMREAD_GRAYSCALE)
    if raw is None:
        fail(f"Cannot open image: {filepath}")
    return raw.astype(np.float32)


# ─────────────────────────────────────────────────────────────────────────────
#  Compute gradients
# ─────────────────────────────────────────────────────────────────────────────

def compute(temp: np.ndarray) -> dict:
    img     = (255 * temp / temp.max()).astype(np.float32)
    blurred = cv2.GaussianBlur(img, (5, 5), sigmaX=1.5)

    sx_raw = cv2.Sobel(blurred, cv2.CV_64F, 1, 0, ksize=3)
    sy_raw = cv2.Sobel(blurred, cv2.CV_64F, 0, 1, ksize=3)
    sx     = cv2.convertScaleAbs(sx_raw)
    sy     = cv2.convertScaleAbs(sy_raw)

    combined    = cv2.addWeighted(sx, 0.5, sy, 0.5, 0)
    sobel_norm  = normalize_u8(combined)
    clahe       = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(16, 16))
    sobel_clahe = clahe.apply(sobel_norm)

    magnitude  = np.sqrt(sx_raw**2 + sy_raw**2).astype(np.float32)
    mag_thresh = np.where(magnitude >= np.percentile(magnitude, 75),
                          magnitude, 0).astype(np.float32)
    angle      = np.arctan2(sy_raw, sx_raw).astype(np.float32)

    orig_color  = cv2.applyColorMap(normalize_u8(temp), cv2.COLORMAP_INFERNO)
    edge_color  = cv2.applyColorMap(sobel_clahe, cv2.COLORMAP_HOT)
    overlay_rgb = cv2.cvtColor(
        cv2.addWeighted(orig_color, 0.6, edge_color, 0.4, 0),
        cv2.COLOR_BGR2RGB
    )

    return dict(
        temp        = temp,
        sobelx_raw  = sx_raw,
        sobely_raw  = sy_raw,
        magnitude   = magnitude,
        mag_thresh  = mag_thresh,
        angle       = angle,
        overlay_rgb = overlay_rgb,
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Save PNGs
# ─────────────────────────────────────────────────────────────────────────────

def save_panel_png(arr, cmap, path, title):
    fig, ax = plt.subplots(figsize=(8, 6), facecolor="#0e0e0e")
    ax.imshow(arr, cmap=cmap)
    ax.axis("off")
    ax.set_title(title, color="white", fontsize=11)
    fig.savefig(path, dpi=150, bbox_inches="tight", facecolor="#0e0e0e")
    plt.close(fig)


def save_all_pngs(data: dict, out_dir: Path, stem: str) -> dict:
    paths = {}

    # 1. Save unpadded pure 1:1 image rasters for pixel-perfect GUI and canvas overlay
    p_orig = out_dir / f"{stem}_original.png"
    p_inferno = out_dir / f"{stem}_inferno.png"
    temp_u8 = normalize_u8(data["temp"])
    orig_inferno_bgr = cv2.applyColorMap(temp_u8, cv2.COLORMAP_INFERNO)
    cv2.imwrite(str(p_orig), orig_inferno_bgr)
    cv2.imwrite(str(p_inferno), orig_inferno_bgr)
    paths["original"] = str(p_orig)
    paths["inferno"] = str(p_inferno)
    log(f"  saved 1:1 {p_orig.name}")

    panels = {
        "magnitude"       : (data["magnitude"],   "hot",     "Gradient Magnitude"),
        "mag_thresh"      : (data["mag_thresh"],  "hot",     "Magnitude Thresholded"),
        "angle"           : (data["angle"],       "hsv",     "Gradient Angle"),
        "overlay"         : (data["overlay_rgb"], None,      "Overlay"),
    }
    for key, (arr, cmap, title) in panels.items():
        p = out_dir / f"{stem}_{key}.png"
        save_panel_png(arr, cmap, str(p), title)
        paths[key] = str(p)
        log(f"  saved {p.name}")

    # quiver arrows PNG
    quiver_path = save_quiver_png(data, out_dir, stem)
    paths["quiver"] = quiver_path

    # grid PNG
    grid_path = save_grid_png(data, panels, out_dir, stem)
    paths["grid"] = grid_path

    return paths


def save_quiver_png(data: dict, out_dir: Path, stem: str) -> str:
    temp = data["temp"]
    sx   = data["sobelx_raw"]
    sy   = data["sobely_raw"]
    mag  = data["magnitude"]

    strong = mag > np.percentile(mag, 75)
    h, w   = temp.shape
    sub    = 15
    ys, xs = np.mgrid[0:h:sub, 0:w:sub]
    u = sx[ys, xs].astype(float)
    v = -sy[ys, xs].astype(float)
    mask   = strong[ys, xs]
    nrm    = np.sqrt(u**2 + v**2) + 1e-8
    u_n, v_n = u / nrm, v / nrm
    colors = plt.cm.hsv((np.arctan2(v_n, u_n) + np.pi) / (2 * np.pi))

    fig, ax = plt.subplots(figsize=(12, 8), facecolor="black")
    ax.imshow(temp, cmap="inferno", alpha=0.85)
    for i in range(ys.shape[0]):
        for j in range(ys.shape[1]):
            if mask[i, j]:
                ax.annotate("",
                    xy    =(xs[i,j] + u_n[i,j]*6, ys[i,j] + v_n[i,j]*6),
                    xytext=(xs[i,j], ys[i,j]),
                    arrowprops=dict(arrowstyle="->", color=colors[i,j], lw=1.1))

    # compass wheel
    ax_w  = fig.add_axes([0.80, 0.76, 0.16, 0.16], projection="polar")
    theta = np.linspace(0, 2*np.pi, 256)
    r_arr = np.linspace(0.4, 1, 10)
    T, R  = np.meshgrid(theta, r_arr)
    ax_w.pcolormesh(T, R, T, cmap="hsv", shading="auto")
    ax_w.set_yticklabels([])
    ax_w.set_xticklabels(["E","","N","","W","","S",""], fontsize=7, color="white")
    ax_w.set_title("Direction", fontsize=8, color="white", pad=2)
    ax_w.spines["polar"].set_visible(False)
    ax_w.set_facecolor("black")

    ax.set_title("Gradient Direction", color="white", fontsize=11)
    ax.axis("off")
    fig.patch.set_facecolor("black")

    p = out_dir / f"{stem}_quiver.png"
    fig.savefig(str(p), dpi=150, bbox_inches="tight", facecolor="black")
    plt.close(fig)
    log(f"  saved {p.name}")
    return str(p)


def save_grid_png(data, panels, out_dir: Path, stem: str) -> str:
    fig, axes = plt.subplots(2, 3, figsize=(15, 10), facecolor="#111")
    for ax, (key, (arr, cmap, title)) in zip(axes.flatten(), panels.items()):
        ax.imshow(arr, cmap=cmap)
        ax.axis("off")
        ax.set_title(title, color="white", fontsize=9)
    axes.flatten()[-1].set_visible(False)
    fig.suptitle(f"Thermal Analysis — {stem}", color="white",
                 fontsize=13, fontweight="bold")
    plt.tight_layout(rect=[0, 0, 1, 0.96])
    p = out_dir / f"{stem}_grid.png"
    fig.savefig(str(p), dpi=150, bbox_inches="tight", facecolor="#111")
    plt.close(fig)
    log(f"  saved {p.name}")
    return str(p)


def save_gradient_2d_quiver(temp_patch: np.ndarray, out_path: Path, title: str, px_cm: float = 10.0, roi_polygon: list = None) -> str:
    """
    Generates side-by-side 2D Heatmap with Quiver gradient vector field + 2D Gradient Magnitude map.
    Matching scientific publication standard (Image 2).
    """
    H, W = temp_patch.shape
    dx_cm = 1.0 / max(0.1, px_cm)
    dy_cm = 1.0 / max(0.1, px_cm)
    Lx = W * dx_cm
    Ly = H * dy_cm

    # Compute spatial derivatives
    sobel_x = cv2.Sobel(temp_patch, cv2.CV_64F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(temp_patch, cv2.CV_64F, 0, 1, ksize=3)
    
    # Scale to °C/cm (Sobel 3x3 has normalization factor of 8)
    gx = (sobel_x / 8.0) / dx_cm
    gy = (sobel_y / 8.0) / dy_cm
    grad_mag = np.sqrt(gx**2 + gy**2)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.8), dpi=150, facecolor="white")

    # 1. Left: Temperature Map + Quiver Vector Field
    im1 = ax1.imshow(temp_patch, extent=[0, Lx, 0, Ly], origin="lower", cmap="viridis", aspect="equal")
    
    # Downsample quiver arrows for clean visualization
    step = max(1, int(round(min(W, H) / 10.0)))
    y_idxs, x_idxs = np.mgrid[step//2:H:step, step//2:W:step]
    x_coords = x_idxs * dx_cm
    y_coords = y_idxs * dy_cm
    u_vals = gx[y_idxs, x_idxs]
    v_vals = gy[y_idxs, x_idxs]

    max_m = np.max(grad_mag) or 1.0
    ax1.quiver(x_coords, y_coords, u_vals, v_vals, color="red", angles="xy", scale_units="xy", scale=max_m * 1.8, width=0.007)

    # Optional ROI Boundary Outline (for 2x context or all-labels)
    if roi_polygon and len(roi_polygon) >= 3:
        pxs = [pt[0] for pt in roi_polygon] + [roi_polygon[0][0]]
        pys = [pt[1] for pt in roi_polygon] + [roi_polygon[0][1]]
        ax1.plot(pxs, pys, color="yellow", linestyle="--", linewidth=1.5, label="ROI Target")
        ax2.plot(pxs, pys, color="yellow", linestyle="--", linewidth=1.5)

    ax1.set_title(f"{title}: Thermal Map", fontsize=11, fontweight="bold", pad=8)
    ax1.set_xlabel("X (cm)", fontsize=10)
    ax1.set_ylabel("Y (cm)", fontsize=10)
    cbar1 = fig.colorbar(im1, ax=ax1, fraction=0.046, pad=0.04)
    cbar1.set_label("Temperature (°C)", fontsize=9)

    # 2. Right: Gradient Magnitude Map
    im2 = ax2.imshow(grad_mag, extent=[0, Lx, 0, Ly], origin="lower", cmap="viridis", aspect="equal")
    ax2.set_title(f"{title}: Gradient Magnitude", fontsize=11, fontweight="bold", pad=8)
    ax2.set_xlabel("X (cm)", fontsize=10)
    ax2.set_ylabel("Y (cm)", fontsize=10)
    cbar2 = fig.colorbar(im2, ax=ax2, fraction=0.046, pad=0.04)
    cbar2.set_label("Gradient Magnitude (°C/cm)", fontsize=9)

    plt.tight_layout()
    fig.savefig(str(out_path), bbox_inches="tight")
    plt.close(fig)
    log(f"  saved 2D Quiver & Magnitude Map: {out_path.name}")
    return str(out_path)


def save_gradient_3d_surface(temp_patch: np.ndarray, out_path: Path, title: str, px_cm: float = 10.0, roi_polygon: list = None) -> str:
    """
    Generates 3D Surface mesh with colormap + Bottom-plane contour lines and 2D Quiver vectors.
    Matching scientific publication standard (Image 1).
    """
    H, W = temp_patch.shape
    dx_cm = 1.0 / max(0.1, px_cm)
    dy_cm = 1.0 / max(0.1, px_cm)
    Lx = W * dx_cm
    Ly = H * dy_cm

    x_arr = np.linspace(0, Lx, W)
    y_arr = np.linspace(0, Ly, H)
    X, Y = np.meshgrid(x_arr, y_arr)
    Z = temp_patch

    # Derivatives for bottom plane quiver
    sobel_x = cv2.Sobel(temp_patch, cv2.CV_64F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(temp_patch, cv2.CV_64F, 0, 1, ksize=3)
    gx = (sobel_x / 8.0) / dx_cm
    gy = (sobel_y / 8.0) / dy_cm

    z_min = float(np.min(Z))
    z_max = float(np.max(Z))
    z_span = max(0.5, z_max - z_min)
    z_bottom = z_min - z_span * 0.35 # position bottom plane slightly below surface

    fig = plt.figure(figsize=(9, 7.5), dpi=150, facecolor="white")
    ax = fig.add_subplot(111, projection='3d')
    ax.set_facecolor("white")

    # 1. 3D Surface Mesh
    surf = ax.plot_surface(X, Y, Z, cmap='viridis', edgecolor='black', linewidth=0.25, alpha=0.88, rstride=1, cstride=1)

    # 2. Bottom Plane Contours
    ax.contour(X, Y, Z, zdir='z', offset=z_bottom, cmap='viridis', levels=10, linewidths=1.0)

    # 3. Bottom Plane Quiver Vector Field
    step = max(1, int(round(min(W, H) / 9.0)))
    y_idxs, x_idxs = np.mgrid[step//2:H:step, step//2:W:step]
    x_q = X[y_idxs, x_idxs].flatten()
    y_q = Y[y_idxs, x_idxs].flatten()
    z_q = np.full_like(x_q, z_bottom)
    u_q = gx[y_idxs, x_idxs].flatten()
    v_q = gy[y_idxs, x_idxs].flatten()
    w_q = np.zeros_like(x_q)

    # Normalize vectors for clear quiver arrows on bottom plane
    mag_q = np.sqrt(u_q**2 + v_q**2)
    max_q = np.max(mag_q) or 1.0
    norm_u = np.where(mag_q > 0.001, u_q / max_q * (Lx / 10.0), 0)
    norm_v = np.where(mag_q > 0.001, v_q / max_q * (Ly / 10.0), 0)

    ax.quiver(x_q, y_q, z_q, norm_u, norm_v, w_q, color="#0055ff", length=0.8, arrow_length_ratio=0.35, linewidth=0.9)

    # Optional ROI Boundary Outline projected on bottom plane
    if roi_polygon and len(roi_polygon) >= 3:
        pxs = [pt[0] for pt in roi_polygon] + [roi_polygon[0][0]]
        pys = [pt[1] for pt in roi_polygon] + [roi_polygon[0][1]]
        pzs = [z_bottom] * len(pxs)
        ax.plot(pxs, pys, pzs, color="yellow", linestyle="--", linewidth=1.5)

    ax.set_zlim(z_bottom, z_max + z_span * 0.1)
    ax.set_title(f"{title}\n3D Thermal Gradient Surface", fontsize=12, fontweight="bold", pad=12)
    ax.set_xlabel("X (cm)", fontsize=10, labelpad=8)
    ax.set_ylabel("Y (cm)", fontsize=10, labelpad=8)
    ax.set_zlabel("Temperature (°C)", fontsize=10, labelpad=8)

    # Clean 3D view angles
    ax.view_init(elev=28, azim=-55)

    cbar = fig.colorbar(surf, ax=ax, shrink=0.6, aspect=14, pad=0.08)
    cbar.set_label("Temperature (°C)", fontsize=10)

    plt.tight_layout()
    fig.savefig(str(out_path), bbox_inches="tight")
    plt.close(fig)
    log(f"  saved 3D Surface Mesh: {out_path.name}")
    return str(out_path)


def save_full_gradient_magnitude(temp: np.ndarray, out_path: Path, title: str, px_cm: float = 10.0) -> str:
    H, W = temp.shape
    dx_cm = 1.0 / max(0.1, px_cm)
    dy_cm = 1.0 / max(0.1, px_cm)
    Lx = W * dx_cm
    Ly = H * dy_cm

    sobel_x = cv2.Sobel(temp, cv2.CV_64F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(temp, cv2.CV_64F, 0, 1, ksize=3)
    gx = (sobel_x / 8.0) / dx_cm
    gy = (sobel_y / 8.0) / dy_cm
    grad_mag = np.sqrt(gx**2 + gy**2)

    fig, ax = plt.subplots(figsize=(6.5, 7.5), dpi=150, facecolor="white")
    im = ax.imshow(grad_mag, extent=[0, Lx, Ly, 0], cmap="inferno", aspect="equal")
    ax.set_title(f"{title}\nThermal Gradient Magnitude", fontsize=12, fontweight="bold", pad=10)
    ax.set_xlabel("X (cm)", fontsize=10)
    ax.set_ylabel("Y (cm)", fontsize=10)
    cbar = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    cbar.set_label("Gradient Magnitude (°C/cm)", fontsize=10)
    plt.tight_layout()
    fig.savefig(str(out_path), bbox_inches="tight", facecolor="white")
    plt.close(fig)
    log(f"  saved full gradient magnitude: {out_path.name}")
    return str(out_path)


def save_full_gradient_labeled(temp: np.ndarray, rois: list, out_path: Path, title: str, px_cm: float = 10.0) -> str:
    H, W = temp.shape
    dx_cm = 1.0 / max(0.1, px_cm)
    dy_cm = 1.0 / max(0.1, px_cm)
    Lx = W * dx_cm
    Ly = H * dy_cm

    sobel_x = cv2.Sobel(temp, cv2.CV_64F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(temp, cv2.CV_64F, 0, 1, ksize=3)
    gx = (sobel_x / 8.0) / dx_cm
    gy = (sobel_y / 8.0) / dy_cm
    grad_mag = np.sqrt(gx**2 + gy**2)

    fig, ax = plt.subplots(figsize=(6.5, 7.5), dpi=150, facecolor="white")
    im = ax.imshow(grad_mag, extent=[0, Lx, Ly, 0], cmap="inferno", aspect="equal")
    
    # Overlay ROIs
    for roi in (rois or []):
        name = roi.get("labelName", "ROI")
        col = roi.get("color", "#00e5ff")
        if roi.get("type") == "circle" and "cx" in roi:
            cx_cm = float(roi["cx"]) * dx_cm
            cy_cm = float(roi["cy"]) * dy_cm
            r_cm = float(roi.get("radius", 15)) * dx_cm
            c_circ = plt.Circle((cx_cm, cy_cm), r_cm, color=col, fill=False, linewidth=2)
            ax.add_patch(c_circ)
            ax.plot(cx_cm, cy_cm, "o", color="white", markersize=4, markeredgecolor=col)
            ax.text(cx_cm, cy_cm - r_cm - 0.25, name.upper(), color="white", fontsize=10, fontweight="bold",
                    ha="center", va="bottom", bbox=dict(boxstyle="round,pad=0.2", facecolor="black", alpha=0.7, edgecolor=col))
        elif roi.get("points") and len(roi["points"]) >= 3:
            pts = roi["points"]
            xs = [float(p["x"]) * dx_cm for p in pts] + [float(pts[0]["x"]) * dx_cm]
            ys = [float(p["y"]) * dy_cm for p in pts] + [float(pts[0]["y"]) * dy_cm]
            ax.plot(xs, ys, color=col, linewidth=2)
            cx_cm = float(np.mean([float(p["x"]) * dx_cm for p in pts]))
            cy_cm = float(np.mean([float(p["y"]) * dy_cm for p in pts]))
            ax.plot(cx_cm, cy_cm, "o", color="white", markersize=4, markeredgecolor=col)
            ax.text(cx_cm, cy_cm - 0.35, name.upper(), color="white", fontsize=10, fontweight="bold",
                    ha="center", va="bottom", bbox=dict(boxstyle="round,pad=0.2", facecolor="black", alpha=0.7, edgecolor=col))

    ax.set_title(f"{title}\nThermal Gradient with ROI Labels", fontsize=12, fontweight="bold", pad=10)
    ax.set_xlabel("X (cm)", fontsize=10)
    ax.set_ylabel("Y (cm)", fontsize=10)
    cbar = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    cbar.set_label("Gradient Magnitude (°C/cm)", fontsize=10)
    plt.tight_layout()
    fig.savefig(str(out_path), bbox_inches="tight", facecolor="white")
    plt.close(fig)
    log(f"  saved labeled gradient map: {out_path.name}")
    return str(out_path)


def save_full_gradient_quiver_contours(temp: np.ndarray, rois: list, out_path: Path, title: str, px_cm: float = 10.0) -> str:
    H, W = temp.shape
    dx_cm = 1.0 / max(0.1, px_cm)
    dy_cm = 1.0 / max(0.1, px_cm)
    Lx = W * dx_cm
    Ly = H * dy_cm

    x_arr = np.linspace(0, Lx, W)
    y_arr = np.linspace(0, Ly, H)
    X, Y = np.meshgrid(x_arr, y_arr)

    # Smooth slightly to remove high-frequency thermal sensor noise
    temp_smooth = cv2.GaussianBlur(temp, (5, 5), 1.2)

    sobel_x = cv2.Sobel(temp_smooth, cv2.CV_64F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(temp_smooth, cv2.CV_64F, 0, 1, ksize=3)
    gx = (sobel_x / 8.0) / dx_cm
    gy = (sobel_y / 8.0) / dy_cm
    grad_mag = np.sqrt(gx**2 + gy**2)

    fig, ax = plt.subplots(figsize=(7.5, 9.5), dpi=150, facecolor="white")
    ax.set_facecolor("white")

    # 1. Clean Radiometric Thermal Footprint Background (Inferno)
    im = ax.imshow(temp_smooth, cmap="inferno", extent=[0, Lx, Ly, 0], aspect="auto", alpha=0.92)
    cbar = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    cbar.set_label("Temperature (°C)", fontsize=10, fontweight="bold")

    # 2. Multi-level Isotherm Contours (Crisp subtle lines)
    t_p5 = float(np.percentile(temp_smooth, 10))
    t_p98 = float(np.percentile(temp_smooth, 98))
    if t_p98 - t_p5 > 0.5:
        levels = np.linspace(t_p5, t_p98, 12)
        ax.contour(X, Y, temp_smooth, levels=levels, colors="white", linewidths=0.75, alpha=0.55)

    # 3. Subsampled Quiver Vector Field
    step = max(3, int(round(min(W, H) / 24.0)))
    y_idxs, x_idxs = np.mgrid[step//2:H:step, step//2:W:step]
    x_q = x_idxs * dx_cm
    y_q = y_idxs * dy_cm
    u_q = gx[y_idxs, x_idxs]
    v_q = gy[y_idxs, x_idxs]
    mag_q = grad_mag[y_idxs, x_idxs]

    # Filter out low-gradient noise
    noise_gate = max(0.2, float(np.percentile(grad_mag, 45)))
    active_mask = mag_q > noise_gate

    max_mag = np.max(mag_q[active_mask]) if np.any(active_mask) else 1.0
    scale_factor = max_mag * 1.5

    # Quiver vectors: Vivid Cyan for outstanding contrast against Inferno thermal heatmap
    ax.quiver(
        x_q[active_mask], y_q[active_mask],
        u_q[active_mask], v_q[active_mask],
        color="#00ffff", angles="xy", scale_units="xy",
        scale=scale_factor, width=0.005, headwidth=3.8, headlength=4.8, alpha=0.95
    )

    # Circular ROI badges matching Panel B (T1, M1, M2, HL)
    for roi in (rois or []):
        name = roi.get("labelName", "ROI")
        if roi.get("type") == "circle" and "cx" in roi:
            cx_cm = float(roi["cx"]) * dx_cm
            cy_cm = float(roi["cy"]) * dy_cm
            r_cm = float(roi.get("radius", 15)) * dx_cm
        elif roi.get("points") and len(roi["points"]) >= 3:
            pts = roi["points"]
            cx_cm = float(np.mean([float(p["x"]) * dx_cm for p in pts]))
            cy_cm = float(np.mean([float(p["y"]) * dy_cm for p in pts]))
            r_cm = 1.4
        else:
            continue

        # Concentric rings with high contrast (Yellow & Red)
        c_outer = plt.Circle((cx_cm, cy_cm), r_cm, color="#ffff00", fill=False, linewidth=2.2)
        c_inner = plt.Circle((cx_cm, cy_cm), r_cm * 0.85, color="#ff3333", fill=False, linewidth=1.2, linestyle=":")
        ax.add_patch(c_outer)
        ax.add_patch(c_inner)
        # Center marker
        ax.plot(cx_cm, cy_cm, "o", color="#ffff00", markersize=4.5)

        # Anatomical text label with high-visibility badge
        ax.text(cx_cm, cy_cm - r_cm - 0.4, name.upper(), color="#ffffff", fontsize=12, fontweight="bold",
                ha="center", va="bottom", bbox=dict(boxstyle="round,pad=0.2", facecolor="#111111", edgecolor="#ffff00", alpha=0.85))

    ax.set_xlim(0, Lx)
    ax.set_ylim(Ly, 0) # match top-down image orientation
    ax.set_title(f"{title}\nPPG & PGA (Plantar Peak Gradient & Angle)", fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("X (cm)", fontsize=11, fontweight="bold")
    ax.set_ylabel("Y (cm)", fontsize=11, fontweight="bold")
    ax.grid(True, linestyle=":", alpha=0.35, color="#ffffff")

    plt.tight_layout()
    fig.savefig(str(out_path), bbox_inches="tight", facecolor="white")
    plt.close(fig)
    log(f"  saved gradient quiver & contours (Panel B style): {out_path.name}")
    return str(out_path)


# ─────────────────────────────────────────────────────────────────────────────
#  Save CSVs
# ─────────────────────────────────────────────────────────────────────────────

def save_full_csvs(data: dict, out_dir: Path, stem: str) -> dict:
    csv_paths = {}
    for key in ("temp", "sobelx_raw", "sobely_raw"):
        arr  = data[key]
        path = out_dir / f"{stem}_{key}.csv"
        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            for row in arr:
                w.writerow([f"{v:.6f}" for v in row])
        csv_paths[key] = str(path)
        log(f"  saved {path.name}  {arr.shape}")
    return csv_paths


# ─────────────────────────────────────────────────────────────────────────────
#  Star measurement — 8 compass points around a chosen centre
# ─────────────────────────────────────────────────────────────────────────────

import math

COMPASS = [
    ("N",   0),
    ("NE", 45),
    ("E",  90),
    ("SE", 135),
    ("S",  180),
    ("SW", 225),
    ("W",  270),
    ("NW", 315),
]


def bilinear_sample(arr: np.ndarray, x: float, y: float) -> float:
    """Bilinear interpolation at float pixel (x, y)."""
    h, w = arr.shape
    x = max(0.0, min(float(x), w - 1))
    y = max(0.0, min(float(y), h - 1))
    x0, y0 = int(x), int(y)
    x1, y1 = min(x0 + 1, w - 1), min(y0 + 1, h - 1)
    fx, fy = x - x0, y - y0
    return float(
        arr[y0, x0] * (1 - fx) * (1 - fy) +
        arr[y0, x1] * fx       * (1 - fy) +
        arr[y1, x0] * (1 - fx) * fy       +
        arr[y1, x1] * fx       * fy
    )


def compute_star(temp: np.ndarray, cx: float, cy: float,
                 dist_px: float, rotation_deg: float) -> dict:
    temp_centre = bilinear_sample(temp, cx, cy)
    points = {}
    for name, base_angle in COMPASS:
        angle_rad = math.radians(base_angle + rotation_deg)
        px = cx + dist_px * math.sin(angle_rad)
        py = cy - dist_px * math.cos(angle_rad)
        t  = bilinear_sample(temp, px, py)
        points[name] = {
            "px":        round(px, 2),
            "py":        round(py, 2),
            "angle_deg": round((base_angle + rotation_deg) % 360, 2),
            "temp":      round(t, 6),
            "diff":      round(t - temp_centre, 6),
        }
    return {
        "centre":       {"px": round(cx, 2), "py": round(cy, 2),
                         "temp": round(temp_centre, 6)},
        "points":       points,
        "temp_centre":  round(temp_centre, 6),
        "rotation_deg": rotation_deg,
        "dist_px":      round(dist_px, 2),
    }


def save_star_csv(star: dict, cx: float, cy: float, dist_cm: float,
                  dist_px: float, rotation_deg: float, px_cm: float,
                  out_dir: Path, stem: str) -> str:
    tag      = (f"star_x{int(cx)}_y{int(cy)}"
                f"_d{dist_cm:.1f}cm_r{rotation_deg:.0f}deg")
    csv_path = out_dir / f"{stem}_{tag}.csv"

    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["# STAR MEASUREMENT"])
        w.writerow(["# centre_px",    f"{cx:.2f},{cy:.2f}"])
        w.writerow(["# centre_cm",    f"{cx/px_cm:.4f},{cy/px_cm:.4f}"])
        w.writerow(["# dist_cm",      f"{dist_cm:.4f}"])
        w.writerow(["# dist_px",      f"{dist_px:.2f}"])
        w.writerow(["# rotation_deg", f"{rotation_deg:.2f}"])
        w.writerow(["# px_per_cm",    f"{px_cm:.6f}"])
        w.writerow(["# temp_centre",  f"{star['temp_centre']:.6f}"])
        w.writerow(["#"])
        w.writerow(["# GRADIENT VECTORS (diff = point_temp - centre_temp)"])
        for name, _ in COMPASS:
            p = star["points"][name]
            w.writerow([f"# {name}",
                        f"temp={p['temp']:.6f}",
                        f"diff={p['diff']:+.6f}",
                        f"diff_per_cm={p['diff']/max(dist_cm, 1e-8):+.6f}"])
        w.writerow(["#"])
        w.writerow(["direction", "px_x", "px_y", "x_cm", "y_cm",
                    "angle_deg", "temp", "diff_from_centre", "diff_per_cm"])
        w.writerow(["CENTER",
                    f"{cx:.2f}", f"{cy:.2f}",
                    f"{cx/max(px_cm, 1e-8):.4f}", f"{cy/max(px_cm, 1e-8):.4f}",
                    "—",
                    f"{star['temp_centre']:.6f}",
                    "0.000000", "0.000000"])
        for name, _ in COMPASS:
            p = star["points"][name]
            w.writerow([name,
                        f"{p['px']:.2f}", f"{p['py']:.2f}",
                        f"{p['px']/px_cm:.4f}", f"{p['py']/px_cm:.4f}",
                        f"{p['angle_deg']:.1f}",
                        f"{p['temp']:.6f}",
                        f"{p['diff']:+.6f}",
                        f"{p['diff']/dist_cm:+.6f}"])

    log(f"  saved {csv_path.name}")
    return str(csv_path)


# ─────────────────────────────────────────────────────────────────────────────
#  Commands
# ─────────────────────────────────────────────────────────────────────────────

def cmd_analyze(image_path: str, out_dir_str: str):
    out_dir = Path(out_dir_str)
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = Path(image_path).stem

    log(f"Loading: {image_path}")
    temp = load_temperature(image_path)
    log(f"Shape {temp.shape}  range {temp.min():.1f}–{temp.max():.1f}")

    log("Computing gradients…")
    data = compute(temp)

    log("Saving PNGs…")
    image_paths = save_all_pngs(data, out_dir, stem)

    log("Saving CSVs…")
    csv_paths = save_full_csvs(data, out_dir, stem)

    emit({
        "status"  : "ok",
        "stem"    : stem,
        "out_dir" : str(out_dir),
        "shape"   : list(temp.shape),
        "temp_min": float(temp.min()),
        "temp_max": float(temp.max()),
        "temp_mean": float(temp.mean()),
        "images"  : image_paths,
        "csvs"    : csv_paths,
    })


def cmd_star(image_path: str, cx: float, cy: float,
             dist_cm: float, rotation_deg: float,
             px_cm: float, out_dir_str: str):
    out_dir = Path(out_dir_str)
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = Path(image_path).stem

    log(f"STAR: loading {image_path}")
    temp = load_temperature(image_path)

    dist_px = dist_cm * px_cm
    star    = compute_star(temp, cx, cy, dist_px, rotation_deg)
    csv_path = save_star_csv(star, cx, cy, dist_cm, dist_px,
                             rotation_deg, px_cm, out_dir, stem)

    dom = max(COMPASS, key=lambda nd: abs(star["points"][nd[0]]["diff"]))[0]

    emit({
        "status":       "ok",
        "csv_path":     csv_path,
        "centre_px":    [round(cx), round(cy)],
        "centre_cm":    [round(cx / px_cm, 3), round(cy / px_cm, 3)],
        "temp_centre":  star["temp_centre"],
        "dist_cm":      dist_cm,
        "dist_px":      round(dist_px, 1),
        "rotation_deg": rotation_deg,
        "dominant":     dom,
        "points":       star["points"],
    })


def cmd_crop(image_path: str, points_json_str: str, label_name: str,
             roi_index_str: str, out_dir_str: str):
    out_dir = Path(out_dir_str)
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = Path(image_path).stem

    log(f"CROP: loading {image_path}")
    temp = load_temperature(image_path)
    h, w = temp.shape

    try:
        pts_data = json.loads(points_json_str)
    except Exception as e:
        fail(f"Invalid JSON for ROI points: {e}")

    raw_pts = []
    if isinstance(pts_data, list):
        for p in pts_data:
            if isinstance(p, dict) and "x" in p and "y" in p:
                raw_pts.append((float(p["x"]), float(p["y"])))
            elif isinstance(p, (list, tuple)) and len(p) >= 2:
                raw_pts.append((float(p[0]), float(p[1])))

    if len(raw_pts) < 3:
        fail(f"Polygon must have at least 3 points, got {len(raw_pts)}")

    # Create polygon mask on full image resolution
    pts_arr = np.array(raw_pts, dtype=np.int32)
    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.fillPoly(mask, [pts_arr], 1)

    # Bounding box
    rx, ry, rw, rh = cv2.boundingRect(pts_arr)
    rx = max(0, min(rx, w - 1))
    ry = max(0, min(ry, h - 1))
    rw = max(1, min(rw, w - rx))
    rh = max(1, min(rh, h - ry))

    # Crop temperature array and mask
    temp_crop = temp[ry:ry+rh, rx:rx+rw]
    mask_crop = mask[ry:ry+rh, rx:rx+rw]

    # Calculate statistics inside polygon
    valid_pixels = temp_crop[mask_crop == 1]
    if len(valid_pixels) == 0:
        valid_pixels = temp_crop.flatten()

    mean_v = float(np.mean(valid_pixels))
    min_v  = float(np.min(valid_pixels))
    max_v  = float(np.max(valid_pixels))
    std_v  = float(np.std(valid_pixels))

    safe_label = "".join(c if c.isalnum() or c in ("_", "-") else "_" for c in label_name)
    csv_filename = f"isolated_{stem}_{safe_label}_{roi_index_str}.csv"
    csv_path = out_dir / csv_filename

    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        w_csv = csv.writer(f)
        w_csv.writerow(["# ISOLATED ROI TEMPERATURE MATRIX"])
        w_csv.writerow(["# stem", stem])
        w_csv.writerow(["# label", label_name])
        w_csv.writerow(["# roi_index", roi_index_str])
        w_csv.writerow(["# mean_temp", f"{mean_v:.4f}"])
        w_csv.writerow(["# min_temp", f"{min_v:.4f}"])
        w_csv.writerow(["# max_temp", f"{max_v:.4f}"])
        w_csv.writerow(["# std_temp", f"{std_v:.4f}"])
        w_csv.writerow(["# pixel_count", len(valid_pixels)])
        w_csv.writerow(["#"])
        w_csv.writerow(["y_offset", ry, "x_offset", rx, "width", rw, "height", rh])
        for r_idx in range(rh):
            row_vals = []
            for c_idx in range(rw):
                if mask_crop[r_idx, c_idx] > 0:
                    row_vals.append(f"{temp_crop[r_idx, c_idx]:.6f}")
    # Calculate automatic 8-point star gradient inside this ROI
    cx = float(np.mean(pts_arr[:, 0]))
    cy = float(np.mean(pts_arr[:, 1]))
    rad_px = float(max(5.0, min(rw, rh) / 2.0))
    dist_cm = rad_px / 10.0 # default fallback scale 10 px/cm if uncalibrated

    star_data = compute_star(temp, cx, cy, rad_px, 0.0)
    dom = max(COMPASS, key=lambda nd: abs(star_data["points"][nd[0]]["diff"]))[0]
    dom_diff = star_data["points"][dom]["diff"]
    dom_grad = abs(dom_diff) / max(0.0001, dist_cm)
    grad_modus = f"{dom} ({'+' if dom_diff >= 0 else ''}{dom_diff:.2f}°C)"
    
    grads = [abs(p["diff"]) / max(0.0001, dist_cm) for p in star_data["points"].values()]
    grad_max = round(max(grads), 4) if grads else float(dom_grad)
    grad_min = round(min(grads), 4) if grads else 0.0

    # Save detailed 9-point star gradient CSV
    star_csv_filename = f"isolated_{stem}_{safe_label}_{roi_index_str}_gradient_star.csv"
    star_csv_path = out_dir / star_csv_filename
    with open(star_csv_path, "w", newline="", encoding="utf-8-sig") as sf:
        sw = csv.writer(sf)
        sw.writerow(["point", "direction", "angle_deg", "px", "py", "temp_c", "diff_centre_c", "gradient_c_per_cm"])
        sw.writerow(["centre", "Center", 0, f"{cx:.1f}", f"{cy:.1f}", f"{star_data['temp_centre']:.4f}", "0.0000", "0.0000"])
        for name, angle in COMPASS:
            sp = star_data["points"][name]
            p_grad = abs(sp["diff"]) / max(0.0001, dist_cm)
            sp["grad"] = round(float(p_grad), 4)
            diff_sign = f"+{sp['diff']:.4f}" if sp["diff"] >= 0 else f"{sp['diff']:.4f}"
            sw.writerow([name, name, angle, f"{sp['px']:.1f}", f"{sp['py']:.1f}", f"{sp['temp']:.4f}", diff_sign, f"{p_grad:.4f}"])

        star_data["radius_cm"] = float(dist_cm)
        star_data["gradient_max"] = float(grad_max)
        star_data["gradient_min"] = float(grad_min)
        star_data["gradient_modus"] = str(grad_modus)

    # Render cropped thermal PNG with masked transparency and 8-point star overlay
    norm_crop = np.clip((temp_crop - 20.0) / 25.0 * 255.0, 0, 255).astype(np.uint8)
    colored_bgr = cv2.applyColorMap(norm_crop, cv2.COLORMAP_INFERNO)
    colored_rgba = cv2.cvtColor(colored_bgr, cv2.COLOR_BGR2BGRA)
    colored_rgba[mask_crop == 0, 3] = 0 # Transparent background outside polygon

    rel_cx = int(round(cx - rx))
    rel_cy = int(round(cy - ry))
    rel_r = int(round(rad_px))

    # Incircle outline
    cv2.circle(colored_rgba, (rel_cx, rel_cy), rel_r, (255, 229, 0, 180), 1)

    # 8 radial spokes
    for name, angle in COMPASS:
        sp = star_data["points"][name]
        sp_x = int(round(sp["px"] - rx))
        sp_y = int(round(sp["py"] - ry))
        col = (70, 90, 255, 230) if sp["diff"] >= 0 else (255, 160, 80, 230)
        cv2.line(colored_rgba, (rel_cx, rel_cy), (sp_x, sp_y), col, 1)
        cv2.putText(colored_rgba, name, (sp_x - 3, sp_y - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.28, (255, 255, 255, 255), 1)

    # Center dot
    cv2.circle(colored_rgba, (rel_cx, rel_cy), 2, (255, 255, 255, 255), -1)

    png_filename = f"isolated_{stem}_{safe_label}_{roi_index_str}.png"
    png_path = out_dir / png_filename
    cv2.imwrite(str(png_path), colored_rgba)
    log(f"  saved isolated ROI PNG: {png_path.name}")

    # Generate 1x Tight 2D Quiver & 3D Gradient Surface Plots from square orthogonal patch
    rad_int = max(8, int(round(rad_px)))
    sq_x0 = max(0, int(round(cx - rad_int)))
    sq_x1 = min(temp.shape[1], int(round(cx + rad_int)))
    sq_y0 = max(0, int(round(cy - rad_int)))
    sq_y1 = min(temp.shape[0], int(round(cy + rad_int)))
    temp_square_patch = temp[sq_y0:sq_y1, sq_x0:sq_x1]

    effective_px_cm = rad_px / max(0.001, dist_cm)
    png_2d_quiver_path = None
    png_3d_surface_path = None
    if temp_square_patch.size > 0 and temp_square_patch.shape[0] >= 4 and temp_square_patch.shape[1] >= 4:
        try:
            p2d = out_dir / f"isolated_{stem}_{safe_label}_{roi_index_str}_2d_quiver.png"
            png_2d_quiver_path = save_gradient_2d_quiver(temp_square_patch, p2d, f"{label_name} ({stem})", effective_px_cm)
        except Exception as e:
            log(f"  warning: failed to render 2D quiver: {e}")

        try:
            p3d = out_dir / f"isolated_{stem}_{safe_label}_{roi_index_str}_3d_surface.png"
            png_3d_surface_path = save_gradient_3d_surface(temp_square_patch, p3d, f"{label_name} ({stem})", effective_px_cm)
        except Exception as e:
            log(f"  warning: failed to render 3D surface: {e}")

    # Generate 2x Expanded Context Area Plots (with original ROI boundary overlay)
    rad_2x = max(16, int(round(rad_px * 2.0)))
    ctx_x0 = max(0, int(round(cx - rad_2x)))
    ctx_x1 = min(temp.shape[1], int(round(cx + rad_2x)))
    ctx_y0 = max(0, int(round(cy - rad_2x)))
    ctx_y1 = min(temp.shape[0], int(round(cy + rad_2x)))
    temp_2x_patch = temp[ctx_y0:ctx_y1, ctx_x0:ctx_x1]

    png_2x_2d_path = None
    png_2x_3d_path = None
    if temp_2x_patch.size > 0 and temp_2x_patch.shape[0] >= 4 and temp_2x_patch.shape[1] >= 4:
        try:
            p2d_2x = out_dir / f"isolated_{stem}_{safe_label}_{roi_index_str}_2x_context_2d.png"
            patch_poly_cm = [
                ((float(pt[0]) - ctx_x0) / effective_px_cm, (ctx_y1 - float(pt[1])) / effective_px_cm)
                for pt in pts_arr
            ]
            png_2x_2d_path = save_gradient_2d_quiver(temp_2x_patch, p2d_2x, f"{label_name} 2x Context ({stem})", effective_px_cm, roi_polygon=patch_poly_cm)
        except Exception as e:
            log(f"  warning: failed to render 2x context 2D quiver: {e}")

        try:
            p3d_2x = out_dir / f"isolated_{stem}_{safe_label}_{roi_index_str}_2x_context_3d.png"
            patch_poly_cm = [
                ((float(pt[0]) - ctx_x0) / effective_px_cm, (ctx_y1 - float(pt[1])) / effective_px_cm)
                for pt in pts_arr
            ]
            png_2x_3d_path = save_gradient_3d_surface(temp_2x_patch, p3d_2x, f"{label_name} 2x Context ({stem})", effective_px_cm, roi_polygon=patch_poly_cm)
        except Exception as e:
            log(f"  warning: failed to render 2x context 3D surface: {e}")

    emit({
        "status":              "ok",
        "csv_path":            str(csv_path),
        "star_csv_path":       str(star_csv_path),
        "png_path":            str(png_path),
        "png_2d_quiver_path":  str(png_2d_quiver_path) if png_2d_quiver_path else None,
        "png_3d_surface_path": str(png_3d_surface_path) if png_3d_surface_path else None,
        "png_2x_2d_path":      str(png_2x_2d_path) if png_2x_2d_path else None,
        "png_2x_3d_path":      str(png_2x_3d_path) if png_2x_3d_path else None,
        "stem":                stem,
        "label":               label_name,
        "roi_index":           int(roi_index_str),
        "mean_temp":           mean_v,
        "min_temp":            min_v,
        "max_temp":            max_v,
        "std_temp":            std_v,
        "pixel_count":         len(valid_pixels),
        "gradient_max":        grad_max,
        "gradient_min":        grad_min,
        "gradient_modus":      grad_modus,
        "star_center_temp":    star_data["temp_centre"],
        "star_radius_cm":      dist_cm,
        "star":                star_data,
    })


def cmd_gradient_scene(image_path: str, rois_json_str: str, px_cm: float, out_dir_str: str):
    out_dir = Path(out_dir_str)
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = Path(image_path).stem

    log(f"GRADIENT_SCENE: loading {image_path}")
    temp = load_temperature(image_path)

    try:
        rois = json.loads(rois_json_str) if rois_json_str else []
    except Exception as e:
        log(f"  warning: failed to parse rois json: {e}")
        rois = []

    p1 = out_dir / f"gradient_full_scene_{stem}.png"
    p2 = out_dir / f"gradient_labeled_scene_{stem}.png"
    p3 = out_dir / f"gradient_quiver_contour_{stem}.png"

    path1 = save_full_gradient_magnitude(temp, p1, stem, px_cm)
    path2 = save_full_gradient_labeled(temp, rois, p2, stem, px_cm)
    path3 = save_full_gradient_quiver_contours(temp, rois, p3, stem, px_cm)

    emit({
        "status": "ok",
        "stem": stem,
        "full_gradient_path": str(path1),
        "labeled_gradient_path": str(path2),
        "quiver_contour_path": str(path3)
    })


def cmd_plantar_fig1(image_path: str, rois_json_str: str, out_dir_str: str):
    out_dir = Path(out_dir_str)
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = Path(image_path).stem

    log(f"PLANTAR_FIG1: loading {image_path}")
    temp = load_temperature(image_path)
    H, W = temp.shape

    try:
        rois = json.loads(rois_json_str) if rois_json_str else []
    except Exception as e:
        log(f"  warning: failed to parse rois json: {e}")
        rois = []

    # 1. Determine Foot Side: Screen Left (avg_x < W/2) -> Right Foot in camera plantar view
    xs = [r.get("cx", r.get("points", [{}])[0].get("x", W / 2)) for r in rois if isinstance(r, dict)]
    avg_x = float(np.mean(xs)) if xs else (W / 4)

    col_prof = np.mean(temp, axis=0)
    c_start, c_end = int(W * 0.35), int(W * 0.65)
    valley_idx = int(np.argmin(col_prof[c_start:c_end])) + c_start

    if avg_x < valley_idx:
        foot_side = "RightFoot"
        foot_patch_raw = temp[:, :valley_idx]
        offset_x = 0
    else:
        foot_side = "LeftFoot"
        foot_patch_raw = temp[:, valley_idx:]
        offset_x = valley_idx

    # Crop foot bounding box
    mask = foot_patch_raw > max(26.0, float(np.percentile(foot_patch_raw, 35)))
    ys, xs_mask = np.where(mask)
    pad = 4
    if len(ys) > 50:
        ymin = max(0, int(np.min(ys)) - pad)
        ymax = min(H - 1, int(np.max(ys)) + pad)
        xmin = max(0, int(np.min(xs_mask)) - pad)
        xmax = min(foot_patch_raw.shape[1] - 1, int(np.max(xs_mask)) + pad)
        foot_crop = foot_patch_raw[ymin:ymax+1, xmin:xmax+1]
    else:
        ymin, ymax, xmin, xmax = 0, H - 1, 0, foot_patch_raw.shape[1] - 1
        foot_crop = foot_patch_raw

    n_rows, n_cols = 104, 54
    grid_dense = cv2.resize(foot_crop, (n_cols, n_rows), interpolation=cv2.INTER_AREA)
    foot_mask = grid_dense > 28.5
    grid_disp = grid_dense.copy()
    grid_disp[~foot_mask] = 23.5

    grid_smooth = cv2.GaussianBlur(grid_dense, (7, 7), 1.8)
    sobel_x = cv2.Sobel(grid_smooth, cv2.CV_64F, 1, 0, ksize=3) / 8.0
    sobel_y = cv2.Sobel(grid_smooth, cv2.CV_64F, 0, 1, ksize=3) / 8.0
    grad_mag = np.sqrt(sobel_x**2 + sobel_y**2)

    grid_contour = grid_smooth.copy()
    grid_contour[~foot_mask] = np.nan

    crop_w = max(1, xmax - xmin + 1)
    crop_h = max(1, ymax - ymin + 1)
    mapped_rois = []
    radius_grid = 3.6

    for r in rois:
        if not isinstance(r, dict):
            continue
        name = str(r.get("labelName", "ROI")).upper()
        rcx = float(r.get("cx", 0)) - offset_x - xmin
        rcy = float(r.get("cy", 0)) - ymin
        gx = (rcx / crop_w) * n_cols + 1
        gy = (rcy / crop_h) * n_rows + 1
        gx = float(np.clip(gx, 4.0, n_cols - 4.0))
        gy = float(np.clip(gy, 4.0, n_rows - 4.0))
        mapped_rois.append((name, gx, gy))

    if not mapped_rois:
        if foot_side == "RightFoot":
            mapped_rois = [("T1", 17.0, 22.0), ("M1", 14.0, 40.0), ("M3", 27.0, 38.0), ("HL", 27.0, 88.0)]
        else:
            mapped_rois = [("T1", 37.0, 19.0), ("M1", 39.0, 41.0), ("M3", 26.0, 39.0), ("HL", 28.0, 87.0)]
    else:
        has_heel = any("H" in m[0] or "HEEL" in m[0] for m in mapped_rois)
        if not has_heel:
            hl_gx = 27.0 if foot_side == "RightFoot" else 28.0
            mapped_rois.append(("HL", hl_gx, 88.0))

    # White-Hot Colormap
    cmap_thermal = LinearSegmentedColormap.from_list("flir_whitehot", [
        (0.00, "#000000"), (0.12, "#180036"), (0.28, "#4f046e"),
        (0.44, "#990060"), (0.60, "#d92c20"), (0.74, "#f57a00"),
        (0.85, "#fcb800"), (0.93, "#ffea70"), (1.00, "#ffffff"),
    ])

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(8.5, 11), dpi=220, facecolor="white")
    ax1.set_facecolor("#000000")
    x_edges = np.arange(0.5, n_cols + 1.5, 1)
    y_edges = np.arange(0.5, n_rows + 1.5, 1)
    X_e, Y_e = np.meshgrid(x_edges, y_edges)

    ax1.pcolormesh(X_e, Y_e, grid_disp, cmap=cmap_thermal, vmin=23.5, vmax=np.max(grid_dense),
                   edgecolors="#111111", linewidth=0.20, shading="flat")
    ax1.set_xlim(1.5, n_cols + 0.5)
    ax1.set_ylim(n_rows + 0.5, 1.5)
    ax1.set_aspect("equal")
    ax1.tick_params(colors="black", labelsize=9)

    for name, gx, gy in mapped_rois:
        c_out = plt.Circle((gx, gy), radius_grid, edgecolor="#00e5ff", facecolor="none", lw=2.0, zorder=10)
        c_in = plt.Circle((gx, gy), radius_grid * 0.82, edgecolor="red", facecolor="none", lw=1.3, zorder=11)
        ax1.add_patch(c_out)
        ax1.add_patch(c_in)
        ax1.plot(gx, gy, "o", color="red", markeredgecolor="white", markeredgewidth=1.0, markersize=5, zorder=12)
        ty = 7.5 if gy < 50 else -6.5
        ax1.text(gx, gy + ty, name, color="white", fontsize=16, fontweight="bold",
                 ha="center", va="center", zorder=15,
                 bbox=dict(boxstyle="round,pad=0.15", facecolor="#000000", alpha=0.6, edgecolor="none"))

    ax1.set_title("(A)\n\nPPP", fontsize=18, fontweight="bold", pad=12)

    ax2.set_facecolor("white")
    levels = np.linspace(np.nanmin(grid_contour), np.nanmax(grid_contour), 16)
    ax2.contour(np.arange(1, n_cols + 1), np.arange(1, n_rows + 1), grid_contour,
                levels=levels, cmap=cmap_thermal, linewidths=1.0, alpha=0.90)

    foot_outline = (foot_mask).astype(np.uint8)
    ax2.contour(np.arange(1, n_cols + 1), np.arange(1, n_rows + 1), foot_outline,
                levels=[0.5], colors="#777799", linewidths=0.7, linestyles="--")

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
               color="#0b4db7", angles="xy", scale_units="xy", scale=1.0,
               width=0.0038, headwidth=3.4, headlength=4.2, zorder=8)

    ax2.set_xlim(1.5, n_cols + 0.5)
    ax2.set_ylim(n_rows + 0.5, 1.5)
    ax2.set_aspect("equal")
    ax2.tick_params(colors="black", labelsize=9)

    metrics = []
    for name, gx, gy in mapped_rois:
        c_out = plt.Circle((gx, gy), radius_grid, edgecolor="red", facecolor="none", lw=2.0, zorder=10)
        c_in = plt.Circle((gx, gy), radius_grid * 0.82, edgecolor="red", facecolor="none", lw=1.2, linestyle=":", zorder=11)
        ax2.add_patch(c_out)
        ax2.add_patch(c_in)
        ax2.plot(gx, gy, "o", color="red", markersize=4.5, zorder=12)
        ty = 7.5 if gy < 50 else -6.5
        ax2.text(gx, gy + ty, name, color="black", fontsize=16, fontweight="bold", ha="center", va="center", zorder=15)

        ix = int(round(gx)) - 1
        iy = int(round(gy)) - 1
        val_ppp = float(grid_dense[iy, ix])
        gx_val = float(sobel_x[iy, ix])
        gy_val = float(sobel_y[iy, ix])
        val_ppg = float(np.sqrt(gx_val**2 + gy_val**2))
        val_pga = float(np.degrees(np.arctan2(gy_val, gx_val)))
        metrics.append({
            "ROI": name,
            "Grid_X": round(gx, 1),
            "Grid_Y": round(gy, 1),
            "PPP_Peak_Value": round(val_ppp, 2),
            "PPG_Gradient_Mag": round(val_ppg, 3),
            "PGA_Angle_Deg": round(val_pga, 1)
        })

    ax2.set_title("(B)\n\nPPG & PGA", fontsize=18, fontweight="bold", pad=12)
    plt.tight_layout()

    out_png = out_dir / f"{stem}_{foot_side}_whitehot.png"
    out_csv = out_dir / f"{stem}_{foot_side}_metrics.csv"
    fig.savefig(str(out_png), bbox_inches="tight", facecolor="white")
    plt.close(fig)

    df = pd.DataFrame(metrics)
    df.to_csv(str(out_csv), index=False)

    emit({
        "status": "ok",
        "stem": stem,
        "foot_side": foot_side,
        "png_path": str(out_png),
        "csv_path": str(out_csv)
    })


# ─────────────────────────────────────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 2:
        fail("Usage: analyzer.py <analyze|star|crop|gradient_scene|plantar_fig1> ...")

    command = sys.argv[1].lower()

    if command == "analyze":
        if len(sys.argv) < 4:
            fail("Usage: analyzer.py analyze <imagePath> <outputDir>")
        cmd_analyze(sys.argv[2], sys.argv[3])

    elif command == "star":
        if len(sys.argv) < 9:
            fail("Usage: analyzer.py star <imagePath> <cx> <cy> <dist_cm> <rotation_deg> <px_per_cm> <outputDir>")
        cmd_star(
            image_path   = sys.argv[2],
            cx           = float(sys.argv[3]),
            cy           = float(sys.argv[4]),
            dist_cm      = float(sys.argv[5]),
            rotation_deg = float(sys.argv[6]),
            px_cm        = float(sys.argv[7]),
            out_dir_str  = sys.argv[8],
        )

    elif command == "crop":
        if len(sys.argv) < 7:
            fail("Usage: analyzer.py crop <imagePath> <pointsJson> <labelName> <roiIndex> <outputDir>")
        cmd_crop(
            image_path      = sys.argv[2],
            points_json_str = sys.argv[3],
            label_name      = sys.argv[4],
            roi_index_str   = sys.argv[5],
            out_dir_str     = sys.argv[6],
        )

    elif command == "gradient_scene":
        if len(sys.argv) < 6:
            fail("Usage: analyzer.py gradient_scene <imagePath> <roisJson> <pxPerCm> <outputDir>")
        cmd_gradient_scene(
            image_path    = sys.argv[2],
            rois_json_str = sys.argv[3],
            px_cm         = float(sys.argv[4]),
            out_dir_str   = sys.argv[5],
        )

    elif command == "plantar_fig1":
        if len(sys.argv) < 5:
            fail("Usage: analyzer.py plantar_fig1 <imagePath> <roisJson> <outputDir>")
        cmd_plantar_fig1(
            image_path    = sys.argv[2],
            rois_json_str = sys.argv[3],
            out_dir_str   = sys.argv[4],
        )

    else:
        fail(f"Unknown command: {command}. Use 'analyze', 'star', 'crop', 'gradient_scene', or 'plantar_fig1'.")

