import React, { useState } from 'react';

/**
 * ThermalSight v1.8.0 - Multilingual Interactive Workflow & Flowchart Guide
 * Supports: English (default), Indonesian (ID), Traditional Chinese (繁體中文)
 * Tabs:
 *  1. User Operating Guide (Cards & Visual Flowchart)
 *  2. Logic & Algorithm Flow
 *  3. Integrated Full Architecture
 */

export const MERMAID_FLOWCHART_EN = `flowchart TD
    Start(["🚀 Start: Launch ThermalSight v1.8.0"]) --> Launch["Application Welcome Screen"]
    
    %% Input Data Selection
    Launch --> InputChoice{"Select Input Method"}
    InputChoice -->|"Folder Bulk Mode"| OpenFolder["Click 'Open Image Folder'<br>Select sequence folder (e.g., example/bas)"]
    InputChoice -->|"Single Image"| OpenSingle["Click 'Open Single Image'<br>Select 1 radiometric file (.jpg/.png/.tiff)"]
    InputChoice -->|"Saved Session"| OpenSession["Click 'Open Saved Annotations'<br>Load annotations_session.json"]
    InputChoice -->|"Drag & Drop"| DragDrop["Drag & Drop Folder / ZIP onto Canvas"]

    %% Filtering & Pure Radiometric Extraction
    OpenFolder --> RootFilter["Automatic Root Folder Filter:<br>Strictly ingests files in top-level directory.<br>Subfolders (_Result, _analysis) are ignored."]
    DragDrop --> RootFilter
    OpenSingle --> IngestionOverlay
    OpenSession --> AutoUpgradeCheck

    RootFilter --> PureSensorDecode["Pure Radiometric Decoding ('Mode Mula-mula'):<br>Decodes 16-bit FLIR Planck data directly.<br>Zero artificial inpainting; eliminates OSD stamps naturally."]
    PureSensorDecode --> IngestionOverlay

    %% Full Blocking Batch Ingestion Overlay
    subgraph BLOCKING_INGESTION ["Full Blocking Batch Ingestion Overlay"]
        IngestionOverlay["Canvas & Controls 100% Locked<br>Displays Real-time Progress Bar & Terminal Diagnostics"]
        IngestionOverlay --> StatusCheck{"Any Decoding Errors?"}
        
        StatusCheck -->|"Corrupt / Invalid File"| ShowErrorBanner["Alert Banner Displayed Above Progress Bar:<br>Lists problematic filenames & error codes."]
        ShowErrorBanner --> IngestionErrorAction{"User Recovery Action"}
        IngestionErrorAction -->|"Click 🔄 Refresh / Retry"| IngestionOverlay
        IngestionErrorAction -->|"Click ← Back / Cancel"| CancelIngestion["Abort & Return to Welcome Screen"]
        
        StatusCheck -->|"All Succeeded (100%)"| UnlockIngestion["Ingestion Completed Successfully (100%)"]
    end

    CancelIngestion --> Launch

    %% Legacy Session Auto-Upgrade Routine
    subgraph LEGACY_UPGRADE ["Legacy Session Auto-Upgrade Engine"]
        AutoUpgradeCheck{"Session Version Check"}
        AutoUpgradeCheck -->|"Legacy v1.6 / v1.7 (< 9x9 Grid)"| UpgradeMatrix["Automatic Translation Matrix:<br>1. Centroids (cx, cy) preserved 100%<br>2. Circle radii expanded to 9x9 grid cells (r = 4.5 cells = 1.2 cm)<br>3. 36-vertex polygons regenerated"]
        AutoUpgradeCheck -->|"Standard v1.8.0 (9x9 Grid)"| DirectLoad["Load Annotations Directly"]
        UpgradeMatrix --> DirectLoad
    end
    DirectLoad --> MainWorkspace

    %% Mandatory Calibration Wizard
    UnlockIngestion --> CalibWizardCheck{"Is Image Calibrated?"}
    CalibWizardCheck -->|"Yes (Saved in Session)"| MainWorkspace
    CalibWizardCheck -->|"No (New Image / Uncalibrated)"| EnterWizard

    subgraph CALIB_WIZARD ["Mandatory Scale Calibration Wizard"]
        EnterWizard["Calibration Wizard Banner Appears:<br>ROI Annotation Temporarily Locked.<br>Scale Panel Highlighted in Cyan."]
        
        EnterWizard --> ChooseCalibType{"Select Calibration Modality"}
        
        ChooseCalibType -->|"⏹️ Reference Box"| BoxCalib["1. Enter physical dimensions (Default: 10 x 10 cm)<br>2. Click 2 diagonal corners (Top-Left & Bottom-Right)<br>3. Dashed preview box & 4 anchor dots appear<br>4. Isotropic scale: S = (Wpx + Hpx) / (Wcm + Hcm) [px/cm]"]
        
        ChooseCalibType -->|"📏 Ruler Line"| RulerCalib["1. Enter physical length (cm)<br>2. Click Start Point & End Point along ruler<br>3. Linear scale: S = DistPx / DistCm [px/cm]"]

        BoxCalib --> ConfirmCalib["Click 'Confirm & Set Calibration'"]
        RulerCalib --> ConfirmCalib
        ConfirmCalib --> UnlockWorkspaceBtn["Click Banner Button:<br>'✓ Done & Start Annotating'"]
    end

    UnlockWorkspaceBtn --> MainWorkspace["Full Workspace Unlocked:<br>Canvas, Toolbars, and All Diagnostic Panels Ready"]

    %% ROI Segmentation & 9x9 Grid Standards
    subgraph ANNOTATION_PHASE ["ROI Segmentation & 9x9 Grid Standard"]
        MainWorkspace --> SelectDrawTool{"Select ROI Tool"}
        
        SelectDrawTool -->|"Circle Tool (C)"| CircleMode["Standardized 9x9 Grid Circle Mode:<br>- Physical radius synchronized: r_cm = 1.2 cm<br>- Exact 9x9 grid cells window (radius = 4.5 cells)<br>- Dynamically rescales pixel radius with camera distance"]
        
        CircleMode --> PlaceCircle["Click Canvas to Place ROI Circle"]

        SelectDrawTool -->|"Polygon Tool (P)"| PolyMode["Freehand Polygon Tool:<br>Click sequential vertices, close loop at start point."]
        PolyMode --> PlacePoly["Polygon ROI Created"]

        PlaceCircle --> AssignLabelShortcuts["Assign Anatomical Landmark Hotkeys:<br>[T] = T1 Hallux | [M] = M1 Metatarsal | [3] = M3 Midfoot"]
        PlacePoly --> AssignLabelShortcuts
    end

    %% Thermal Gradient & Star Compass Analysis
    subgraph ANALYSIS_PHASE ["Thermal Gradient & Directional Analysis"]
        AssignLabelShortcuts --> AnalysisChoice{"Select Diagnostic Tool"}
        
        AnalysisChoice -->|"8-Point Compass Star (S)"| StarAnalysis["Automated 8-Directional Radial Sampling:<br>- Evaluates N, NE, E, SE, S, SW, W, NW<br>- Computes thermal difference ΔT relative to center<br>- Identifies dominant thermal drift direction"]
        
        AnalysisChoice -->|"Sobel Gradient Field"| SobelAnalysis["Spatial Gradient Convolution:<br>- Computes derivatives Gx, Gy via Sobel-Feldman kernels<br>- Gradient magnitude ||∇T|| in °C/px and °C/cm<br>- Gradient direction θ = atan2(Gy, Gx)"]
        
        AnalysisChoice -->|"Plantar Paper Fig.1"| PlantarAnalysis["Generate Publication Fig.1 Package:<br>- Whitehot high-contrast monochrome background<br>- Ironbow false-color thermal colormap inside ROIs<br>- 4 Grid Modes: Normal Sparse, Dense Dots,<br>  Sparse Lines, Hairline Dense (step=1, width=0.0019)<br>- Quiver drift vectors & polar radar rose overlay"]
        
        AnalysisChoice -->|"Analytics Dashboard"| AnalyticsView["Multi-ROI Thermal Trendlines & Stability Analysis"]
    end

    %% Export & Packaging
    StarAnalysis --> ExportPackage
    SobelAnalysis --> ExportPackage
    PlantarAnalysis --> ExportPackage
    AnalyticsView --> ExportPackage

    subgraph EXPORT_PHASE ["Multi-Format Export & Archival"]
        ExportPackage["Click '💾 Save Label & Export' / 'Export ZIP Package'"] --> SaveResults["Automated Multi-Format Export:<br>1. Clean Radiometric Image (1:1 pure sensor)<br>2. metrics.csv (Min, Max, Mean, Dominant Vectors)<br>3. Plantar Fig.1 Composites (Whitehot + Ironbow)<br>4. Quiver Gradient Vector Maps & Polar Roses<br>5. annotations_session.json (Portable Backup)"]
    end
    
    SaveResults --> Finish(["✅ Complete: Clinically Validated, Calibrated & Publication Ready"])`;

export const MERMAID_FLOWCHART_ZH = `flowchart TD
    Start(["🚀 開始：啟動 ThermalSight v1.8.0"]) --> Launch["應用程式歡迎與載入主畫面"]
    
    %% 資料匯入方式選擇
    Launch --> InputChoice{"選擇資料匯入方式"}
    InputChoice -->|"資料夾批量模式"| OpenFolder["點擊「開啟影像資料夾 (Bulk Mode)」<br>選取序列資料夾（例如：example/bas）"]
    InputChoice -->|"單張影像模式"| OpenSingle["點擊「開啟單張熱像圖」<br>選取單一輻射檔案 (.jpg/.png/.tiff)"]
    InputChoice -->|"讀取已存專案"| OpenSession["點擊「開啟儲存之標註專案」<br>載入 annotations_session.json"]
    InputChoice -->|"拖放上傳"| DragDrop["直接將資料夾或 ZIP 壓縮檔拖曳至畫布"]

    %% 資料夾過濾與純感測解碼
    OpenFolder --> RootFilter["根目錄自動過濾機制：<br>嚴格僅讀取最外層主要照片。<br>自動忽略所有結果子資料夾（如 _Result、_analysis）。"]
    DragDrop --> RootFilter
    OpenSingle --> IngestionOverlay
    OpenSession --> AutoUpgradeCheck

    RootFilter --> PureSensorDecode["純輻射感測解碼（Mode Mula-mula）：<br>直接依據 FLIR 普朗克公式解算 16 位元原始溫度。<br>零破壞性修復，天然消除原廠螢幕 OSD 水印與溫度標籤。"]
    PureSensorDecode --> IngestionOverlay

    %% 全阻斷批量載入遮罩
    subgraph BLOCKING_INGESTION ["全阻斷批量載入畫面 (Full Blocking Ingestion)"]
        IngestionOverlay["畫布與控制項 100% 鎖定<br>顯示即時進度條與終端診斷視窗"]
        IngestionOverlay --> StatusCheck{"是否有檔案解碼異常？"}
        
        StatusCheck -->|"有損壞或非熱像檔"| ShowErrorBanner["警告橫幅即時顯示於進度條正上方：<br>列出問題檔案名稱與錯誤代碼。"]
        ShowErrorBanner --> IngestionErrorAction{"使用者應對選項"}
        IngestionErrorAction -->|"點擊 🔄 重新整理 / 重試"| IngestionOverlay
        IngestionErrorAction -->|"點擊 ← 返回 / 取消（左上方）"| CancelIngestion["放棄載入並返回首頁"]
        
        StatusCheck -->|"全數解碼成功 (100%)"| UnlockIngestion["批量影像載入完成 (100%)"]
    end

    CancelIngestion --> Launch

    %% 舊版標註向後相容升級矩陣
    subgraph LEGACY_UPGRADE ["舊版標註專案自動升級引擎"]
        AutoUpgradeCheck{"標註版本檢查"}
        AutoUpgradeCheck -->|"舊版 v1.6 / v1.7（未達 9x9 規格）"| UpgradeMatrix["自動相容性轉換矩陣：<br>1. 解剖幾何中心 (cx, cy) 100% 絕對鎖定<br>2. 圓形半徑自動擴展至 9x9 網格單元 (半徑 r = 4.5 格 = 1.2 cm)<br>3. 重新計算並生成 36 頂點多邊形邊界"]
        AutoUpgradeCheck -->|"新版 v1.8.0（標準 9x9 規格）"| DirectLoad["直接套用標註數據"]
        UpgradeMatrix --> DirectLoad
    end
    DirectLoad --> MainWorkspace

    %% 強制尺度校準嚮導
    UnlockIngestion --> CalibWizardCheck{"該影像是否已建立校準比例？"}
    CalibWizardCheck -->|"已校準（專案已存）"| MainWorkspace
    CalibWizardCheck -->|"未校準（全新拍攝影像）"| EnterWizard

    subgraph CALIB_WIZARD ["強制物理尺寸校準嚮導 (Calibration Wizard)"]
        EnterWizard["校準嚮導頂部橫幅啟動：<br>暫時鎖定標註繪製功能，<br>右側校準面板以青色亮框提示。"]
        
        EnterWizard --> ChooseCalibType{"選取校準工具模式"}
        
        ChooseCalibType -->|"⏹️ 參考方塊 (Reference Box)"| BoxCalib["1. 輸入實體公制長寬（預設：10 x 10 cm）<br>2. 於畫布對角線點擊 2 點（左上角與右下角）<br>3. 即時顯示虛線預覽框與 4 頂點錨點<br>4. 自動計算各向同性比例：S = (Wpx + Hpx) / (Wcm + Hcm) [px/cm]"]
        
        ChooseCalibType -->|"📏 直尺標記 (Ruler Line)"| RulerCalib["1. 輸入直尺長度（公分 cm）<br>2. 點擊標定直尺的起點與終點<br>3. 計算線性像素比例：S = DistPx / DistCm [px/cm]"]

        BoxCalib --> ConfirmCalib["點擊「確認並套用校準比例」"]
        RulerCalib --> ConfirmCalib
        ConfirmCalib --> UnlockWorkspaceBtn["點擊頂部橫幅按鈕：<br>「✓ 完成並開始進行解剖標註」"]
    end

    UnlockWorkspaceBtn --> MainWorkspace["工作區完整解鎖：<br>畫布、繪圖工具列與所有診斷面板全面就緒"]

    %% 解剖標記與 9x9 網格標準
    subgraph ANNOTATION_PHASE ["解剖標註與 9×9 網格標準化"]
        MainWorkspace --> SelectDrawTool{"選取標註工具"}
        
        SelectDrawTool -->|"圓形工具 (C)"| CircleMode["標準化 9×9 網格圓形模式：<br>- 鎖定物理實體半徑：r_cm = 1.2 cm<br>- 精確符合 9×9 網格單元觀測窗（半徑 = 4.5 格）<br>- 自動根據鏡頭拍攝距離動態調整像素半徑大小"]
        
        CircleMode --> PlaceCircle["點擊畫布放置解剖圓形 ROI"]

        SelectDrawTool -->|"多邊形工具 (P)"| PolyMode["自由多邊形鋼筆工具：<br>依序點擊邊界節點，於起點閉合輪廓。"]
        PolyMode --> PlacePoly["多邊形 ROI 建立完成"]

        PlaceCircle --> AssignLabelShortcuts["鍵盤快速鍵指派解剖標籤：<br>[T] = T1 拇趾 | [M] = M1 第一蹠骨 | [3] = M3 中足部"]
        PlacePoly --> AssignLabelShortcuts
    end

    %% 熱梯度與八向星形羅盤分析
    subgraph ANALYSIS_PHASE ["熱梯度場與熱流傳播分析"]
        AssignLabelShortcuts --> AnalysisChoice{"選擇診斷分析面板"}
        
        AnalysisChoice -->|"八向星形羅盤 (S)"| StarAnalysis["自動化八向徑向溫度採樣：<br>- 測量 8 個方位角（N, NE, E, SE, S, SW, W, NW）<br>- 計算相對於幾何中心之溫差 ΔT<br>- 自動識別主導熱擴散偏移方位 (Modus)"]
        
        AnalysisChoice -->|"Sobel 空間梯度場"| SobelAnalysis["空間梯度卷積運算：<br>- 透過 Sobel-Feldman 空間核計算偏導數 Gx, Gy<br>- 梯度向量模長 ||∇T||（°C/px 與 °C/cm）<br>- 梯度夾角 θ = atan2(Gy, Gx)"]
        
        AnalysisChoice -->|"足底論文 Figure 1"| PlantarAnalysis["生成國際期刊級 Figure 1 複合圖：<br>- Whitehot 高對比黑白足底輪廓底圖<br>- ROI 解剖區域內套用高解析度 Ironbow 鐵紅熱色表<br>- 4 種網格模式：稀疏點陣、密集點陣、稀疏格線、<br>  密集極細髮絲線 (step=1, 線寬=0.0019)<br>- 自動疊加向量流向箭頭與極坐標雷達玫瑰圖"]
        
        AnalysisChoice -->|"多特徵統計圖表"| AnalyticsView["全序列多 ROI 溫度變化趨勢與熱穩定度分析圖"]
    end

    %% 成果導出與存檔
    StarAnalysis --> ExportPackage
    SobelAnalysis --> ExportPackage
    PlantarAnalysis --> ExportPackage
    AnalyticsView --> ExportPackage

    subgraph EXPORT_PHASE ["多格式結果導出與成果歸檔"]
        ExportPackage["點擊「💾 儲存標註並導出」 / 「導出 ZIP 完整壓縮包」"] --> SaveResults["自動化多格式導出套件：<br>1. 純淨感測影像 (1:1 原始無干擾)<br>2. metrics.csv (最高溫、最低溫、平均溫、主導向量)<br>3. Plantar Fig.1 複合期刊圖 (Whitehot + Ironbow)<br>4. 梯度向量 Quiver 圖與極坐標玫瑰圖<br>5. annotations_session.json (完整專案備份檔)"]
    end
    
    SaveResults --> Finish(["✅ 完成：臨床驗證完備、物理尺寸精準且具備期刊發表品質"])`;

export const MERMAID_FLOWCHART_ID = `flowchart TD
    Start(["🚀 Mulai: Buka ThermalSight v1.8.0"]) --> Launch["Tampilan Awal Aplikasi"]
    
    %% Input Data
    Launch --> InputChoice{"Pilih Metode Input Folder / Citra"}
    InputChoice -->|"Folder Bulk Mode"| OpenFolder["Klik 'Open Image Folder'<br>Pilih folder sequence (misal: example/bas)"]
    InputChoice -->|"Single Image"| OpenSingle["Klik 'Open Single Image'<br>Pilih 1 file (.jpg/.png/.tiff)"]
    InputChoice -->|"Saved Session"| OpenSession["Klik 'Open Saved Annotations'<br>Load annotations_session.json"]
    InputChoice -->|"Drag & Drop"| DragDrop["Drag & Drop Folder / ZIP ke Kanvas"]

    %% Filter Subfolder & Pure Sensor
    OpenFolder --> RootFilter["Filter Folder Otomatis:<br>Hanya mengambil foto di ROOT folder utama.<br>Semua subfolder result (_Result, _analysis) diabaikan."]
    DragDrop --> RootFilter
    OpenSingle --> IngestionOverlay
    OpenSession --> AutoUpgradeCheck

    RootFilter --> PureSensorDecode["Dekode Radiometrik Murni ('Mode Mula-mula'):<br>Data suhu dihitung langsung dari 16-bit Planck FLIR.<br>Bebas inpainting; bebas watermark teks OSD kamera."]
    PureSensorDecode --> IngestionOverlay

    %% Full Blocking Ingestion Screen
    subgraph BLOCKING_INGESTION ["Layar Terkunci Penuh (Full Blocking Batch Ingestion)"]
        IngestionOverlay["Layar Utama & Kanvas Terkunci 100%<br>Menampilkan Progress Bar & Terminal Diagnostik"]
        IngestionOverlay --> StatusCheck{"Apakah Ada Error Pembacaan?"}
        
        StatusCheck -->|"Ada File Corrupt"| ShowErrorBanner["Banner Peringatan Muncul Tepat di Atas Progress Bar:<br>Daftar file gagal & kode error."]
        ShowErrorBanner --> IngestionErrorAction{"Pilihan Pengguna"}
        IngestionErrorAction -->|"Klik 🔄 Refresh / Retry"| IngestionOverlay
        IngestionErrorAction -->|"Klik ← Back / Cancel"| CancelIngestion["Batal & Kembali ke Tampilan Awal"]
        
        StatusCheck -->|"Semua Sukses (100%)"| UnlockIngestion["Ingestion Selesai 100%"]
    end

    CancelIngestion --> Launch

    %% Translasi Otomatis Sesi Lama
    subgraph LEGACY_UPGRADE ["Mesin Auto-Upgrade Sesi Lama"]
        AutoUpgradeCheck{"Pemeriksaan Versi Sesi"}
        AutoUpgradeCheck -->|"Sesi Lama v1.6 / v1.7 (< 9x9 Grid)"| UpgradeMatrix["Matriks Translasi Otomatis:<br>1. Titik pusat anatomi (cx, cy) terkunci 100%<br>2. Radius lingkaran diperbesar ke standar grid 9x9 (r = 4.5 sel = 1.2 cm)<br>3. Poligon 36-titik dihitung ulang"]
        AutoUpgradeCheck -->|"Standar v1.8.0 (Grid 9x9)"| DirectLoad["Terapkan Anotasi Langsung"]
        UpgradeMatrix --> DirectLoad
    end
    DirectLoad --> MainWorkspace

    %% Mandatory Calibration Wizard
    UnlockIngestion --> CalibWizardCheck{"Apakah Citra Sudah Terkalibrasi?"}
    CalibWizardCheck -->|"Sudah (Tersimpan di Sesi)"| MainWorkspace
    CalibWizardCheck -->|"Belum (Citra Baru)"| EnterWizard

    subgraph CALIB_WIZARD ["Langkah Wajib: Calibration Wizard Step"]
        EnterWizard["Banner Kalibrasi Muncul:<br>Fitur Anotasi Terkunci Sementara,<br>Panel Kalibrasi Menyala dengan Bingkai Cyan."]
        
        EnterWizard --> ChooseCalibType{"Pilih Modalitas Kalibrasi"}
        
        ChooseCalibType -->|"⏹️ Reference Box (Kotak)"| BoxCalib["1. Masukkan ukuran kotak (Default: 10 x 10 cm)<br>2. Klik 2 titik sudut diagonal (Kiri-Atas & Kanan-Bawah)<br>3. Kotak preview putus-putus & 4 anchor dot muncul<br>4. Skala isotropik: S = (Wpx+Hpx)/(Wcm+Hcm) [px/cm]"]
        
        ChooseCalibType -->|"📏 Ruler Line (Mistar)"| RulerCalib["1. Masukkan panjang garis (cm)<br>2. Klik Titik Awal & Akhir garis mistar<br>3. Skala dihitung: S = DistPx / DistCm [px/cm]"]

        BoxCalib --> ConfirmCalib["Klik 'Confirm & Set Calibration'"]
        RulerCalib --> ConfirmCalib
        ConfirmCalib --> UnlockWorkspaceBtn["Klik Tombol Banner:<br>'✓ Selesai & Mulai Anotasi'"]
    end

    UnlockWorkspaceBtn --> MainWorkspace["Workspace Terbuka Penuh:<br>Canvas, Tool Draw, dan Seluruh Panel Siap Digunakan"]

    %% Anotasi & Sinkronisasi Fisik
    subgraph ANNOTATION_PHASE ["Anotasi ROI & Standar Grid 9x9"]
        MainWorkspace --> SelectDrawTool{"Pilih Tool Anotasi"}
        
        SelectDrawTool -->|"Mode Lingkaran (C)"| CircleMode["Mode Lingkaran Standar 9x9 Grid:<br>- Radius terkunci fisik: r_cm = 1.2 cm<br>- Jendela ROI tepat 9x9 sel grid (radius = 4.5 sel)<br>- Menyesuaikan skala piksel otomatis sesuai jarak kamera"]
        
        CircleMode --> PlaceCircle["Klik Kanvas untuk Menaruh ROI Lingkaran"]

        SelectDrawTool -->|"Mode Poligon (P)"| PolyMode["Mode Poligon (Pen Tool):<br>Klik titik-titik kontur bebas, tutup di titik awal."]
        PolyMode --> PlacePoly["ROI Poligon Terbentuk"]

        PlaceCircle --> AssignLabelShortcuts["Beri Label Anatomi via Shortcut Keyboard:<br>[T] = T1 Ibu Jari | [M] = M1 Metatarsal 1 | [3] = M3 Midfoot"]
        PlacePoly --> AssignLabelShortcuts
    end

    %% Analisis Lanjutan & Ekspor
    subgraph ANALYSIS_PHASE ["Analisis Gradien Termal & Arah"]
        AssignLabelShortcuts --> AnalysisChoice{"Pilih Panel Diagnostik"}
        
        AnalysisChoice -->|"Bintang Kompas 8 Arah (S)"| StarAnalysis["Pengukuran Radial Otomatis 8 Arah:<br>- Evaluasi N, NE, E, SE, S, SW, W, NW<br>- Hitung selisih suhu ΔT terhadap pusat<br>- Tentukan arah rambat panas dominan (Modus)"]
        
        AnalysisChoice -->|"Gradien Sobel Spasial"| SobelAnalysis["Konvolusi Gradien Spasial:<br>- Hitung turunan Gx, Gy via kernel Sobel-Feldman<br>- Magnitudo ||∇T|| dalam °C/px dan °C/cm<br>- Sudut arah θ = atan2(Gy, Gx)"]
        
        AnalysisChoice -->|"Plantar Paper Fig.1"| PlantarAnalysis["Replika Plantar Fig 1 untuk Publikasi:<br>- Latar Whitehot kontras tinggi<br>- Colormap Ironbow di dalam lingkaran ROI<br>- 4 Pilihan Grid: Sparse Dots, Dense Dots,<br>  Sparse Lines, Hairline Dense (step=1, width=0.0019)<br>- Overlay panah rambat vektor & mawar radar"]
        
        AnalysisChoice -->|"Analytics Dashboard"| AnalyticsView["Grafik Tren Suhu Multi-ROI & Stabilitas"]
    end

    StarAnalysis --> ExportPackage
    SobelAnalysis --> ExportPackage
    PlantarAnalysis --> ExportPackage
    AnalyticsView --> ExportPackage

    subgraph EXPORT_PHASE ["Ekspor Multi-Format & Penyimpanan"]
        ExportPackage["Klik '💾 Simpan Label & Ekspor' / 'Ekspor Paket ZIP'"] --> SaveResults["Ekspor Otomatis Multi-Format:<br>1. Citra Bersih (1:1 sensor murni)<br>2. metrics.csv (Min, Max, Rerata, Vektor Dominan)<br>3. Plantar Fig.1 Komposit (Whitehot + Ironbow)<br>4. Peta Vektor Quiver & Mawar Polar<br>5. annotations_session.json (Cadangan Portabel)"]
    end
    
    SaveResults --> Finish(["✅ Selesai: Analisis Valid, Terkalibrasi Fisik & Siap Publikasi"])`;

export const WORKFLOW_CONTENT = {
  en: {
    title: "ThermalSight v1.8.0 — System Architecture & Workflow",
    subtitle: "Complete clinical thermography pipeline: pure radiometric decoding, 9×9 grid standard, and multi-modal export.",
    close: "✕ Close",
    tabUser: "👤 User Operating Guide",
    tabLogic: "🧠 System Logic & Math",
    tabIntegrated: "⚡ Integrated Architecture",
    subviewCards: "🗂️ Step Cards",
    subviewFlowchart: "🗺️ Visual Flowchart",
    copySummary: "📋 Copy Spec Summary",
    copyMermaid: "📋 Copy Mermaid Diagram (EN)",
    copied: "✓ Copied!",
    searchPlaceholder: "Search pipeline steps, math formulas, or shortcuts...",
    mermaidCode: MERMAID_FLOWCHART_EN,
    
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
    subviewCards: "🗂️ Kartu Tahapan",
    subviewFlowchart: "🗺️ Diagram Alur",
    copySummary: "📋 Salin Ringkasan",
    copyMermaid: "📋 Salin Diagram Mermaid (ID)",
    copied: "✓ Tersalin!",
    searchPlaceholder: "Cari tahapan alur kerja, rumus, atau tombol pintas...",
    mermaidCode: MERMAID_FLOWCHART_ID,

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
    subviewCards: "🗂️ 步驟卡片",
    subviewFlowchart: "🗺️ 視覺流程圖",
    copySummary: "📋 複製架構摘要",
    copyMermaid: "📋 複製 Mermaid 流程圖 (繁中)",
    copied: "✓ 已複製！",
    searchPlaceholder: "搜尋工作流步驟、數學公式或快捷鍵...",
    mermaidCode: MERMAID_FLOWCHART_ZH,

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
  const [userSubView, setUserSubView] = useState('cards'); // 'cards' | 'flowchart'
  const [filterText, setFilterText] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [copyMermaidSuccess, setCopyMermaidSuccess] = useState(false);

  const t = WORKFLOW_CONTENT[lang] || WORKFLOW_CONTENT.en;

  const handleCopySummary = () => {
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

  const handleCopyMermaid = () => {
    navigator.clipboard.writeText(t.mermaidCode).then(() => {
      setCopyMermaidSuccess(true);
      setTimeout(() => setCopyMermaidSuccess(false), 2000);
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
        maxWidth: '1040px',
        width: '95vw',
        maxHeight: '92vh',
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

          {/* ACTION & VIEW SWITCHERS */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {activeTab === 'user' && (
              <div style={{ display: 'flex', background: 'var(--bg1)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <button
                  className="btn-ghost btn-tiny"
                  style={{
                    fontSize: '11px',
                    fontWeight: userSubView === 'cards' ? '700' : '400',
                    background: userSubView === 'cards' ? 'var(--cyan)' : 'transparent',
                    color: userSubView === 'cards' ? '#000' : 'var(--text1)',
                    borderRadius: '4px',
                    padding: '3px 8px'
                  }}
                  onClick={() => setUserSubView('cards')}
                >
                  {t.subviewCards}
                </button>
                <button
                  className="btn-ghost btn-tiny"
                  style={{
                    fontSize: '11px',
                    fontWeight: userSubView === 'flowchart' ? '700' : '400',
                    background: userSubView === 'flowchart' ? 'var(--cyan)' : 'transparent',
                    color: userSubView === 'flowchart' ? '#000' : 'var(--text1)',
                    borderRadius: '4px',
                    padding: '3px 8px'
                  }}
                  onClick={() => setUserSubView('flowchart')}
                >
                  {t.subviewFlowchart}
                </button>
              </div>
            )}

            {activeTab === 'user' && userSubView === 'cards' && (
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
                  width: '240px'
                }}
              />
            )}

            {activeTab === 'user' && userSubView === 'flowchart' ? (
              <button className="btn-secondary btn-tiny" onClick={handleCopyMermaid} style={{ fontSize: '11px', padding: '6px 10px', color: 'var(--cyan)' }}>
                {copyMermaidSuccess ? t.copied : t.copyMermaid}
              </button>
            ) : (
              <button className="btn-secondary btn-tiny" onClick={handleCopySummary} style={{ fontSize: '11px', padding: '6px 10px' }}>
                {copySuccess ? t.copied : t.copySummary}
              </button>
            )}
          </div>
        </div>

        {/* SCROLLABLE CONTENT BODY */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '6px' }}>

          {/* TAB 1: USER OPERATING GUIDE */}
          {activeTab === 'user' && (
            <div>
              <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--cyan)', margin: '0 0 4px 0' }}>
                    {t.userGuide.heading}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text2)', margin: 0 }}>
                    {t.userGuide.desc}
                  </p>
                </div>
              </div>

              {/* VIEW 1A: STEP CARDS */}
              {userSubView === 'cards' && (
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
                        justifyContent: 'space-between'
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
              )}

              {/* VIEW 1B: VISUAL FLOWCHART DIAGRAM */}
              {userSubView === 'flowchart' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  
                  {/* Visual Node Diagram */}
                  <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text0)' }}>
                        {lang === 'zh' ? '臨床端到端操作指引流程圖' : lang === 'id' ? 'Diagram Alur Pemakaian Klinis Terstruktur' : 'Clinical End-to-End Operating Guide Flowchart'}
                      </span>
                      <button className="btn-secondary btn-tiny" onClick={handleCopyMermaid} style={{ fontSize: '11px' }}>
                        {copyMermaidSuccess ? t.copied : t.copyMermaid}
                      </button>
                    </div>

                    {/* Step-by-Step Interactive Nodes */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      
                      {/* Node 1 */}
                      <div style={{ background: 'var(--bg0)', border: '1px solid var(--border-h)', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span style={{ background: 'var(--accent)', color: '#fff', fontSize: '10px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px' }}>STEP 1</span>
                          <strong style={{ fontSize: '12px', color: 'var(--text0)' }}>
                            {lang === 'zh' ? '選擇資料匯入方式' : lang === 'id' ? 'Pilih Metode Input' : 'Select Ingestion Method'}
                          </strong>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginTop: '6px' }}>
                          <div style={{ background: 'var(--bg1)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '11px', color: 'var(--text1)' }}>
                            📁 <strong>{lang === 'zh' ? '資料夾批量 (Bulk)' : lang === 'id' ? 'Folder Bulk Mode' : 'Folder Bulk Mode'}</strong>
                            <div style={{ fontSize: '10px', color: 'var(--text2)', marginTop: '2px' }}>
                              {lang === 'zh' ? '自動過濾子資料夾，僅讀取最外層主要照片' : lang === 'id' ? 'Abaikan subfolder, hanya ambil file di folder utama' : 'Strict root filter; ignores _Result and subfolders'}
                            </div>
                          </div>
                          <div style={{ background: 'var(--bg1)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '11px', color: 'var(--text1)' }}>
                            📷 <strong>{lang === 'zh' ? '單張熱像圖' : lang === 'id' ? 'Citra Tunggal' : 'Single Image'}</strong>
                            <div style={{ fontSize: '10px', color: 'var(--text2)', marginTop: '2px' }}>
                              {lang === 'zh' ? '支援 FLIR 16位元純輻射檔案 (.jpg/.png/.tiff)' : lang === 'id' ? 'Format .jpg / .png / .tiff radiometrik' : 'FLIR radiometric .jpg / .png / .tiff'}
                            </div>
                          </div>
                          <div style={{ background: 'var(--bg1)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '11px', color: 'var(--text1)' }}>
                            📂 <strong>{lang === 'zh' ? '讀取已存專案' : lang === 'id' ? 'Buka Sesi Tersimpan' : 'Load Saved Session'}</strong>
                            <div style={{ fontSize: '10px', color: 'var(--text2)', marginTop: '2px' }}>
                              {lang === 'zh' ? '舊版專案自動平滑升級至 9×9 網格標準' : lang === 'id' ? 'Translasi otomatis ke standar grid 9×9' : 'Auto-translates legacy sessions to 9×9 grid'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'center', color: 'var(--cyan)', fontSize: '14px', lineHeight: '1' }}>↓</div>

                      {/* Node 2 */}
                      <div style={{ background: 'var(--bg0)', border: '1px solid var(--border-h)', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span style={{ background: 'var(--accent)', color: '#fff', fontSize: '10px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px' }}>STEP 2</span>
                          <strong style={{ fontSize: '12px', color: 'var(--text0)' }}>
                            {lang === 'zh' ? '全阻斷載入畫面與感測解碼' : lang === 'id' ? 'Layar Terkunci Batch & Dekode Sensor' : 'Blocking Batch Overlay & Pure Radiometric Decode'}
                          </strong>
                          <span style={{ background: 'rgba(0, 229, 255, 0.1)', color: 'var(--cyan)', fontSize: '10px', padding: '1px 6px', borderRadius: '4px' }}>Mode Mula-mula</span>
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--text1)', margin: '0 0 6px 0' }}>
                          {lang === 'zh' 
                            ? '完全移除人工影像修復 (cv2.inpaint)，直接讀取普朗克參數計算溫度；若有損壞檔案，提供進度條上方警告橫幅與「重新整理/重試」或「安全取消」選項。'
                            : lang === 'id'
                            ? 'Bebas efek inpainting; suhu murni diekstrak dari parameter Planck. Bila ada file rusak, banner peringatan muncul di atas progress bar dengan tombol Refresh atau Batal.'
                            : 'Bypasses artificial inpainting; pure float32 temperatures decoded directly. If corrupted files occur, top alert banner offers Refresh/Retry or safe Cancel.'}
                        </p>
                      </div>

                      <div style={{ textAlign: 'center', color: 'var(--cyan)', fontSize: '14px', lineHeight: '1' }}>↓</div>

                      {/* Node 3 */}
                      <div style={{ background: 'var(--bg0)', border: '1px solid var(--cyan)', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span style={{ background: 'var(--cyan)', color: '#000', fontSize: '10px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px' }}>STEP 3 (MANDATORY)</span>
                          <strong style={{ fontSize: '12px', color: 'var(--text0)' }}>
                            {lang === 'zh' ? '強制物理尺寸校準嚮導 (Calibration Wizard)' : lang === 'id' ? 'Langkah Wajib: Wizard Kalibrasi Skala Fisik' : 'Mandatory Calibration Wizard'}
                          </strong>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                          <div style={{ background: 'var(--bg1)', padding: '8px', borderRadius: '6px', fontSize: '11px', color: 'var(--text1)' }}>
                            ⏹️ <strong>{lang === 'zh' ? '參考方塊 (10×10 cm)' : lang === 'id' ? 'Reference Box (10×10 cm)' : 'Reference Box (10×10 cm)'}</strong>
                            <div style={{ fontSize: '10px', color: 'var(--text2)', marginTop: '2px' }}>
                              {lang === 'zh' ? '對角點擊 2 點計算各向同性比例 S = (Wpx+Hpx)/(Wcm+Hcm)' : lang === 'id' ? 'Klik 2 titik diagonal, skala S = (Wpx+Hpx)/(Wcm+Hcm)' : '2-point diagonal click for isotropic px/cm ratio'}
                            </div>
                          </div>
                          <div style={{ background: 'var(--bg1)', padding: '8px', borderRadius: '6px', fontSize: '11px', color: 'var(--text1)' }}>
                            📏 <strong>{lang === 'zh' ? '直尺標記 (Ruler Line)' : lang === 'id' ? 'Mistar Garis (Ruler Line)' : 'Ruler Line'}</strong>
                            <div style={{ fontSize: '10px', color: 'var(--text2)', marginTop: '2px' }}>
                              {lang === 'zh' ? '點擊起點與終點計算線性比例 S = DistPx / DistCm' : lang === 'id' ? 'Klik titik awal dan akhir garis mistar' : '2-point linear distance calculation'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'center', color: 'var(--cyan)', fontSize: '14px', lineHeight: '1' }}>↓</div>

                      {/* Node 4 */}
                      <div style={{ background: 'var(--bg0)', border: '1px solid var(--border-h)', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span style={{ background: 'var(--accent)', color: '#fff', fontSize: '10px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px' }}>STEP 4</span>
                          <strong style={{ fontSize: '12px', color: 'var(--text0)' }}>
                            {lang === 'zh' ? '9×9 網格標準化 ROI 標記與解剖點快捷鍵' : lang === 'id' ? 'Anotasi ROI Standar Grid 9×9 & Shortcut' : 'Standard 9×9 Grid ROI & Landmark Hotkeys'}
                          </strong>
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--text1)', margin: '0 0 6px 0' }}>
                          {lang === 'zh'
                            ? '圓形直徑嚴格鎖定 9×9 個網格單元 (半徑 r = 4.5 格 = 1.2 cm)，像素大小隨鏡頭拍攝距離動態自適應；支援快捷鍵 [T] 拇趾、[M] 第一蹠骨、[3] 中足部。'
                            : lang === 'id'
                            ? 'Diameter lingkaran terkunci tepat 9×9 sel grid (radius = 4.5 sel = 1.2 cm) dan beradaptasi otomatis terhadap jarak kamera; shortcut [T] T1, [M] M1, [3] M3.'
                            : 'ROI circle locked to 9×9 grid cells (r = 4.5 cells = 1.2 cm) and automatically rescales with camera distance; fast hotkeys [T] Hallux, [M] 1st Metatarsal, [3] Midfoot.'}
                        </p>
                      </div>

                      <div style={{ textAlign: 'center', color: 'var(--cyan)', fontSize: '14px', lineHeight: '1' }}>↓</div>

                      {/* Node 5 */}
                      <div style={{ background: 'var(--bg0)', border: '1px solid var(--border-h)', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span style={{ background: 'var(--accent)', color: '#fff', fontSize: '10px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px' }}>STEP 5</span>
                          <strong style={{ fontSize: '12px', color: 'var(--text0)' }}>
                            {lang === 'zh' ? '熱梯度空間分析與足底論文 Figure 1 複合圖' : lang === 'id' ? 'Analisis Gradien Sobel & Plantar Paper Fig.1' : 'Spatial Gradient Analysis & Plantar Paper Fig.1'}
                          </strong>
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--text1)', margin: '0 0 6px 0' }}>
                          {lang === 'zh'
                            ? 'Sobel 偏導數 (Gx, Gy)、八向星形羅盤 (S) 徑向溫差採樣、Whitehot 黑白高對比底圖 + Ironbow 偽彩色斑塊 + 4種網格樣式（含 step=1 極細髮絲線）。'
                            : lang === 'id'
                            ? 'Derivatif Sobel (Gx, Gy), bintang kompas 8 arah (S), latar Whitehot + ROI Ironbow + 4 opsi grid (termasuk garis rambut rapat step=1).'
                            : 'Sobel derivatives (Gx, Gy), 8-direction radial star (S), Whitehot background + Ironbow ROIs + 4 grid modes (including hairline dense step=1).'}
                        </p>
                      </div>

                      <div style={{ textAlign: 'center', color: 'var(--cyan)', fontSize: '14px', lineHeight: '1' }}>↓</div>

                      {/* Node 6 */}
                      <div style={{ background: 'var(--bg0)', border: '1px solid var(--green)', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span style={{ background: 'var(--green)', color: '#000', fontSize: '10px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px' }}>STEP 6 (FINAL)</span>
                          <strong style={{ fontSize: '12px', color: 'var(--green)' }}>
                            {lang === 'zh' ? '成果導出：1:1純淨圖、CSV指標、Quiver向量圖、JSON備份與ZIP壓縮包' : lang === 'id' ? 'Ekspor Multi-Format: Citra Murni, CSV, Quiver, Sesi JSON & ZIP' : 'Multi-Format Export: Clean Image, CSV, Quiver Maps, JSON & ZIP'}
                          </strong>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Mermaid Raw Code Box */}
                  <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text2)', textTransform: 'uppercase' }}>
                        Mermaid Diagram Code ({lang.toUpperCase()})
                      </span>
                      <button className="btn-secondary btn-tiny" onClick={handleCopyMermaid} style={{ fontSize: '10px' }}>
                        {copyMermaidSuccess ? t.copied : '📋 Copy Code'}
                      </button>
                    </div>
                    <pre style={{
                      background: 'var(--bg0)',
                      border: '1px solid var(--border-h)',
                      borderRadius: '6px',
                      padding: '10px',
                      margin: 0,
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--cyan)',
                      overflowX: 'auto',
                      maxHeight: '160px'
                    }}>
                      {t.mermaidCode}
                    </pre>
                  </div>

                </div>
              )}

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
                <button className="btn-primary btn-tiny" onClick={handleCopySummary} style={{ fontSize: '11px', padding: '4px 10px' }}>
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
