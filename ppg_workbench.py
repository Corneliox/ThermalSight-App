"""
ThermalSight PPG & PGA Interactive Workbench (v1.8.0)
Standalone companion tool for interactive foot segmentation (Manual Brush Add/Remove)
and live PPG & PGA parameter tuning.
"""

import os
import sys
import json
from pathlib import Path
import numpy as np
import cv2
import matplotlib
matplotlib.use("TkAgg")
import matplotlib.pyplot as plt
from matplotlib.patches import Circle
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg, NavigationToolbar2Tk

import tkinter as tk
from tkinter import ttk, filedialog, messagebox

# Import backend modules
CURRENT_DIR = Path(__file__).resolve().parent
sys.path.append(str(CURRENT_DIR / "backend"))
try:
    from analyzer import load_temperature
except ImportError:
    import flyr
    def load_temperature(p):
        return flyr.unpack(p).celsius.astype(np.float32)

class PPGWorkbenchApp:
    def __init__(self, root):
        self.root = root
        self.root.title("ThermalSight — PPG & PGA Interactive Research Workbench v1.8.0")
        self.root.geometry("1500x940")
        self.root.minsize(1200, 750)
        self.root.configure(bg="#F1F5F9")

        # Application state
        self.image_path = None
        self.json_path = None
        self.temp_raw = None
        self.rois_data = []
        
        # Computed state (cached)
        self.foot_crop = None
        self.mask_crop = None
        self.mask_crop_u8 = None
        self.mask_history = []
        self.is_mouse_down = False
        
        self.grid_dense = None
        self.mask_dense = None
        self.grid_smooth = None
        self.sobel_x = None
        self.sobel_y = None
        self.grad_mag = None
        self.grid_contour = None
        self.n_rows = 104
        self.n_cols = 54
        self.offset_x = 0
        self.ymin = 0
        self.xmin = 0
        self.cw = 1
        self.ch = 1
        self.foot_side = "RightFoot"

        self.setup_ui()
        self.load_default_sample()

    def setup_ui(self):
        # Top toolbar
        top_bar = tk.Frame(self.root, bg="#0F172A", height=60)
        top_bar.pack(side=tk.TOP, fill=tk.X)

        title_lbl = tk.Label(top_bar, text="ThermalSight PPG & PGA Workbench", font=("Arial", 16, "bold"), fg="#FFFFFF", bg="#0F172A")
        title_lbl.pack(side=tk.LEFT, padx=20, pady=12)

        sub_lbl = tk.Label(top_bar, text="Interactive Segmentation & Hairline Topography Lab", font=("Arial", 11), fg="#94A3B8", bg="#0F172A")
        sub_lbl.pack(side=tk.LEFT, padx=5, pady=14)

        btn_open_img = tk.Button(top_bar, text="📂 Load Thermal Image", font=("Arial", 10, "bold"), bg="#0284C7", fg="white",
                                 activebackground="#0369A1", relief="flat", padx=12, pady=5, command=self.browse_image)
        btn_open_img.pack(side=tk.RIGHT, padx=12, pady=12)

        btn_open_json = tk.Button(top_bar, text="📋 Load Session JSON", font=("Arial", 10), bg="#334155", fg="white",
                                  activebackground="#475569", relief="flat", padx=12, pady=5, command=self.browse_json)
        btn_open_json.pack(side=tk.RIGHT, padx=6, pady=12)

        # Main layout: Left sidebar controls, Right matplotlib canvas
        main_container = tk.Frame(self.root, bg="#F1F5F9")
        main_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # Left control panel (scrollable)
        sidebar_frame = tk.Frame(main_container, bg="#FFFFFF", width=390, highlightbackground="#CBD5E1", highlightthickness=1)
        sidebar_frame.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 10))
        sidebar_frame.pack_propagate(False)

        canvas_sidebar = tk.Canvas(sidebar_frame, bg="#FFFFFF", highlightthickness=0)
        scrollbar = ttk.Scrollbar(sidebar_frame, orient="vertical", command=canvas_sidebar.yview)
        self.scroll_content = tk.Frame(canvas_sidebar, bg="#FFFFFF")

        self.scroll_content.bind("<Configure>", lambda e: canvas_sidebar.configure(scrollregion=canvas_sidebar.bbox("all")))
        canvas_sidebar.create_window((0, 0), window=self.scroll_content, anchor="nw", width=370)
        canvas_sidebar.configure(yscrollcommand=scrollbar.set)

        canvas_sidebar.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self.build_sidebar_controls()

        # Right display panel
        display_frame = tk.Frame(main_container, bg="#FFFFFF", highlightbackground="#CBD5E1", highlightthickness=1)
        display_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)

        self.fig, (self.ax1, self.ax2) = plt.subplots(1, 2, figsize=(11, 8.5), dpi=100, facecolor="white")
        self.fig.subplots_adjust(left=0.04, right=0.96, top=0.92, bottom=0.06, wspace=0.12)

        self.canvas = FigureCanvasTkAgg(self.fig, master=display_frame)
        self.canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

        # Connect mouse events for manual mask brush editing
        self.canvas.mpl_connect("button_press_event", self.on_canvas_press)
        self.canvas.mpl_connect("motion_notify_event", self.on_canvas_motion)
        self.canvas.mpl_connect("button_release_event", self.on_canvas_release)

        # Matplotlib toolbar
        toolbar_frame = tk.Frame(display_frame, bg="#FFFFFF")
        toolbar_frame.pack(side=tk.BOTTOM, fill=tk.X)
        self.toolbar = NavigationToolbar2Tk(self.canvas, toolbar_frame)
        self.toolbar.update()

    def build_sidebar_controls(self):
        p = self.scroll_content

        def section_header(text):
            lbl = tk.Label(p, text=text, font=("Arial", 11, "bold"), fg="#0F172A", bg="#FFFFFF")
            lbl.pack(anchor="w", padx=12, pady=(14, 4))
            sep = ttk.Separator(p, orient="horizontal")
            sep.pack(fill=tk.X, padx=12, pady=(0, 8))

        # 1. FILE & STATUS
        section_header("1. Active Session")
        self.lbl_file = tk.Label(p, text="No file loaded", font=("Arial", 9), fg="#64748B", bg="#FFFFFF", wraplength=350, justify="left")
        self.lbl_file.pack(anchor="w", padx=14, pady=2)

        # 2. FOOT SEGMENTATION & BRUSH
        section_header("2. Foot Isolation & Mask Editor")
        
        lbl_bg = tk.Label(p, text="Auto Background Cutoff (°C):", font=("Arial", 9, "bold"), fg="#334155", bg="#FFFFFF")
        lbl_bg.pack(anchor="w", padx=14)
        self.scale_bg_thresh = tk.Scale(p, from_=22.0, to_=31.0, resolution=0.1, orient=tk.HORIZONTAL, bg="#FFFFFF",
                                        highlightthickness=0, command=lambda v: self.on_segmentation_change())
        self.scale_bg_thresh.set(26.5)
        self.scale_bg_thresh.pack(fill=tk.X, padx=14, pady=(0, 6))

        lbl_morph = tk.Label(p, text="Auto Morphology Clean:", font=("Arial", 9), fg="#334155", bg="#FFFFFF")
        lbl_morph.pack(anchor="w", padx=14)
        self.scale_morph = tk.Scale(p, from_=3, to_=15, resolution=2, orient=tk.HORIZONTAL, bg="#FFFFFF",
                                    highlightthickness=0, command=lambda v: self.on_segmentation_change())
        self.scale_morph.set(7)
        self.scale_morph.pack(fill=tk.X, padx=14, pady=(0, 6))

        self.var_show_mask = tk.BooleanVar(value=True)
        chk_mask = tk.Checkbutton(p, text="Show Foot Mask Overlay (Green)", variable=self.var_show_mask, font=("Arial", 9, "bold"),
                                  fg="#0284C7", bg="#FFFFFF", activebackground="#FFFFFF", command=self.update_plot)
        chk_mask.pack(anchor="w", padx=14, pady=(0, 8))

        # Manual Mask Brush Editor Controls
        box_brush = tk.LabelFrame(p, text=" Interactive Mask Brush ", font=("Arial", 9, "bold"), fg="#0F172A", bg="#F8FAFC", padx=8, pady=8)
        box_brush.pack(fill=tk.X, padx=12, pady=(0, 10))

        self.brush_mode = tk.StringVar(value="pan")
        r_pan = tk.Radiobutton(box_brush, text="🔍 Inspect / Pan-Zoom", variable=self.brush_mode, value="pan",
                               font=("Arial", 9), bg="#F8FAFC", activebackground="#F8FAFC", command=self.on_brush_mode_change)
        r_pan.pack(anchor="w")

        r_add = tk.Radiobutton(box_brush, text="🖌️ Paint Mask (Add Foot Area)", variable=self.brush_mode, value="paint",
                               font=("Arial", 9, "bold"), fg="#16A34A", bg="#F8FAFC", activebackground="#F8FAFC", command=self.on_brush_mode_change)
        r_add.pack(anchor="w")

        r_erase = tk.Radiobutton(box_brush, text="🧹 Erase Mask (Remove Blanket/Noise)", variable=self.brush_mode, value="erase",
                                 font=("Arial", 9, "bold"), fg="#DC2626", bg="#F8FAFC", activebackground="#F8FAFC", command=self.on_brush_mode_change)
        r_erase.pack(anchor="w")

        lbl_bsize = tk.Label(box_brush, text="Brush Radius (Cells):", font=("Arial", 8), fg="#475569", bg="#F8FAFC")
        lbl_bsize.pack(anchor="w", pady=(4, 0))
        self.scale_brush_size = tk.Scale(box_brush, from_=1.0, to_=12.0, resolution=0.5, orient=tk.HORIZONTAL, bg="#F8FAFC", highlightthickness=0)
        self.scale_brush_size.set(3.5)
        self.scale_brush_size.pack(fill=tk.X, pady=(0, 6))

        frame_brush_btns = tk.Frame(box_brush, bg="#F8FAFC")
        frame_brush_btns.pack(fill=tk.X)

        btn_undo = tk.Button(frame_brush_btns, text="↩️ Undo", font=("Arial", 8, "bold"), bg="#E2E8F0", fg="#1E293B",
                             relief="flat", padx=6, pady=3, command=self.undo_mask_stroke)
        btn_undo.pack(side=tk.LEFT, padx=(0, 4))

        btn_reset_mask = tk.Button(frame_brush_btns, text="🔄 Reset Auto", font=("Arial", 8), bg="#E2E8F0", fg="#1E293B",
                                   relief="flat", padx=6, pady=3, command=self.on_segmentation_change)
        btn_reset_mask.pack(side=tk.LEFT, padx=4)

        btn_clear_mask = tk.Button(frame_brush_btns, text="🗑️ Clear All", font=("Arial", 8), bg="#FEE2E2", fg="#991B1B",
                                   relief="flat", padx=6, pady=3, command=self.clear_all_mask)
        btn_clear_mask.pack(side=tk.RIGHT)

        # 3. TOPOGRAPHY & CONTOURS
        section_header("3. Contour Line Topography")

        lbl_lw = tk.Label(p, text="Contour Linewidth (pt):", font=("Arial", 9, "bold"), fg="#334155", bg="#FFFFFF")
        lbl_lw.pack(anchor="w", padx=14)
        self.scale_lw = tk.Scale(p, from_=0.10, to_=1.20, resolution=0.05, orient=tk.HORIZONTAL, bg="#FFFFFF",
                                 highlightthickness=0, command=lambda v: self.update_plot())
        self.scale_lw.set(0.20)  # Default: user requested 0.2 pt!
        self.scale_lw.pack(fill=tk.X, padx=14, pady=(0, 6))

        lbl_levels = tk.Label(p, text="Contour Levels (Density):", font=("Arial", 9), fg="#334155", bg="#FFFFFF")
        lbl_levels.pack(anchor="w", padx=14)
        self.scale_levels = tk.Scale(p, from_=10, to_=30, resolution=1, orient=tk.HORIZONTAL, bg="#FFFFFF",
                                     highlightthickness=0, command=lambda v: self.update_plot())
        self.scale_levels.set(18)
        self.scale_levels.pack(fill=tk.X, padx=14, pady=(0, 6))

        lbl_cmap = tk.Label(p, text="Contour Colormap:", font=("Arial", 9), fg="#334155", bg="#FFFFFF")
        lbl_cmap.pack(anchor="w", padx=14)
        self.combo_cmap = ttk.Combobox(p, values=["turbo", "jet", "rainbow", "inferno", "magma", "viridis", "coolwarm"], state="readonly")
        self.combo_cmap.set("turbo")
        self.combo_cmap.bind("<<ComboboxSelected>>", lambda e: self.update_plot())
        self.combo_cmap.pack(fill=tk.X, padx=14, pady=(0, 8))

        # 4. QUIVER VECTOR FLOW (PPG & PGA)
        section_header("4. Quiver Vector Field (1:1 Grid)")

        self.var_step = tk.IntVar(value=1)
        lbl_step = tk.Label(p, text="Grid Sampling Density:", font=("Arial", 9, "bold"), fg="#334155", bg="#FFFFFF")
        lbl_step.pack(anchor="w", padx=14)
        r_step1 = tk.Radiobutton(p, text="Step = 1 (1:1 Full Grid, ~2,300 Nodes)", variable=self.var_step, value=1,
                                 font=("Arial", 9), bg="#FFFFFF", activebackground="#FFFFFF", command=self.update_plot)
        r_step1.pack(anchor="w", padx=20)
        r_step2 = tk.Radiobutton(p, text="Step = 2 (Subsampled, ~600 Nodes)", variable=self.var_step, value=2,
                                 font=("Arial", 9), bg="#FFFFFF", activebackground="#FFFFFF", command=self.update_plot)
        r_step2.pack(anchor="w", padx=20, pady=(0, 6))

        lbl_ascale = tk.Label(p, text="Arrow Length Scale:", font=("Arial", 9), fg="#334155", bg="#FFFFFF")
        lbl_ascale.pack(anchor="w", padx=14)
        self.scale_arrow_len = tk.Scale(p, from_=0.3, to_=1.8, resolution=0.05, orient=tk.HORIZONTAL, bg="#FFFFFF",
                                        highlightthickness=0, command=lambda v: self.update_plot())
        self.scale_arrow_len.set(0.72)
        self.scale_arrow_len.pack(fill=tk.X, padx=14, pady=(0, 6))

        self.var_show_dots = tk.BooleanVar(value=True)
        chk_dots = tk.Checkbutton(p, text="Show Anchor Dots in Flat Zones (100% Nodes)", variable=self.var_show_dots,
                                  font=("Arial", 9), bg="#FFFFFF", activebackground="#FFFFFF", command=self.update_plot)
        chk_dots.pack(anchor="w", padx=14, pady=(0, 10))

        # 5. EXPORT ACTIONS
        section_header("5. Publication Export")

        btn_export_png = tk.Button(p, text="📷 Save Figure 1 (300 DPI PNG)", font=("Arial", 10, "bold"),
                                   bg="#0284C7", fg="white", relief="flat", padx=10, pady=8, command=self.export_highres_png)
        btn_export_png.pack(fill=tk.X, padx=14, pady=(4, 6))

        btn_export_pdf = tk.Button(p, text="📑 Save Vector PDF (Editable OMML)", font=("Arial", 10),
                                   bg="#475569", fg="white", relief="flat", padx=10, pady=6, command=self.export_pdf)
        btn_export_pdf.pack(fill=tk.X, padx=14, pady=(0, 16))

    def on_brush_mode_change(self):
        mode = self.brush_mode.get()
        if mode in ["paint", "erase"]:
            self.var_show_mask.set(True)
            if hasattr(self, "toolbar") and getattr(self.toolbar, "mode", ""):
                if "zoom" in self.toolbar.mode:
                    self.toolbar.zoom()
                elif "pan" in self.toolbar.mode:
                    self.toolbar.pan()
        self.update_plot()

    def load_default_sample(self):
        sample_path = CURRENT_DIR / "example" / "bas" / "FLIR0201.jpg"
        if sample_path.exists():
            self.load_image_file(str(sample_path))

    def browse_image(self):
        file_path = filedialog.askopenfilename(
            title="Select FLIR Thermal Image",
            filetypes=[("Thermal Images", "*.jpg *.jpeg *.png *.tiff"), ("All Files", "*.*")]
        )
        if file_path:
            self.load_image_file(file_path)

    def browse_json(self):
        file_path = filedialog.askopenfilename(
            title="Select Session JSON Annotations",
            filetypes=[("JSON files", "*.json"), ("All Files", "*.*")]
        )
        if file_path:
            self.load_json_file(file_path)

    def load_image_file(self, path_str):
        try:
            self.image_path = path_str
            self.temp_raw = load_temperature(path_str)
            self.lbl_file.config(text=f"Loaded: {Path(path_str).name}\nSize: {self.temp_raw.shape[1]}x{self.temp_raw.shape[0]}")
            
            # Check for companion JSON in same directory
            json_candidate = Path(path_str).with_suffix(".json")
            if json_candidate.exists():
                self.load_json_file(str(json_candidate))
            else:
                self.rois_data = []

            self.compute_segmentation_and_gradients()
            self.update_plot()
        except Exception as e:
            messagebox.showerror("Error Loading Image", str(e))

    def load_json_file(self, path_str):
        try:
            with open(path_str, "r") as f:
                data = json.load(f)
            self.json_path = path_str
            if isinstance(data, list):
                self.rois_data = data
            elif isinstance(data, dict):
                self.rois_data = data.get("rois", data.get("landmarks", []))
            self.lbl_file.config(text=self.lbl_file.cget("text") + f"\nJSON: {Path(path_str).name} ({len(self.rois_data)} ROIs)")
            self.update_plot()
        except Exception as e:
            messagebox.showwarning("JSON Notice", f"Could not parse JSON ({e}). Defaulting to standard T1, M1, M2.")

    def compute_segmentation_and_gradients(self):
        if self.temp_raw is None:
            return

        H, W = self.temp_raw.shape
        temp_work = self.temp_raw.copy()

        xs = [r.get("cx", (r.get("points") or [{}])[0].get("x", W / 2)) for r in self.rois_data if isinstance(r, dict)]
        avg_x = float(np.mean(xs)) if xs else (W * 0.28)
        col_prof = np.mean(temp_work, axis=0)
        c_start, c_end = int(W * 0.35), int(W * 0.65)
        valley_idx = int(np.argmin(col_prof[c_start:c_end])) + c_start

        if avg_x < valley_idx:
            self.foot_patch_raw = temp_work[:, :valley_idx].copy()
            self.offset_x = 0
            self.foot_side = "RightFoot"
        else:
            self.foot_patch_raw = temp_work[:, valley_idx:].copy()
            self.offset_x = valley_idx
            self.foot_side = "LeftFoot"

        bg_val = float(self.scale_bg_thresh.get())
        morph_k = int(self.scale_morph.get())

        bg_map = np.full_like(self.foot_patch_raw, bg_val)
        bg_map[int(H * 0.75):, :] = bg_val + 1.2
        binary_cand = (self.foot_patch_raw > bg_map).astype(np.uint8)

        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(binary_cand)
        if num_labels > 1:
            largest_idx = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
            clean_mask = (labels == largest_idx)
        else:
            clean_mask = (self.foot_patch_raw > bg_map)

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (morph_k, morph_k))
        clean_mask = cv2.morphologyEx(clean_mask.astype(np.uint8), cv2.MORPH_CLOSE, kernel)
        clean_mask = cv2.morphologyEx(clean_mask, cv2.MORPH_OPEN, kernel).astype(bool)

        ys, xs_mask = np.where(clean_mask)
        pad = 4
        if len(ys) > 50:
            self.ymin = max(0, int(np.min(ys)) - pad)
            self.ymax = min(H - 1, int(np.max(ys)) + pad)
            self.xmin = max(0, int(np.min(xs_mask)) - pad)
            self.xmax = min(self.foot_patch_raw.shape[1] - 1, int(np.max(xs_mask)) + pad)
            self.foot_crop = self.foot_patch_raw[self.ymin:self.ymax+1, self.xmin:self.xmax+1].copy()
            self.mask_crop = clean_mask[self.ymin:self.ymax+1, self.xmin:self.xmax+1]
        else:
            self.ymin, self.ymax, self.xmin, self.xmax = 0, H - 1, 0, self.foot_patch_raw.shape[1] - 1
            self.foot_crop = self.foot_patch_raw.copy()
            self.mask_crop = np.ones_like(self.foot_crop, dtype=bool)

        self.ch, self.cw = self.foot_crop.shape
        aspect = float(self.cw) / float(max(1, self.ch))
        self.n_rows = 104
        self.n_cols = max(20, int(round(self.n_rows * aspect)))

        self.mask_crop_u8 = self.mask_crop.astype(np.uint8)
        self.mask_history = [self.mask_crop_u8.copy()]

        self.recompute_gradients_from_mask()

    def recompute_gradients_from_mask(self):
        if self.foot_crop is None or self.mask_crop_u8 is None:
            return

        self.mask_dense = cv2.resize(self.mask_crop_u8, (self.n_cols, self.n_rows), interpolation=cv2.INTER_NEAREST).astype(bool)

        # Inward Inpainting to eliminate boundary cliff
        mask_inv = (self.mask_crop_u8 == 0).astype(np.uint8)
        crop_inpainted = cv2.inpaint(np.clip(self.foot_crop, 0, 255).astype(np.uint8), mask_inv, 7, cv2.INPAINT_TELEA).astype(np.float32)
        grid_inpainted = cv2.resize(crop_inpainted, (self.n_cols, self.n_rows), interpolation=cv2.INTER_AREA)

        # Smooth & Gradients
        self.grid_smooth = cv2.GaussianBlur(grid_inpainted, (7, 7), 1.8)
        self.sobel_x = cv2.Sobel(self.grid_smooth, cv2.CV_64F, 1, 0, ksize=3) / 8.0
        self.sobel_y = cv2.Sobel(self.grid_smooth, cv2.CV_64F, 0, 1, ksize=3) / 8.0
        self.grad_mag = np.sqrt(self.sobel_x**2 + self.sobel_y**2)

        self.grid_contour = self.grid_smooth.astype(np.float64)
        self.grid_contour[~self.mask_dense] = np.nan

    def on_segmentation_change(self):
        self.compute_segmentation_and_gradients()
        self.update_plot()

    # ──────── INTERACTIVE BRUSH MOUSE EVENTS ────────
    def on_canvas_press(self, event):
        mode = self.brush_mode.get()
        if mode not in ["paint", "erase"] or event.inaxes not in [self.ax1, self.ax2]:
            return
        if event.button == 1:
            self.is_mouse_down = True
            # Save history state for undo
            if self.mask_crop_u8 is not None:
                self.mask_history.append(self.mask_crop_u8.copy())
                if len(self.mask_history) > 15:
                    self.mask_history.pop(0)
            self.apply_brush_stroke(event.xdata, event.ydata)

    def on_canvas_motion(self, event):
        if not self.is_mouse_down:
            return
        mode = self.brush_mode.get()
        if mode in ["paint", "erase"] and event.inaxes in [self.ax1, self.ax2]:
            self.apply_brush_stroke(event.xdata, event.ydata, interactive=True)

    def on_canvas_release(self, event):
        if self.is_mouse_down:
            self.is_mouse_down = False
            self.recompute_gradients_from_mask()
            self.update_plot()

    def apply_brush_stroke(self, gx, gy, interactive=False):
        if gx is None or gy is None or self.mask_crop_u8 is None:
            return
        # Map grid coords (1 to n_cols) to foot_crop image pixel coords
        px = int(np.clip((gx - 0.5) / self.n_cols * self.cw, 0, self.cw - 1))
        py = int(np.clip((gy - 0.5) / self.n_rows * self.ch, 0, self.ch - 1))

        r_grid = float(self.scale_brush_size.get())
        r_px = max(1, int(r_grid / self.n_cols * self.cw))
        val = 1 if self.brush_mode.get() == "paint" else 0

        cv2.circle(self.mask_crop_u8, (px, py), r_px, val, -1)

        if interactive:
            # Quick mask overlay update during mouse drag
            self.mask_dense = cv2.resize(self.mask_crop_u8, (self.n_cols, self.n_rows), interpolation=cv2.INTER_NEAREST).astype(bool)
            self.update_plot()

    def undo_mask_stroke(self):
        if len(self.mask_history) > 1:
            self.mask_history.pop()  # Remove current
            self.mask_crop_u8 = self.mask_history[-1].copy()
            self.recompute_gradients_from_mask()
            self.update_plot()
        elif len(self.mask_history) == 1:
            self.mask_crop_u8 = self.mask_history[0].copy()
            self.recompute_gradients_from_mask()
            self.update_plot()

    def clear_all_mask(self):
        if self.mask_crop_u8 is not None:
            self.mask_history.append(self.mask_crop_u8.copy())
            self.mask_crop_u8.fill(0)
            self.recompute_gradients_from_mask()
            self.update_plot()

    # ──────── PLOT RENDERING ────────
    def update_plot(self):
        if self.foot_crop is None or self.mask_dense is None:
            return

        self.ax1.clear()
        self.ax2.clear()

        lw = float(self.scale_lw.get())
        n_levels = int(self.scale_levels.get())
        cmap_name = self.combo_cmap.get()
        step = int(self.var_step.get())
        a_scale = float(self.scale_arrow_len.get())
        show_dots = self.var_show_dots.get()
        show_mask_overlay = self.var_show_mask.get()

        # ──────── PANEL A: PPP ────────
        self.ax1.set_facecolor("#000000")
        x_edges = np.arange(0.5, self.n_cols + 1.5, 1)
        y_edges = np.arange(0.5, self.n_rows + 1.5, 1)
        X_e, Y_e = np.meshgrid(x_edges, y_edges)

        grid_disp = cv2.resize(self.foot_crop, (self.n_cols, self.n_rows), interpolation=cv2.INTER_AREA)
        grid_disp[~self.mask_dense] = 23.5

        self.ax1.pcolormesh(X_e, Y_e, grid_disp, cmap="inferno", vmin=23.5, vmax=np.max(grid_disp),
                            edgecolors="#111111", linewidth=0.20, shading="flat")

        if show_mask_overlay:
            mask_rgba = np.zeros((self.n_rows, self.n_cols, 4), dtype=np.float32)
            mask_rgba[self.mask_dense] = [0.0, 1.0, 0.2, 0.32]  # Translucent bright green
            self.ax1.imshow(mask_rgba, extent=[0.5, self.n_cols + 0.5, self.n_rows + 0.5, 0.5], zorder=5)

        self.ax1.set_xlim(0.5, self.n_cols + 0.5)
        self.ax1.set_ylim(self.n_rows + 0.5, 0.5)
        self.ax1.set_aspect("equal")
        self.ax1.tick_params(colors="black", labelsize=8)

        mode_desc = f" | Brush: {self.brush_mode.get().upper()}" if self.brush_mode.get() != 'pan' else ""
        self.ax1.set_title(f"(A)\n\nPPP (Thermal Intensity){mode_desc}", fontsize=12, fontweight="bold", pad=8)

        # ──────── PANEL B: PPG & PGA ────────
        self.ax2.set_facecolor("white")
        foot_outline = (self.mask_dense).astype(np.uint8)
        self.ax2.contour(np.arange(1, self.n_cols + 1), np.arange(1, self.n_rows + 1), foot_outline,
                         levels=[0.5], colors="#94A3B8", linewidths=0.6, linestyles="--")

        # Dynamic internal percentiles
        internal_temps = self.grid_contour[self.mask_dense & np.isfinite(self.grid_contour)]
        if len(internal_temps) > 10:
            p_min = float(np.percentile(internal_temps, 4))
            p_max = float(np.percentile(internal_temps, 98))
            levels = np.linspace(p_min, p_max, n_levels)
            self.ax2.contour(np.arange(1, self.n_cols + 1), np.arange(1, self.n_rows + 1), self.grid_contour,
                             levels=levels, cmap=cmap_name, linewidths=lw, alpha=0.92)

        # Quiver arrows
        y_q, x_q = np.mgrid[1:self.n_rows+1:step, 1:self.n_cols+1:step]
        foot_sub = self.mask_dense[::step, ::step]
        m_sub = self.grad_mag[::step, ::step]
        u_sub = self.sobel_x[::step, ::step]
        v_sub = self.sobel_y[::step, ::step]
        nrm = np.sqrt(u_sub**2 + v_sub**2) + 1e-6

        is_arrow = foot_sub & (m_sub >= 0.012)
        is_dot = foot_sub & (m_sub < 0.012)

        u_plot = ((u_sub / nrm) * a_scale)[is_arrow]
        v_plot = ((v_sub / nrm) * a_scale)[is_arrow]

        if show_dots:
            dot_sz = 0.9 if step == 1 else 1.8
            self.ax2.plot(x_q[is_dot], y_q[is_dot], "o", color="#0b4db7", markersize=dot_sz, alpha=0.45, zorder=6)

        qw = 0.0020 if step == 1 else 0.0034
        hw = 2.5 if step == 1 else 3.2
        hl = 3.0 if step == 1 else 3.8

        self.ax2.quiver(x_q[is_arrow], y_q[is_arrow], u_plot, v_plot,
                        color="#0b4db7", angles="xy", scale_units="xy", scale=1.0,
                        width=qw, headwidth=hw, headlength=hl, alpha=0.90, zorder=8)

        # Map ROIs
        mapped_rois = self.get_mapped_rois()
        for name, gx, gy, r_rad in mapped_rois:
            # On Panel A
            c_out_a = Circle((gx, gy), r_rad, edgecolor="#00e5ff", facecolor="none", lw=1.8, zorder=10)
            c_in_a = Circle((gx, gy), r_rad * 0.82, edgecolor="red", facecolor="none", lw=1.2, zorder=11)
            self.ax1.add_patch(c_out_a)
            self.ax1.add_patch(c_in_a)
            self.ax1.plot(gx, gy, "o", color="red", markeredgecolor="white", markeredgewidth=0.8, markersize=4.0, zorder=12)
            ty_a = 5.5 if gy < self.n_rows * 0.55 else -4.5
            self.ax1.text(gx, gy + ty_a, name, color="white", fontsize=12, fontweight="bold",
                          ha="center", va="center", zorder=15,
                          bbox=dict(boxstyle="round,pad=0.15", facecolor="#000000", alpha=0.6, edgecolor="none"))

            # On Panel B
            c_out_b = Circle((gx, gy), r_rad, edgecolor="red", facecolor="none", lw=1.6, zorder=10)
            c_in_b = Circle((gx, gy), r_rad * 0.82, edgecolor="red", facecolor="none", lw=0.9, linestyle=":", zorder=11)
            self.ax2.add_patch(c_out_b)
            self.ax2.add_patch(c_in_b)
            self.ax2.plot(gx, gy, "o", color="red", markersize=3.8, zorder=12)
            ty_b = 5.5 if gy < self.n_rows * 0.55 else -4.5
            self.ax2.text(gx, gy + ty_b, name, color="black", fontsize=12, fontweight="bold", ha="center", va="center", zorder=15)

        self.ax2.set_xlim(0.5, self.n_cols + 0.5)
        self.ax2.set_ylim(self.n_rows + 0.5, 0.5)
        self.ax2.set_aspect("equal")
        self.ax2.tick_params(colors="black", labelsize=8)
        self.ax2.set_title(f"(B)\n\nPPG & PGA (Hairline {lw}pt, Step {step})", fontsize=12, fontweight="bold", pad=8)

        self.canvas.draw_idle()

    def get_mapped_rois(self):
        mapped = []
        for r in self.rois_data:
            if not isinstance(r, dict):
                continue
            name = str(r.get("labelName", r.get("name", "ROI"))).upper()
            rcx = float(r.get("cx", (r.get("points") or [{}])[0].get("x", 0))) - self.offset_x - self.xmin
            rcy = float(r.get("cy", (r.get("points") or [{}])[0].get("y", 0))) - self.ymin
            gx = (rcx / self.cw) * self.n_cols + 0.5
            gy = (rcy / self.ch) * self.n_rows + 0.5
            r_final = 4.5
            gx = float(np.clip(gx, r_final + 0.5, self.n_cols - r_final + 0.5))
            gy = float(np.clip(gy, r_final + 0.5, self.n_rows - r_final + 0.5))
            mapped.append((name, gx, gy, r_final))

        if not mapped:
            if self.foot_side == "RightFoot":
                mapped = [("T1", 0.61 * self.n_cols, 0.16 * self.n_rows, 4.5),
                          ("M1", 0.61 * self.n_cols, 0.33 * self.n_rows, 4.5),
                          ("M2", 0.44 * self.n_cols, 0.33 * self.n_rows, 4.5)]
            else:
                mapped = [("T1", 0.39 * self.n_cols, 0.16 * self.n_rows, 4.5),
                          ("M1", 0.39 * self.n_cols, 0.33 * self.n_rows, 4.5),
                          ("M2", 0.56 * self.n_cols, 0.33 * self.n_rows, 4.5)]
        return mapped

    def export_highres_png(self):
        if self.foot_crop is None:
            return
        default_name = f"Fig1_PPGPGA_Custom_{Path(self.image_path).stem if self.image_path else 'export'}.png"
        out_file = filedialog.asksaveasfilename(defaultextension=".png", initialfile=default_name,
                                                filetypes=[("PNG Image", "*.png")])
        if out_file:
            self.fig.savefig(out_file, dpi=300, bbox_inches="tight", facecolor="white")
            messagebox.showinfo("Export Successful", f"Saved publication-grade Figure 1 at 300 DPI:\n{out_file}")

    def export_pdf(self):
        if self.foot_crop is None:
            return
        default_name = f"Fig1_PPGPGA_Vector_{Path(self.image_path).stem if self.image_path else 'export'}.pdf"
        out_file = filedialog.asksaveasfilename(defaultextension=".pdf", initialfile=default_name,
                                                filetypes=[("PDF Document", "*.pdf")])
        if out_file:
            self.fig.savefig(out_file, dpi=300, bbox_inches="tight", facecolor="white")
            messagebox.showinfo("Export Successful", f"Saved vector PDF:\n{out_file}")


def main():
    root = tk.Tk()
    app = PPGWorkbenchApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()
