import os
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np

output_dir = r"C:\Users\Pongo\.gemini\antigravity\brain\06bf9c7b-247d-44d0-a660-4c440fd1ce9d\step4_visuals"
os.makedirs(output_dir, exist_ok=True)

# 1. Exact 9x9 Grid Detail
fig, ax = plt.subplots(figsize=(6, 6), dpi=200)
fig.patch.set_facecolor('white')
ax.set_facecolor('#F8FAFC')

# Draw 9x9 grid
n = 9
for i in range(n + 1):
    ax.axhline(i, color='#CBD5E1', lw=1.2, ls='--')
    ax.axvline(i, color='#CBD5E1', lw=1.2, ls='--')

# Draw circular ROI (radius = 4.5, center = 4.5, 4.5)
circle = patches.Circle((4.5, 4.5), 4.5, edgecolor='#0284C7', facecolor='#0284C7', alpha=0.15, lw=2.5)
ax.add_patch(circle)
circle_edge = patches.Circle((4.5, 4.5), 4.5, edgecolor='#0369A1', facecolor='none', lw=2.5)
ax.add_patch(circle_edge)

# Mark center
ax.plot(4.5, 4.5, marker='+', color='#DC2626', markersize=12, markeredgewidth=2.5)
ax.text(4.7, 4.7, "Center (cx, cy)", fontsize=10, fontweight='bold', color='#DC2626')

# Diameter dimension arrow
ax.annotate('', xy=(0, 4.5), xytext=(9, 4.5), arrowprops=dict(arrowstyle='<->', color='#0F172A', lw=1.8))
ax.text(4.5, 3.8, "Diameter = 9 Cells (81 Subcells)", fontsize=10, fontweight='bold', ha='center', color='#0F172A',
        bbox=dict(boxstyle='round,pad=0.3', facecolor='white', edgecolor='#94A3B8'))

ax.set_xlim(-0.5, 9.5)
ax.set_ylim(-0.5, 9.5)
ax.set_xticks(range(10))
ax.set_yticks(range(10))
ax.set_title("Standardized 9x9 Grid ROI Cell Geometry", fontsize=11, fontweight='bold', color='#0F172A', pad=12)
plt.tight_layout()
out_path1 = os.path.join(output_dir, "step4_grid9x9_detail.png")
plt.savefig(out_path1, bbox_inches='tight', dpi=200)
plt.close()
print(f"Saved: {out_path1}")

# 2. Dynamic Distance Sync (1.2 cm)
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(9, 4.5), dpi=200)
fig.patch.set_facecolor('white')

# Case 1: Close Distance
ax1.set_facecolor('#F8FAFC')
c1 = patches.Circle((0.5, 0.5), 0.38, edgecolor='#0369A1', facecolor='#E0F2FE', lw=2)
ax1.add_patch(c1)
ax1.annotate('', xy=(0.12, 0.5), xytext=(0.88, 0.5), arrowprops=dict(arrowstyle='<->', color='#0F172A', lw=1.8))
ax1.text(0.5, 0.55, "120 pixels", ha='center', fontsize=10, fontweight='bold', color='#0F172A')
ax1.text(0.5, 0.42, "= 1.2 cm Real Scale", ha='center', fontsize=9.5, fontweight='bold', color='#0369A1')
ax1.set_title("Close Camera Distance\n(High Pixel Density)", fontsize=10, fontweight='bold', color='#0F172A')
ax1.set_xlim(0, 1)
ax1.set_ylim(0, 1)
ax1.axis('off')

# Case 2: Far Distance
ax2.set_facecolor('#F8FAFC')
c2 = patches.Circle((0.5, 0.5), 0.22, edgecolor='#0369A1', facecolor='#E0F2FE', lw=2)
ax2.add_patch(c2)
ax2.annotate('', xy=(0.28, 0.5), xytext=(0.72, 0.5), arrowprops=dict(arrowstyle='<->', color='#0F172A', lw=1.8))
ax2.text(0.5, 0.55, "70 pixels", ha='center', fontsize=10, fontweight='bold', color='#0F172A')
ax2.text(0.5, 0.42, "= 1.2 cm Real Scale", ha='center', fontsize=9.5, fontweight='bold', color='#0369A1')
ax2.set_title("Far Camera Distance\n(Lower Pixel Density)", fontsize=10, fontweight='bold', color='#0F172A')
ax2.set_xlim(0, 1)
ax2.set_ylim(0, 1)
ax2.axis('off')

plt.suptitle("Dynamic Distance Adaptation: Physical Size Stays Constant (1.2 cm)", fontsize=11, fontweight='bold', color='#0F172A')
plt.tight_layout()
out_path2 = os.path.join(output_dir, "step4_dynamic_distance_sync.png")
plt.savefig(out_path2, bbox_inches='tight', dpi=200)
plt.close()
print(f"Saved: {out_path2}")

# 3. Legacy Auto-Upgrade (6x6 to 9x9)
fig, ax = plt.subplots(figsize=(7, 4.5), dpi=200)
fig.patch.set_facecolor('white')
ax.set_facecolor('#F8FAFC')

# Center point
cx, cy = 0.5, 0.5

# Legacy 6x6 circle
c_old = patches.Circle((cx, cy), 0.22, edgecolor='#9333EA', facecolor='#F3E8FF', lw=2, ls='--', label='Legacy v1.6 (6x6 Cells)')
ax.add_patch(c_old)

# Upgraded 9x9 circle
c_new = patches.Circle((cx, cy), 0.35, edgecolor='#0284C7', facecolor='none', lw=2.5, label='v1.8.0 Standard (9x9 Cells, 1.2 cm)')
ax.add_patch(c_new)

# Center marker
ax.plot(cx, cy, marker='+', color='#DC2626', markersize=14, markeredgewidth=2.5)
ax.text(cx + 0.03, cy - 0.05, "Center Locked", fontsize=9.5, fontweight='bold', color='#DC2626')

# Arrow showing expansion
ax.annotate('Automatic Radius Expansion\n(+50% to match 1.2 cm)', 
            xy=(cx + 0.22, cy + 0.15), xytext=(cx + 0.38, cy + 0.32),
            arrowprops=dict(facecolor='#0284C7', edgecolor='#0369A1', shrink=0.05, width=1.5, headwidth=7),
            fontsize=9.5, fontweight='bold', color='#0369A1')

ax.legend(loc='lower left', fontsize=9, framealpha=0.95)
ax.set_xlim(0, 1)
ax.set_ylim(0, 1)
ax.axis('off')
ax.set_title("Backward Compatibility: Automatic Legacy JSON Translation", fontsize=11, fontweight='bold', color='#0F172A', pad=12)

plt.tight_layout()
out_path3 = os.path.join(output_dir, "step4_legacy_upgrade_comparison.png")
plt.savefig(out_path3, bbox_inches='tight', dpi=200)
plt.close()
print(f"Saved: {out_path3}")
