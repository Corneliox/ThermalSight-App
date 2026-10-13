import os
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
from PIL import Image

output_dir = r"C:\Users\Pongo\.gemini\antigravity\brain\06bf9c7b-247d-44d0-a660-4c440fd1ce9d\step5_visuals"
os.makedirs(output_dir, exist_ok=True)

# 1. Figure 1 Deliverable Preview
fig1_src = r"C:\Users\Pongo\.gemini\antigravity\brain\06bf9c7b-247d-44d0-a660-4c440fd1ce9d\plantar_fig1_preview_balanced_step3.png"
if os.path.exists(fig1_src):
    img_fig1 = Image.open(fig1_src)
    img_fig1.thumbnail((1200, 900), Image.Resampling.LANCZOS)
    out_fig1_path = os.path.join(output_dir, "step5_fig1_publication_figure.png")
    img_fig1.save(out_fig1_path)
    print(f"Saved: {out_fig1_path}")

# 2. 8-Directional Compass Heatmap Preview
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 4.8), dpi=200, gridspec_kw={'width_ratios': [1.1, 1.2]})
fig.patch.set_facecolor('white')

m1_src = r"C:\Users\Pongo\.gemini\antigravity\brain\06bf9c7b-247d-44d0-a660-4c440fd1ce9d\m1_verified_9_arrows.png"
if os.path.exists(m1_src):
    m1_img = Image.open(m1_src)
    ax1.imshow(m1_img)
    ax1.set_title("Localized ROI Vector Grid (9x9)", fontsize=11, fontweight='bold', color='#0F172A', pad=8)
ax1.axis('off')

theta = np.linspace(0, 2*np.pi, 8, endpoint=False)
radii = [2.8, 3.4, 4.1, 3.2, 2.5, 1.9, 2.2, 2.7]
labels = ['E (0°)', 'NE (45°)', 'N (90°)', 'NW (135°)', 'W (180°)', 'SW (225°)', 'S (270°)', 'SE (315°)']

ax2 = plt.subplot(1, 2, 2, polar=True)
ax2.set_facecolor('#F8FAFC')
bars = ax2.bar(theta, radii, width=0.6, bottom=0.0, color='#0284C7', alpha=0.85, edgecolor='#0369A1', linewidth=1.5)
ax2.set_xticks(theta)
ax2.set_xticklabels(labels, fontsize=9, fontweight='bold', color='#1E293B')
ax2.set_title("8-Directional Heat Propagation Compass", fontsize=11, fontweight='bold', color='#0F172A', pad=14)
ax2.grid(True, color='#CBD5E1', linestyle='--', linewidth=0.8)

plt.tight_layout()
out_compass_path = os.path.join(output_dir, "step5_directional_compass_heatmap.png")
plt.savefig(out_compass_path, bbox_inches='tight', facecolor='white', dpi=200)
plt.close()
print(f"Saved: {out_compass_path}")

# 3. Tabular Metrics (CSV / Excel) Preview
fig, ax = plt.subplots(figsize=(10, 4.8), dpi=200)
fig.patch.set_facecolor('white')
ax.axis('off')

table_data = [
    ["Landmark", "Left T_mean", "Right T_mean", "Delta-T (|L-R|)", "Std Dev", "Ulcer Risk Status"],
    ["Hallux (T1)", "32.4 °C", "32.1 °C", "0.3 °C", "±0.41", "Normal (<1.0°C)"],
    ["Metatarsal 1 (M1)", "33.8 °C", "31.2 °C", "2.6 °C", "±0.58", "ALERT HOTSPOT (>2.2°C)"],
    ["Metatarsal 3 (M3)", "32.9 °C", "32.3 °C", "0.6 °C", "±0.35", "Normal (<1.0°C)"],
    ["Metatarsal 5 (M5)", "31.7 °C", "31.0 °C", "0.7 °C", "±0.29", "Normal (<1.0°C)"],
    ["Midfoot (MF)", "30.5 °C", "30.2 °C", "0.3 °C", "±0.22", "Normal (<1.0°C)"],
    ["Heel (HL)", "31.1 °C", "31.4 °C", "0.3 °C", "±0.30", "Normal (<1.0°C)"]
]

table = ax.table(
    cellText=table_data,
    cellLoc='center',
    loc='center',
    colWidths=[0.22, 0.14, 0.14, 0.16, 0.12, 0.22]
)
table.auto_set_font_size(False)
table.set_fontsize(10)
table.scale(1.0, 2.0)

for (r, c), cell in table.get_celld().items():
    cell.set_edgecolor('#CBD5E1')
    cell.set_linewidth(1.0)
    if r == 0:
        cell.set_facecolor('#0F172A')
        cell.get_text().set_color('white')
        cell.get_text().set_fontweight('bold')
    elif r == 2:
        cell.set_facecolor('#FEE2E2')
        cell.get_text().set_color('#991B1B')
        cell.get_text().set_fontweight('bold')
    else:
        cell.set_facecolor('#F8FAFC' if r % 2 == 1 else 'white')
        cell.get_text().set_color('#334155')

plt.title("Automated Clinical Metrics Spreadsheet (Exported .CSV / .XLSX)", fontsize=13, fontweight='bold', color='#0F172A', pad=15)
out_table_path = os.path.join(output_dir, "step5_tabular_metrics_table.png")
plt.savefig(out_table_path, bbox_inches='tight', facecolor='white', dpi=200)
plt.close()
print(f"Saved: {out_table_path}")

# 4. 1-Click ZIP Archive Structure Preview
fig, ax = plt.subplots(figsize=(10, 4.8), dpi=200)
fig.patch.set_facecolor('white')
ax.axis('off')

rect = patches.FancyBboxPatch((0.05, 0.05), 0.9, 0.85, boxstyle="round,pad=0.03", 
                             facecolor='#F8FAFC', edgecolor='#0369A1', linewidth=2, linestyle='--')
ax.add_patch(rect)

ax.text(0.08, 0.83, "PACKAGE: ThermalSight_Session_Export_2026.zip", fontsize=12, fontweight='bold', color='#0F172A')

folders = [
    ("Folder: /figures", "High-res publication graphics:\n• Fig1_plantar_monochrome_ironbow.png\n• Fig2_compass_radial_heatmaps.png\n• panel_comparisons_300dpi.pdf", 0.08, 0.44, 0.40, 0.32, '#EFF6FF', '#93C5FD'),
    ("Folder: /metrics", "Spreadsheets & statistical tables:\n• plantar_temperature_metrics.csv\n• bilateral_asymmetry_delta_T.xlsx\n• calibration_audit_log.txt", 0.52, 0.44, 0.40, 0.32, '#F0FDF4', '#86EFAC'),
    ("Folder: /raw_data", "Reproducibility arrays & session data:\n• calibrated_temperature_matrix.npy\n• session_annotations_v180.json\n• thermal_camera_metadata.xml", 0.08, 0.10, 0.84, 0.28, '#FFFBEB', '#FDE68A')
]

for title, desc, x, y, w, h, bg, border in folders:
    sub_rect = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02", facecolor=bg, edgecolor=border, linewidth=1.2)
    ax.add_patch(sub_rect)
    ax.text(x + 0.02, y + h - 0.08, title, fontsize=11, fontweight='bold', color='#0F172A')
    ax.text(x + 0.02, y + 0.03, desc, fontsize=9, color='#334155', linespacing=1.4)

plt.title("1-Click Portable Archive Package (Structured ZIP & JSON)", fontsize=13, fontweight='bold', color='#0F172A', pad=15)
out_zip_path = os.path.join(output_dir, "step5_zip_archive_package.png")
plt.savefig(out_zip_path, bbox_inches='tight', facecolor='white', dpi=200)
plt.close()
print(f"Saved: {out_zip_path}")
