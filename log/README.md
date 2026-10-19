# 🛠️ Master Execution Plan & Validation Checklist — ThermalSight v1.8.4 Patch
**Dokumen Panduan Eksekusi Lintas-Jendela (Context-Isolated Work Packages & QA Testing)**

> [!IMPORTANT]
> **Tujuan Dokumen Ini:**  
> Dokumen ini memecah perbaikan **25 Bug Tervalidasi** (lihat detail lengkap di [`log/bugfound_v1_8_3.md`](./bugfound_v1_8_3.md)) menjadi **6 Paket Pekerjaan (Work Packages / Fase)** yang terisolasi per berkas dan rentang baris.  
> Strategi ini memastikan setiap jendela eksekusi baru **hanya membaca baris kode yang relevan (< 40.000 token per sesi)**, tidak pernah mendekati batas konteks 1 juta token, dan tidak saling menimpa perubahan.

---

## 📊 Ringkasan Pembagian Paket Pekerjaan (Token-Safe Sprints)

| Paket | Fokus Utama | Berkas yang Diubah (Rentang Baris Spesifik) | Bug yang Diselesaikan | Estimasi Beban Konteks |
| :--- | :--- | :--- | :--- | :--- |
| **Paket 1** | **Anomali Suhu >100°C & Engine Python Utama** | `backend/analyzer.py` (L69–140, L640–650, L810–915, L1215–1425) | `BUG-1.1`, `BUG-1.2`, `BUG-1.3`, `BUG-1.5`, `BUG-1.7`, `BUG-3.3` | ~25k Token (Sangat Aman) |
| **Paket 2** | **Presisi Float32, Mask ROI 9×9 & Kompas di Workbench** | `ppg_workbench.py` (L45–55, L1055–1130, L1355–1392, L1520–1715) | `BUG-1.1`, `BUG-1.2`, `BUG-1.5`, `BUG-1.7`, `BUG-1.8`, `BUG-3.9` | ~30k Token (Sangat Aman) |
| **Paket 3** | **Rumus Excel Audit Trail, Headless CLI & Multiplatform** | `ppg_workbench.py` (L155–260, L305–335, L425–448, L920–985, L1465–1510, L1845–1960) | `BUG-1.4`, `BUG-2.3`, `BUG-3.1`, `BUG-3.2`, `BUG-3.4` | ~25k Token (Sangat Aman) |
| **Paket 4** | **Electron IPC, Keamanan, Timeout & Kalibrasi Desktop** | `src/main.js` (L140–230, L345–365, L633–667, L734–805) & `src/preload.js` (L12–25) | `BUG-1.3`, `BUG-2.1`, `BUG-2.2`, `BUG-2.4`, `BUG-2.5` | ~20k Token (Sangat Aman) |
| **Paket 5** | **Perbaikan Engine Mode Web & UI React** | `src/src/thermalEngine.js` (L540–555, L580–700, L740–810, L2590–2780) & `src/src/App.jsx` (L750–770, L1570–1585) | `BUG-1.3`, `BUG-1.6`, `BUG-3.5`, `BUG-3.6`, `BUG-3.7`, `BUG-3.8` | ~25k Token (Sangat Aman) |
| **Paket 6** | **Build Dependencies, PyInstaller Spec & Unit Test CI** | `backend/requirements.txt`, `analyzer.spec`, & `backend/test_regression_v184.py` | `BUG-2.4`, `BUG-4.1`, `BUG-4.2`, `BUG-4.3` | ~15k Token (Sangat Aman) |

---

## 📦 Rincian Paket Pekerjaan (Siap Copy-Paste ke Jendela Baru)

### 🔴 PAKET 1: Perbaikan Anomali `> 100°C`, Inpainting Float32 & Kalibrasi di `backend/analyzer.py`
**Target File**: [`backend/analyzer.py`](../backend/analyzer.py)  
**Aturan Hemat Token untuk Agent**: *Jangan baca seluruh file! Gunakan `view_file` hanya pada baris `L65–140`, `L635–655`, `L885–915`, dan `L1215–1425`.*

#### Daftar Pekerjaan Paket 1:
- [ ] **1.1 (`BUG-1.7` & `BUG-3.3` — Anomali >100°C & Dark Hole Artifact)**:
  - Pada `load_temperature(filepath)` (`L69–79`):
    - Hapus pemanggilan `clean_flir_accessories(...)` pada baris 79 agar piksel terpanas (`norm_u8 > 240`) tidak dihapus/di-inpaint menjadi lubang dingin (~187).
    - Jika `flyr` gagal dan jatuh ke `cv2.imread(filepath, cv2.IMREAD_GRAYSCALE)` (nilai `0–255`), petakan secara linier ke rentang suhu fisiologis plantar (`20.0 + (raw.astype(np.float32) / 255.0) * 18.0`) **atau** sertakan metadata/warning jelas sehingga matriks yang keluar dari `load_temperature` selalu berada pada rentang Celcius fisiologis (`< 50°C`) dan tidak pernah mengeluarkan angka `123.87°C`–`187.06°C`.
- [ ] **1.2 (`BUG-1.2` — Trunkasi Float32 ke Uint8 pada `cmd_plantar_fig1`)**:
  - Pada `cmd_plantar_fig1` (`L1239–1253`):
    - Saat melakukan inpainting OSD (`osd_stroke_mask`), **jangan pernah menimpa seluruh `temp_work` dengan `inpainted_u8.astype(np.float32)`**!
    - Hanya salin piksel yang terkena mask (`mask_d > 0`):
      ```python
      if is_celsius:
          inpainted_f32 = mn + (inpainted_u8.astype(np.float32) / 255.0) * (mx - mn)
      else:
          inpainted_f32 = inpainted_u8.astype(np.float32)
      temp_work[mask_d > 0] = inpainted_f32[mask_d > 0]
      ```
- [ ] **1.3 (`BUG-1.1` — Inversi Kompas PGA $180^\circ$)**:
  - Pada `cmd_plantar_fig1` (`L1268` / bagian perhitungan `pga_angle_deg`):
    - Ubah `np.arctan2(gy, gx)` menjadi `np.arctan2(-gy, gx)` karena indeks baris `y` citra bertambah ke arah bawah (Tumit / South).
- [ ] **1.4 (`BUG-1.3` — Skala Kalibrasi `pxPerCm` pada `cmd_crop`)**:
  - Pada `cmd_crop` (`L805–915`):
    - Tambahkan dukungan argumen opsional `px_per_cm` (default `10.0` hanya jika tidak diberikan atau `<= 0`).
    - Pada `L897`, ganti `dist_cm = rad_px / 10.0` menjadi `dist_cm = rad_px / effective_px_cm`, dan teruskan `effective_px_cm` ke `generate_surface_plots` (`L642`).
- [ ] **1.5 (`BUG-1.5` — Penanganan Pusat Polygon ROI & Konsistensi Sampling)**:
  - Pada `cmd_plantar_fig1` (`L1394–1395`): Jika `r` tidak memiliki `"cx"`/`"cy"` (misal ROI bertipe `polygon`), hitung pusat `(rcx, rcy)` dari rata-rata `r["points"]`, bukan `0`!

> **💬 Prompt Siap Pakai untuk Jendela Baru (Paket 1):**
> ```text
> Tolong kerjakan PAKET 1 dari file log/README.md untuk memperbaiki BUG-1.1, BUG-1.2, BUG-1.3, BUG-1.5, BUG-1.7, dan BUG-3.3 di backend/analyzer.py. Baca hanya baris L65-140, L635-655, L805-915, dan L1215-1425 di backend/analyzer.py agar hemat token, lalu jalankan verifikasi sintaks Python.
> ```

---

### 🔴 PAKET 2: Perbaikan Presisi Float32, Masking ROI 9×9 & Kompas PGA di `ppg_workbench.py`
**Target File**: [`ppg_workbench.py`](../ppg_workbench.py)  
**Aturan Hemat Token untuk Agent**: *Baca hanya baris `L45–55`, `L1055–1135`, `L1355–1392`, dan `L1520–1715` di `ppg_workbench.py`.*

#### Daftar Pekerjaan Paket 2:
- [ ] **2.1 (`BUG-1.7` — Fallback `load_temperature` & Penanganan Citra Grayscale)**:
  - Pada `L47–53` dan `L1072–1086` / `L1599–1610`:
    - Pastikan jika matriks `foot_patch` memiliki nilai maksimum `>= 100.0` (citra grayscale yang belum terkonversi), konversikan ke skala suhu fisiologis atau gunakan ambang persentil adaptif (`np.percentile(foot_patch, 35)`) seperti di `analyzer.py`, bukan membandingkan kecerahan `0–255` dengan `bg_val = 31.0°C`!
- [ ] **2.2 (`BUG-1.2` — Hentikan Trunkasi Float32 ke Uint8 pada Seluruh Piksel Kaki)**:
  - Pada `recompute_gradients_from_mask` (`L1118–1120`) dan `recompute_and_export_all_metrics` (`L1633–1635`):
    - **JANGAN** mengubah seluruh `self.foot_crop` / `foot_crop` menjadi `np.uint8`!
    - Normalisasikan ke `0–255` hanya untuk menghitung inpainting pada area luar kaki (`mask_inv > 0`), lalu kembalikan ke skala suhu `float32` dan **hanya isi piksel `mask_inv > 0`**, sementara piksel di dalam mask kaki (`mask_crop_u8 > 0`) **wajib mempertahankan nilai `float32` aslinya 100% tanpa kehilangan desimal**:
      ```python
      crop_inpainted = foot_crop.copy().astype(np.float32)
      if np.any(mask_inv):
          mn, mx = float(np.min(foot_crop)), float(np.max(foot_crop))
          Span = max(1e-6, mx - mn)
          norm_u8 = np.clip((foot_crop - mn) / Span * 255.0, 0, 255).astype(np.uint8)
          inp_u8 = cv2.inpaint(norm_u8, mask_inv, 7, cv2.INPAINT_TELEA)
          inp_f32 = mn + (inp_u8.astype(np.float32) / 255.0) * Span
          crop_inpainted[mask_inv > 0] = inp_f32[mask_inv > 0]
      ```
- [ ] **2.3 (`BUG-1.1` — Inversi Sumbu Y pada Sudut PGA $180^\circ$)**:
  - Pada `recompute_and_export_all_metrics` (`L1641`):
    - Ubah `grad_angles = np.degrees(np.arctan2(sobel_y, sobel_x)) % 360.0` menjadi:
      ```python
      grad_angles = np.degrees(np.arctan2(-sobel_y, sobel_x)) % 360.0
      ```
- [ ] **2.4 (`BUG-1.8` & `BUG-1.4` — Filter Mask Kaki pada ROI 9×9, Koreksi Offset Indeks 0.5, & Rata-Rata Sirkular Berbobot)**:
  - Pada `L1656–1693`:
    - Jika ROI adalah polygon tanpa `cx`/`cy`, hitung pusat `(rcx, rcy)` sebagai rata-rata seluruh titik `points` (bukan `points[0]`).
    - Konversi koordinat pusat grid 1-based `(gx, gy)` ke indeks array 0-based `ix = gx - 0.5`, `iy = gy - 0.5` sebelum mengambil window $9\times 9$.
    - **Wajib filter piksel di dalam mask kaki (`roi_mask = mask_dense[gy_min:gy_max, gx_min:gx_max]`)** agar piksel latar belakang dingin tidak mencemari ROI tepi seperti `T1` (penyebab `Min = 40.53` dan `Std = 24.8` pada `FLIR0428`)!
    - Hitung `mean_ang` dan `coherence_pct` menggunakan vektor gradien (`sobel_x`, `-sobel_y`) atau pembobotan magnitudo pada piksel valid di dalam `roi_mask`.
- [ ] **2.5 (`BUG-3.9` — Jangan Mutasi `self.rois_data` dengan `"points": []` Kosong)**:
  - Pada `get_mapped_rois` (`L1357–1377`):
    - Saat membuat ROI default (`T1`, `M1`, `M2`), bangkitkan 36 titik poligon lingkaran (`points`) seperti di `App.jsx` agar jika disimpan ke JSON, `analyzer.py cmd_crop` tidak gagal dengan `"Polygon must have at least 3 points, got 0"`.

> **💬 Prompt Siap Pakai untuk Jendela Baru (Paket 2):**
> ```text
> Tolong kerjakan PAKET 2 dari file log/README.md untuk memperbaiki BUG-1.1, BUG-1.2, BUG-1.5, BUG-1.7, BUG-1.8, dan BUG-3.9 di ppg_workbench.py. Baca hanya baris L45-55, L1055-1135, L1355-1392, dan L1520-1715 di ppg_workbench.py agar hemat token.
> ```

---

### 🟠 PAKET 3: Perbaikan Tabel Audit Trail Excel, Mode Headless CLI & Multiplatform di `ppg_workbench.py`
**Target File**: [`ppg_workbench.py`](../ppg_workbench.py)  
**Aturan Hemat Token untuk Agent**: *Baca hanya baris `L155–260`, `L305–335`, `L425–450`, `L920–985`, `L1465–1510`, dan `L1845–1960` di `ppg_workbench.py`.*

#### Daftar Pekerjaan Paket 3:
- [ ] **3.1 (`BUG-1.4` — Perbaikan Tabel Audit Trail Excel & Sheet 3 Metodologi)**:
  - Pada `enhance_excel_workbook` (`L157–245`):
    - **Kolom D (`Cara Menghitung (Formula & Metode)`)**: Isi dengan **teks penjelasan rumus** (misal `"AVERAGE(D2:D7)"` tanpa tanda `=` di depan, atau awali dengan kutip tunggal `'=AVERAGE(...)`), sehingga Excel menampilkan teks rumusnya, **bukan** mengevaluasinya menjadi angka duplikat `141.18666666666664`!
    - **Kolom E (`Nilai Agregat`)**: Isi dengan formula Excel aktif (`=AVERAGE(...)`, `=MAX(...)`, `=MIN(...)`) dan format angka `"0.00"`.
    - **Baris `PGA (Mean Angle)` (`L199–204`)**: Ganti formula rata-rata aritmetika `=AVERAGE(K2:K...)` dengan formula rata-rata vektor sirkular Excel:
      `=MOD(DEGREES(ATAN2(AVERAGE(COS(RADIANS(K2:K{data_end_row}))), AVERAGE(SIN(RADIANS(K2:K{data_end_row}))))), 360)` (atau hitung rata-rata vektor sirkular di Python dan tulis nilainya dengan format `0.0°`).
  - Pada Sheet 3 (`Panduan_Metodologi`, `L319`):
    - Perbarui teks rumus PGA menjadi `θ = arctan2(-Gy, Gx) % 360°`.
- [ ] **3.2 (`BUG-2.3` & `BUG-3.4` — Bebaskan Mode `--export-metrics` dari Deadlock `messagebox` & Berikan Exit Code Akurat)**:
  - Tambahkan atribut `self.headless = headless` pada `PPGWorkbenchApp.__init__`.
  - Di `load_json_file` (`L929`, `L947`) dan `load_image_file` (`L983`), jika `self.headless` atau `silent_err` bernilai `True`, **jangan pernah memanggil `messagebox.showerror(...)`**! Cetak pesan error ke `sys.stderr` dan kembalikan `False`.
  - Pada blok `if __name__ == "__main__":` (`L1950–1956`):
    - Saat `args.export_metrics` aktif, jalankan dengan `headless=True`. Jika `not app.image_list` atau `recompute_and_export_all_metrics` gagal menghasilkan file Excel/CSV, keluar dengan `sys.exit(1)` (bukan `sys.exit(0)`).
- [ ] **3.3 (`BUG-3.1` — Pembuka Folder Multiplatform Pengganti `os.startfile`)**:
  - Pada `L1853`, ganti `os.startfile(str(result_dir))` dengan fungsi multiplatform (`os.startfile` untuk `win32`, `subprocess.Popen(["open", ...])` untuk `darwin`, dan `subprocess.Popen(["xdg-open", ...])` untuk Linux).
- [ ] **3.4 (`BUG-3.2` — Cegah Penumpukan Nama Folder `*_result_result`)**:
  - Pada `L1469` dan `L1507`, bersihkan akhiran `_result` menggunakan `re.sub(r'_[rR]esult$', '', active_img_dir.name)` sebelum menambahkan `_result`.

> **💬 Prompt Siap Pakai untuk Jendela Baru (Paket 3):**
> ```text
> Tolong kerjakan PAKET 3 dari file log/README.md untuk memperbaiki BUG-1.4, BUG-2.3, BUG-3.1, BUG-3.2, dan BUG-3.4 di ppg_workbench.py. Baca hanya baris L155-260, L305-335, L425-450, L920-985, L1465-1510, dan L1845-1960 di ppg_workbench.py agar hemat token.
> ```

---

### 🟠 PAKET 4: Perbaikan Electron IPC, Keamanan, Timeout & Kalibrasi di `src/main.js` & `src/preload.js`
**Target File**: [`src/main.js`](../src/main.js) & [`src/preload.js`](../src/preload.js)  
**Aturan Hemat Token untuk Agent**: *Baca hanya `src/preload.js` (`L1–40`) dan `src/main.js` (`L140–230`, `L345–365`, `L633–667`, `L734–805`).*

#### Daftar Pekerjaan Paket 4:
- [ ] **4.1 (`BUG-1.3` — Teruskan Parameter `pxPerCm` pada IPC `crop-labels`)**:
  - Di `src/preload.js` (`L15`): Tambahkan parameter `pxPerCm` pada `cropLabels: (imagePath, points, labelName, roiIndex, outputDir, pxPerCm) => ipcRenderer.invoke('crop-labels', ...)`.
  - Di `src/main.js` (`L346`): Terima `pxPerCm` dan teruskan `String(pxPerCm || 10)` ke `runPython('crop', [...])`.
- [ ] **4.2 (`BUG-2.2`, `BUG-2.3`, `BUG-2.4` — Drain Stdout, Timeout 60 Detik, & Resolusi Python `.venv` / Packaged)**:
  - Buat fungsi helper `resolvePythonExecutable()` di `src/main.js` yang memprioritaskan Python di dalam `.venv` lokal (`backend/.venv/Scripts/python.exe` atau `.venv/bin/python`) sebelum jatuh ke `python`/`python3` sistem, sehingga pustaka `flyr`, `openpyxl`, dan `pandas` selalu ditemukan!
  - Pada `open-ppg-workbench` (`L650`): Pasang `child.stdout?.on('data', ...)` agar pipa stdout tidak pernah penuh dan menyebabkan deadlock 64 KB.
  - Pada `export-ppg-summary` (`L788–801`): Pasang listener `stdout` & `stderr`, tambahkan *timeout* 60 detik (`setTimeout` yang mematikan proses anak jika menggantung), dan periksa kode keluar (`code === 0`).
- [ ] **4.3 (`BUG-2.1` & `BUG-2.5` — Perbaikan Keamanan Path Traversal & `webSecurity`)**:
  - Pada `delete-result-folder` (`L759`): Pastikan pengecekan prefix menggunakan `path.sep` (`const resolvedBase = path.resolve(resultDir); if (fullPath !== resolvedBase && !fullPath.startsWith(resolvedBase + path.sep))`).
  - Pada `save-file` (`L734`): Tolak penulisan ke file sistem atau direktori di luar ruang kerja/output pengguna.

> **💬 Prompt Siap Pakai untuk Jendela Baru (Paket 4):**
> ```text
> Tolong kerjakan PAKET 4 dari file log/README.md untuk memperbaiki BUG-1.3, BUG-2.1, BUG-2.2, BUG-2.4, dan BUG-2.5 di src/main.js dan src/preload.js. Baca hanya baris yang disebutkan pada Paket 4 agar hemat token.
> ```

---

### 🟡 PAKET 5: Perbaikan Engine Mode Web (`thermalEngine.js`) & UI React (`App.jsx`)
**Target File**: [`src/src/thermalEngine.js`](../src/src/thermalEngine.js) & [`src/src/App.jsx`](../src/src/App.jsx)  
**Aturan Hemat Token untuk Agent**: *Baca hanya `src/src/thermalEngine.js` (`L535–555`, `L580–700`, `L740–810`, `L2590–2780`) dan `src/src/App.jsx` (`L750–770`, `L1570–1585`).*

#### Daftar Pekerjaan Paket 5:
- [ ] **5.1 (`BUG-1.6` — Perbaiki `temp_mean` di `thermalEngine.js` L548)**:
  - Ganti `temp_mean: +(sortedMag.reduce((a, b) => a + b, 0) / (W * H)).toFixed(2)` agar menghitung rata-rata dari `tempMatrix` (misal menggunakan `imgDataObj.temp_mean` yang sudah dihitung di `loadThermalImageData`), **bukan** merata-ratakan `sortedMag` (gradien Sobel)!
- [ ] **5.2 (`BUG-3.6` — Perbaiki Destructuring `COMPASS` di `thermalEngine.js` L691)**:
  - Pada `computeLabelStarGradient` (`L691`), ubah `COMPASS.forEach(([name]) => {` menjadi `COMPASS.forEach((name) => {` agar keempat arah diagonal (`NE`, `SE`, `SW`, `NW`) ikut dihitung dalam pencarian `gradient_min`.
- [ ] **5.3 (`BUG-3.7` — Tambahkan `ctx.putImageData(imgData, 0, 0)` di `thermalEngine.js` L781)**:
  - Pada `clientCropPolygonROI`, panggil `ctx.putImageData(imgData, 0, 0);` tepat setelah *loop* pengisian piksel (`L780`) dan sebelum menggambar garis bintang 8-arah (`L799`), sehingga gambar crop ROI di mode Web tidak lagi transparan/kosong.
- [ ] **5.4 (`BUG-3.5` — Perbaiki `ReferenceError: radiusGrid is not defined` di `thermalEngine.js` L2598 & L2768)**:
  - Di dalam `generatePlantarPaperFig1Package`, ganti `radiusGrid * cellW` menjadi `m.rFinal * cellW` pada kedua lokasi (`L2598` dan `L2768`).
- [ ] **5.5 (`BUG-3.8` & `BUG-1.3` di `src/src/App.jsx`)**:
  - Pada `L761`: Ubah `names.sort((a, b) => a.name.localeCompare(b.name, ...))` menjadi `names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))`.
  - Pada `L1575`: Teruskan `imgScale` (`pxPerCm`) ke panggilan `await api.cropLabels(imgPath, roi.points, roi.labelName, i + 1, isolatedDir, imgScale)`.

> **💬 Prompt Siap Pakai untuk Jendela Baru (Paket 5):**
> ```text
> Tolong kerjakan PAKET 5 dari file log/README.md untuk memperbaiki BUG-1.3, BUG-1.6, BUG-3.5, BUG-3.6, BUG-3.7, dan BUG-3.8 di src/src/thermalEngine.js dan src/src/App.jsx. Baca hanya rentang baris yang tercantum pada Paket 5 agar hemat token.
> ```

---

### ⚪ PAKET 6: Perbaikan Dependensi, PyInstaller Spec & Automated Regression Test
**Target File**: [`backend/requirements.txt`](../backend/requirements.txt), [`analyzer.spec`](../analyzer.spec), & file tes baru `backend/test_regression_v184.py`

#### Daftar Pekerjaan Paket 6:
- [ ] **6.1 (`BUG-4.3` — Konversi `backend/requirements.txt` ke UTF-8 & Lengkapi Paket)**:
  - Tulis ulang `backend/requirements.txt` dalam encoding `UTF-8` murni dan pastikan mencakup `numpy`, `opencv-python`, `matplotlib`, `scipy`, `flyr`, `pandas`, dan `openpyxl`.
- [ ] **6.2 (`BUG-2.4` — Integrasi Sub-Command `export_ppg_summary` ke `analyzer.py` / `analyzer.spec`)**:
  - Pastikan `analyzer.py` dapat memanggil fungsi ekspor ringkasan Excel/CSV secara langsung (`analyzer.exe export_ppg_summary <sessionJsonPath>`) sehingga di komputer pengguna akhir tanpa Python sistem, aplikasi `.exe`/`.dmg` tetap menghasilkan `PPP_PPG_PGA_Statistical_Summary.xlsx`.
- [ ] **6.3 (Pembuatan Suite Uji Otomatis `backend/test_regression_v184.py`)**:
  - Buat skrip pengujian otomatis yang memverifikasi semua invarian ilmiah dan fungsional pada Ceklist Utama di bawah.

> **💬 Prompt Siap Pakai untuk Jendela Baru (Paket 6):**
> ```text
> Tolong kerjakan PAKET 6 dari file log/README.md untuk memperbaiki BUG-2.4 dan BUG-4.3 pada backend/requirements.txt dan analyzer.spec, serta buatkan dan jalankan skrip pengujian otomatis backend/test_regression_v184.py.
> ```

---

## ✅ CEKLIST UTAMA PENGUJIAN & VALIDASI APLIKASI (Master QA & Scientific Validity Checklist)

Gunakan ceklist ini setelah seluruh paket dikerjakan untuk memvalidasi bahwa aplikasi benar-benar bebas cacat dan sahih secara ilmiah sebelum merilis `v1.8.4`:

### 🧪 Gate 1: Uji Validitas Suhu & Bebas Anomali `> 100°C` (`BUG-1.7`, `BUG-1.8`, `BUG-3.3`)
- [ ] **Test 1.1 (Radiometric FLIR Unpack Test)**: Muat citra `FLIR0426.jpg`, `FLIR0428.jpg`, dan `FLIR0201.jpg`. Pastikan nilai `PPP_Mean_Temp_C`, `PPP_Peak_Temp_C`, dan `PPP_Min_Temp_C` berada pada rentang fisiologis manusia (**$20.0^\circ\text{C} \le T \le 42.0^\circ\text{C}$**) dan **TIDAK PERNAH** menyentuh $> 50^\circ\text{C}$ apalagi $123^\circ\text{C}\text{–}187^\circ\text{C}$.
- [ ] **Test 1.2 (Grayscale Fallback Scaling Test)**: Simulasikan citra tanpa metadata FLIR (misal file `.png` 8-bit grayscale dengan nilai piksel `0–255`). Pastikan `load_temperature()` memetakan nilainya ke rentang suhu fisiologis dan tidak pernah mengembalikan angka mentah `0–255` sebagai derajat Celcius.
- [ ] **Test 1.3 (Hotspot Preservation Test — Anti Dark Hole)**: Buat citra uji dengan titik panas lokal (piksel nilai tertinggi di tengah telapak kaki). Pastikan `load_temperature()` **tidak** menghapus atau menambal titik panas tersebut menjadi kawah dingin (`clean_flir_accessories` tidak boleh merusak area tengah kaki).
- [ ] **Test 1.4 (Boundary ROI `T1` Mask Isolation Test)**: Tempatkan ROI `T1` di dekat tepi atas jempol kaki pada `FLIR0426` dan `FLIR0428`. Pastikan hanya piksel di dalam `mask_dense` yang dihitung, sehingga:
  - `PPP_Min_Temp_C` pada `T1` tidak anjlok ke suhu latar belakang.
  - `PPP_Std_Temp_C` pada `T1` berada di kisaran fisiologis wajar ($< 2.5^\circ\text{C}$, bukan $18.5\text{–}24.8$).
  - `PPG_Peak_Grad` mencerminkan gradien jaringan kaki ($< 3.0^\circ\text{C}/\text{sel}$), bukan tebing kontras kaki-ke-background ($10.8\text{–}16.1$).

### 📐 Gate 2: Uji Presisi Matematika, Desimal Float32, Kompas PGA & Kalibrasi (`BUG-1.1` s/d `BUG-1.6`)
- [ ] **Test 2.1 (Sub-Degree Float32 Precision Test)**: Buat matriks suhu sintetis `float32` dengan gradien halus sub-derajat (misal meningkat dari $33.10^\circ\text{C}$ ke $33.90^\circ\text{C}$ secara linier di dalam mask kaki). Jalankan `recompute_gradients_from_mask()`. Pastikan:
  - Nilai suhu di dalam kaki **tidak** terpotong menjadi angka bulat `33.0`.
  - Nilai `PPG_Mean_Grad` bernilai **$> 0.000$** dan sesuai dengan kemiringan analitis.
- [ ] **Test 2.2 (PGA Compass Orientation Test — North vs South)**:
  - Buat matriks sintetis di mana suhu meningkat ke **atas gambar** (baris `y` mengecil, menuju jari kaki / Distal). Pastikan sudut `PGA_Mean_Angle_Deg` adalah **$\approx 90.0^\circ$** dan `PGA_Direction_Compass` menghasilkan **`N (Distal / Toes)`**.
  - Buat matriks sintetis di mana suhu meningkat ke **bawah gambar** (baris `y` membesar, menuju tumit / Proximal). Pastikan sudut `PGA_Mean_Angle_Deg` adalah **$\approx 270.0^\circ$** dan `PGA_Direction_Compass` menghasilkan **`S (Proximal / Heel)`**.
- [ ] **Test 2.3 (Calibration Scale Propagation Test)**:
  - Di aplikasi Desktop, kalibrasi sebuah gambar dengan `pxPerCm = 20.0` (bukan 10.0) lalu klik **Save / Export**.
  - Buka `labels_summary.csv` dan pastikan nilai `gradient_max`, `gradient_min`, serta `grad_N_c_per_cm` berubah secara proporsional dengan skala `20.0 px/cm` (setengah dari nilai pada skala `10.0 px/cm`).
- [ ] **Test 2.4 (Web `temp_mean` Accuracy Test)**:
  - Muat gambar di mode Web (`thermalEngine.js`). Pastikan `temp_mean` yang tampil pada panel informasi bernilai di antara `temp_min` dan `temp_max` (misal ~$28^\circ\text{C}\text{–}34^\circ\text{C}$), bukan rata-rata gradien Sobel (~$0.3^\circ\text{C}$).

### 📊 Gate 3: Uji Audit Trail Excel & Konsistensi Output (`BUG-1.4`, `BUG-1.5`)
- [ ] **Test 3.1 (Excel Column D vs Column E Separation Test)**:
  - Buka `PPP_PPG_PGA_Statistical_Summary.xlsx` pada Sheet 1 (`Detailed_ROIs`), periksa kotak `📌 AUDIT PENGAMBILAN CELL & PANDUAN PERHITUNGAN`.
  - Pastikan **Kolom D (`Cara Menghitung`)** menampilkan **teks rumus** (misal `=AVERAGE(D2:D7)` sebagai teks), sedangkan **Kolom E (`Nilai Agregat`)** menampilkan **angka hasil perhitungan** yang diformat rapi 2 desimal (`0.00`), bukan angka pecahan 14 digit (`141.18666666666664`).
- [ ] **Test 3.2 (Circular Mean Angle Test in Excel)**:
  - Jika terdapat sudut ROI sebesar `355.0°` dan `5.0°`, pastikan rata-rata sudut `PGA (Mean Angle)` menghasilkan **`0.0°` ( atau `360.0°`)**, bukan `180.0°`.
- [ ] **Test 3.3 (Sheet 3 Formula Text Test)**:
  - Buka Sheet 3 (`Panduan_Metodologi`) dan pastikan baris Pilar 3 (`PGA`) mencantumkan rumus `θ = arctan2(-Gy, Gx) % 360°`.

### 🖥️ Gate 4: Uji Stabilitas Electron IPC, Headless CLI & Multiplatform (`BUG-2.2`, `BUG-2.3`, `BUG-3.1`, `BUG-3.2`, `BUG-3.4`)
- [ ] **Test 4.1 (Headless Missing-Image Non-Blocking Test)**:
  - Jalankan `python ppg_workbench.py --session path_json_rusak.json --export-metrics` dari terminal.
  - Pastikan proses **langsung berhenti dalam $< 3$ detik** dengan kode keluar `1` (`echo $LASTEXITCODE` bernilai `1`) dan **tidak** memunculkan jendela pop-up `messagebox.showerror` yang menggantung proses.
- [ ] **Test 4.2 (Anti-Recursive `_result_result` Folder Test)**:
  - Buka sesi `annotations_session.json` yang sudah berada di dalam folder `subjek_result`, lalu jalankan **Recompute All Metrics** atau **Save Session**.
  - Pastikan output tetap ditulis ke `subjek_result`, **bukan** membuat folder baru `subjek_result_result`.
- [ ] **Test 4.3 (PPG Workbench Long Session Pipe Test)**:
  - Buka PPG Workbench dari tombol Electron dan lakukan navigasi/recompute berulang kali. Pastikan jendela Workbench tidak mengalami *freeze* akibat pipa `stdout` penuh.

### 🌐 Gate 5: Uji Mode Web & Drag-and-Drop UI (`BUG-3.5`, `BUG-3.6`, `BUG-3.7`, `BUG-3.8`, `BUG-3.9`)
- [ ] **Test 5.1 (ZIP Drag-and-Drop Test)**:
  - Tarik dan lepaskan (*drag-and-drop*) sebuah file `.zip` berisi beberapa citra termal ke jendela aplikasi. Pastikan citra berhasil dimuat berurutan tanpa error `TypeError: Cannot read properties of undefined (reading 'localeCompare')`.
- [ ] **Test 5.2 (Web Mode ROI Crop Image Test)**:
  - Dalam mode Web (tanpa Electron backend), buat sebuah ROI dan jalankan ekspor. Buka gambar PNG hasil potongan ROI dan pastikan latar belakang termalnya tergambar penuh (tidak transparan/kosong) dengan garis bintang 8-arah di atasnya.
- [ ] **Test 5.3 (Web Mode Plantar Fig 1 Generation Test)**:
  - Jalankan `generatePlantarPaperFig1Package` di mode Web. Pastikan gambar Panel A & Panel B berhasil dibuat tanpa error `ReferenceError: radiusGrid is not defined`.
- [ ] **Test 5.4 (8-Compass Diagonal `gradient_min` Test)**:
  - Uji `computeLabelStarGradient` pada ROI yang memiliki gradien minimum pada arah diagonal (`NE`, `SE`, `SW`, atau `NW`). Pastikan nilai `gradient_min` berhasil mendeteksi arah diagonal tersebut.
