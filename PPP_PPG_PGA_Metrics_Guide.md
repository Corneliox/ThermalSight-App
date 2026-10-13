# 📘 Panduan Lengkap Metrik Termal: PPP, PPG, dan PGA
### *ThermalSight v1.8.0 & PPG/PGA Analysis Suite*

Dokumen ini menjelaskan secara komprehensif definisi, formulasi matematis, variabel output data, serta interpretasi klinis dari triad metrik termal: **PPP**, **PPG**, dan **PGA**.

---

## 📑 Daftar Isi
1. [Ringkasan Eksekutif (Triad Metrik Termal)](#1-ringkasan-eksekutif-triad-metrik-termal)
2. [Pilar 1: PPP (Plantar Peak Parameter / Suhu Absolut)](#2-pilar-1-ppp-plantar-peak-parameter--suhu-absolut)
3. [Pilar 2: PPG (Plantar Peak Gradient / Ketajaman Perbedaan Suhu)](#3-pilar-2-ppg-plantar-peak-gradient--ketajaman-perbedaan-suhu)
4. [Pilar 3: PGA (Plantar Gradient Angle / Sudut & Arah Aliran Panas)](#4-pilar-3-pga-plantar-gradient-angle--sudut--arah-aliran-panas)
5. [Tabel Perbandingan & Kamus Data Excel](#5-tabel-perbandingan--kamus-data-excel)
6. [Interpretasi Klinis untuk Skrining Kaki Diabetik](#6-interpretasi-klinis-untuk-skrining-kaki-diabetik)

---

## 1. Ringkasan Eksekutif (Triad Metrik Termal)

Analisis termografi telapak kaki (*diabetic foot plantar thermography*) membagi evaluasi panas ke dalam 3 dimensi pertanyaan mendasar:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      TRIAD EVALUASI TERMAL KAKI                        │
├──────────────────┬──────────────────────┬──────────────────────────────┤
│ Metrik           │ Menjawab Pertanyaan  │ Karakteristik Data           │
├──────────────────┼──────────────────────┼──────────────────────────────┤
│ 1. PPP           │ Seberapa panasnya?   │ Nilai Suhu Absolut (°C)      │
│                  │                      │ (Mencakup Peak/Max, Min,     │
│                  │                      │  Mean, dan Std)              │
├──────────────────┼──────────────────────┼──────────────────────────────┤
│ 2. PPG           │ Seberapa tajam       │ Laju Perubahan Suhu Spasial  │
│                  │ perbedaannya?        │ (°C/cm atau °C/piksel)       │
├──────────────────┼──────────────────────┼──────────────────────────────┤
│ 3. PGA           │ Ke mana arah         │ Vektor Orientasi Aliran      │
│                  │ rambatannya?         │ (Sudut Derajat & Arah Kompas)│
└──────────────────┴──────────────────────┴──────────────────────────────┘
```

---

## 2. Pilar 1: PPP (Plantar Peak Parameter / Suhu Absolut)

### A. Definisi
**PPP** mengukur intensitas suhu permukaan kulit (*Skin Temperature*) di dalam setiap wilayah minat anatomis (*Region of Interest / ROI*), seperti **T1** (Hallux/Jempol Kaki), **M1** (Caput Metatarsal 1), dan **M2** (Caput Metatarsal 2).

> **Catatan Penting:**  
> Nilai **Maksimum (Max)** dan **Minimum (Min)** suhu kulit **sepenuhnya berada di dalam kelompok PPP**.

### B. Variabel di dalam File Excel / CSV
| Variabel | Keterangan | Satuan |
| :--- | :--- | :---: |
| `PPP_Peak_Temp_C` | **Nilai Maksimum (Max)**: Suhu tertinggi atau titik terpanas absolut di area ROI. | $^\circ\text{C}$ |
| `PPP_Min_Temp_C` | **Nilai Minimum (Min)**: Suhu terendah atau titik terdingin di area ROI. | $^\circ\text{C}$ |
| `PPP_Mean_Temp_C` | **Rata-rata (Mean)**: Nilai rata-rata temperatur dari seluruh piksel di dalam ROI. | $^\circ\text{C}$ |
| `PPP_Std_Temp_C` | **Standar Deviasi (Std)**: Ukuran keragaman suhu (seberapa heterogen suhu di area tersebut). | $^\circ\text{C}$ |

### C. Formulasi Matematis
Jika suatu ROI $R$ memuat sejumlah $N$ piksel dengan suhu $T_i$:
$$T_{\text{peak}} = \max_{i \in R} (T_i), \quad T_{\text{min}} = \min_{i \in R} (T_i)$$
$$T_{\text{mean}} = \frac{1}{N} \sum_{i=1}^{N} T_i, \quad T_{\text{std}} = \sqrt{\frac{1}{N} \sum_{i=1}^{N} (T_i - T_{\text{mean}})^2}$$

---

## 3. Pilar 2: PPG (Plantar Peak Gradient / Ketajaman Perbedaan Suhu)

### A. Definisi
**PPG** mengukur **laju perubahan suhu secara spasial** antar piksel yang bersebelahan. PPG tidak melihat seberapa tinggi suhu absolutnya, melainkan seberapa curam lonjakan suhunya (*spatial temperature gradient*).

### B. Variabel di dalam File Excel / CSV
| Variabel | Keterangan | Satuan |
| :--- | :--- | :---: |
| `PPG_Peak_Grad` | Gradien tertinggi/paling curam di dalam ROI (batas kontras panas tertajam). | $^\circ\text{C}/\text{cm}$ |
| `PPG_Mean_Grad` | Rata-rata kemiringan gradien termal di dalam area ROI. | $^\circ\text{C}/\text{cm}$ |
| `PPG_Std_Grad` | Variasi ketajaman gradien di dalam ROI. | $^\circ\text{C}/\text{cm}$ |

### C. Formulasi Matematis
Dihitung menggunakan operator diferensial Sobel dua dimensi pada sumbu horizontal ($G_x$) dan vertikal ($G_y$):
$$G_x = \frac{\partial T}{\partial x}, \quad G_y = \frac{\partial T}{\partial y}$$
$$\text{PPG} = \|\vec{\nabla} T\| = \sqrt{G_x^2 + G_y^2}$$

---

## 4. Pilar 3: PGA (Plantar Gradient Angle / Sudut & Arah Aliran Panas)

### A. Definisi
**PGA** menentukan **arah vektor** ke mana energi panas merambat atau mengalir keluar dari titik fokus panas.

### B. Variabel di dalam File Excel / CSV
| Variabel | Keterangan | Satuan / Nilai |
| :--- | :--- | :---: |
| `PGA_Mean_Angle_Deg` | Rata-rata sudut arah vektor gradien termal. | $0^\circ - 360^\circ$ |
| `PGA_Direction_Compass` | Penerjemahan sudut ke arah anatomis kaki manusia. | Teks (Kompas) |
| `PGA_Coherence_Pct` | Persentase keselarasan arah vektor gradien ($0\% - 100\%$). | $\%$ |

### C. Peta Arah Kompas Anatomis
Sistem secara otomatis menyesuaikan pembacaan untuk Kaki Kanan (*Right Foot*) dan Kaki Kiri (*Left Foot*):

* **N (Distal / Toes):** Panas merambat ke arah atas (jari-jari kaki).
* **S (Proximal / Heel):** Panas merambat ke arah bawah (tumit/arch).
* **W (Medial):** Panas merambat ke sisi dalam telapak kaki.
* **E (Lateral):** Panas merambat ke sisi luar telapak kaki.
* **Interkardinal (NE, NW, SE, SW):** Sudut serong diagonal.

### D. Arti Nilai Coherence (`PGA_Coherence_Pct`)
* **Tinggi (> 75%):** Vektor aliran panas sangat terarah dan seragam menuju satu lintasan anatomis tertentu (misal: kebocoran perfusi vaskular ke arah medial).
* **Rendah (< 50%):** Aliran panas menyebar acak melingkar (*isotropic dispersion*), umum pada jaringan sehat tanpa fokus radang akut.

---

## 5. Tabel Perbandingan & Kamus Data Excel

Hasil ekspor pada file **`PPP_PPG_PGA_Statistical_Summary.xlsx`** memiliki struktur sebagai berikut:

```csv
Image_Name,Foot_Side,ROI,PPP_Mean_Temp_C,PPP_Peak_Temp_C,PPP_Min_Temp_C,PPP_Std_Temp_C,PPG_Mean_Grad,PPG_Peak_Grad,PPG_Std_Grad,PGA_Mean_Angle_Deg,PGA_Direction_Compass,PGA_Coherence_Pct
FLIR0201,Right,T1,33.74,34.74,31.21,0.89,0.337,0.847,0.274,175.6,W (Medial),85.9
FLIR0201,Right,M1,34.74,35.00,33.59,0.41,0.181,0.953,0.256,187.6,W (Medial),51.5
FLIR0201,Right,M2,34.69,35.00,34.00,0.34,0.107,0.221,0.075,343.7,E (Lateral),84.1
```

---

## 6. Interpretasi Klinis untuk Skrining Kaki Diabetik

Dalam aplikasi klinis pencegahan luka/ulkus diabetik (*diabetic foot ulcer prevention*):

1. **Evaluasi Suhu Absolut (PPP):**
   * **Bilateral Asymmetry:** Selisih suhu antara kaki kiri dan kaki kanan pada titik yang sama ($\Delta T = |T_{\text{kanan}} - T_{\text{kiri}}|$).
   * **Ambang Batas Kritis:** Bila $\Delta T > 2.2^\circ\text{C}$, zona tersebut dikategorikan sebagai **Hotspot Berisiko Tinggi** yang menandakan inflamasi bawah kulit (*subclinical ulceration*).

2. **Evaluasi Gradien (PPG):**
   * Suhu tinggi yang merata pada seluruh telapak kaki biasanya akibat suhu ruangan atau sehabis berjalan.
   * Sebaliknya, **suhu tinggi dengan PPG yang sangat curam** (kontras tinggi lokal) menandakan fokus inflamasi aktif (misalnya abses dalam, osteomielitis, atau lesi neuropatik).

3. **Evaluasi Arah (PGA):**
   * Memberikan informasi arah disipasi panas untuk memandu dokter atau perawat dalam memeriksa apakah ada infeksi yang sedang menjalar ke kompartemen jaringan lain.
