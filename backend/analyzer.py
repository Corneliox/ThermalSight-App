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

# 8 compass directions with base angle from North, clockwise
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
    """
    Place 8 compass points at distance dist_px from (cx, cy), rotated
    by rotation_deg clockwise. Return coords + temps + diffs from centre.
    Image coords: +x = East, +y = South  →  North = -y direction.
    """
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
                        f"diff_per_cm={p['diff']/dist_cm:+.6f}"])
        w.writerow(["#"])
        w.writerow(["direction", "px_x", "px_y", "x_cm", "y_cm",
                    "angle_deg", "temp", "diff_from_centre", "diff_per_cm"])
        # centre row
        w.writerow(["CENTER",
                    f"{cx:.2f}", f"{cy:.2f}",
                    f"{cx/px_cm:.4f}", f"{cy/px_cm:.4f}",
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

    # dominant direction = point with largest absolute diff
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


# ─────────────────────────────────────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 2:
        fail("Usage: analyzer.py analyze <imagePath> <outputDir>")

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

    else:
        fail(f"Unknown command: {command}. Use 'analyze' or 'star'.")
