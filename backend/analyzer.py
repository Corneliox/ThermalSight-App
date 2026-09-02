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
    panels = {
        "original"        : (data["temp"],        "inferno", "Temperature (°C)"),
        "magnitude"       : (data["magnitude"],   "hot",     "Gradient Magnitude"),
        "mag_thresh"      : (data["mag_thresh"],  "hot",     "Magnitude Thresholded"),
        "angle"           : (data["angle"],       "hsv",     "Gradient Angle"),
        "overlay"         : (data["overlay_rgb"], None,      "Overlay"),
    }
    paths = {}
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


def save_gradient_2d_quiver(temp_patch: np.ndarray, out_path: Path, title: str, px_cm: float = 10.0) -> str:
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


def save_gradient_3d_surface(temp_patch: np.ndarray, out_path: Path, title: str, px_cm: float = 10.0) -> str:
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


# ─────────────────────────────────────────────────────────────────────────────
#  Save CSVs
# ─────────────────────────────────────────────────────────────────────────────

def save_full_csvs(data: dict, out_dir: Path, stem: str) -> dict:
    csv_paths = {}
    for key in ("temp", "sobelx_raw", "sobely_raw"):
        arr  = data[key]
        path = out_dir / f"{stem}_{key}.csv"
        with open(path, "w", newline="") as f:
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

    with open(csv_path, "w", newline="") as f:
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

    if len(raw_pts) == 2:
        x0, y0 = raw_pts[0]
        x1, y1 = raw_pts[1]
        raw_pts = [
            (min(x0, x1), min(y0, y1)),
            (max(x0, x1), min(y0, y1)),
            (max(x0, x1), max(y0, y1)),
            (min(x0, x1), max(y0, y1))
        ]

    if len(raw_pts) < 3:
        fail("ROI points must form at least 3 vertices or 2 bounding box corners")

    pts_arr = np.array([[int(round(x)), int(round(y))] for x, y in raw_pts], dtype=np.int32)
    pts_arr[:, 0] = np.clip(pts_arr[:, 0], 0, w - 1)
    pts_arr[:, 1] = np.clip(pts_arr[:, 1], 0, h - 1)

    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.fillPoly(mask, [pts_arr], 255)

    rx, ry, rw, rh = cv2.boundingRect(pts_arr)
    rw = max(1, rw)
    rh = max(1, rh)

    temp_crop = temp[ry:ry+rh, rx:rx+rw].copy()
    mask_crop = mask[ry:ry+rh, rx:rx+rw]

    valid_pixels = temp_crop[mask_crop > 0]
    if len(valid_pixels) == 0:
        valid_pixels = temp_crop.flatten()

    mean_v = float(np.mean(valid_pixels))
    min_v  = float(np.min(valid_pixels))
    max_v  = float(np.max(valid_pixels))
    std_v  = float(np.std(valid_pixels))

    safe_label = "".join([c if c.isalnum() else "_" for c in label_name])
    csv_filename = f"isolated_{stem}_{safe_label}_{roi_index_str}.csv"
    csv_path = out_dir / csv_filename

    with open(csv_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([f"# ISOLATED SEGMENTATION ROI - {stem} - {label_name}"])
        writer.writerow(["# label", safe_label])
        writer.writerow(["# roi_index", roi_index_str])
        writer.writerow(["# mean_temp", f"{mean_v:.6f}"])
        writer.writerow(["# min_temp",  f"{min_v:.6f}"])
        writer.writerow(["# max_temp",  f"{max_v:.6f}"])
        writer.writerow(["# std_temp",  f"{std_v:.6f}"])
        writer.writerow(["# pixel_count", len(valid_pixels)])
        writer.writerow(["#"])

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
    grad_max = float(dom_grad)

    # Save detailed 9-point star gradient CSV
    star_csv_filename = f"isolated_{stem}_{safe_label}_{roi_index_str}_gradient_star.csv"
    star_csv_path = out_dir / star_csv_filename
    with open(star_csv_path, "w", newline="") as sf:
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

    # Generate 2D Quiver & 3D Gradient Surface Plots from square orthogonal patch
    rad_int = max(8, int(round(rad_px)))
    sq_x0 = max(0, int(round(cx - rad_int)))
    sq_x1 = min(temp.shape[1], int(round(cx + rad_int)))
    sq_y0 = max(0, int(round(cy - rad_int)))
    sq_y1 = min(temp.shape[0], int(round(cy + rad_int)))
    temp_square_patch = temp[sq_y0:sq_y1, sq_x0:sq_x1]

    png_2d_quiver_path = None
    png_3d_surface_path = None
    if temp_square_patch.size > 0 and temp_square_patch.shape[0] >= 4 and temp_square_patch.shape[1] >= 4:
        try:
            p2d = out_dir / f"isolated_{stem}_{safe_label}_{roi_index_str}_2d_quiver.png"
            effective_px_cm = rad_px / max(0.001, dist_cm)
            png_2d_quiver_path = save_gradient_2d_quiver(temp_square_patch, p2d, f"{label_name} ({stem})", effective_px_cm)
        except Exception as e:
            log(f"  warning: failed to render 2D quiver: {e}")

        try:
            p3d = out_dir / f"isolated_{stem}_{safe_label}_{roi_index_str}_3d_surface.png"
            effective_px_cm = rad_px / max(0.001, dist_cm)
            png_3d_surface_path = save_gradient_3d_surface(temp_square_patch, p3d, f"{label_name} ({stem})", effective_px_cm)
        except Exception as e:
            log(f"  warning: failed to render 3D surface: {e}")

    emit({
        "status":              "ok",
        "csv_path":            str(csv_path),
        "star_csv_path":       str(star_csv_path),
        "png_path":            str(png_path),
        "png_2d_quiver_path":  str(png_2d_quiver_path) if png_2d_quiver_path else None,
        "png_3d_surface_path": str(png_3d_surface_path) if png_3d_surface_path else None,
        "stem":                stem,
        "label":               label_name,
        "roi_index":           int(roi_index_str),
        "mean_temp":           mean_v,
        "min_temp":            min_v,
        "max_temp":            max_v,
        "std_temp":            std_v,
        "pixel_count":         len(valid_pixels),
        "gradient_max":        grad_max,
        "gradient_modus":      grad_modus,
        "star_center_temp":    star_data["temp_centre"],
        "star_radius_cm":      dist_cm,
        "star":                star_data,
    })


# ─────────────────────────────────────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 2:
        fail("Usage: analyzer.py <analyze|star|crop> ...")

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

    else:
        fail(f"Unknown command: {command}. Use 'analyze', 'star', or 'crop'.")
