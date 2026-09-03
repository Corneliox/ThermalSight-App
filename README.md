# 🌡 ThermalSight

[![Version](https://img.shields.io/badge/version-1.6.5-blue.svg)](https://github.com/Corneliox/ThermalSight-App/releases/tag/v1.6.5)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Web-brightgreen.svg)]()
[![Web App](https://img.shields.io/badge/Live%20Demo-Firebase%20Hosting-orange.svg)](https://thermalsight-web-2026.web.app)
[![License](https://img.shields.io/badge/license-MIT-purple.svg)]()

**ThermalSight** is a high-precision biomedical and industrial thermal imaging suite designed for radiometric temperature analysis, multi-label region segmentation, time-series treadmill/pressure protocol tracking, and automated 8-point compass thermal gradient extraction.

Available as both an offline desktop application (**Electron + Python backend**) and a zero-install, 100% client-side web application (**React + HTML5 Canvas engine**).

🌐 **Live Web Application**: [https://thermalsight-web-2026.web.app](https://thermalsight-web-2026.web.app)

---

## 📑 Table of Contents

- [Key Features](#-key-features)
- [Mathematical Formulation](#-mathematical-formulation)
- [Application Architecture](#-application-architecture)
- [Output Package Structure](#-output-package-structure)
- [Installation & Getting Started](#-installation--getting-started)
  - [Web Application](#1-web-application)
  - [Desktop Application (Windows / macOS)](#2-desktop-application-windows--macos)
- [Workflow & Usage Guide](#-workflow--usage-guide)
- [Keyboard Shortcuts](#-keyboard-shortcuts)
- [Authors & Acknowledgments](#-authors--acknowledgments)
- [License](#-license)

---

## ✨ Key Features

### 1. Radiometric FLIR Thermal Decoding
- Sub-pixel float32 temperature matrix reconstruction from radiometric FLIR images.
- Dynamic colormap visualization (**Inferno**, **Ironbow**, **Jet**, **Grayscale**) with contrast stretch and temperature span clipping.
- Real-time bilinear temperature probing under the cursor.

### 2. Multi-Label Polygon Region Segmentation (ROIs)
- Multi-region polygon annotation with customizable label variables ($m_1, m_2, m_3, \dots, m_n$).
- Automated pixel extraction, masked polygon cropping, standard deviation ($\sigma$), mean, minimum, and maximum temperature calculations.
- Automatic calibration support via scale bar drawing ($\text{px}/\text{cm}$).

### 3. Automated 8-Point Compass Star Gradient Engine
- Automatically inscribes an 8-spoke compass star inside every segmented ROI.
- Samples sub-pixel temperatures along 8 cardinal and intercardinal axes ($\text{N, NE, E, SE, S, SW, W, NW}$).
- Computes directional thermal gradient magnitude ($G_k$ in $^\circ\text{C}/\text{cm}$), maximum gradient ($G_{\max}$), and dominant gradient direction (**Modus**).

### 4. Whole-Scene Gradient & Quiver Vector Field Suite (Panel B Style)
- **Whole-Scene Gradient Magnitude**: Continuous 2D spatial gradient magnitude map $\|\vec{\nabla} T\|$ in $^\circ\text{C}/\text{cm}$.
- **Whole-Scene Gradient with ROI Labels**: Spatial gradient map with polygon/circle boundaries, centroids, and label badges overlaid.
- **Biomechanical Quiver & Isotherm Contour Map (TPG & TGA)**: Publication-grade vector map on clean white background with multi-level isotherm contours, gradient quiver arrows pointing along $\vec{\nabla} T$, and anatomical circular ROI markers (T1, M1, M2, HL).

### 5. Multi-Mode Relative Sequence Progression
- Side-by-side time-series comparison across protocol steps (Step 1 to Step $N$, e.g., Treadmill Rest $\to$ 80 mmHg $\to$ 160 mmHg $\to$ Heat).
- High-resolution montage generator:
  - `comparison_overall_all_labels.png`: Full thermal view displaying all ROIs simultaneously.
  - `comparison_relative_{label}.png`: Full thermal view focused specifically on a target label with relative baseline delta metrics.
- Computes temporal differential deltas relative to Step 1 baseline:
  $$\Delta T_{\text{center}}(t) = T_{\text{center}}(t) - T_{\text{center}}(1), \quad \Delta T_{\text{mean}}(t) = T_{\text{mean}}(t) - T_{\text{mean}}(1)$$

### 6. 8-Axis Polar Radar Gradient Profiles
- Polar radar diagrams overlaying directional gradient vectors across all sequence steps.
- Visualizes heat dissipation trajectories and directional vascular response over time.
- Direct export to scalable vector graphics (`radar_gradient_{label}_dark.svg` and `white.svg`).

---

## 📐 Mathematical Formulation

```
                                  N (0°)
                                    │
                       NW (315°)    │    NE (45°)
                              \     │     /
                                \   │   /
                                  \ │ /
             W (270°) ──────────── (xc, yc) ──────────── E (90°)
                                  / │ \
                                /   │   \
                              /     │     \
                       SW (225°)    │    SE (135°)
                                    │
                                  S (180°)
```

### 1. 8-Spoke Compass Star Geometry
Given the centroid $(x_c, y_c)$ of an ROI polygon and the maximum inscribed circle radius $R_{\text{px}} = \frac{\min(W_{\text{ROI}}, H_{\text{ROI}})}{2}$:
For each direction $k \in \{\text{N, NE, E, SE, S, SW, W, NW}\}$ with angle $\theta_k \in \{0^\circ, 45^\circ, 90^\circ, 135^\circ, 180^\circ, 225^\circ, 270^\circ, 315^\circ\}$:

$$x_k = x_c + R_{\text{px}} \cdot \sin(\theta_k)$$
$$y_k = y_c - R_{\text{px}} \cdot \cos(\theta_k)$$

### 2. Bilinear Sub-Pixel Temperature Interpolation
Temperature at float coordinate $(x, y)$ is interpolated continuously from the 2D discrete matrix:
$$T(x, y) = (1 - f_x)(1 - f_y) T[y_0, x_0] + f_x(1 - f_y) T[y_0, x_1] + (1 - f_x)f_y T[y_1, x_0] + f_x f_y T[y_1, x_1]$$
where $x_0 = \lfloor x \rfloor, x_1 = x_0 + 1, f_x = x - x_0$, and $y_0 = \lfloor y \rfloor, y_1 = y_0 + 1, f_y = y - y_0$.

### 3. Directional Thermal Gradient ($G_k$)
With pixel calibration scale $S_{\text{px/cm}}$, physical radius distance is $R_{\text{cm}} = \frac{R_{\text{px}}}{S_{\text{px/cm}}}$.  
The directional gradient from centroid $(x_c, y_c)$ toward compass vertex $k$ is:
$$G_k = \frac{T(x_k, y_k) - T(x_c, y_c)}{R_{\text{cm}}} \quad \left[\frac{^\circ\text{C}}{\text{cm}}\right]$$

### 4. Maximum Gradient & Dominant Modus Direction
$$G_{\max} = \max_{k \in \text{COMPASS}} |G_k| \quad \left[\frac{^\circ\text{C}}{\text{cm}}\right]$$
$$\text{Modus} = \arg\max_{k \in \text{COMPASS}} |T(x_k, y_k) - T(x_c, y_c)|$$

---

## 🏗 Application Architecture

```
                               ┌────────────────────────────────────────────────────────┐
                               │                      THERMALSIGHT                      │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                      ┌────────────────────────────────────┴───────────────────────────────────┐
                      ▼                                                                        ▼
         ┌─────────────────────────┐                                              ┌─────────────────────────┐
         │     DESKTOP EDITION     │                                              │       WEB EDITION       │
         │  (Electron + Python)    │                                              │  (100% Client-Side JS)  │
         └────────────┬────────────┘                                              └────────────┬────────────┘
                      │                                                                        │
        ┌─────────────┴─────────────┐                                            ┌─────────────┴─────────────┐
        ▼                           ▼                                            ▼                           ▼
 ┌──────────────┐            ┌──────────────┐                             ┌──────────────┐            ┌──────────────┐
 │  Electron    │            │ Python Core  │                             │  React +     │            │ thermalEngine│
 │  Main / IPC  │ ◄────────► │ (OpenCV,     │                             │  Vite UI     │ ◄────────► │ (HTML5 Canvas│
 │  Controller  │            │  NumPy,      │                             │  App         │            │  JS Client)  │
 │              │            │  Matplotlib) │                             │              │            │  LUT / Sobel)│
 └──────────────┘            └──────────────┘                             └──────────────┘            └──────────────┘
```

---

## 📦 Output Package Structure

When saving labels and exporting, ThermalSight generates a comprehensive analysis suite (`{FolderName}_Result/` or `{FolderName}_Result.zip`):

```
📂 {FolderName}_Result/
├── 📄 annotations_session.json               # Full session metadata & polygon vertices
├── 📄 master_summary_all_labels.csv          # Combined metrics & 8-directional gradients (UTF-8 BOM)
├── 📄 m1_summary.csv                         # Step-by-step summary for ROI m1
├── 📄 m2_summary.csv                         # Step-by-step summary for ROI m2
├── 📊 graph_m1_dark.svg / white.svg          # Min-Max range band & mean curve
├── 🕸 radar_gradient_m1_dark.svg / white.svg # 8-axis polar gradient radar profile
├── 🖼 comparison_overall_all_labels.png      # Multi-step sequence strip (All ROIs)
├── 🖼 comparison_relative_m1.png             # Multi-step sequence strip (m1 focus)
├── 🖼 comparison_relative_m2.png             # Multi-step sequence strip (m2 focus)
└── 📂 {FolderName}_isolated_labels/          # Cropped ROI images & raw pixel CSVs
    ├── 🖼 isolated_{img}_m1_1.png             # Masked ROI PNG with 8-star overlay
    ├── 📄 isolated_{img}_m1_1.csv             # Full 2D cropped temperature matrix
    └── 📄 isolated_{img}_m1_1_gradient_star.csv # 9-point compass table with gradients
```

---

## 🚀 Installation & Getting Started

### 1. Web Application
No installation required. Access directly in any modern browser:
👉 **[https://thermalsight-web-2026.web.app](https://thermalsight-web-2026.web.app)**

### 2. Desktop Application (Windows / macOS)

#### Prerequisites
- **Node.js** (v18 or newer)
- **Python** (v3.10 or newer)

#### Setup & Local Development
```bash
# Clone the repository
git clone https://github.com/Corneliox/ThermalSight-App.git
cd ThermalSight-App

# 1. Install frontend dependencies
cd src
npm install

# 2. Setup Python environment (for desktop backend)
cd ../backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On macOS / Linux:
source venv/bin/activate
pip install -r requirements.txt

# 3. Launch Desktop in Development Mode
cd ../src
npm run dev
```

#### Packaging Binaries
```bash
# Build desktop executable installer (Windows .exe / macOS .dmg)
cd src
npm run dist
```

---

## 🕹 Workflow & Usage Guide

1. **Load Images**: Click **Select Image Folder** or drag & drop thermal JPEG files.
2. **Set Calibration (Optional)**: Click **Calibrate** and draw a line along a known reference length to set physical pixels-per-centimeter ($S_{\text{px/cm}}$).
3. **Segment Regions**:
   - Select a label variable from the sidebar ($m_1, m_2, m_3, \dots$).
   - Click vertices around the anatomical or industrial target to draw a polygon. Double-click or press `Enter` to close.
4. **Inspect 8-Star Compass**:
   - The 8-point compass star is automatically calculated with the incircle radius, centroid, directional spokes, and dominant modus.
5. **Analyze Progression**:
   - Navigate through the sequence steps using `Next` / `Prev` or arrow keys.
6. **Export & Analytics**:
   - Click **Save Label & Export** to generate the complete analytical suite and view the interactive time-series modal.

---

## ⌨ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Left Arrow` / `[` / `b` | Previous image in sequence |
| `Right Arrow` / `]` / `n` | Next image in sequence |
| `Enter` / `Space` | Finish and close current polygon ROI |
| `Escape` | Cancel current active polygon drawing |
| `a` – `z` | Quick switch active segmentation label |
| `Ctrl + S` / `Cmd + S` | Save labels and trigger export package |

---

## 👨‍💻 Authors & Acknowledgments

- **Aditya & Research Team**
- Department of Biomedical Engineering / Industrial Automation
- Developed for thermal gradient evaluation, diabetes foot ulcer monitoring, vascular flow assessment, and industrial heat distribution research.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
