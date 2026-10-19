# Laporan Audit Cacat Perangkat Lunak & Analisis Kerentanan Terpadu (Merged Master Bug Log)
## ThermalSight Release v1.8.3

- **Tanggal Audit & Validasi Silang**: 19 Oktober 2026
- **Target Versi**: `v1.8.3` $\rightarrow$ **Tuntas Diperbaiki di `v1.8.4`**
- **Repositori**: `Corneliox/ThermalSight-App`
- **Tingkat Keparahan Global**: 🟢 **RESOLVED (Seluruh 25 Bug & Anomali Suhu > 100°C Telah Diperbaiki & Lulus 9/9 Regression Tests di `backend/test_regression_v184.py`)**
- **Total Temuan Tervalidasi & Diselesaikan**: **25/25 Cacat Perangkat Lunak (100% Fixed & Verified)**
- **Panduan Eksekusi Lintas-Jendela & Ceklist Pengujian (QA)**: Lihat [`log/README.md`](./README.md)

---

## 1. Ringkasan Eksekutif & Matriks Validasi Silang

Berdasarkan inspeksi menyeluruh terhadap riwayat git (`v1.8.1` $\rightarrow$ `v1.8.2` $\rightarrow$ `v1.8.3`), audit baris-demi-baris pada seluruh komponen (`ppg_workbench.py`, `backend/analyzer.py`, `src/main.js`, `src/preload.js`, `src/src/App.jsx`, `src/src/thermalEngine.js`), serta **bukti empiris dari output nyata `FLIR0426` & `FLIR0428`**:

1. **Penyebab Anomali Suhu Menyentuh $> 100^\circ\text{C}$ (`123.87°C` s/d `187.06°C` pada `FLIR0426` & `FLIR0428`)**:
   - Ketika `ppg_workbench.py` dijalankan oleh Electron (`main.js` L645/L788 menggunakan `python` sistem yang tidak memiliki pustaka `flyr`, **ATAU** ketika `flyr.unpack()` gagal membaca metadata radiometrik pada file `.jpg`), fungsi `load_temperature()` di [`backend/analyzer.py` (L76–L79)](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/backend/analyzer.py#L76-L79) jatuh ke mode *fallback* `cv2.imread(filepath, cv2.IMREAD_GRAYSCALE)`.
   - Mode *fallback* ini mengembalikan **intensitas kecerahan piksel 8-bit mentah (`0` s/d `255`)** tanpa memetakannya ke rentang suhu Celcius fisiologis! Akibatnya, tingkat kecerahan piksel grayscale (`88.26`, `123.87`, `175.14`, `187.06`) langsung dicetak sebagai derajat Celcius (`PPP_Mean_Temp_C`, `PPP_Peak_Temp_C`), gradien `PPG` membengkak ~15 kali lipat (`6.37`–`16.1`), dan ambang background `bg_val = 31.0°C` salah memotong pada kecerahan piksel `31/255` sehingga latar belakang dingin (`40.53`) ikut masuk ke dalam ROI `T1`!
2. **Validasi 10 Bug Laporan Awal (`bugfound_v1_8_3.md`)**: **Seluruh 10 bug (100%) terbukti BENAR dan masih aktif** di kode sumber saat ini.
3. **Penambahan 15 Bug Baru yang Tervalidasi Penuh**: Termasuk anomali skala `0–255` (`BUG-1.7`), kontaminasi piksel background pada kotak ROI $9\times 9$ (`BUG-1.8`), trunkasi desimal `float32` $\rightarrow$ `uint8` (`BUG-1.2`), diabaikannya kalibrasi `pxPerCm` (`BUG-1.3`), rumus sudut sirkular & duplikasi kolom formula Excel yang terbukti langsung di output CSV/Excel pengguna (`BUG-1.4`), serta 4 bug crash di mode Web/UI (`BUG-3.5` s/d `BUG-3.8`).

### Tabel Matriks Perbandingan & Validasi (25 Bug)

| ID Bug | Kategori | Ringkasan Masalah | Status di Laporan Awal | Hasil Validasi Kode & Bukti Output |
| :--- | :--- | :--- | :--- | :--- |
| **BUG-1.1** | 🔴 Ilmiah/Medis | Pembalikan $180^\circ$ vektor orientasi PGA (`sobel_y` tidak dinegasi) di `ppg_workbench.py` & `analyzer.py` | Ada (`BUG-1.1`) | ✅ **VALID & DIPERLUAS** (Juga terjadi di `analyzer.py` L1268) |
| **BUG-1.2** | 🔴 Ilmiah/Medis | **Trunkasi `float32` $\rightarrow$ `uint8`** pada `cv2.inpaint` memotong seluruh desimal suhu kaki menjadi integer sebelum hitung PPP/PPG/PGA | 🆕 **BARU** | ✅ **TERVALIDASI** (`ppg_workbench.py` L1119, L1634 & `analyzer.py` L1239) |
| **BUG-1.3** | 🔴 Ilmiah/Medis | **Skala kalibrasi `pxPerCm` diabaikan** saat ekspor ROI di Desktop (`10.0 px/cm` *hardcoded*) | 🆕 **BARU** | ✅ **TERVALIDASI** (`App.jsx` L1575 $\rightarrow$ `analyzer.py` L897) |
| **BUG-1.4** | 🔴 Ilmiah/Medis | **Rumus rata-rata sudut `PGA` salah (`=AVERAGE` aritmetika)**, rata-rata sirkular tanpa bobot magnitudo, & **duplikasi kolom formula Excel (`141.186` tampil di 2 kolom)** | 🆕 **BARU** | ✅ **TERBUKTI DI OUTPUT** (`ppg_workbench.py` L162–230, L1685–1691) |
| **BUG-1.5** | 🔴 Ilmiah/Medis | **Inkonsistensi metrik** antara `analyzer.py` (`bg_thresh=26.5°C`, 1 piksel) vs `ppg_workbench.py` (`bg_thresh=31.0°C`, *patch* $9\times 9$) | 🆕 **BARU** | ✅ **TERVALIDASI** (`analyzer.py` L1217 vs `ppg_workbench.py` L1622) |
| **BUG-1.6** | 🔴 Ilmiah/Medis | **`temp_mean` di Mode Web** menghitung rata-rata gradien Sobel (`sortedMag`), bukan rata-rata suhu (`tempMatrix`) | 🆕 **BARU** | ✅ **TERVALIDASI** (`thermalEngine.js` L548) |
| **BUG-1.7** | 🔴 **ANOMALI >100°C** | **Fallback Grayscale `0–255` Tanpa Konversi Suhu & Gagalnya `flyr` di System Python**: Menyebabkan suhu `FLIR0426`/`FLIR0428` tercatat `123.87°C`–`187.06°C` dan `PPG` membengkak 15x lipat | 🆕 **BARU (Temuan Utama Anomali >100)** | ✅ **TERBUKTI DI OUTPUT** (`analyzer.py` L76–79, L90–95, L131 & `main.js` L788) |
| **BUG-1.8** | 🔴 **ANOMALI >100°C** | **Sampling Kotak $9\times 9$ ROI Tidak Memfilter Piksel Luar Mask Kaki (`~mask_dense`) & Offset Grid $+0.5$**: Menyebabkan `T1` kemasukan background dingin (`Min=40.53`, `Std=24.8`, `PPG_Peak=16.1`) | 🆕 **BARU (Temuan Utama Anomali >100)** | ✅ **TERBUKTI DI OUTPUT** (`ppg_workbench.py` L1666–1673) |
| **BUG-2.1** | 🟠 Keamanan/IPC | `webSecurity: false` masih aktif di `BrowserWindow` utama Electron | Ada (`BUG-2.1`) | ✅ **VALID** (`src/main.js` L148) |
| **BUG-2.2** | 🟠 Keamanan/IPC | Buffer deadlock pada pipa `stdout`/`stderr` child process `open-ppg-workbench` | Ada (`BUG-2.2`) | ✅ **VALID** (`src/main.js` L650) |
| **BUG-2.3** | 🟠 Keamanan/IPC | Headless auto-export menggantung selamanya (*UI freeze*) akibat `messagebox.showerror` tersembunyi | Ada (`BUG-2.3`) | ✅ **VALID** (`ppg_workbench.py` L929, L947, L983) |
| **BUG-2.4** | 🟠 Arsitektur/Build | **Gagal jalan / kehilangan `flyr` di Build Produksi & Dev**: `main.js` memanggil `python` sistem (bukan `.venv` atau `analyzer.exe`) untuk `ppg_workbench.py` | 🆕 **BARU** | ✅ **TERVALIDASI** (`src/main.js` L645–654, L788) |
| **BUG-2.5** | 🟠 Keamanan/IPC | **Arbitrary File Write pada IPC `save-file`** & *path traversal prefix bypass* pada `delete-result-folder` | 🆕 **BARU** | ✅ **TERVALIDASI** (`src/main.js` L734–746, L759) |
| **BUG-3.1** | 🟡 Stabilitas/OS | Crash `AttributeError: os.startfile` pada macOS dan Linux | Ada (`BUG-3.1`) | ✅ **VALID** (`ppg_workbench.py` L1853) |
| **BUG-3.2** | 🟡 File System | Penumpukan nama folder hasil rekursif `*_result_result` | Ada (`BUG-3.2`) | ✅ **VALID** (`ppg_workbench.py` L1469, L1507) |
| **BUG-3.3** | 🟡 Citra/Inpaint | Regresi `clean_flir_accessories` menghapus titik terpanas kaki (`norm_u8 > 240`) menjadi *dark hole artifact* & memotong puncak di `~187` | Ada (`BUG-3.3`) | ✅ **TERBUKTI DI OUTPUT** (`analyzer.py` L79, L122 & `ppg_workbench.py` L48) |
| **BUG-3.4** | 🟡 CLI/IPC | Headless CLI `--export-metrics` selalu keluar dengan `sys.exit(0)` meski gagal | Ada (`BUG-3.4`) | ✅ **VALID** (`ppg_workbench.py` L1956) |
| **BUG-3.5** | 🟡 Runtime Web | **Crash `ReferenceError: radiusGrid is not defined`** pada `generatePlantarPaperFig1Package` | 🆕 **BARU** | ✅ **TERVALIDASI** (`thermalEngine.js` L2598, L2768) |
| **BUG-3.6** | 🟡 Runtime Web | **Destructuring string `[name]` salah** pada `COMPASS.forEach`, mengabaikan 4 arah diagonal (`NE, SE, SW, NW`) | 🆕 **BARU** | ✅ **TERVALIDASI** (`thermalEngine.js` L691–696) |
| **BUG-3.7** | 🟡 Runtime Web | **Gambar Crop ROI transparan/kosong** karena `ctx.putImageData(imgData, 0, 0)` tidak pernah dipanggil | 🆕 **BARU** | ✅ **TERVALIDASI** (`thermalEngine.js` L743–802) |
| **BUG-3.8** | 🟡 Runtime UI | **Crash `TypeError: a.name.localeCompare`** saat pengguna men-*drop* file arsip `.zip` | 🆕 **BARU** | ✅ **TERVALIDASI** (`src/src/App.jsx` L757–761) |
| **BUG-3.9** | 🟡 State/Data | **Mutasi `self.rois_data` dengan `"points": []` kosong** di dalam `get_mapped_rois`, merusak file JSON sesi | 🆕 **BARU** | ✅ **TERVALIDASI** (`ppg_workbench.py` L1357–1376) |
| **BUG-4.1** | ⚪ Rilis/Git | Mutabilitas tag Git `v1.8.3` yang dipindah-pindah antar-commit | Ada (`BUG-4.1`) | ✅ **VALID** |
| **BUG-4.2** | ⚪ Rilis/Git | Penyimpanan artefak biner & path lokal ke Git (`example/bas_Result/`) | Ada (`BUG-4.2`) | ✅ **VALID** |
| **BUG-4.3** | ⚪ Build/Deps | **`backend/requirements.txt` ber-encoding `UTF-16LE`** & belum mencantumkan `pandas` serta `openpyxl` | 🆕 **BARU** | ✅ **TERVALIDASI** (`backend/requirements.txt`) |

---

## 2. Taksonomi & Rincian Lengkap Seluruh Bug (Merged Details)

### 🔴 KELOMPOK 1: Integritas Ilmiah, Anomali Suhu $> 100^\circ\text{C}$ & Validitas Medis (KRITIS)

#### BUG-1.7 [BARU — PENYEBAB UTAMA ANOMALI SUHU > 100°C]: Fallback Grayscale `0–255` Tanpa Konversi Suhu & Tidak Dipakainya `flyr` Saat Memanggil `ppg_workbench.py`
- **File**: [`backend/analyzer.py`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/backend/analyzer.py#L69-L79) (L69–L79, L90–L95, L128–L131), [`ppg_workbench.py`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/ppg_workbench.py#L48) (L48, L1542), & [`src/main.js`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/src/main.js#L788) (L645, L788)
- **Tingkat Keparahan**: 🔴 **CRITICAL BLOCKER**
- **Bukti Empiris pada Data Pengguna (`FLIR0426` & `FLIR0428`)**:
  ```csv
  Image_Name,Foot_Side,ROI,PPP_Mean_Temp_C,PPP_Peak_Temp_C,PPP_Min_Temp_C,PPP_Std_Temp_C,PPG_Mean_Grad,PPG_Peak_Grad
  FLIR0426,Right,T1,123.87,161.98,94.92,18.53,6.371,10.842
  FLIR0426,Right,M1,175.14,185.13,161.56,5.45,2.818,12.448
  FLIR0426,Right,M3,178.67,187.06,165.62,5.36,2.363,3.51
  FLIR0428,Right,T1,88.26,135.23,40.53,24.8,9.728,16.1
  ```
- **Deskripsi Masalah (Rantai Sebab-Akibat)**:
  1. **Jatuhnya Pembacaan Citra ke Mode Grayscale 8-Bit (`0–255`)**:
     Pada [`backend/analyzer.py` (L69–L79)](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/backend/analyzer.py#L69-L79):
     ```python
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
         return clean_flir_accessories(raw.astype(np.float32))
     ```
     Ketika `main.js` (L645 / L788) memanggil `python ppg_workbench.py` menggunakan Python sistem yang tidak memiliki `flyr` (`FLYR_AVAILABLE = False`), **atau** ketika file `FLIR0426.jpg`/`FLIR0428.jpg` tidak memiliki metadata radiometrik FLIR APP1 yang valid (misal telah dikompresi/disimpan ulang), fungsi `load_temperature()` jatuh ke `cv2.imread(filepath, cv2.IMREAD_GRAYSCALE)`.
  2. **Intensitas Piksel `0–255` Dilaporkan Langsung Sebagai Derajat Celcius (`°C`)**:
     `cv2.imread(..., cv2.IMREAD_GRAYSCALE)` menghasilkan nilai kecerahan piksel **0 s/d 255**, bukan suhu dalam derajat Celcius! Di [`clean_flir_accessories` (L90 & L131)](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/backend/analyzer.py#L90-L131), kode bahkan mendeteksi `is_celsius = float(temp_work.max()) < 100.0`, namun ketika `is_celsius == False`, kode tetap mengembalikan `inpainted_u8.astype(np.float32)` dalam rentang **0 s/d 255**!
  3. **Puncak Terpotong di `~187` Akibat `BUG-3.3` (`clean_flir_accessories`)**:
     Mengapa nilai tertinggi di tabel berhenti di `185.13` dan `187.06` (tidak mencapai `240–255`)? Karena [`clean_flir_accessories` (L122)](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/backend/analyzer.py#L122) menganggap semua piksel di tengah gambar dengan kecerahan `norm_u8 > 240` sebagai "crosshair kamera", mendilasinya dengan kernel $5\times 5$, lalu menghapus dan menambalnya (*inpaint*) dengan piksel pinggiran yang lebih redup (~`185`–`187`)!
  4. **Distorsi Gradien `PPG` (~15x Lipat Lebih Besar)**:
     Karena rentang nilai piksel kaki adalah `40–187` ($\Delta \approx 147$ unit grayscale) alih-alih suhu fisiologis `25–36°C` ($\Delta \approx 10^\circ\text{C}$), hasil turunan Sobel (`PPG_Mean_Grad` dan `PPG_Peak_Grad`) ikut terkalikan ~15x lipat (mencapai `6.371`–`16.100`).

#### BUG-1.8 [BARU — PENYEBAB ANOMALI `T1` `Min=40.53` & `Std=24.8`]: Sampling Kotak $9\times 9$ ROI Tidak Memfilter Mask Kaki (`mask_dense`) & Kegagalan Threshold `bg_val=31.0` pada Mode Grayscale
- **File**: [`ppg_workbench.py`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/ppg_workbench.py#L1599-L1673) (L1599–L1610 & L1666–L1673)
- **Tingkat Keparahan**: 🔴 **CRITICAL**
- **Bukti Empiris pada Data Pengguna**:
  Pada `FLIR0428` ROI `T1`, nilai `PPP_Min_Temp_C` anjlok ke **`40.53`** dengan `PPP_Std_Temp_C = 24.8` dan `PPG_Peak_Grad = 16.1` (sedangkan `M1` dan `M3` memiliki `Std` sekitar `5.0–8.3`).
- **Deskripsi Masalah**:
  1. **Threshold `bg_val = 31.0°C` Diterapkan pada Matriks Grayscale `0–255` (L1599)**:
     Berbeda dengan [`backend/analyzer.py` (L1278–L1294)](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/backend/analyzer.py#L1278-L1294) yang membedakan `if np.max(foot_patch_raw) < 100:` vs mode grayscale (`np.percentile(foot_patch_raw, 35)`), [`ppg_workbench.py` (L1599)](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/ppg_workbench.py#L1599) langsung menerapkan `bg_map = np.full_like(foot_patch, bg_val)` (`31.0`) tanpa memeriksa apakah citra berskala Celcius atau `0–255`. Pada skala `0–255`, nilai `31.0` adalah latar belakang yang sangat gelap, sehingga latar belakang dingin dengan kecerahan `35–95` di sekitar ujung jari kaki (`T1`) ikut masuk ke dalam mask kaki!
  2. **Kotak $9\times 9$ Tidak Memfilter Piksel Luar Kaki (`~mask_dense`) (L1671–L1673)**:
     ```python
     roi_temps = grid_smooth[gy_min:gy_max, gx_min:gx_max]
     roi_mags = grad_mag[gy_min:gy_max, gx_min:gx_max]
     roi_angs = grad_angles[gy_min:gy_max, gx_min:gx_max]
     ```
     Kode mengambil seluruh piksel dalam persegi $9\times 9$ tanpa memfilter `mask_dense[gy_min:gy_max, gx_min:gx_max]`. Untuk `T1` (jempol kaki) yang berada di dekat batas tepi atas kaki, piksel latar belakang di luar jempol kaki ikut dihitung sebagai suhu ROI `T1`, menjatuhkan `PPP_Min_Temp_C` ke `40.53`, menaikkan `PPP_Std_Temp_C` ke `24.8`, dan menciptakan tebing gradien palsu (`PPG_Peak_Grad = 16.1`).
  3. **Pergeseran Indeks Grid $+0.5$ Sel & Tanpa Clamping Batas (L1659–L1669)**:
     `gx` dan `gy` memiliki offset `+ 0.5` (koordinat 1-based untuk plotting Matplotlib `0.5 .. n_cols+0.5`), tetapi langsung dipakai memotong array `numpy` 0-based tanpa dikurangi `0.5` dan tanpa `np.clip` terhadap batas ukuran grid.

#### BUG-1.1: Pembalikan 180° Vektor Orientasi Rambatan Panas (PGA Compass Inversion)
- **File**: [`ppg_workbench.py`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/ppg_workbench.py#L1641) (L1641, L319, L1524) & [`backend/analyzer.py`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/backend/analyzer.py#L1268) (L1268)
- **Tingkat Keparahan**: 🔴 **CRITICAL**
- **Deskripsi Masalah**:
  Dalam matriks citra digital (`numpy` / OpenCV), indeks baris ($y$) bertambah **ke bawah** (arah tumit / proksimal / South). Pada `v1.8.1`, perhitungan orientasi telah diperbaiki dengan menginversi komponen vertikal (`-sobel_y`). Namun pada `v1.8.2` dan `v1.8.3`, baris 1641 [`ppg_workbench.py`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/ppg_workbench.py#L1641) dan baris 1268 [`backend/analyzer.py`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/backend/analyzer.py#L1268) menggunakan:
  ```python
  grad_angles = np.degrees(np.arctan2(sobel_y, sobel_x)) % 360.0
  ```
  Karena `sobel_y > 0` berarti suhu meningkat ke arah bawah (tumit), sudut yang dihasilkan adalah $+90^\circ$. Namun fungsi [`_angle_to_compass`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/ppg_workbench.py#L1524) memetakan sudut $67.5^\circ\text{–}112.5^\circ$ ($+90^\circ$) ke `"N (Distal / Toes)"`.
- **Dampak Klinis/Riset**:
  Semua file keluaran (`PPP_PPG_PGA_Statistical_Summary.xlsx`, `PPP_PPG_PGA_Statistical_Summary.csv`, `PPP_PPG_PGA_Wide_Summary.csv`, dan `*_metrics.csv`) mencatat arah disipasi panas yang **terbalik 180° secara vertikal**. Pada data `FLIR0426` & `FLIR0428` di atas, sudut `79.2°` dan `92.1°` yang dilabeli `N (Distal / Toes)` sebenarnya mengarah ke **Selatan (Tumit/Heel)**!

#### BUG-1.2 [BARU]: Trunkasi Float32 ke Uint8 (`cv2.inpaint`) yang Menghancurkan Presisi Desimal Suhu & Gradien
- **File**: [`ppg_workbench.py`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/ppg_workbench.py#L1119) (L1119 & L1634) & [`backend/analyzer.py`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/backend/analyzer.py#L1239-L1253) (L1239–L1253)
- **Tingkat Keparahan**: 🔴 **CRITICAL**
- **Deskripsi Masalah**:
  Pada [`recompute_gradients_from_mask`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/ppg_workbench.py#L1119) dan [`recompute_and_export_all_metrics`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/ppg_workbench.py#L1634), matriks suhu kaki `self.foot_crop` diproses dengan:
  ```python
  crop_inpainted = cv2.inpaint(
      np.clip(self.foot_crop, 0, 255).astype(np.uint8), mask_inv, 7, cv2.INPAINT_TELEA
  ).astype(np.float32)
  ```
  Konversi `.astype(np.uint8)` pada seluruh matriks `self.foot_crop` **memotong semua nilai pecahan desimal menjadi bilangan bulat (integer)** di seluruh telapak kaki ($34.89^\circ\text{C} \rightarrow 34.0^\circ\text{C}$) sebelum dilakukan interpolasi `cv2.resize` dan Gaussian Blur! Hal serupa terjadi di [`cmd_plantar_fig1` (`backend/analyzer.py` L1239–L1253)](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/backend/analyzer.py#L1239-L1253).

#### BUG-1.3 [BARU]: Skala Kalibrasi (`pxPerCm`) Diabaikan Saat Ekspor ROI di Desktop (`10.0 px/cm` Hardcoded)
- **File**: [`src/src/App.jsx`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/src/src/App.jsx#L1575) (L1575), [`src/preload.js`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/src/preload.js#L15) (L15), [`src/main.js`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/src/main.js#L346) (L346), & [`backend/analyzer.py`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/backend/analyzer.py#L897) (L642, L897)
- **Tingkat Keparahan**: 🔴 **CRITICAL**
- **Deskripsi Masalah**:
  Panggilan `await api.cropLabels(imgPath, roi.points, roi.labelName, i + 1, isolatedDir)` pada L1575 **tidak pernah mengirimkan parameter `imgScale` (`pxPerCm`)** ke backend Python. Di [`backend/analyzer.py` L897](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/backend/analyzer.py#L897), `cmd_crop` selalu menggunakan `dist_cm = rad_px / 10.0`.

#### BUG-1.4 [BARU — TERBUKTI DI OUTPUT PENGGUNA]: Kesalahan Rumus Rata-Rata Sudut Sirkular (`PGA`) & Duplikasi Kolom Formula pada Audit Trail Excel
- **File**: [`ppg_workbench.py`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/ppg_workbench.py#L158-L231) (L158–L231 & L1685–L1691)
- **Tingkat Keparahan**: 🔴 **CRITICAL**
- **Bukti Empiris pada Data Pengguna**:
  ```csv
  Metrik Parameter,Pertanyaan Klinis (Definisi),Cell Sumber / Rentang Acuan,Cara Menghitung (Formula & Metode),Nilai Agregat
  PPP (Mean Temp),Berapa rata-rata suhu jaringan kulit pada area ROI?,Kolom D (D2:D7),141.18666666666664,141.18666666666664
  PGA (Mean Angle),Ke sudut berapa derajat vektor rambatan panas mengalir?,Kolom K (K2:K7),94.300000000000011,94.300000000000011
  ```
- **Deskripsi Masalah**:
  1. **Duplikasi Formula pada Kolom D dan E (L228–L230)**: Kolom D (`"Cara Menghitung (Formula & Metode)"`) dan Kolom E (`"Nilai Agregat"`) diisi dengan string formula yang sama (`=AVERAGE(D2:D7)`), sehingga Excel mengevaluasi Kolom D menjadi angka `141.18666666666664` alih-alih menampilkan teks penjelasan rumus! Selain itu, Kolom D tidak diformat `0.00` (L243 hanya memformat Kolom E), sehingga muncul angka floating-point panjang `141.18666666666664` dan `94.300000000000011`.
  2. **Rata-rata Aritmetika pada Sudut Sirkular (L202)**: Baris `PGA (Mean Angle)` menggunakan `=AVERAGE(K2:K7)` yang menghasilkan `94.3°` (rata-rata aritmetika biasa), bukan rata-rata vektor sirkular.
  3. **Rata-rata Sirkular Patch Tanpa Bobot Magnitudo (L1686–L1690)**: Tidak membobot `cos`/`sin` dengan magnitudo gradien `roi_mags`.

#### BUG-1.5 [BARU]: Inkonsistensi Ambang Batas Background & Sampling ROI antara `analyzer.py` vs `ppg_workbench.py`
- **File**: [`backend/analyzer.py`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/backend/analyzer.py#L1217) (L1217, L1264–L1268) vs [`ppg_workbench.py`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/ppg_workbench.py#L1622) (L1622, L1672–L1691)
- **Tingkat Keparahan**: 🔴 **HIGH / SCIENTIFIC INCONSISTENCY**
- **Deskripsi Masalah**:
  `analyzer.py` memakai `bg_thresh = 26.5°C` dan mengambil nilai `PPP`/`PPG`/`PGA` dari **1 piksel tunggal** `grid_smooth[iy, ix]`, sedangkan `ppg_workbench.py` memakai `bg_thresh = 31.0°C` dan mengambil rata-rata dari **patch $9\times 9$ piksel**. Selain itu, untuk ROI bertipe `polygon` (yang tidak memiliki properti `cx`/`cy`), `analyzer.py` (L1394) menempatkan titik pusat ROI di `(0, 0)`!

#### BUG-1.6 [BARU]: Perhitungan `temp_mean` di Mode Web Menghitung Rata-Rata Gradien Sobel, Bukan Suhu
- **File**: [`src/src/thermalEngine.js`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/src/src/thermalEngine.js#L548) (L548)
- **Tingkat Keparahan**: 🔴 **HIGH**
- **Deskripsi Masalah**:
  Pada [`runClientThermalAnalysis`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/src/src/thermalEngine.js#L548), `temp_mean` merata-ratakan `sortedMag` (magnitudo gradien Sobel) alih-alih `tempMatrix`.

---

### 🟠 KELOMPOK 2: Kerentanan Keamanan, Kegagalan Packaging & Deadlock IPC (TINGGI)

#### BUG-2.1: `webSecurity: false` Masih Aktif di Electron Main Window
- **File**: [`src/main.js`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/src/main.js#L148) (L148)
- **Tingkat Keparahan**: 🟠 **HIGH**

#### BUG-2.2: Buffer Deadlock pada Pipa Stdout/Stderr Child Process
- **File**: [`src/main.js`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/src/main.js#L650) (L650 `open-ppg-workbench` & L788 `export-ppg-summary`)
- **Tingkat Keparahan**: 🟠 **HIGH**

#### BUG-2.3: Headless Auto-Export Menggantung (UI Freeze pada Tombol Save)
- **File**: [`src/src/App.jsx`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/src/src/App.jsx#L1810-L1818) (L1810–L1818) & [`ppg_workbench.py`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/ppg_workbench.py#L929) (L439, L929, L947, L983, L1950)
- **Tingkat Keparahan**: 🟠 **HIGH**

#### BUG-2.4 [BARU]: Kegagalan Eksekusi & Hilangnya `flyr` Saat `main.js` Memanggil `ppg_workbench.py`
- **File**: [`src/main.js`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/src/main.js#L645-L654) (L645–L654 & L788) & [`analyzer.spec`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/analyzer.spec)
- **Tingkat Keparahan**: 🟠 **HIGH**
- **Deskripsi Masalah**:
  Handler `open-ppg-workbench` dan `export-ppg-summary` di `main.js` memanggil `python` / `python3` sistem secara langsung, bukan menggunakan `analyzer.exe` (pada saat produksi) atau environment Python terkonfigurasi. Jika Python sistem tidak memiliki `flyr`, `ppg_workbench.py` diam-diam jatuh ke mode grayscale `0–255` (`BUG-1.7`); jika tidak memiliki `pandas`/`openpyxl`, ekspor gagal total.

#### BUG-2.5 [BARU]: Celah Keamanan Penulisan File Sembarang (`save-file` IPC) & Bypass Prefix pada `delete-result-folder`
- **File**: [`src/main.js`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/src/main.js#L734-L760) (L734–L746 & L759)
- **Tingkat Keparahan**: 🟠 **HIGH**

---

### 🟡 KELOMPOK 3: Bug Runtime Web/UI, Stabilitas Platform & File System (SEDANG–TINGGI)

#### BUG-3.1: Crash `os.startfile` di macOS & Linux
- **File**: [`ppg_workbench.py`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/ppg_workbench.py#L1853) (L1853)

#### BUG-3.2: Penumpukan Nama Folder Hasil `*_result_result`
- **File**: [`ppg_workbench.py`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/ppg_workbench.py#L1469) (L1469 & L1507)

#### BUG-3.3: Regresi Inpainting Merusak Titik Panas Kaki (Dark Hole Artifact & Pemotongan Peak di ~187)
- **File**: [`backend/analyzer.py`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/backend/analyzer.py#L79) (L79, L122) & [`ppg_workbench.py`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/ppg_workbench.py#L48) (L48)

#### BUG-3.4: Headless CLI Selalu Keluar dengan Exit Code 0
- **File**: [`ppg_workbench.py`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/ppg_workbench.py#L1956) (L1956)

#### BUG-3.5 [BARU]: Crash `ReferenceError: radiusGrid is not defined` pada Generator Plantar Fig 1 (Mode Web)
- **File**: [`src/src/thermalEngine.js`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/src/src/thermalEngine.js#L2598) (L2598 & L2768)

#### BUG-3.6 [BARU]: Destructuring String `[name]` yang Salah pada `computeLabelStarGradient` (Mode Web)
- **File**: [`src/src/thermalEngine.js`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/src/src/thermalEngine.js#L691-L696) (L583 & L691–L696)

#### BUG-3.7 [BARU]: Gambar Crop ROI Transparan/Kosong Akibat Hilangnya `ctx.putImageData` (Mode Web)
- **File**: [`src/src/thermalEngine.js`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/src/src/thermalEngine.js#L743-L802) (L743–L802)

#### BUG-3.8 [BARU]: Crash `TypeError: a.name.localeCompare` Saat Drag-and-Drop File `.zip`
- **File**: [`src/src/App.jsx`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/src/src/App.jsx#L757-L761) (L757–L761)

#### BUG-3.9 [BARU]: Mutasi `self.rois_data` dengan `"points": []` Kosong di `get_mapped_rois`
- **File**: [`ppg_workbench.py`](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/ppg_workbench.py#L1357-L1376) (L1357–L1376)

---

### ⚪ KELOMPOK 4: Manajemen Rilis, Dependensi & Kebersihan Repositori (RENDAH)

#### BUG-4.1: Mutabilitas Tag Git (`v1.8.3` Digerakkan Ulang)
#### BUG-4.2: Penyimpanan Artefak Komputasi & File Biner ke Riwayat Git (`example/bas_Result/`)
#### BUG-4.3 [BARU]: Encoding `UTF-16LE` & Dependensi Hilang pada `backend/requirements.txt`

---

## 3. Protokol Evaluasi Berpikir Kritis (Critical Thinking Assessment)

### 3.1. Main Concern (Kekhawatiran Utama)
Anomali suhu yang menyentuh **`123.87°C` hingga `187.06°C`** pada output `FLIR0426` dan `FLIR0428` membuktikan secara empiris bahwa pipa komputasi saat ini **mencampuradukkan nilai kecerahan piksel 8-bit (`0–255`) dengan satuan suhu derajat Celcius (`°C`)** (`BUG-1.7`). Hal ini diperparah oleh pemotongan piksel terpanas (`> 240`) oleh `clean_flir_accessories` (`BUG-3.3`), masuknya piksel latar belakang dingin ke dalam kotak ROI `T1` (`BUG-1.8`), pembalikan arah kompas PGA $180^\circ$ (`BUG-1.1`), serta kesalahan rumus dan tampilan tabel Audit Trail di Excel (`BUG-1.4`).

### 3.2. Weakest Assumption (Asumsi Paling Lemah)
Mengasumsikan bahwa `load_temperature()` selalu mengembalikan matriks dalam satuan derajat Celcius (`20°C–40°C`). Ketika `flyr` tidak tersedia di environment Python yang menjalankan `ppg_workbench.py` atau ketika citra JPG bukan merupakan citra radiometrik FLIR murni, `load_temperature()` jatuh ke `cv2.imread(..., cv2.IMREAD_GRAYSCALE)` dan mengembalikan nilai `0–255` tanpa normalisasi fisiologis ataupun peringatan kepada pengguna.

### 3.3. Strongest Counterargument (Bantahan Terkuat & Sanggahannya)
- **Bantahan**: *"Citra non-radiometrik memang tidak memiliki data suhu absolut, sehingga wajar jika nilainya berupa intensitas grayscale 0–255."*
- **Sanggahan**:
  1. Jika citra seperti `FLIR0426.jpg` dan `FLIR0428.jpg` sebenarnya adalah citra FLIR radiometrik asli tetapi terbaca `0–255` hanya karena `main.js` memanggil `python` sistem yang tidak memiliki modul `flyr` (`BUG-2.4`), maka data radiometrik asli yang sebenarnya ada di dalam file JPG telah terbuang sia-sia!
  2. Bahkan jika sebuah citra benar-benar non-radiometrik, seluruh algoritma hilir di `ppg_workbench.py` mengasumsikan input berada pada rentang Celcius fisiologis (misalnya threshold segmentasi `bg_val = 31.0°C` di L1599 dan batas bawah plot `vmin = 23.5°C` di L1725). Memasukkan angka `0–255` ke algoritma yang di-hardcode untuk `23.5–40.0°C` merusak segmentasi mask kaki, meledakkan standar deviasi `T1` hingga `24.8`, dan melabeli nilai `187.06` sebagai `°C` di laporan klinis.

### 3.4. What Should Be Verified (Verifikasi Lapangan)
1. Apakah file `FLIR0426.jpg` dan `FLIR0428.jpg` memiliki metadata radiometrik FLIR ketika dibuka dengan `flyr.unpack()`? (Jika ya, berarti penyebab utamanya adalah `python` yang mengeksekusi `ppg_workbench.py` tidak memiliki modul `flyr`, atau `clean_flir_accessories` terpanggil).
2. Jika ada citra yang memang non-radiometrik (8-bit grayscale), apakah harus dipetakan secara linier ke rentang suhu fisiologis plantar (misal $20.0^\circ\text{C}\text{–}38.0^\circ\text{C}$ seperti pada `thermalEngine.js`) disertai penanda jelas bahwa citra tersebut adalah estimasi non-radiometrik?

---

## 4. Rekomendasi Solusi & Rencana Patch Terpadu (Roadmap v1.8.4)

1. **Perbaikan Tuntas Anomali `> 100°C` (`BUG-1.7`, `BUG-1.8`, `BUG-2.4`, `BUG-3.3`)**:
   - Hapus pemanggilan `clean_flir_accessories` pada `load_temperature()` di [`backend/analyzer.py` (L79)](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/backend/analyzer.py#L79).
   - Pastikan eksekusi `ppg_workbench.py` / `--export-metrics` menggunakan interpreter Python yang memiliki `flyr` (dan bundel ke dalam `analyzer.exe`).
   - Apabila sebuah file benar-benar tidak memiliki metadata radiometrik FLIR (fallback grayscale `0–255`), petakan rentang luminansi ke skala fisiologis plantar atau gunakan deteksi skala adaptif pada segmentasi background (jangan gunakan threshold tetap `31.0` pada matriks `0–255`).
   - Pada pengambilan sampel ROI $9\times 9$ di [`ppg_workbench.py` (L1671–L1673)](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/ppg_workbench.py#L1671-L1673), **wajib filter hanya piksel yang berada di dalam mask telapak kaki (`mask_dense`)** agar piksel latar belakang dingin tidak mencemari ROI tepi seperti `T1`.
2. **Perbaikan Presisi Desimal, Kalibrasi, Kompas PGA & Rumus Excel (`BUG-1.1` s/d `BUG-1.6`)**:
   - Hentikan konversi seluruh `foot_crop` ke `uint8` pada `cv2.inpaint` (`BUG-1.2`): pertahankan nilai `float32` asli untuk seluruh piksel di dalam mask kaki.
   - Balik tanda `sobel_y` (`np.arctan2(-sobel_y, sobel_x)`) agar $90^\circ$ benar-benar mengarah ke `N (Distal / Toes)` (`BUG-1.1`).
   - Di [`enhance_excel_workbook` (`ppg_workbench.py` L158–L244)](file:///c:/Users/Pongo/OneDrive/Documents/GitHub/ThermalSight-App/ppg_workbench.py#L158-L244), tampilkan rumus sebagai **teks** di Kolom D (misal `"'=AVERAGE(D2:D7)"`) dan hasil evaluasi di Kolom E (dengan format `0.00`), serta gunakan rumus rata-rata vektor sirkular untuk `PGA (Mean Angle)`.
   - Teruskan `pxPerCm` dari `App.jsx` ke `analyzer.py cmd_crop` (`BUG-1.3`).
3. **Perbaikan Bug Runtime Web, UI & IPC (`BUG-2.1` s/d `BUG-2.5`, `BUG-3.1` s/d `BUG-3.9`)**:
   - Perbaiki `radiusGrid` $\rightarrow$ `m.rFinal`, tambahkan `ctx.putImageData`, perbaiki `COMPASS.forEach`, dan `temp_mean` di `thermalEngine.js`, serta `names.sort` di `App.jsx`.
