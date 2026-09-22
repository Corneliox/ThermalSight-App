import React, { useState } from 'react';

/**
 * ThermalSight v1.8.0 - Multilingual Interactive Workflow Guide
 * Supports: English (default), Indonesian (ID), Traditional Chinese (繁體中文)
 * Tabs:
 *  1. User Workflow (Alur Pemakaian)
 *  2. Logic & Algorithm Flow (Alur Logika)
 *  3. Integrated Full Architecture (Alur Terintegrasi)
 */

export const WORKFLOW_CONTENT = {
  en: {
    title: "ThermalSight v1.8.0 — System Architecture & Workflow",
    subtitle: "Complete clinical thermography pipeline: pure radiometric decoding, 9×9 grid standard, and multi-modal export.",
    close: "✕ Close",
    tabUser: "👤 User Operating Guide",
    tabLogic: "🧠 System Logic & Math",
    tabIntegrated: "⚡ Integrated Architecture",
    copySummary: "📋 Copy Architecture Summary",
    copied: "✓ Copied!",
    searchPlaceholder: "Search pipeline steps, math formulas, or shortcuts...",
    
    userGuide: {
      heading: "User Operating Flow (Clinical Step-by-Step)",
      desc: "Standard operating procedure for processing single thermal captures or bulk sequence folders.",
      steps: [
        {
          step: "01",
          title: "Sequence or Single Ingestion",
          tag: "Input Stage",
          badge: "v1.8.0 Pure Sensor",
          summary: "Drop an individual FLIR radiometric image or select an entire sequence folder.",
          details: [
            "Folder Filtering: Subfolders are automatically ignored; only top-level thermal captures in the root folder are loaded.",
            "Pure Radiometric Mode: Inpainting is bypassed. Thermal data is unpacked directly from 16-bit radiometric metadata (FLIR Planck parameters) without visual OSD stamp artifacts.",
            "Blocking Ingestion Overlay: Live progress bar with docked terminal diagnostics monitors decoding status.",
            "Safe Recovery: If files fail decoding, click 'Refresh / Retry Ingestion' or cancel safely."
          ],
          shortcuts: ["Drag & Drop", "Browse Folder", "Load Session"]
        },
        {
          step: "02",
          title: "Scale Calibration Wizard",
          tag: "Calibration",
          badge: "Auto Guided",
          summary: "Establish physical metric dimensions (pixels per cm) for accurate anatomy quantification.",
          details: [
            "Reference Box Tool: Draw a 10×10 cm box or ruler along the reference scale in the scene.",
            "Auto Calculation: Scale (px/cm) is calculated instantly and synchronized across the entire session.",
            "Dynamic Circle Radius: Adjust physical circle radius (default 1.2 cm) which dynamically scales to match camera distance."
          ],
          shortcuts: ["R (Reference Box)", "L (Line Ruler)", "Wizard Banner"]
        },
        {
          step: "03",
          title: "ROI Segmentation & Placement",
          tag: "Annotation",
          badge: "9×9 Grid Standard",
          summary: "Annotate clinical landmarks (T1: Hallux, M1: 1st Metatarsal, M2/M3: Midfoot).",
          details: [
            "Standard 9×9 Window: ROIs are locked to exactly 9×9 grid cells (diameter 9 cells, radius 4.5 cells) for reproducible thermal gradient calculations.",
            "Legacy Session Auto-Upgrade: Opening older sessions (v1.6 / v1.7) automatically rescales ROIs to 9×9 dimensions while preserving centroid coordinates.",
            "Hotkeys: Fast landmark switching with keyboard hotkeys."
          ],
          shortcuts: ["T (T1 Landmark)", "M (M1 Landmark)", "3 (M3 Landmark)", "C (Circle Mode)", "P (Polygon)"]
        },
        {
          step: "04",
          title: "Thermal Gradient Analysis",
          tag: "Analysis",
          badge: "Sobel & Polar Rose",
          summary: "Multi-directional heat flux quantification across 8 compass directions (N, NE, E, SE, S, SW, W, NW).",
          details: [
            "Spatial Sobel Derivatives: Computes central gradient vectors (Gx, Gy) and magnitude in °C/px and °C/cm.",
            "8-Point Directional Star: Measures thermal propagation radially from centroid to boundary.",
            "Live Polar Compass Rose: Instant visual readout of dominant thermal drift."
          ],
          shortcuts: ["S (Star Tool)", "Arrow Left / Right (Sequence Navigation)"]
        },
        {
          step: "05",
          title: "Plantar Paper Fig.1 Generation",
          tag: "Publication Visuals",
          badge: "4 Grid Modes",
          summary: "Generate publication-grade diagnostic composite figures for medical journals.",
          details: [
            "White-Hot Base: High-contrast monochrome background with custom contrast thresholds.",
            "Ironbow ROI Patches: High-resolution false-color thermal colormap inside anatomical circles.",
            "4 Grid Options: Normal Sparse (step=4), Dense Dots (step=2), Sparse Lines (step=4), and Hairline Dense (step=1, width=0.0019, alpha=0.75).",
            "Polar Rose & Vector Overlay: Directional thermal drift arrows and radar rose diagram."
          ],
          shortcuts: ["Export Plantar Fig.1", "Ironbow Mode", "Contrast Sliders"]
        },
        {
          step: "06",
          title: "Multi-Format Export & Session Save",
          tag: "Export",
          badge: "Full Archival",
          summary: "Export clinical results, raw CSV metrics, high-res PNGs, and JSON session backups.",
          details: [
            "annotations_session.json: Portable session backup containing all coordinates, calibrations, and settings.",
            "metrics.csv: Tabular export of min, max, mean temperatures, dominant gradient vector, and scale.",
            "Batch ZIP Package: 1-click export bundling all figures, vectors, and tables into a structured archive."
          ],
          shortcuts: ["Ctrl+S / 💾 Save", "Export ZIP Package", "Show CSV"]
        }
      ]
    },

    logicGuide: {
      heading: "System Logic & Algorithmic Architecture",
      desc: "Mathematical formulations and computational backend operations powering ThermalSight.",
      sections: [
        {
          title: "1. Radiometric Decoding (Zero-OSD Protocol)",
          formula: "T(x,y) = \\frac{B}{\\ln\\left(\\frac{R_1}{R_2 \\cdot (S(x,y) + O)} + F\\right)} - 273.15",
          notes: "FLIR radiometric Planck equation maps raw 16-bit A/D counts S(x,y) directly to Celsius temperature T(x,y).",
          points: [
            "Zero destructive inpainting: We eliminate visual edge blurs caused by cv2.inpaint.",
            "True 32-bit floating point temperature grid is preserved bit-for-bit.",
            "All OSD overlays (temperature badges, brand watermarks) are stripped cleanly at byte extraction."
          ]
        },
        {
          title: "2. Metric Calibration & Physical Grid Scaling",
          formula: "Scale = \\frac{\\Delta p_{px}}{D_{cm}} \\; [px/cm], \\quad \\Delta_{cell} = \\frac{Scale}{step_{cm}} \\; [px/cell]",
          notes: "Relates digital image coordinates to real-world anatomical distance regardless of working camera distance.",
          points: [
            "Standardized grid cell size derived from physical reference square.",
            "Grid step options: step=1 (dense 1mm hairline), step=2 (2mm dots), step=4 (4mm sparse).",
            "Radius formula: r_final = 4.5 * Delta_cell, ensuring precisely 9×9 cells span the ROI diameter."
          ]
        },
        {
          title: "3. Spatial Thermal Gradient Vectorization",
          formula: "G_x = \\frac{\\partial T}{\\partial x} \\approx T * K_x, \\quad G_y = \\frac{\\partial T}{\\partial y} \\approx T * K_y, \\quad |\\nabla T| = \\sqrt{G_x^2 + G_y^2}",
          notes: "Sobel-Feldman convolution kernels Kx, Ky compute local temperature gradients.",
          points: [
            "Direction angle: theta = atan2(Gy, Gx) in range [-pi, +pi].",
            "Dominant direction matched against 8-direction compass rose: N (0°), NE (45°), E (90°), SE (135°), S (180°), SW (225°), W (270°), NW (315°).",
            "Normalized vector field creates publication arrow overlays."
          ]
        },
        {
          title: "4. Legacy Annotation Auto-Translation Matrix",
          formula: "ROI_{new} = \\left\\{ (c_x, c_y), \\; r_{new} = \\max(r_{old}, \\; 4.5 \\cdot \\Delta_{cell}) \\right\\}",
          notes: "Backward-compatibility engine dynamically upgrades older 6×6 annotations to 9×9 upon file load.",
          points: [
            "Centroid stability: Anatomical point of interest (cx, cy) remains 100% untouched.",
            "36-vertex polygon regenerated: P_i = (cx + r*cos(2pi*i/36), cy + r*sin(2pi*i/36)).",
            "Seamless compatibility with historical research datasets."
          ]
        }
      ]
    },

    integratedGuide: {
      heading: "Integrated Pipeline Dataflow",
      desc: "End-to-end visualization of data transformation from raw camera capture to published journal figure.",
      flow: [
        { phase: "Stage 1: Raw Ingestion", input: "FLIR Radiometric JPG / TIFF", process: "Planck 16-bit Decode & Root-only Filter", output: "Clean float32 Temperature Grid [H×W]" },
        { phase: "Stage 2: Spatial Calibration", input: "10×10 cm Ref Box or Ruler", process: "Pixel Euclidean Norm & Ratio Calculation", output: "Dynamic px/cm Scale & 9×9 Grid Step" },
        { phase: "Stage 3: Landmark Annotation", input: "User Clicks (T1, M1, M2/M3)", process: "Circle/Polygon Centroid Binding & Auto-Upgrade", output: "Normalized ROI Coordinates & Masks" },
        { phase: "Stage 4: Mathematical Analysis", input: "Masked Thermal Arrays", process: "Sobel Gradient + 8-Point Star Compass", output: "Temperature Statistics & Dominant Drift Vector" },
        { phase: "Stage 5: Multi-Modal Rendering", input: "Temperature & Vectors", process: "Whitehot Base + Ironbow ROIs + 4 Grid Modes", output: "Plantar Paper Fig.1, Vector Maps, Polar Roses" },
        { phase: "Stage 6: Packaging & Storage", input: "All Render Buffers", process: "ZIP Archival & JSON Session Serialization", output: "annotations_session.json + metrics.csv + ZIP" }
      ]
    }
  },

  id: {
    title: "ThermalSight v1.8.0 — Arsitektur Sistem & Alur Kerja",
    subtitle: "Pipeline lengkap termografi klinis: pemecahan radiometrik murni, standar grid 9×9, dan ekspor multi-modal.",
    close: "✕ Tutup",
    tabUser: "👤 Panduan Penggunaan",
    tabLogic: "🧠 Logika & Algoritma",
    tabIntegrated: "⚡ Arsitektur Terintegrasi",
    copySummary: "📋 Salin Ringkasan Arsitektur",
    copied: "✓ Tersalin!",
    searchPlaceholder: "Cari tahapan alur kerja, rumus, atau tombol pintas...",

    userGuide: {
      heading: "Alur Pemakaian Pengguna (Langkah Operasional Klinis)",
      desc: "Prosedur operasional standar untuk memproses foto termal tunggal maupun seluruh folder urutan pasien.",
      steps: [
        {
          step: "01",
          title: "Unggah Tunggal atau Sekuens Folder",
          tag: "Tahap Input",
          badge: "v1.8.0 Sensor Murni",
          summary: "Tarik gambar radiometrik FLIR tunggal atau pilih seluruh folder urutan pengamatan.",
          details: [
            "Penyaringan Folder: Subfolder diabaikan secara otomatis; hanya foto pada folder utama yang dimuat.",
            "Mode Sensor Mula-mula (Murni): Inpainting dihilangkan. Data suhu diekstrak langsung dari 16-bit metadata radiometrik (parameter Planck FLIR) tanpa artefak OSD (watermark, teks suhu).",
            "Layar Tunggu Batch: Bilah proses interaktif dan terminal diagnostik memantau status pembacaan.",
            "Pemulihan Aman: Bila ada file yang gagal, klik tombol 'Refresh / Coba Lagi' atau batalkan dengan aman."
          ],
          shortcuts: ["Drag & Drop", "Buka Folder", "Buka Sesi"]
        },
        {
          step: "02",
          title: "Kalibrasi Skala Fisik (Wizard)",
          tag: "Kalibrasi",
          badge: "Panduan Otomatis",
          summary: "Menentukan dimensi fisik (piksel per cm) untuk pengukuran anatomi yang akurat.",
          details: [
            "Kotak Referensi: Gambar kotak referensi 10×10 cm atau penggaris linier pada objek kalibrasi di foto.",
            "Perhitungan Otomatis: Rasio px/cm dihitung seketika dan disinkronkan ke seluruh foto dalam sesi.",
            "Radius Lingkaran Dinamis: Tentukan radius lingkaran fisik (bawaan 1.2 cm) yang otomatis menyesuaikan jarak kamera."
          ],
          shortcuts: ["R (Kotak Referensi)", "L (Penggaris Garis)", "Banner Wizard"]
        },
        {
          step: "03",
          title: "Segmentasi & Penempatan ROI",
          tag: "Anotasi",
          badge: "Standar Grid 9×9",
          summary: "Anotasi titik landmark klinis (T1: Ibu Jari Kaki, M1: Metatarsal 1, M2/M3: Midfoot).",
          details: [
            "Jendela Standar 9×9: Lingkaran ROI terkunci tepat berukuran 9×9 sel grid (diameter 9 sel, radius 4.5 sel) untuk gradien termal yang konsisten.",
            "Translasi Otomatis Sesi Lama: Memuat sesi lama (v1.6 / v1.7) akan langsung memperbesar ROI ke ukuran 9×9 tanpa menggeser titik pusat anatomi.",
            "Tombol Pintas Cepat: Beralih label landmark dengan cepat via keyboard."
          ],
          shortcuts: ["T (Landmark T1)", "M (Landmark M1)", "3 (Landmark M3)", "C (Mode Lingkaran)", "P (Poligon)"]
        },
        {
          step: "04",
          title: "Analisis Gradien Termal & Arah",
          tag: "Analisis",
          badge: "Sobel & Bintang 8 Arah",
          summary: "Kuantifikasi fluks panas pada 8 arah mata angin (N, NE, E, SE, S, SW, W, NW).",
          details: [
            "Derivatif Spasial Sobel: Menghitung vektor gradien (Gx, Gy) dan magnitudo dalam °C/px serta °C/cm.",
            "Bintang Pengukuran 8 Arah: Mengukur distribusi suhu radial dari pusat ke tepi ROI.",
            "Mawar Kompas Langsung: Visualisasi instan arah perambatan panas dominan."
          ],
          shortcuts: ["S (Alat Bintang)", "Panah Kiri / Kanan (Navigasi Sekuens)"]
        },
        {
          step: "05",
          title: "Pembuatan Gambar Plantar Paper Fig.1",
          tag: "Publikasi Ilmiah",
          badge: "4 Mode Grid",
          summary: "Menghasilkan gambar komposit diagnostik standar jurnal medis internasional.",
          details: [
            "Dasar White-Hot: Latar belakang monokrom kontras tinggi dengan batas ambang suhu yang dapat diatur.",
            "Patch ROI Ironbow: Tampilan warna semu resolusi tinggi khusus di dalam area anatomi.",
            "4 Pilihan Grid: Titik Jarang (step=4), Titik Rapat (step=2), Garis Jarang (step=4), dan Garis Rapat Rambut/Hairline (step=1, tebal 0.0019, transparansi 0.75).",
            "Overlay Vektor & Mawar Polar: Panah arah rambat panas dan diagram radar polar."
          ],
          shortcuts: ["Ekspor Plantar Fig.1", "Mode Ironbow", "Slider Kontras"]
        },
        {
          step: "06",
          title: "Ekspor Multi-Format & Penyimpanan Sesi",
          tag: "Ekspor",
          badge: "Arsip Lengkap",
          summary: "Ekspor hasil klinis, tabel CSV mentah, foto resolusi tinggi PNG, dan cadangan JSON.",
          details: [
            "annotations_session.json: Cadangan sesi portabel berisi seluruh koordinat, kalibrasi, dan konfigurasi.",
            "metrics.csv: Tabel ekspor suhu min, max, rata-rata, vektor gradien utama, dan skala.",
            "Paket ZIP Batch: Ekspor 1-klik yang membungkus semua gambar, vektor, dan tabel ke dalam satu file ZIP terstruktur."
          ],
          shortcuts: ["Ctrl+S / 💾 Simpan", "Ekspor Paket ZIP", "Lihat CSV"]
        }
      ]
    },

    logicGuide: {
      heading: "Logika Sistem & Arsitektur Algoritma",
      desc: "Formulasi matematis dan komputasi backend yang menggerakkan ThermalSight.",
      sections: [
        {
          title: "1. Pemecahan Radiometrik (Protokol Tanpa OSD)",
          formula: "T(x,y) = \\frac{B}{\\ln\\left(\\frac{R_1}{R_2 \\cdot (S(x,y) + O)} + F\\right)} - 273.15",
          notes: "Persamaan radiometrik Planck FLIR memetakan sinyal mentah 16-bit A/D counts S(x,y) langsung ke suhu Celcius T(x,y).",
          points: [
            "Bebas inpainting destruktif: Mencegah efek blur/kabur akibat algoritma cv2.inpaint.",
            "Matriks suhu floating point 32-bit dipertahankan akurat bit-per-bit.",
            "Semua teks OSD bawaan kamera (label suhu, logo) dihilangkan secara alami pada saat ekstraksi byte."
          ]
        },
        {
          title: "2. Kalibrasi Metrik & Penskalaan Grid Fisik",
          formula: "Skala = \\frac{\\Delta p_{px}}{D_{cm}} \\; [px/cm], \\quad \\Delta_{sel} = \\frac{Skala}{step_{cm}} \\; [px/sel]",
          notes: "Menghubungkan koordinat piksel digital ke jarak nyata anatomi terlepas dari jarak kamera ke kaki.",
          points: [
            "Ukuran sel grid distandarisasi dari kotak referensi fisik.",
            "Opsi kerapatan grid: step=1 (garis rambut 1mm), step=2 (titik 2mm), step=4 (jarang 4mm).",
            "Rumus radius: r_final = 4.5 * Delta_sel, memastikan diameter ROI tepat 9×9 sel grid."
          ]
        },
        {
          title: "3. Vektorisasi Gradien Termal Spasial",
          formula: "G_x = \\frac{\\partial T}{\\partial x} \\approx T * K_x, \\quad G_y = \\frac{\\partial T}{\\partial y} \\approx T * K_y, \\quad |\\nabla T| = \\sqrt{G_x^2 + G_y^2}",
          notes: "Kernel konvolusi Sobel-Feldman Kx, Ky menghitung gradien suhu lokal.",
          points: [
            "Sudut arah: theta = atan2(Gy, Gx) dalam rentang [-pi, +pi].",
            "Arah dominan dicocokkan ke 8 mata angin kompas: U (0°), TL (45°), T (90°), TG (135°), S (180°), BD (225°), B (270°), BL (315°).",
            "Medan vektor ternormalisasi menjadi dasar gambar panah publikasi."
          ]
        },
        {
          title: "4. Matriks Translasi Otomatis Sesi Lama",
          formula: "ROI_{baru} = \\left\\{ (c_x, c_y), \\; r_{baru} = \\max(r_{lama}, \\; 4.5 \\cdot \\Delta_{sel}) \\right\\}",
          notes: "Mesin kompatibilitas mundur yang secara cerdas memperbesar anotasi 6×6 lama menjadi 9×9 saat dibuka.",
          points: [
            "Stabilitas titik pusat: Koordinat anatomis (cx, cy) tetap 100% presisi.",
            "Poligon 36-titik dihitung ulang: P_i = (cx + r*cos(2pi*i/36), cy + r*sin(2pi*i/36)).",
            "Mendukung kelangsungan penelitian tanpa perlu menganotasi ulang dari awal."
          ]
        }
      ]
    },

    integratedGuide: {
      heading: "Alur Data Terintegrasi (Dataflow)",
      desc: "Visualisasi menyeluruh dari gambar mentah kamera hingga menjadi publikasi ilmiah.",
      flow: [
        { phase: "Tahap 1: Ingesti Mentah", input: "FLIR Radiometrik JPG / TIFF", process: "Dekode Planck 16-bit & Filter Folder Utama", output: "Matriks Suhu float32 Murni [H×W]" },
        { phase: "Tahap 2: Kalibrasi Spasial", input: "Kotak Referensi 10×10 cm / Penggaris", process: "Norma Euclidean & Perhitungan Rasio", output: "Skala px/cm Dinamis & Step Grid 9×9" },
        { phase: "Tahap 3: Anotasi Landmark", input: "Klik Pengguna (T1, M1, M2/M3)", process: "Pengikatan Pusat Lingkaran & Auto-Upgrade 9×9", output: "Koordinat & Masking ROI Ternormalisasi" },
        { phase: "Tahap 4: Analisis Matematis", input: "Array Suhu Terpotong", process: "Gradien Sobel + Bintang Kompas 8 Arah", output: "Statistik Suhu & Vektor Panas Dominan" },
        { phase: "Tahap 5: Rendering Multi-Modal", input: "Suhu & Vektor", process: "Whitehot Dasar + ROI Ironbow + 4 Mode Grid", output: "Plantar Paper Fig.1, Peta Vektor, Mawar Polar" },
        { phase: "Tahap 6: Pengarsipan & Penyimpanan", input: "Semua Buffer Render", process: "Kompresi ZIP & Serialisasi JSON Sesi", output: "annotations_session.json + metrics.csv + ZIP" }
      ]
    }
  },

  zh: {
    title: "ThermalSight v1.8.0 — 系統架構與操作工作流",
    subtitle: "臨床紅外熱像分析全流程：純輻射感測器解碼、9×9網格標準與多模態導出。",
    close: "✕ 關閉",
    tabUser: "👤 使用者操作流程",
    tabLogic: "🧠 演算法與數學邏輯",
    tabIntegrated: "⚡ 全系統整合架構",
    copySummary: "📋 複製架構摘要",
    copied: "✓ 已複製！",
    searchPlaceholder: "搜尋工作流步驟、數學公式或快捷鍵...",

    userGuide: {
      heading: "使用者操作指引（臨床步驟）",
      desc: "處理單張熱像圖或批量序列資料夾的標準臨床操作流程。",
      steps: [
        {
          step: "01",
          title: "序列或單圖匯入",
          tag: "輸入階段",
          badge: "v1.8.0 純感測模式",
          summary: "拖放單張 FLIR 輻射影像，或選取整個檢查序列資料夾。",
          details: [
            "資料夾過濾：自動忽略內部子資料夾，僅載入根目錄中的主要熱像圖片。",
            "原始感測模式（純淨模式）：完全移除破壞性影像修復（inpainting），直接自 16-bit 輻射中繼資料（FLIR 普朗克公式）提取溫度，杜絕螢幕 OSD 水印與溫度標籤干擾。",
            "批量阻斷載入畫面：配備即時進度條與終端診斷視窗，全程監控解碼狀態。",
            "安全復原機制：若部分檔案解碼異常，可點擊「重新載入」或安全取消回到上一頁。"
          ],
          shortcuts: ["拖放檔案", "瀏覽資料夾", "開啟專案"]
        },
        {
          step: "02",
          title: "物理比例校準嚮導",
          tag: "校準階段",
          badge: "引導校準",
          summary: "建立實體公制尺寸（每公分像素數 px/cm），以確保解剖特徵定量精準。",
          details: [
            "參考方塊工具：在畫面中框選 10×10 cm 標定板或繪製直尺標記。",
            "自動換算：立即計算像素與公分換算比率，並同步套用至全序列。",
            "動態圓形半徑：設定物理圓半徑（預設 1.2 cm），自動根據鏡頭拍攝距離動態調整像素大小。"
          ],
          shortcuts: ["R (參考方塊)", "L (直尺標定)", "嚮導橫幅"]
        },
        {
          step: "03",
          title: "感興趣區域 (ROI) 標記",
          tag: "標註階段",
          badge: "9×9 網格標準",
          summary: "標註臨床關鍵解剖點（T1: 拇趾、M1: 第一蹠骨頭、M2/M3: 中足部）。",
          details: [
            "標準 9×9 觀測窗：ROI 嚴格鎖定為 9×9 個網格單元（直徑 9 格，半徑 4.5 格），確保熱梯度計算具備高度可重複性。",
            "舊版標註自動升級：開啟舊版專案（v1.6 / v1.7）時，系統會自動將 ROI 擴展至 9×9 規格，同時完整保留解剖中心座標。",
            "鍵盤快捷切換：支援快速鍵切換各解剖點標籤。"
          ],
          shortcuts: ["T (T1 標籤)", "M (M1 標籤)", "3 (M3 標籤)", "C (圓形模式)", "P (多邊形)"]
        },
        {
          step: "04",
          title: "熱梯度與熱擴散方向分析",
          tag: "分析階段",
          badge: "Sobel 與八向羅盤",
          summary: "量化沿 8 個羅盤方向（N, NE, E, SE, S, SW, W, NW）的熱流分佈與傳播向量。",
          details: [
            "空間 Sobel 導數：計算中心梯度向量 (Gx, Gy) 及熱梯度強度（°C/px 及 °C/cm）。",
            "八向星形測量儀：精確量化自中心向外放射的熱分佈趨勢。",
            "即時極坐標羅盤：直觀顯示主導熱擴散方向與向量偏移量。"
          ],
          shortcuts: ["S (星形工具)", "左右方向鍵 (切換序列圖片)"]
        },
        {
          step: "05",
          title: "足底論文 Figure 1 複合圖生成",
          tag: "學術成果產出",
          badge: "4種網格樣式",
          summary: "生成符合國際醫學期刊發表的足底熱圖診斷複合圖。",
          details: [
            "White-Hot 基底：高對比黑白足底輪廓背景，可自由調整對比度閾值。",
            "Ironbow 彩色斑塊：解剖圓形內部保留高解析度鐵紅偽彩色熱圖。",
            "4 種網格模式：稀疏點陣 (step=4)、密集點陣 (step=2)、稀疏格線 (step=4) 以及 密集極細線 (step=1, 線寬 0.0019, 透明度 0.75)。",
            "極坐標玫瑰圖與向量覆蓋：自動繪製熱漂移箭頭與雷達方向圖。"
          ],
          shortcuts: ["導出 Plantar Fig.1", "Ironbow 模式", "對比度滑桿"]
        },
        {
          step: "06",
          title: "多格式導出與專案封裝",
          tag: "匯出階段",
          badge: "全格式封存",
          summary: "匯出臨床分析報告、原始 CSV 數據、高解析度 PNG 及 JSON 備份檔。",
          details: [
            "annotations_session.json：可移植的完整專案備份檔，包含所有座標、標定值及參數設定。",
            "metrics.csv：包含最高溫、最低溫、平均溫、主導梯度向量及尺寸標定的表格數據。",
            "批量 ZIP 壓縮包：一鍵將全套圖表、向量圖及數據表封裝為標準檔案結構。"
          ],
          shortcuts: ["Ctrl+S / 💾 儲存", "導出 ZIP 壓縮包", "檢視 CSV"]
        }
      ]
    },

    logicGuide: {
      heading: "系統核心邏輯與演算法架構",
      desc: "驅動 ThermalSight 運行的數學公式與後端計算邏輯。",
      sections: [
        {
          title: "1. 輻射信號純淨解碼（無 OSD 干擾協定）",
          formula: "T(x,y) = \\frac{B}{\\ln\\left(\\frac{R_1}{R_2 \\cdot (S(x,y) + O)} + F\\right)} - 273.15",
          notes: "透過 FLIR 普朗克輻射方程式，直接將 16 位元原始訊號 S(x,y) 轉換為攝氏溫度 T(x,y)。",
          points: [
            "杜絕破壞性修復：完全移除 cv2.inpaint 產生的模糊與人為邊緣失真。",
            "位元級精準：完整保留 32 位元浮點數溫度矩陣。",
            "天然純淨：在二進位解碼時直接剝離相機 OSD（溫度標記、原廠浮水印）。"
          ]
        },
        {
          title: "2. 公制校準與物理網格步長",
          formula: "Scale = \\frac{\\Delta p_{px}}{D_{cm}} \\; [px/cm], \\quad \\Delta_{cell} = \\frac{Scale}{step_{cm}} \\; [px/cell]",
          notes: "建立影像像素與真實人體解剖距離的數學映射，消除拍攝距離遠近造成的測量誤差。",
          points: [
            "標準化網格單元：以實體參考方塊（如 10×10 cm）為基準計算像素間距。",
            "網格步長選項：step=1 (1mm 極細髮絲線)、step=2 (2mm 點陣)、step=4 (4mm 稀疏格)。",
            "半徑標準化：r_final = 4.5 * Delta_cell，確保 ROI 直徑恆等於 9×9 網格單元。"
          ]
        },
        {
          title: "3. 空間熱梯度向量場計算",
          formula: "G_x = \\frac{\\partial T}{\\partial x} \\approx T * K_x, \\quad G_y = \\frac{\\partial T}{\\partial y} \\approx T * K_y, \\quad |\\nabla T| = \\sqrt{G_x^2 + G_y^2}",
          notes: "採用 Sobel-Feldman 空間卷積核 Kx、Ky 計算局部熱梯度導數。",
          points: [
            "方向角度：theta = atan2(Gy, Gx)，範圍介於 [-pi, +pi]。",
            "主導方向映射至八向羅盤：北 (0°)、東北 (45°)、東 (90°)、東南 (135°)、南 (180°)、西南 (225°)、西 (270°)、西北 (315°)。",
            "正規化向量場直接驅動論文級熱流向箭頭圖案渲染。"
          ]
        },
        {
          title: "4. 舊版標註向後相容升級矩陣",
          formula: "ROI_{new} = \\left\\{ (c_x, c_y), \\; r_{new} = \\max(r_{old}, \\; 4.5 \\cdot \\Delta_{cell}) \\right\\}",
          notes: "相容性引擎，於讀取舊版 6×6 標註專案時，自動平滑過渡擴展至 9×9 標準尺度。",
          points: [
            "幾何中心鎖定：臨床解剖點 (cx, cy) 坐標絕對保持不變。",
            "重新生成 36 頂點多邊形：P_i = (cx + r*cos(2pi*i/36), cy + r*sin(2pi*i/36))。",
            "歷史研究標註檔案無縫相容，無須重新費時手動標註。"
          ]
        }
      ]
    },

    integratedGuide: {
      heading: "系統端到端整合數據流 (Dataflow)",
      desc: "從相機原始影像提取到最終醫學期刊成果發布的全程數據變換流程圖。",
      flow: [
        { phase: "第 1 階段：原始感測匯入", input: "FLIR 輻射影像 (JPG / TIFF)", process: "普朗克 16 位元解碼與根目錄照片過濾", output: "純淨 float32 溫度矩陣 [H×W]" },
        { phase: "第 2 階段：空間幾何校準", input: "10×10 cm 標定板或直尺", process: "歐幾里得距離計算與像素換算", output: "動態 px/cm 比例與 9×9 網格單元尺寸" },
        { phase: "第 3 階段：解剖關鍵點標記", input: "使用者點擊 (T1, M1, M2/M3)", process: "圓形/多邊形錨定與舊版自動擴展至 9×9", output: "正規化 ROI 座標與解剖遮罩 (Mask)" },
        { phase: "第 4 階段：數理統計與梯度分析", input: "裁切後之溫度陣列", process: "Sobel 梯度向量卷積 + 八向星形羅盤計算", output: "溫度統計特徵與主導熱流傳播向量" },
        { phase: "第 5 階段：多模態期刊圖渲染", input: "溫度數據與向量場", process: "Whitehot 足底底圖 + Ironbow ROI + 4種網格樣式", output: "Plantar Paper Fig.1、向量場圖與極坐標玫瑰圖" },
        { phase: "第 6 階段：檔案封裝與成果儲存", input: "全部渲染緩衝區數據", process: "ZIP 結構化打包與 JSON 專案序列化儲存", output: "annotations_session.json + metrics.csv + 成果 ZIP" }
      ]
    }
  }
};

export default function WorkflowView({ onClose }) {
  const [lang, setLang] = useState('en'); // Default to English as requested
  const [activeTab, setActiveTab] = useState('user'); // 'user' | 'logic' | 'integrated'
  const [filterText, setFilterText] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const t = WORKFLOW_CONTENT[lang] || WORKFLOW_CONTENT.en;

  const handleCopy = () => {
    const summary = `ThermalSight v1.8.0 Pipeline Summary (${lang.toUpperCase()})
- Radiometric Sensor: Pure FLIR Planck 16-bit decoding (zero artificial inpainting)
- ROI Geometry: Standardized 9x9 grid cells (r=4.5 cells) with legacy auto-translation
- Calibration: Reference box (10x10 cm) & physical circle radius (1.2 cm)
- Plantar Paper Fig.1: 4 Grid Modes (Normal Sparse, Dense Dots, Sparse Lines, Hairline Dense step=1)
- Dataflow: Ingestion -> Calibration -> Annotation -> Sobel Gradient & 8-Dir Star -> Publication Visuals -> Multi-Format Export`;
    navigator.clipboard.writeText(summary).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(() => {});
  };

  // Filter helper
  const filterStep = (s) => {
    if (!filterText.trim()) return true;
    const q = filterText.toLowerCase();
    return s.title.toLowerCase().includes(q) ||
           s.summary.toLowerCase().includes(q) ||
           s.tag.toLowerCase().includes(q) ||
           s.details.some(d => d.toLowerCase().includes(q));
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div className="modal-card workflow-modal-card" style={{
        maxWidth: '1020px',
        width: '95vw',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 24px',
        background: 'var(--bg0)',
        border: '1px solid var(--border-h)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
        borderRadius: '12px'
      }}>
        
        {/* HEADER BAR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: '14px', marginBottom: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>🗺️</span>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text0)', margin: 0 }}>
                {t.title}
              </h2>
              <span style={{
                background: 'rgba(0, 229, 255, 0.12)',
                color: 'var(--cyan)',
                border: '1px solid var(--cyan)',
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                v1.8.0 Stable Release
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text2)' }}>
              {t.subtitle}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* LANGUAGE SWITCHER */}
            <div style={{ display: 'flex', background: 'var(--bg1)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <button
                className={`btn-ghost btn-tiny ${lang === 'en' ? 'active-lang' : ''}`}
                style={{
                  fontWeight: lang === 'en' ? '700' : '400',
                  color: lang === 'en' ? '#000' : 'var(--text1)',
                  background: lang === 'en' ? 'var(--cyan)' : 'transparent',
                  padding: '4px 10px',
                  borderRadius: '6px'
                }}
                onClick={() => setLang('en')}
              >
                EN
              </button>
              <button
                className={`btn-ghost btn-tiny ${lang === 'id' ? 'active-lang' : ''}`}
                style={{
                  fontWeight: lang === 'id' ? '700' : '400',
                  color: lang === 'id' ? '#000' : 'var(--text1)',
                  background: lang === 'id' ? 'var(--cyan)' : 'transparent',
                  padding: '4px 10px',
                  borderRadius: '6px'
                }}
                onClick={() => setLang('id')}
              >
                ID
              </button>
              <button
                className={`btn-ghost btn-tiny ${lang === 'zh' ? 'active-lang' : ''}`}
                style={{
                  fontWeight: lang === 'zh' ? '700' : '400',
                  color: lang === 'zh' ? '#000' : 'var(--text1)',
                  background: lang === 'zh' ? 'var(--cyan)' : 'transparent',
                  padding: '4px 10px',
                  borderRadius: '6px'
                }}
                onClick={() => setLang('zh')}
              >
                繁中
              </button>
            </div>

            {/* CLOSE BUTTON */}
            <button className="btn-ghost" onClick={onClose} style={{ fontSize: '14px', padding: '6px 12px' }}>
              {t.close}
            </button>
          </div>
        </div>

        {/* CONTROLS BAR: TABS & SEARCH */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
          {/* TAB BUTTONS */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className={`btn-secondary ${activeTab === 'user' ? 'btn-primary' : ''}`}
              style={{
                fontSize: '12px',
                fontWeight: '600',
                background: activeTab === 'user' ? 'var(--accent)' : undefined,
                color: activeTab === 'user' ? '#fff' : undefined
              }}
              onClick={() => setActiveTab('user')}
            >
              {t.tabUser}
            </button>
            <button
              className={`btn-secondary ${activeTab === 'logic' ? 'btn-primary' : ''}`}
              style={{
                fontSize: '12px',
                fontWeight: '600',
                background: activeTab === 'logic' ? 'var(--accent)' : undefined,
                color: activeTab === 'logic' ? '#fff' : undefined
              }}
              onClick={() => setActiveTab('logic')}
            >
              {t.tabLogic}
            </button>
            <button
              className={`btn-secondary ${activeTab === 'integrated' ? 'btn-primary' : ''}`}
              style={{
                fontSize: '12px',
                fontWeight: '600',
                background: activeTab === 'integrated' ? 'var(--accent)' : undefined,
                color: activeTab === 'integrated' ? '#fff' : undefined
              }}
              onClick={() => setActiveTab('integrated')}
            >
              {t.tabIntegrated}
            </button>
          </div>

          {/* SEARCH & ACTION BUTTONS */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {activeTab === 'user' && (
              <input
                type="text"
                placeholder={t.searchPlaceholder}
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                style={{
                  padding: '6px 10px',
                  fontSize: '12px',
                  background: 'var(--bg1)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text0)',
                  width: '260px'
                }}
              />
            )}
            <button className="btn-secondary btn-tiny" onClick={handleCopy} style={{ fontSize: '11px', padding: '6px 10px' }}>
              {copySuccess ? t.copied : t.copySummary}
            </button>
          </div>
        </div>

        {/* SCROLLABLE CONTENT BODY */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '6px' }}>

          {/* TAB 1: USER OPERATING GUIDE */}
          {activeTab === 'user' && (
            <div>
              <div style={{ marginBottom: '14px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--cyan)', margin: '0 0 4px 0' }}>
                  {t.userGuide.heading}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text2)', margin: 0 }}>
                  {t.userGuide.desc}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
                {t.userGuide.steps.filter(filterStep).map((item) => (
                  <div
                    key={item.step}
                    style={{
                      background: 'var(--bg1)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'border-color 0.15s ease'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            background: 'var(--accent)',
                            color: '#fff',
                            fontWeight: '800',
                            fontSize: '11px',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>
                            {item.step}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {item.tag}
                          </span>
                        </div>
                        <span style={{
                          background: 'rgba(0, 229, 255, 0.1)',
                          color: 'var(--cyan)',
                          fontSize: '10px',
                          fontWeight: '600',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '1px solid rgba(0, 229, 255, 0.25)'
                        }}>
                          {item.badge}
                        </span>
                      </div>

                      <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text0)', margin: '0 0 6px 0' }}>
                        {item.title}
                      </h4>
                      <p style={{ fontSize: '12px', color: 'var(--text1)', lineHeight: '1.4', marginBottom: '10px' }}>
                        {item.summary}
                      </p>

                      <ul style={{ margin: '0 0 10px 14px', padding: 0, fontSize: '11px', color: 'var(--text2)', lineHeight: '1.5' }}>
                        {item.details.map((d, dIdx) => (
                          <li key={dIdx} style={{ marginBottom: '4px' }}>{d}</li>
                        ))}
                      </ul>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {item.shortcuts.map((sc, scIdx) => (
                        <span key={scIdx} style={{
                          fontSize: '10px',
                          background: 'var(--bg0)',
                          border: '1px solid var(--border-h)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          color: 'var(--cyan)',
                          fontFamily: 'var(--font-mono)'
                        }}>
                          {sc}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: LOGIC & ALGORITHMIC ARCHITECTURE */}
          {activeTab === 'logic' && (
            <div>
              <div style={{ marginBottom: '14px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--cyan)', margin: '0 0 4px 0' }}>
                  {t.logicGuide.heading}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text2)', margin: 0 }}>
                  {t.logicGuide.desc}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {t.logicGuide.sections.map((sec, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--bg1)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '16px'
                    }}
                  >
                    <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text0)', margin: '0 0 8px 0' }}>
                      {sec.title}
                    </h4>

                    {/* Formula Box */}
                    <div style={{
                      background: 'var(--bg0)',
                      border: '1px solid var(--border-h)',
                      borderRadius: '6px',
                      padding: '10px 14px',
                      marginBottom: '10px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      color: 'var(--cyan)',
                      overflowX: 'auto'
                    }}>
                      <code>{sec.formula}</code>
                    </div>

                    <p style={{ fontSize: '11px', color: 'var(--text1)', marginBottom: '8px', fontStyle: 'italic' }}>
                      {sec.notes}
                    </p>

                    <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: 'var(--text2)', lineHeight: '1.5' }}>
                      {sec.points.map((p, pIdx) => (
                        <li key={pIdx} style={{ marginBottom: '3px' }}>{p}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: INTEGRATED DATAFLOW */}
          {activeTab === 'integrated' && (
            <div>
              <div style={{ marginBottom: '14px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--cyan)', margin: '0 0 4px 0' }}>
                  {t.integratedGuide.heading}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text2)', margin: 0 }}>
                  {t.integratedGuide.desc}
                </p>
              </div>

              {/* Step Sequence Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {t.integratedGuide.flow.map((node, nIdx) => (
                  <div
                    key={nIdx}
                    style={{
                      background: 'var(--bg1)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      display: 'grid',
                      gridTemplateColumns: '180px 1fr 1fr 1fr',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <span style={{
                        background: 'var(--accent)',
                        color: '#fff',
                        fontSize: '10px',
                        fontWeight: '800',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        display: 'inline-block',
                        marginBottom: '4px'
                      }}>
                        STEP {nIdx + 1}
                      </span>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text0)' }}>
                        {node.phase}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text2)', textTransform: 'uppercase', marginBottom: '2px' }}>Input</div>
                      <div style={{ fontSize: '11px', color: 'var(--text1)', background: 'var(--bg0)', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                        {node.input}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--cyan)', textTransform: 'uppercase', marginBottom: '2px' }}>Processing Engine</div>
                      <div style={{ fontSize: '11px', color: 'var(--cyan)', background: 'rgba(0, 229, 255, 0.05)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(0, 229, 255, 0.2)' }}>
                        ⚙ {node.process}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--green)', textTransform: 'uppercase', marginBottom: '2px' }}>Output Artifact</div>
                      <div style={{ fontSize: '11px', color: 'var(--green)', background: 'rgba(0, 230, 118, 0.05)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(0, 230, 118, 0.2)' }}>
                        ✓ {node.output}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pipeline Architecture Legend */}
              <div style={{
                marginTop: '16px',
                background: 'var(--bg0)',
                border: '1px solid var(--border-h)',
                borderRadius: '8px',
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ fontSize: '11px', color: 'var(--text2)' }}>
                  💡 <strong>Pipeline Standard:</strong> All 6 stages execute strictly in sequence. 9×9 grid diameter (r=4.5 cells) is preserved bit-for-bit across calibration, annotation, and composite export.
                </div>
                <button className="btn-primary btn-tiny" onClick={handleCopy} style={{ fontSize: '11px', padding: '4px 10px' }}>
                  {copySuccess ? t.copied : '📋 Copy Pipeline Spec'}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* FOOTER */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text2)' }}>
            ThermalSight v1.8.0 Clinical Edition • National Cheng Kung University / AU Aditya Thermal
          </span>
          <button className="btn-primary" onClick={onClose} style={{ fontSize: '12px', padding: '6px 16px' }}>
            {t.close}
          </button>
        </div>

      </div>
    </div>
  );
}
