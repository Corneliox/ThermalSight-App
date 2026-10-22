# ThermalSight

[![Production Release](https://img.shields.io/badge/Release-v1.8.5%20Stable-blue.svg)](https://github.com/Corneliox/ThermalSight-App/releases/tag/v1.8.5)
[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/License-PolyForm%20Noncommercial-purple.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/Platforms-Windows%20%7C%20macOS%20%7C%20Web%20Trial-green.svg)](https://github.com/Corneliox/ThermalSight-App/releases)
[![Web Demo](https://img.shields.io/badge/GitHub%20Pages-Trial%20Demo%20(Nano)-orange.svg)](https://corneliox.github.io/ThermalSight-App/)

ThermalSight is a specialized biomedical infrared thermography and plantar biomechanics analytical suite. Engineered for clinical researchers and biomedical engineers, it provides automated radiometric decoding, multi-region polygonal segmentation, time-series vascular protocol tracking, and rigorous spatial-temporal thermal gradient extraction (PPP, PPG, and PGA triad metrics).

---

## Table of Contents

- [Abstract and Clinical Motivation](#abstract-and-clinical-motivation)
- [System Architecture and Dual-Engine Design](#system-architecture-and-dual-engine-design)
  - [Standalone Desktop Application (Full Scientific Engine)](#1-standalone-desktop-application-full-scientific-engine)
  - [GitHub Pages Trial Web Demo (Nano Engine)](#2-github-pages-trial-web-demo-nano-engine)
- [Key Features](#key-features)
- [Mathematical and Methodological Framework](#mathematical-and-methodological-framework)
  - [The Thermal Biomechanics Triad (PPP, PPG, PGA)](#1-the-thermal-biomechanics-triad-ppp-ppg-pga)
  - [Directional Circular Statistics](#2-directional-circular-statistics)
  - [8-Point Compass Star Gradient Formulation](#3-8-point-compass-star-gradient-formulation)
- [Installation and Getting Started](#installation-and-getting-started)
  - [Pre-Packaged Desktop Executables](#pre-packaged-desktop-executables)
  - [Local Development and Source Build](#local-development-and-source-build)
- [Operating Workflow](#operating-workflow)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Authors and Academic Affiliations](#authors-and-academic-affiliations)
- [Citation](#citation)
- [License and Non-Commercial Policy](#license-and-non-commercial-policy)

---

## Abstract and Clinical Motivation

Diabetic foot ulcers (DFU) and Charcot neuroarthropathy represent critical clinical challenges where impaired peripheral microvascular perfusion and mechanical shear stresses lead to tissue breakdown. Traditional thermal imaging assessments rely heavily on single-point mean temperatures, often overlooking localized inflammatory borders and directional vascular heat dissipation trajectories.

ThermalSight addresses these diagnostic gaps by establishing a standardized, reproducible computational framework for:
1. **Peak and Mean Plantar Perfusion (PPP)**: Quantifying absolute baseline tissue temperatures at high-risk biomechanical landmarks ($T_1$ Hallux, $M_1$ First Metatarsal Head, $M_2$ Second Metatarsal Head).
2. **Plantar Perfusion Gradients (PPG)**: Measuring the spatial rate of temperature change across tissue boundaries via 2D Sobel operators and dynamic 8-spoke directional sampling to differentiate diffuse physiological warming from acute focal inflammation.
3. **Plantar Gradient Angles (PGA)**: Determining the directional orientation of heat transfer relative to anatomical axes (Distal/Toes vs. Proximal/Heel, Medial vs. Lateral) using rigorous circular statistics.

---

## System Architecture and Dual-Engine Design

ThermalSight is implemented across two tiers to balance intensive clinical computing with immediate accessibility:

```
+-----------------------------------------------------------------------------------+
|                                   ThermalSight                                    |
+-----------------------------------------+-----------------------------------------+
|                                         |                                         |
|  Standalone Desktop Suite (Recommended)|  GitHub Pages Web Demo (Trial / Nano)   |
|  - Electron Shell + Native Python Engine|  - 100% Client-Side React + Vite        |
|  - Full Radiometric FLIR Raw Decoding   |  - Canvas-based In-Browser Preview      |
|  - Multi-Protocol Cohort Batch Analysis |  - Single Image Trial & Evaluation      |
|  - Interactive Tkinter/Matplotlib Lab   |  - Zero Installation Required           |
|  - Multi-Sheet Excel & Audit Trails     |  - High-Compute Features Restricted     |
|                                         |                                         |
+-----------------------------------------+-----------------------------------------+
```

### 1. Standalone Desktop Application (Full Scientific Engine)
- **Engine**: Electron runtime integrated with an offline Python scientific environment (`numpy`, `scipy`, `opencv`, `openpyxl`, `flyr`, `matplotlib`).
- **Use Case**: Production clinical research, institutional trials, batch dataset recomputation, and publication figure authoring.
- **Full Capabilities**:
  - Unpacks 16-bit radiometric FLIR JPEG metadata into true Kelvin/Celsius float32 thermal matrices.
  - Hierarchical multi-protocol cohort ingestion with complete protocol isolation (e.g., `<protocol>_result/`).
  - Native Excel workbook generation with multi-sheet audit trails, circular statistics, and clinical methodology guides.
  - Windows file-lock resilience preventing data loss when workbooks are open in Microsoft Excel.

### 2. GitHub Pages Trial Web Demo (Nano Engine)
- **Live URL**: [https://corneliox.github.io/ThermalSight-App/](https://corneliox.github.io/ThermalSight-App/)
- **Engine**: Client-side JavaScript running entirely in the browser using HTML5 Canvas.
- **Resource Protection and Limitations**:
  - To prevent excessive compute and memory loads on GitHub infrastructure and client browsers, the web deployment is strictly restricted to the **Nano Engine**.
  - Advanced features—including raw radiometric FLIR metadata unpacking, multi-protocol batch recomputations, automated whole-foot segmentation, and the Python PPG/PGA Research Lab—are disabled on GitHub Pages.
  - Users requiring full dataset evaluations must download the standalone Desktop Application.

---

## Key Features

- **Radiometric FLIR Thermal Ingestion**: Reconstructs sub-pixel float32 temperature matrices from radiometric FLIR images without loss of decimal precision.
- **Multi-Label Polygonal Region Segmentation**: Interactive polygon drawing with dynamic vertices, scale bar calibration (px/cm), and real-time bounding box extraction.
- **Automated 8-Point Compass Star Engine**: Generates an inscribed 8-spoke directional star within each segmented ROI to extract cardinal and intercardinal thermal slopes ($N, NE, E, SE, S, SW, W, NW$).
- **Vector Quiver and Isotherm Contours**: Publication-quality vector maps featuring 0.2 pt ultra-fine isothermal topography lines and 100% density gradient quiver arrows.
- **Multi-Protocol Cohort Isolation**: Seamless ingestion of complex multi-protocol directory structures (e.g., resting, pressure, post-exercise steps) guaranteeing zero cross-protocol data contamination.
- **Multi-Sheet Excel Reporting**: Automated output of `PPP_PPG_PGA_Statistical_Summary.xlsx` containing raw measurements, executive summaries, formula audit boxes, and clinical methodology documentation.

---

## Mathematical and Methodological Framework

### 1. The Thermal Biomechanics Triad (PPP, PPG, PGA)

| Metric | Full Parameter Name | Clinical Question | Units | Mathematical Formulation |
| :--- | :--- | :--- | :--- | :--- |
| **PPP** | Peak and Mean Plantar Perfusion | What is the absolute tissue temperature of the target anatomical site? | $^\circ\text{C}$ | $T_{\text{mean}} = \frac{1}{N} \sum_{i=1}^N T_i, \quad T_{\text{peak}} = \max(T)$ |
| **PPG** | Plantar Perfusion Gradient | How steep is the spatial thermal differential across the region? | $^\circ\text{C}/\text{cm}$ | $\|\vec{\nabla} T\| = \sqrt{G_x^2 + G_y^2}$ |
| **PGA** | Plantar Gradient Angle | In which anatomical direction is thermal energy dissipating? | Degrees / Compass | $\theta = \operatorname{arctan2}(-G_y, G_x) \pmod{360^\circ}$ |

### 2. Directional Circular Statistics

Standard arithmetic averaging of angles fails near the $0^\circ / 360^\circ$ boundary. ThermalSight computes aggregate directional metrics using weighted circular trigonometry:

$$\bar{C} = \sum_{j=1}^m w_j \cos(\theta_j), \quad \bar{S} = \sum_{j=1}^m w_j \sin(\theta_j)$$

$$\bar{\theta} = \operatorname{arctan2}(\bar{S}, \bar{C}) \pmod{360^\circ}$$

$$\text{Vector Coherence } R = \frac{\sqrt{\bar{C}^2 + \bar{S}^2}}{\sum_{j=1}^m w_j} \times 100\%$$

Where $\theta_j$ is the local gradient angle and $w_j = \|\vec{\nabla} T\|_j$ is the local gradient magnitude, ensuring that dominant thermal flows contribute proportionally to the aggregate orientation.

### 3. 8-Point Compass Star Gradient Formulation

For each segmented anatomical region with centroid $(x_c, y_c)$ and inscribed radius $R_{\text{px}}$:

```
                              N (90° / Distal / Toes)
                                        │
                 NW (135°)              │              NE (45°)
                       \                │                /
                         \              │              /
                           \            │            /
    W (180° / Medial) ──────────────── (xc, yc) ──────────────── E (0° / Lateral)
                           /            │            \
                         /              │              \
                       /                │                \
                 SW (225°)              │              SE (315°)
                                        │
                             S (270° / Proximal / Heel)
```

Thermal values are sampled along each ray $k$ at uniform physical steps. The directional gradient magnitude $G_k$ is computed as:

$$G_k = \frac{T(x_c + R_k \cos \theta_k, y_c - R_k \sin \theta_k) - T(x_c, y_c)}{R_k / S_{\text{px/cm}}}$$

---

## Installation and Getting Started

### Pre-Packaged Desktop Executables

Pre-compiled standalone installers for Windows (`.exe`) and macOS (`.dmg`) are available on the [Releases Page](https://github.com/Corneliox/ThermalSight-App/releases).

1. Download the latest `thermalsight-Setup-*.exe` (Windows) or `thermalsight-*.dmg` (macOS).
2. Execute the installer.
3. Launch ThermalSight. The internal Python scientific environment is resolved automatically.

### Local Development and Source Build

#### Prerequisites
- Node.js (v18.x or v20.x LTS) and npm
- Python (v3.10, v3.11, or v3.12)

#### Clone and Setup
```bash
# Clone the repository
git clone https://github.com/Corneliox/ThermalSight-App.git
cd ThermalSight-App

# 1. Install frontend dependencies
cd src
npm install

# 2. Setup Python environment
cd ../backend
python -m venv venv

# Activate venv on Windows:
.\venv\Scripts\activate
# Activate venv on macOS / Linux:
source venv/bin/activate

# Install backend dependencies (with NumPy ABI protection)
pip install -r requirements.txt

# 3. Launch Desktop in Development Mode
cd ../src
npm run dev
```

#### Compiling Desktop Binaries
```bash
cd src
npm run dist
```

---

## Operating Workflow

1. **Import Cohort or Image**: Click **Load Folder / Cohort** to load a multi-protocol study directory, or drag and drop radiometric thermal images.
2. **Physical Scale Calibration**: Select **Calibrate** and draw across a known reference scale bar to establish the physical scale ($S_{\text{px/cm}}$).
3. **Region Annotation**: Select an anatomical label ($T_1, M_1, M_2, \dots$) and outline the target boundary. Press `Enter` or double-click to close the polygon.
4. **Inspect Directional Vectors**: The 8-point compass star, inscribed radius, and whole-scene gradient field are computed automatically.
5. **Recompute Metrics**: Click **Recompute & Export All Metrics** or open the **PPG/PGA Lab** to generate the publication-ready multi-sheet Excel workbook and 300 DPI vector figures.

---

## Keyboard Shortcuts

| Key Binding | Function |
| :--- | :--- |
| `Left Arrow` / `[` / `b` | Navigate to previous image in sequence |
| `Right Arrow` / `]` / `n` | Navigate to next image in sequence |
| `Enter` / `Space` | Complete and close current polygon ROI |
| `Escape` | Cancel active ROI polygon draft |
| `a` through `z` | Fast-switch active segmentation label |
| `Ctrl + S` / `Cmd + S` | Commit annotations and trigger export package |

---

## Authors and Academic Affiliations

- **Aditya Kusuma** (`Aditya42069`)  
  Principal Researcher & Author  
  Department of Biomedical Engineering, Asia University, Taiwan  
  Research Focus: Diabetic Foot Complications, Infrared Plantar Thermography, Non-Invasive Vascular Assessment.

- **Corneliox** (`Corneliox`)  
  Lead Systems & Software Architect  
  Biomedical Systems & Scientific Software Engineering  
  Architecture Focus: High-Performance Electron/Python IPC, Directional Biomechanics Algorithms, UI/UX Engineering.

### Institutional Affiliation
- **Asia University Biomedical Engineering & Biodesign Laboratory**, Taichung, Taiwan.

---

## Citation

If you use ThermalSight in your academic research, clinical studies, or software pipelines, please cite the software as follows:

```bibtex
@software{ThermalSight2026,
  author = {Kusuma, Aditya and Corneliox},
  title = {ThermalSight: Biomedical Infrared Thermography and Plantar Perfusion Biomechanics Analysis Suite},
  url = {https://github.com/Corneliox/ThermalSight-App},
  version = {1.8.5},
  year = {2026},
  publisher = {Asia University Biomedical Engineering & Biodesign Laboratory}
}
```

A complete machine-readable citation definition is provided in [CITATION.cff](CITATION.cff).

---

## License and Non-Commercial Policy

This project is licensed under the **PolyForm Noncommercial License 1.0.0** — see the [LICENSE](LICENSE) file for complete details.

### Permitted Uses (Free and Open-Source)
- Academic, scientific, clinical research, and educational use.
- Non-commercial peer-reviewed scientific publications and academic presentations.
- Non-profit evaluation within universities, hospitals, and medical research institutes.

### Prohibited Uses (Requires Authorization)
- Commercial use, paid diagnostic services, monetization, or fee-for-service clinical usage.
- Sub-licensing, distribution in closed-source commercial packages, or integration into proprietary diagnostic hardware.
- Commercial exploitation without prior written agreement and author contribution from the primary authors.

For commercial licensing, institutional collaboration, or technology transfer inquiries, please contact the primary authors via the repository issue tracker or academic channels.
