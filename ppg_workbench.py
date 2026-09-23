"""
ThermalSight PPG & PGA Interactive Workbench (v1.8.1)
Standalone companion tool for:
1. Multi-image session carousel (Next / Prev / Dropdown navigation)
2. Interactive foot mask paint & erase brush
3. Interactive ROI landmark repositioning (drag & drop T1, M1, M2)
4. Smart directory resolution & path burning (with 'Image not Found' guard)
5. Non-destructive JSON saving (auto .bak + compact mask polygon storage)
6. Export U-Net paired dataset (images + binary masks for deep learning)
7. Targeted incremental pipeline recomputation (⚡ Recompute All Metrics)
8. Concise Executive Statistical Output:
   - PPP_PPG_PGA_Statistical_Summary.xlsx (2 Sheets: Detailed & Executive Wide)
   - PPP_PPG_PGA_Statistical_Summary.csv
   - PPP_PPG_PGA_Wide_Summary.csv
9. Publication Figure 1 (0.2 pt ultra-fine contours + Step=1 100% quiver vectors)
"""

import os
import sys
import re
import json
import shutil
import argparse
import subprocess
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import cv2
import pandas as pd
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
    def __init__(self, root, session_arg=None, image_arg=None):
        self.root = root
        self.root.title("ThermalSight — PPG & PGA Interactive Research Workbench v1.8.1")
        self.root.geometry("1560x960")
        self.root.minsize(1220, 780)
        self.root.configure(bg="#F1F5F9")

        # Session & Image State
        self.image_path = None
        self.session_json_path = None
        self.session_data = {}
        self.image_list = []
        self.current_img_idx = 0
        self.temp_raw = None
        self.rois_data = []

        # Interactive ROI Dragging State
        self.selected_roi = None
        self.is_dragging_roi = False
        
        # Computed Plantar Foot & Mask State
        self.foot_patch_raw = None
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
        self.ymax = 0
        self.xmin = 0
        self.xmax = 0
        self.cw = 1
        self.ch = 1
        self.foot_side = "RightFoot"

        self.setup_ui()
        self.bind_shortcuts()

        # Handle command-line arguments or load default
        if session_arg and Path(session_arg).exists():
            self.load_json_file(session_arg)
            if image_arg and Path(image_arg).exists():
                self.load_image_file(image_arg)
        elif image_arg and Path(image_arg).exists():
            self.load_image_file(image_arg)
        else:
            self.load_default_sample()

    def setup_ui(self):
        # 1. Top Primary Toolbar
        top_bar = tk.Frame(self.root, bg="#0F172A", height=58)
        top_bar.pack(side=tk.TOP, fill=tk.X)

        title_lbl = tk.Label(top_bar, text="ThermalSight PPG & PGA Workbench", font=("Arial", 15, "bold"), fg="#FFFFFF", bg="#0F172A")
        title_lbl.pack(side=tk.LEFT, padx=18, pady=10)

        sub_lbl = tk.Label(top_bar, text="v1.8.0 Ground-Truth Annotation & Topography Lab", font=("Arial", 10), fg="#94A3B8", bg="#0F172A")
        sub_lbl.pack(side=tk.LEFT, padx=5, pady=13)

        btn_open_json = tk.Button(top_bar, text="📋 Load Session JSON", font=("Arial", 9, "bold"), bg="#334155", fg="white",
                                  activebackground="#475569", relief="flat", padx=12, pady=5, command=self.browse_json)
        btn_open_json.pack(side=tk.RIGHT, padx=14, pady=10)

        btn_open_img = tk.Button(top_bar, text="📂 Load Image / Folder", font=("Arial", 9, "bold"), bg="#0284C7", fg="white",
                                 activebackground="#0369A1", relief="flat", padx=12, pady=5, command=self.browse_image)
        btn_open_img.pack(side=tk.RIGHT, padx=6, pady=10)

        # 2. Carousel & Session Sub-Toolbar
        nav_bar = tk.Frame(self.root, bg="#1E293B", height=42)
        nav_bar.pack(side=tk.TOP, fill=tk.X)

        self.btn_prev = tk.Button(nav_bar, text="◀ Prev Image", font=("Arial", 9, "bold"), bg="#334155", fg="white",
                                  activebackground="#475569", relief="flat", padx=10, pady=3, command=self.prev_image)
        self.btn_prev.pack(side=tk.LEFT, padx=(15, 6), pady=6)

        self.btn_next = tk.Button(nav_bar, text="Next Image ▶", font=("Arial", 9, "bold"), bg="#334155", fg="white",
                                  activebackground="#475569", relief="flat", padx=10, pady=3, command=self.next_image)
        self.btn_next.pack(side=tk.LEFT, padx=6, pady=6)

        self.lbl_nav_status = tk.Label(nav_bar, text="No Images Loaded", font=("Arial", 9, "bold"), fg="#38BDF8", bg="#1E293B")
        self.lbl_nav_status.pack(side=tk.LEFT, padx=12, pady=6)

        self.combo_images = ttk.Combobox(nav_bar, state="readonly", width=36)
        self.combo_images.pack(side=tk.LEFT, padx=6, pady=6)
        self.combo_images.bind("<<ComboboxSelected>>", self.on_image_selected_from_combo)

        # Actions on Right Side of Nav Bar
        btn_recompute = tk.Button(nav_bar, text="⚡ Recompute & Export All Metrics", font=("Arial", 9, "bold"), bg="#7C3AED", fg="white",
                                  activebackground="#6D28D9", relief="flat", padx=10, pady=3, command=self.recompute_and_export_all_metrics)
        btn_recompute.pack(side=tk.RIGHT, padx=15, pady=6)

        btn_export_unet = tk.Button(nav_bar, text="🤖 Export U-Net Dataset", font=("Arial", 9, "bold"), bg="#059669", fg="white",
                                    activebackground="#047857", relief="flat", padx=10, pady=3, command=self.export_unet_dataset)
        btn_export_unet.pack(side=tk.RIGHT, padx=6, pady=6)

        btn_save_json = tk.Button(nav_bar, text="💾 Save to JSON", font=("Arial", 9, "bold"), bg="#D97706", fg="white",
                                  activebackground="#B45309", relief="flat", padx=10, pady=3, command=self.save_annotations_to_json)
        btn_save_json.pack(side=tk.RIGHT, padx=6, pady=6)

        # 3. Main Workspace Layout: Sidebar on Left, Matplotlib Canvas on Right
        main_container = tk.Frame(self.root, bg="#F1F5F9")
        main_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # Left Control Panel (Scrollable)
        sidebar_frame = tk.Frame(main_container, bg="#FFFFFF", width=400, highlightbackground="#CBD5E1", highlightthickness=1)
        sidebar_frame.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 10))
        sidebar_frame.pack_propagate(False)

        canvas_sidebar = tk.Canvas(sidebar_frame, bg="#FFFFFF", highlightthickness=0)
        scrollbar = ttk.Scrollbar(sidebar_frame, orient="vertical", command=canvas_sidebar.yview)
        self.scroll_content = tk.Frame(canvas_sidebar, bg="#FFFFFF")

        self.scroll_content.bind("<Configure>", lambda e: canvas_sidebar.configure(scrollregion=canvas_sidebar.bbox("all")))
        canvas_sidebar.create_window((0, 0), window=self.scroll_content, anchor="nw", width=380)
        canvas_sidebar.configure(yscrollcommand=scrollbar.set)

        canvas_sidebar.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self.build_sidebar_controls()

        # Right Matplotlib Canvas Panel
        display_frame = tk.Frame(main_container, bg="#FFFFFF", highlightbackground="#CBD5E1", highlightthickness=1)
        display_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)

        self.fig, (self.ax1, self.ax2) = plt.subplots(1, 2, figsize=(11, 8.5), dpi=100, facecolor="white")
        self.fig.subplots_adjust(left=0.04, right=0.96, top=0.92, bottom=0.06, wspace=0.12)

        self.canvas = FigureCanvasTkAgg(self.fig, master=display_frame)
        self.canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

        # Mouse Event Connections for Brush Painting and ROI Dragging
        self.canvas.mpl_connect("button_press_event", self.on_canvas_press)
        self.canvas.mpl_connect("motion_notify_event", self.on_canvas_motion)
        self.canvas.mpl_connect("button_release_event", self.on_canvas_release)

        # Matplotlib Toolbar
        toolbar_frame = tk.Frame(display_frame, bg="#FFFFFF")
        toolbar_frame.pack(side=tk.BOTTOM, fill=tk.X)
        self.toolbar = NavigationToolbar2Tk(self.canvas, toolbar_frame)
        self.toolbar.update()

    def bind_shortcuts(self):
        self.root.bind("<Left>", lambda e: self.prev_image())
        self.root.bind("<Right>", lambda e: self.next_image())
        self.root.bind("[", lambda e: self.prev_image())
        self.root.bind("]", lambda e: self.next_image())
        self.root.bind("<Control-s>", lambda e: self.save_annotations_to_json())

    def build_sidebar_controls(self):
        p = self.scroll_content

        def section_header(text):
            lbl = tk.Label(p, text=text, font=("Arial", 10, "bold"), fg="#0F172A", bg="#FFFFFF")
            lbl.pack(anchor="w", padx=12, pady=(12, 4))
            sep = ttk.Separator(p, orient="horizontal")
            sep.pack(fill=tk.X, padx=12, pady=(0, 8))

        # 1. FILE & SESSION INFO
        section_header("1. Active Session & File")
        self.lbl_file = tk.Label(p, text="No image loaded", font=("Arial", 9), fg="#475569", bg="#F8FAFC",
                                 anchor="w", justify=tk.LEFT, padx=8, pady=6, relief="groove")
        self.lbl_file.pack(fill=tk.X, padx=12, pady=(0, 6))

        # 2. INTERACTIVE CANVAS MODES
        section_header("2. Interactive Canvas Tool Mode")
        box_mode = tk.LabelFrame(p, text=" Mouse Tool Selection ", font=("Arial", 9, "bold"), fg="#0F172A", bg="#F8FAFC", padx=8, pady=8)
        box_mode.pack(fill=tk.X, padx=12, pady=(0, 10))

        self.tool_mode = tk.StringVar(value="pan")
        r_pan = tk.Radiobutton(box_mode, text="🔍 Inspect / Pan-Zoom", variable=self.tool_mode, value="pan",
                               font=("Arial", 9), bg="#F8FAFC", activebackground="#F8FAFC", command=self.on_tool_mode_change)
        r_pan.pack(anchor="w", pady=1)

        r_roi = tk.Radiobutton(box_mode, text="🎯 Adjust ROI (Drag T1, M1, M2)", variable=self.tool_mode, value="adjust_roi",
                               font=("Arial", 9, "bold"), fg="#2563EB", bg="#F8FAFC", activebackground="#F8FAFC", command=self.on_tool_mode_change)
        r_roi.pack(anchor="w", pady=1)

        r_paint = tk.Radiobutton(box_mode, text="🖌️ Paint Mask (Add Foot Area)", variable=self.tool_mode, value="paint",
                                 font=("Arial", 9, "bold"), fg="#16A34A", bg="#F8FAFC", activebackground="#F8FAFC", command=self.on_tool_mode_change)
        r_paint.pack(anchor="w", pady=1)

        r_erase = tk.Radiobutton(box_mode, text="🧹 Erase Mask (Remove Blanket/Noise)", variable=self.tool_mode, value="erase",
                                 font=("Arial", 9, "bold"), fg="#DC2626", bg="#F8FAFC", activebackground="#F8FAFC", command=self.on_tool_mode_change)
        r_erase.pack(anchor="w", pady=1)

        lbl_bsize = tk.Label(box_mode, text="Brush Radius (Cells):", font=("Arial", 8), fg="#475569", bg="#F8FAFC")
        lbl_bsize.pack(anchor="w", pady=(6, 0))
        self.scale_brush_size = tk.Scale(box_mode, from_=1.0, to_=12.0, resolution=0.5, orient=tk.HORIZONTAL, bg="#F8FAFC", highlightthickness=0)
        self.scale_brush_size.set(3.5)
        self.scale_brush_size.pack(fill=tk.X, pady=(0, 6))

        frame_brush_btns = tk.Frame(box_mode, bg="#F8FAFC")
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

        # 3. SEGMENTATION THRESHOLDS
        section_header("3. Auto Segmentation Parameters")
        lbl_bg = tk.Label(p, text="Auto Background Cutoff (°C):", font=("Arial", 8, "bold"), fg="#334155", bg="#FFFFFF")
        lbl_bg.pack(anchor="w", padx=14)
        self.scale_bg_thresh = tk.Scale(p, from_=22.0, to_=31.0, resolution=0.1, orient=tk.HORIZONTAL, bg="#FFFFFF",
                                        highlightthickness=0, command=lambda v: self.on_segmentation_change())
        self.scale_bg_thresh.set(26.5)
        self.scale_bg_thresh.pack(fill=tk.X, padx=14, pady=(0, 4))

        lbl_morph = tk.Label(p, text="Morphology Kernel Size:", font=("Arial", 8), fg="#334155", bg="#FFFFFF")
        lbl_morph.pack(anchor="w", padx=14)
        self.scale_morph = tk.Scale(p, from_=3, to_=15, resolution=2, orient=tk.HORIZONTAL, bg="#FFFFFF",
                                    highlightthickness=0, command=lambda v: self.on_segmentation_change())
        self.scale_morph.set(7)
        self.scale_morph.pack(fill=tk.X, padx=14, pady=(0, 6))

        self.var_show_mask = tk.BooleanVar(value=True)
        chk_mask = tk.Checkbutton(p, text="Show Foot Mask Overlay (Green)", variable=self.var_show_mask, font=("Arial", 9, "bold"),
                                  fg="#0284C7", bg="#FFFFFF", activebackground="#FFFFFF", command=self.update_plot)
        chk_mask.pack(anchor="w", padx=14, pady=(0, 8))

        # 4. CONTOUR TOPOGRAPHY
        section_header("4. Contour Line Topography")
        lbl_lw = tk.Label(p, text="Contour Linewidth (pt):", font=("Arial", 8, "bold"), fg="#334155", bg="#FFFFFF")
        lbl_lw.pack(anchor="w", padx=14)
        self.scale_lw = tk.Scale(p, from_=0.10, to_=1.20, resolution=0.05, orient=tk.HORIZONTAL, bg="#FFFFFF",
                                 highlightthickness=0, command=lambda v: self.update_plot())
        self.scale_lw.set(0.20)  # Default: 0.2 pt ultra-fine
        self.scale_lw.pack(fill=tk.X, padx=14, pady=(0, 4))

        lbl_levels = tk.Label(p, text="Contour Levels (Density):", font=("Arial", 8), fg="#334155", bg="#FFFFFF")
        lbl_levels.pack(anchor="w", padx=14)
        self.scale_levels = tk.Scale(p, from_=10, to_=30, resolution=1, orient=tk.HORIZONTAL, bg="#FFFFFF",
                                     highlightthickness=0, command=lambda v: self.update_plot())
        self.scale_levels.set(18)
        self.scale_levels.pack(fill=tk.X, padx=14, pady=(0, 4))

        lbl_cmap = tk.Label(p, text="Contour Colormap:", font=("Arial", 8), fg="#334155", bg="#FFFFFF")
        lbl_cmap.pack(anchor="w", padx=14)
        self.combo_cmap = ttk.Combobox(p, values=["turbo", "jet", "rainbow", "inferno", "magma", "viridis", "coolwarm"], state="readonly")
        self.combo_cmap.set("turbo")
        self.combo_cmap.bind("<<ComboboxSelected>>", lambda e: self.update_plot())
        self.combo_cmap.pack(fill=tk.X, padx=14, pady=(0, 8))

        # 5. QUIVER VECTOR FLOW
        section_header("5. Quiver Vector Field (1:1 Grid)")
        self.var_step = tk.IntVar(value=1)
        lbl_step = tk.Label(p, text="Grid Sampling Density:", font=("Arial", 8, "bold"), fg="#334155", bg="#FFFFFF")
        lbl_step.pack(anchor="w", padx=14)
        r_step1 = tk.Radiobutton(p, text="Step = 1 (1:1 Full Grid, ~2,300 Nodes)", variable=self.var_step, value=1,
                                 font=("Arial", 8), bg="#FFFFFF", activebackground="#FFFFFF", command=self.update_plot)
        r_step1.pack(anchor="w", padx=20)
        r_step2 = tk.Radiobutton(p, text="Step = 2 (Subsampled, ~600 Nodes)", variable=self.var_step, value=2,
                                 font=("Arial", 8), bg="#FFFFFF", activebackground="#FFFFFF", command=self.update_plot)
        r_step2.pack(anchor="w", padx=20, pady=(0, 4))

        lbl_ascale = tk.Label(p, text="Arrow Length Scale:", font=("Arial", 8), fg="#334155", bg="#FFFFFF")
        lbl_ascale.pack(anchor="w", padx=14)
        self.scale_arrow_len = tk.Scale(p, from_=0.3, to_=1.8, resolution=0.05, orient=tk.HORIZONTAL, bg="#FFFFFF",
                                        highlightthickness=0, command=lambda v: self.update_plot())
        self.scale_arrow_len.set(0.72)
        self.scale_arrow_len.pack(fill=tk.X, padx=14, pady=(0, 4))

        self.var_show_dots = tk.BooleanVar(value=True)
        chk_dots = tk.Checkbutton(p, text="Anchor Dots in Flat Zones (100% Nodes)", variable=self.var_show_dots,
                                  font=("Arial", 8), bg="#FFFFFF", activebackground="#FFFFFF", command=self.update_plot)
        chk_dots.pack(anchor="w", padx=14, pady=(0, 8))

        # 6. EXPORT ACTIONS
        section_header("6. Publication Figure & Metrics Export")
        btn_recompute_side = tk.Button(p, text="⚡ Recompute All Metrics & Export Excel", font=("Arial", 10, "bold"),
                                       bg="#7C3AED", fg="white", relief="flat", padx=10, pady=8, command=self.recompute_and_export_all_metrics)
        btn_recompute_side.pack(fill=tk.X, padx=14, pady=(2, 6))

        btn_export_png = tk.Button(p, text="📷 Save Figure 1 (300 DPI PNG)", font=("Arial", 9, "bold"),
                                   bg="#0284C7", fg="white", relief="flat", padx=10, pady=6, command=self.export_highres_png)
        btn_export_png.pack(fill=tk.X, padx=14, pady=(2, 4))

        btn_export_pdf = tk.Button(p, text="📑 Save Vector PDF (Editable)", font=("Arial", 9),
                                   bg="#475569", fg="white", relief="flat", padx=10, pady=5, command=self.export_pdf)
        btn_export_pdf.pack(fill=tk.X, padx=14, pady=(0, 16))

    def on_tool_mode_change(self):
        mode = self.tool_mode.get()
        if mode in ["paint", "erase"]:
            self.var_show_mask.set(True)
        if mode in ["paint", "erase", "adjust_roi"]:
            if hasattr(self, "toolbar") and getattr(self.toolbar, "mode", ""):
                if "zoom" in self.toolbar.mode:
                    self.toolbar.zoom()
                elif "pan" in self.toolbar.mode:
                    self.toolbar.pan()
        self.update_plot()

    # ──────── SMART DIRECTORY & IMAGE RESOLUTION ────────
    def resolve_image_paths_from_json(self, json_path_str, data):
        """
        Smart image resolver:
        Searches original keys, JSON dir, parent dir, and subdirectories.
        If no images found, returns None (triggering 'Image not Found').
        """
        if not isinstance(data, dict):
            return None, {}

        seg_dict = data.get("segmentations", {})
        if not seg_dict and "folderPath" in data and data["folderPath"]:
            f_path = Path(data["folderPath"])
            if f_path.exists():
                imgs = sorted([str(p.resolve()) for p in f_path.glob("*.jpg")])
                return imgs, {}

        img_exts = ('.jpg', '.jpeg', '.png', '.tiff', '.tif')
        keys = [k for k in seg_dict.keys() if k.lower().endswith(img_exts)]
        if not keys:
            return None, {}

        json_dir = Path(json_path_str).resolve().parent
        parent_dir = json_dir.parent

        # Collect candidate search directories
        candidate_dirs = [json_dir, parent_dir]
        if "folderPath" in data and data["folderPath"] and Path(data["folderPath"]).exists():
            candidate_dirs.append(Path(data["folderPath"]))
        try:
            for item in parent_dir.iterdir():
                if item.is_dir():
                    candidate_dirs.append(item)
        except Exception:
            pass

        # Try to resolve every key
        resolved_list = []
        burned_segs = {}
        for old_k in keys:
            bname = Path(old_k).name
            found_full = None
            if Path(old_k).exists():
                found_full = str(Path(old_k).resolve())
            else:
                for cdir in candidate_dirs:
                    cand = cdir / bname
                    if cand.exists():
                        found_full = str(cand.resolve())
                        break
            
            if found_full:
                resolved_list.append(found_full)
                burned_segs[found_full] = seg_dict[old_k]
            else:
                burned_segs[old_k] = seg_dict[old_k]

        if not resolved_list:
            return None, {}

        # Deduplicate while preserving natural order
        seen = set()
        deduped = []
        for p in resolved_list:
            if p not in seen:
                seen.add(p)
                deduped.append(p)

        deduped.sort(key=lambda x: [int(c) if c.isdigit() else c.lower() for c in Path(x).stem.split('_')])
        return deduped, burned_segs

    def load_default_sample(self):
        sample_json = CURRENT_DIR / "example" / "bas_result" / "annotations_session.json"
        if not sample_json.exists():
            sample_json = CURRENT_DIR / "example" / "bas_Result_v0" / "annotations_session.json"
        
        if sample_json.exists():
            self.load_json_file(str(sample_json), silent_err=True)
        else:
            sample_img = CURRENT_DIR / "example" / "bas" / "FLIR0201.jpg"
            if sample_img.exists():
                self.load_image_file(str(sample_img))

    def browse_image(self):
        file_path = filedialog.askopenfilename(
            title="Select FLIR Thermal Image",
            filetypes=[("Thermal Images", "*.jpg *.jpeg *.png *.tiff"), ("All Files", "*.*")]
        )
        if file_path:
            p = Path(file_path)
            siblings = sorted([str(f.resolve()) for f in p.parent.glob("*.jpg")])
            if siblings:
                self.image_list = siblings
                self.current_img_idx = siblings.index(str(p.resolve())) if str(p.resolve()) in siblings else 0
                self.combo_images['values'] = [Path(x).name for x in self.image_list]
                self.update_nav_ui()
            self.load_image_file(file_path)

    def browse_json(self):
        file_path = filedialog.askopenfilename(
            title="Select Session JSON Annotations",
            filetypes=[("JSON files", "*.json"), ("All Files", "*.*")]
        )
        if file_path:
            self.load_json_file(file_path)

    def load_json_file(self, path_str, silent_err=False):
        try:
            with open(path_str, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            resolved_images, burned_segs = self.resolve_image_paths_from_json(path_str, data)
            
            if not resolved_images:
                messagebox.showerror("Image not Found", f"Image not Found\n\nCould not resolve referenced thermal images in:\n{path_str}")
                return

            self.session_json_path = Path(path_str)
            self.session_data = data
            self.session_data["segmentations"] = burned_segs
            self.session_data["folderPath"] = str(Path(resolved_images[0]).parent)
            self.image_list = resolved_images
            self.current_img_idx = 0

            self.combo_images['values'] = [Path(x).name for x in self.image_list]
            self.update_nav_ui()

            # Load first image in session
            self.load_image_file(self.image_list[0])

        except Exception as e:
            if not silent_err:
                messagebox.showerror("JSON Load Error", f"Failed to load JSON:\n{e}")

    def load_image_file(self, path_str):
        try:
            self.image_path = str(Path(path_str).resolve())
            self.temp_raw = load_temperature(path_str)
            self.lbl_file.config(text=f"Loaded: {Path(path_str).name}\nSize: {self.temp_raw.shape[1]}x{self.temp_raw.shape[0]}\nDir: {Path(path_str).parent.name}")

            # Extract ROIs from session data or companion JSON
            self.rois_data = []
            if self.session_data and "segmentations" in self.session_data:
                seg_map = self.session_data["segmentations"]
                if self.image_path in seg_map:
                    self.rois_data = seg_map[self.image_path]
                else:
                    bname = Path(self.image_path).name
                    for k, val in seg_map.items():
                        if Path(k).name == bname:
                            self.rois_data = val
                            break

            if not self.rois_data:
                json_candidate = Path(path_str).with_suffix(".json")
                if json_candidate.exists():
                    try:
                        with open(json_candidate, "r") as jf:
                            cd = json.load(jf)
                            self.rois_data = cd if isinstance(cd, list) else cd.get("rois", [])
                    except Exception:
                        pass

            self.compute_segmentation_and_gradients()
            self.update_plot()
            self.update_nav_ui()
        except Exception as e:
            messagebox.showerror("Error Loading Image", str(e))

    def update_nav_ui(self):
        if not self.image_list:
            self.lbl_nav_status.config(text="No Images Loaded")
            self.btn_prev.config(state=tk.DISABLED)
            self.btn_next.config(state=tk.DISABLED)
            return

        total = len(self.image_list)
        curr = self.current_img_idx + 1
        name = Path(self.image_list[self.current_img_idx]).name
        self.lbl_nav_status.config(text=f"Image {curr} of {total}: {name}")
        self.combo_images.set(name)
        self.btn_prev.config(state=tk.NORMAL if self.current_img_idx > 0 else tk.DISABLED)
        self.btn_next.config(state=tk.NORMAL if self.current_img_idx < total - 1 else tk.DISABLED)

    def next_image(self):
        if not self.image_list:
            return
        if self.current_img_idx < len(self.image_list) - 1:
            self.current_img_idx += 1
            self.load_image_file(self.image_list[self.current_img_idx])

    def prev_image(self):
        if not self.image_list:
            return
        if self.current_img_idx > 0:
            self.current_img_idx -= 1
            self.load_image_file(self.image_list[self.current_img_idx])

    def on_image_selected_from_combo(self, event):
        idx = self.combo_images.current()
        if 0 <= idx < len(self.image_list):
            self.current_img_idx = idx
            self.load_image_file(self.image_list[idx])

    # ──────── SEGMENTATION & INPAINTING ENGINE ────────
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

        # Check if saved foot_mask_polygon exists in session data
        saved_polys = None
        if self.session_data and "foot_masks" in self.session_data:
            fm = self.session_data["foot_masks"]
            if self.image_path in fm:
                saved_polys = fm[self.image_path]
            else:
                bname = Path(self.image_path).name
                for k, val in fm.items():
                    if Path(k).name == bname:
                        saved_polys = val
                        break

        bg_val = float(self.scale_bg_thresh.get())
        morph_k = int(self.scale_morph.get())

        if saved_polys:
            full_mask = np.zeros_like(self.foot_patch_raw, dtype=np.uint8)
            for poly in saved_polys:
                pts_local = []
                for pt in poly:
                    lx = int(round(pt[0] - self.offset_x))
                    ly = int(round(pt[1]))
                    pts_local.append([lx, ly])
                if len(pts_local) >= 3:
                    pts_arr = np.array(pts_local, dtype=np.int32).reshape((-1, 1, 2))
                    cv2.fillPoly(full_mask, [pts_arr], 1)
            clean_mask = (full_mask > 0)
        else:
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

    # ──────── INTERACTIVE CANVAS MOUSE EVENTS ────────
    def on_canvas_press(self, event):
        mode = self.tool_mode.get()
        if event.inaxes not in [self.ax1, self.ax2] or event.xdata is None or event.ydata is None:
            return

        if mode == "adjust_roi" and event.button == 1:
            gx, gy = event.xdata, event.ydata
            mapped = self.get_mapped_rois()
            best_roi = None
            min_dist = float('inf')
            for name, rgx, rgy, r_rad, roi_obj in mapped:
                dist = np.hypot(gx - rgx, gy - rgy)
                if dist <= max(r_rad * 1.6, 5.0) and dist < min_dist:
                    min_dist = dist
                    best_roi = roi_obj

            if best_roi is not None:
                self.selected_roi = best_roi
                self.is_dragging_roi = True
            return

        if mode in ["paint", "erase"] and event.button == 1:
            self.is_mouse_down = True
            if self.mask_crop_u8 is not None:
                self.mask_history.append(self.mask_crop_u8.copy())
                if len(self.mask_history) > 20:
                    self.mask_history.pop(0)
            self.apply_brush_stroke(event.xdata, event.ydata)

    def on_canvas_motion(self, event):
        mode = self.tool_mode.get()
        if event.inaxes not in [self.ax1, self.ax2] or event.xdata is None or event.ydata is None:
            return

        # ROI Dragging
        if mode == "adjust_roi" and self.is_dragging_roi and self.selected_roi is not None:
            gx, gy = event.xdata, event.ydata
            orig_x = self.offset_x + self.xmin + (gx - 0.5) / self.n_cols * self.cw
            orig_y = self.ymin + (gy - 0.5) / self.n_rows * self.ch

            self.selected_roi["cx"] = float(orig_x)
            self.selected_roi["cy"] = float(orig_y)

            rad = float(self.selected_roi.get("radius", 12.0))
            thetas = np.linspace(0, 2 * np.pi, 32, endpoint=False)
            self.selected_roi["points"] = [
                {"x": float(orig_x + rad * np.cos(th)), "y": float(orig_y + rad * np.sin(th))}
                for th in thetas
            ]
            self.update_plot()
            return

        # Mask Painting / Erasing
        if self.is_mouse_down and mode in ["paint", "erase"]:
            self.apply_brush_stroke(event.xdata, event.ydata, interactive=True)

    def on_canvas_release(self, event):
        if self.is_dragging_roi:
            self.is_dragging_roi = False
            self.selected_roi = None
            self.update_plot()

        if self.is_mouse_down:
            self.is_mouse_down = False
            self.recompute_gradients_from_mask()
            self.update_plot()

    def apply_brush_stroke(self, gx, gy, interactive=False):
        if gx is None or gy is None or self.mask_crop_u8 is None:
            return
        px = int(np.clip((gx - 0.5) / self.n_cols * self.cw, 0, self.cw - 1))
        py = int(np.clip((gy - 0.5) / self.n_rows * self.ch, 0, self.ch - 1))

        r_grid = float(self.scale_brush_size.get())
        r_px = max(1, int(r_grid / self.n_cols * self.cw))
        val = 1 if self.tool_mode.get() == "paint" else 0

        cv2.circle(self.mask_crop_u8, (px, py), r_px, val, -1)

        if interactive:
            self.mask_dense = cv2.resize(self.mask_crop_u8, (self.n_cols, self.n_rows), interpolation=cv2.INTER_NEAREST).astype(bool)
            self.update_plot()

    def undo_mask_stroke(self):
        if len(self.mask_history) > 1:
            self.mask_history.pop()
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
        mode_str = self.tool_mode.get().upper()

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
            mask_rgba[self.mask_dense] = [0.0, 1.0, 0.2, 0.30]
            self.ax1.imshow(mask_rgba, extent=[0.5, self.n_cols + 0.5, self.n_rows + 0.5, 0.5], zorder=5)

        self.ax1.set_xlim(0.5, self.n_cols + 0.5)
        self.ax1.set_ylim(self.n_rows + 0.5, 0.5)
        self.ax1.set_aspect("equal")
        self.ax1.tick_params(colors="black", labelsize=8)

        desc = f" [{mode_str}]" if mode_str != 'PAN' else ""
        self.ax1.set_title(f"(A)\n\nPPP (Thermal Intensity){desc}", fontsize=12, fontweight="bold", pad=8)

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

        # Quiver vectors
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

        # Map and Render ROIs with interactive drag handles
        mapped_rois = self.get_mapped_rois()
        for name, gx, gy, r_rad, roi_obj in mapped_rois:
            is_sel = (roi_obj is self.selected_roi)
            c_color = "#F59E0B" if is_sel else "red"
            ring_color = "#FBBF24" if is_sel else "#00e5ff"

            # On Panel A
            c_out_a = Circle((gx, gy), r_rad, edgecolor=ring_color, facecolor="none", lw=2.0 if is_sel else 1.8, zorder=10)
            c_in_a = Circle((gx, gy), r_rad * 0.82, edgecolor=c_color, facecolor="none", lw=1.2, zorder=11)
            self.ax1.add_patch(c_out_a)
            self.ax1.add_patch(c_in_a)
            self.ax1.plot(gx, gy, "o", color=c_color, markeredgecolor="white", markeredgewidth=1.0, markersize=5.0 if is_sel else 4.0, zorder=12)
            ty_a = 5.5 if gy < self.n_rows * 0.55 else -4.5
            self.ax1.text(gx, gy + ty_a, name, color="white", fontsize=12, fontweight="bold",
                          ha="center", va="center", zorder=15,
                          bbox=dict(boxstyle="round,pad=0.15", facecolor="#000000", alpha=0.65, edgecolor="none"))

            # On Panel B
            c_out_b = Circle((gx, gy), r_rad, edgecolor=c_color, facecolor="none", lw=1.8 if is_sel else 1.6, zorder=10)
            c_in_b = Circle((gx, gy), r_rad * 0.82, edgecolor=c_color, facecolor="none", lw=0.9, linestyle=":", zorder=11)
            self.ax2.add_patch(c_out_b)
            self.ax2.add_patch(c_in_b)
            self.ax2.plot(gx, gy, "o", color=c_color, markersize=4.2 if is_sel else 3.8, zorder=12)
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
        if not self.rois_data:
            if self.foot_side == "RightFoot":
                defs = [("T1", 0.61, 0.16), ("M1", 0.61, 0.33), ("M2", 0.44, 0.33)]
            else:
                defs = [("T1", 0.39, 0.16), ("M1", 0.39, 0.33), ("M2", 0.56, 0.33)]

            for name, fx, fy in defs:
                px = self.offset_x + self.xmin + fx * self.cw
                py = self.ymin + fy * self.ch
                r_obj = {
                    "id": f"roi_{name.lower()}",
                    "type": "circle",
                    "cx": float(px),
                    "cy": float(py),
                    "radius": 12.0,
                    "labelName": name.lower(),
                    "color": "#ff4444" if name == "M1" else ("#00e5ff" if name == "M2" else "#44ff44"),
                    "points": []
                }
                self.rois_data.append(r_obj)

        for r in self.rois_data:
            if not isinstance(r, dict):
                continue
            name = str(r.get("labelName", r.get("name", "ROI"))).upper()
            rcx = float(r.get("cx", (r.get("points") or [{}])[0].get("x", 0))) - self.offset_x - self.xmin
            rcy = float(r.get("cy", (r.get("points") or [{}])[0].get("y", 0))) - self.ymin
            gx = (rcx / self.cw) * self.n_cols + 0.5
            gy = (rcy / self.ch) * self.n_rows + 0.5
            r_final = 4.5
            mapped.append((name, gx, gy, r_final, r))

        return mapped

    # ──────── NON-DESTRUCTIVE SAVING & PATH BURNING ────────
    def save_annotations_to_json(self):
        """
        Saves updated ROIs and compact foot mask polygons into the session JSON.
        Auto-backs up to .json.bak.
        Burns active image paths and auto-copies to new result folder if applicable.
        """
        if not self.session_json_path:
            p = filedialog.asksaveasfilename(
                title="Save Annotations Session JSON",
                defaultextension=".json",
                filetypes=[("JSON files", "*.json")]
            )
            if not p:
                return
            self.session_json_path = Path(p)

        target_file = Path(self.session_json_path)

        # 1. Automatic backup
        bak_file = target_file.with_suffix(".json.bak")
        if target_file.exists() and not bak_file.exists():
            try:
                shutil.copy2(target_file, bak_file)
            except Exception as e:
                print(f"Backup notice: {e}")

        # 2. Build or update session dictionary
        if not self.session_data:
            self.session_data = {
                "exportedAt": datetime.now(timezone.utc).isoformat(),
                "folderPath": str(Path(self.image_path).parent) if self.image_path else "",
                "labels": [
                    {"id": "m1", "name": "m1", "color": "#ff4444"},
                    {"id": "m2", "name": "m2", "color": "#00e5ff"},
                    {"id": "t1", "name": "t1", "color": "#44ff44"}
                ],
                "segmentations": {},
                "foot_masks": {}
            }

        if "segmentations" not in self.session_data:
            self.session_data["segmentations"] = {}
        if "foot_masks" not in self.session_data:
            self.session_data["foot_masks"] = {}

        if self.image_path:
            self.session_data["segmentations"][self.image_path] = self.rois_data

            # Save compact foot mask polygon
            if self.mask_crop_u8 is not None:
                contours, _ = cv2.findContours(self.mask_crop_u8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                polygon_coords = []
                for cnt in contours:
                    approx = cv2.approxPolyDP(cnt, 1.2, True)
                    pts = []
                    for pt in approx:
                        px, py = pt[0]
                        orig_x = int(round(self.offset_x + self.xmin + px))
                        orig_y = int(round(self.ymin + py))
                        pts.append([orig_x, orig_y])
                    if len(pts) >= 3:
                        polygon_coords.append(pts)
                self.session_data["foot_masks"][self.image_path] = polygon_coords

        # 3. Write to primary JSON file
        try:
            with open(target_file, "w", encoding="utf-8") as f:
                json.dump(self.session_data, f, indent=2)

            msg = f"✓ Saved annotations session to:\n{target_file}"
            if bak_file.exists():
                msg += f"\n\n(Auto-backup preserved at {bak_file.name})"

            # 4. Burn to new active result directory if loaded from backup/result folder
            active_img_dir = Path(self.image_path).parent if self.image_path else target_file.parent
            clean_stem = re.sub(r'_[rR]esult$', '', active_img_dir.name)
            new_result_dir = active_img_dir.parent / f"{clean_stem}_result"
            if "_result" in str(target_file).lower() or active_img_dir.name != target_file.parent.name:
                try:
                    new_result_dir.mkdir(parents=True, exist_ok=True)
                    new_json_path = new_result_dir / "annotations_session.json"
                    if new_json_path.resolve() != target_file.resolve():
                        with open(new_json_path, "w", encoding="utf-8") as nf:
                            json.dump(self.session_data, nf, indent=2)
                        msg += f"\n\n✓ Copied session with burned paths to active result directory:\n{new_json_path}"
                except Exception as e:
                    print(f"Notice: could not copy to new result dir: {e}")

            messagebox.showinfo("Session Saved", msg)
        except Exception as e:
            messagebox.showerror("Save Error", f"Could not save JSON file:\n{e}")

    # ──────── TARGETED PIPELINE RECOMPUTATION & STATISTICAL EXCEL EXPORT ────────
    def recompute_and_export_all_metrics(self):
        """
        Targeted incremental recomputation across all images in the session.
        Generates:
        1. Multi-sheet Excel workbook: PPP_PPG_PGA_Statistical_Summary.xlsx (via openpyxl)
           - Sheet 1: 'Detailed_ROIs' (Long format, 1 row per ROI)
           - Sheet 2: 'Executive_Summary' (Wide format, 1 row per Image/Subject)
        2. Universal CSV files:
           - PPP_PPG_PGA_Statistical_Summary.csv (Long format)
           - PPP_PPG_PGA_Wide_Summary.csv (Wide format)
        3. Updated 300 DPI Publication Figure 1 for every image (0.2 pt hairline, Step=1 100% nodes)
        4. Saves updated annotations_session.json to result directory
        """
        if not self.image_list:
            messagebox.showwarning("No Images", "Please load a session JSON or image folder first.")
            return

        active_img_dir = Path(self.image_path).parent if self.image_path else Path(self.image_list[0]).parent
        clean_stem = re.sub(r'_[rR]esult$', '', active_img_dir.name)
        result_dir = active_img_dir.parent / f"{clean_stem}_result"
        result_dir.mkdir(parents=True, exist_ok=True)

        detailed_rows = []
        bg_val = float(self.scale_bg_thresh.get())
        morph_k = int(self.scale_morph.get())
        lw = float(self.scale_lw.get())
        n_levels = int(self.scale_levels.get())
        cmap_name = self.combo_cmap.get()
        step = int(self.var_step.get())
        a_scale = float(self.scale_arrow_len.get())
        show_dots = self.var_show_dots.get()

        compass_labels = [
            (337.5, 360.0, "E (Lateral)", "E (Medial)"),
            (0.0, 22.5, "E (Lateral)", "E (Medial)"),
            (22.5, 67.5, "NE (Anterolateral)", "NE (Anteromedial)"),
            (67.5, 112.5, "N (Distal / Toes)", "N (Distal / Toes)"),
            (112.5, 157.5, "NW (Anteromedial)", "NW (Anterolateral)"),
            (157.5, 202.5, "W (Medial)", "W (Lateral)"),
            (202.5, 247.5, "SW (Posteromedial)", "SW (Posterolateral)"),
            (247.5, 292.5, "S (Proximal / Heel)", "S (Proximal / Heel)"),
            (292.5, 337.5, "SE (Posterolateral)", "SE (Posteromedial)"),
        ]

        def get_compass_dir(deg, is_right):
            deg = deg % 360.0
            for low, high, right_lbl, left_lbl in compass_labels:
                if low <= deg < high:
                    return right_lbl if is_right else left_lbl
            return "N"

        for img_p in self.image_list:
            stem = Path(img_p).stem
            try:
                temp_raw = load_temperature(img_p)
                H, W = temp_raw.shape

                # Retrieve ROIs for this image
                rois = []
                if self.session_data and "segmentations" in self.session_data:
                    seg_map = self.session_data["segmentations"]
                    if img_p in seg_map:
                        rois = seg_map[img_p]
                    else:
                        for k, v in seg_map.items():
                            if Path(k).name == Path(img_p).name:
                                rois = v
                                break
                if not rois and self.image_path == img_p:
                    rois = self.rois_data

                # Foot side detection
                xs = [r.get("cx", (r.get("points") or [{}])[0].get("x", W / 2)) for r in rois if isinstance(r, dict)]
                avg_x = float(np.mean(xs)) if xs else (W * 0.28)
                col_prof = np.mean(temp_raw, axis=0)
                c_start, c_end = int(W * 0.35), int(W * 0.65)
                valley_idx = int(np.argmin(col_prof[c_start:c_end])) + c_start

                if avg_x < valley_idx:
                    foot_patch = temp_raw[:, :valley_idx].copy()
                    off_x = 0
                    is_right = True
                else:
                    foot_patch = temp_raw[:, valley_idx:].copy()
                    off_x = valley_idx
                    is_right = False

                # Retrieve or compute mask
                saved_polys = None
                if self.session_data and "foot_masks" in self.session_data:
                    fm = self.session_data["foot_masks"]
                    if img_p in fm:
                        saved_polys = fm[img_p]
                    else:
                        for k, val in fm.items():
                            if Path(k).name == Path(img_p).name:
                                saved_polys = val
                                break

                if saved_polys:
                    full_m = np.zeros_like(foot_patch, dtype=np.uint8)
                    for poly in saved_polys:
                        pts_local = [[int(round(pt[0] - off_x)), int(round(pt[1]))] for pt in poly]
                        if len(pts_local) >= 3:
                            pts_arr = np.array(pts_local, dtype=np.int32).reshape((-1, 1, 2))
                            cv2.fillPoly(full_m, [pts_arr], 1)
                    clean_mask = (full_m > 0)
                elif self.image_path == img_p and self.mask_crop_u8 is not None:
                    clean_mask = np.zeros_like(foot_patch, dtype=bool)
                    clean_mask[self.ymin:self.ymin+self.ch, self.xmin:self.xmin+self.cw] = (self.mask_crop_u8 > 0)
                else:
                    bg_map = np.full_like(foot_patch, bg_val)
                    bg_map[int(H * 0.75):, :] = bg_val + 1.2
                    binary_cand = (foot_patch > bg_map).astype(np.uint8)
                    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(binary_cand)
                    if num_labels > 1:
                        lg_idx = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
                        clean_mask = (labels == lg_idx)
                    else:
                        clean_mask = (foot_patch > bg_map)
                    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (morph_k, morph_k))
                    clean_mask = cv2.morphologyEx(clean_mask.astype(np.uint8), cv2.MORPH_CLOSE, kernel)
                    clean_mask = cv2.morphologyEx(clean_mask, cv2.MORPH_OPEN, kernel).astype(bool)

                ys, xs_mask = np.where(clean_mask)
                pad = 4
                if len(ys) > 50:
                    ymin = max(0, int(np.min(ys)) - pad)
                    ymax = min(H - 1, int(np.max(ys)) + pad)
                    xmin = max(0, int(np.min(xs_mask)) - pad)
                    xmax = min(foot_patch.shape[1] - 1, int(np.max(xs_mask)) + pad)
                    foot_crop = foot_patch[ymin:ymax+1, xmin:xmax+1].copy()
                    mask_crop_u8 = clean_mask[ymin:ymax+1, xmin:xmax+1].astype(np.uint8)
                else:
                    ymin, ymax, xmin, xmax = 0, H - 1, 0, foot_patch.shape[1] - 1
                    foot_crop = foot_patch.copy()
                    mask_crop_u8 = np.ones_like(foot_crop, dtype=np.uint8)

                ch, cw = foot_crop.shape
                aspect = float(cw) / float(max(1, ch))
                n_rows = 104
                n_cols = max(20, int(round(n_rows * aspect)))

                # Inpaint & Gradients
                mask_dense = cv2.resize(mask_crop_u8, (n_cols, n_rows), interpolation=cv2.INTER_NEAREST).astype(bool)
                mask_inv = (mask_crop_u8 == 0).astype(np.uint8)
                crop_inp = cv2.inpaint(np.clip(foot_crop, 0, 255).astype(np.uint8), mask_inv, 7, cv2.INPAINT_TELEA).astype(np.float32)
                grid_inp = cv2.resize(crop_inp, (n_cols, n_rows), interpolation=cv2.INTER_AREA)
                grid_smooth = cv2.GaussianBlur(grid_inp, (7, 7), 1.8)

                sobel_x = cv2.Sobel(grid_smooth, cv2.CV_64F, 1, 0, ksize=3) / 8.0
                sobel_y = cv2.Sobel(grid_smooth, cv2.CV_64F, 0, 1, ksize=3) / 8.0
                grad_mag = np.sqrt(sobel_x**2 + sobel_y**2)
                # In digital image matrix, row index y increases downwards (+Y = South / Heel).
                # To match standard Cartesian coordinates where +90° is North (Distal / Toes),
                # invert the vertical gradient component: -sobel_y.
                grad_angles = np.degrees(np.arctan2(-sobel_y, sobel_x)) % 360.0

                # Map ROIs
                mapped_rois = []
                if not rois:
                    if is_right:
                        defs = [("T1", 0.61, 0.16), ("M1", 0.61, 0.33), ("M2", 0.44, 0.33)]
                    else:
                        defs = [("T1", 0.39, 0.16), ("M1", 0.39, 0.33), ("M2", 0.56, 0.33)]
                    for name, fx, fy in defs:
                        mapped_rois.append((name, fx * n_cols + 0.5, fy * n_rows + 0.5, 4.5))
                else:
                    for r in rois:
                        if not isinstance(r, dict):
                            continue
                        name = str(r.get("labelName", r.get("name", "ROI"))).upper()
                        rcx = float(r.get("cx", (r.get("points") or [{}])[0].get("x", 0))) - off_x - xmin
                        rcy = float(r.get("cy", (r.get("points") or [{}])[0].get("y", 0))) - ymin
                        gx = (rcx / cw) * n_cols + 0.5
                        gy = (rcy / ch) * n_rows + 0.5
                        r_rad = 4.5
                        mapped_rois.append((name, gx, gy, r_rad))

                # Extract 9x9 zone statistics for each ROI
                for name, gx, gy, r_rad in mapped_rois:
                    gx_min = max(0, int(round(gx - r_rad)))
                    gx_max = min(n_cols, int(round(gx + r_rad)) + 1)
                    gy_min = max(0, int(round(gy - r_rad)))
                    gy_max = min(n_rows, int(round(gy + r_rad)) + 1)

                    roi_temps = grid_smooth[gy_min:gy_max, gx_min:gx_max]
                    roi_mags = grad_mag[gy_min:gy_max, gx_min:gx_max]
                    roi_angs = grad_angles[gy_min:gy_max, gx_min:gx_max]

                    if roi_temps.size > 0:
                        ppp_mean = float(np.mean(roi_temps))
                        ppp_peak = float(np.max(roi_temps))
                        ppp_min = float(np.min(roi_temps))
                        ppp_std = float(np.std(roi_temps))

                        ppg_mean = float(np.mean(roi_mags))
                        ppg_peak = float(np.max(roi_mags))
                        ppg_std = float(np.std(roi_mags))

                        ang_rads = np.radians(roi_angs.flatten())
                        C_sum = np.sum(np.cos(ang_rads))
                        S_sum = np.sum(np.sin(ang_rads))
                        N_pts = len(ang_rads)
                        mean_ang = float(np.degrees(np.arctan2(S_sum, C_sum))) % 360.0
                        R_len = np.sqrt(C_sum**2 + S_sum**2) / max(1, N_pts)
                        coherence_pct = float(R_len * 100.0)
                        compass_dir = get_compass_dir(mean_ang, is_right)
                    else:
                        ppp_mean = ppp_peak = ppp_min = ppp_std = 0.0
                        ppg_mean = ppg_peak = ppg_std = 0.0
                        mean_ang = coherence_pct = 0.0
                        compass_dir = "N"

                    detailed_rows.append({
                        "Image_Name": stem,
                        "Foot_Side": "Right" if is_right else "Left",
                        "ROI": name,
                        "PPP_Mean_Temp_C": round(ppp_mean, 2),
                        "PPP_Peak_Temp_C": round(ppp_peak, 2),
                        "PPP_Min_Temp_C": round(ppp_min, 2),
                        "PPP_Std_Temp_C": round(ppp_std, 2),
                        "PPG_Mean_Grad": round(ppg_mean, 3),
                        "PPG_Peak_Grad": round(ppg_peak, 3),
                        "PPG_Std_Grad": round(ppg_std, 3),
                        "PGA_Mean_Angle_Deg": round(mean_ang, 1),
                        "PGA_Direction_Compass": compass_dir,
                        "PGA_Coherence_Pct": round(coherence_pct, 1)
                    })

                # Render & save 300 DPI Fig 1 (0.2 pt hairline, Step=1)
                fig_out, (fax1, fax2) = plt.subplots(1, 2, figsize=(11, 8.5), dpi=300, facecolor="white")
                fig_out.subplots_adjust(left=0.04, right=0.96, top=0.92, bottom=0.06, wspace=0.12)

                # Panel A
                fax1.set_facecolor("#000000")
                x_e = np.arange(0.5, n_cols + 1.5, 1)
                y_e = np.arange(0.5, n_rows + 1.5, 1)
                Xe, Ye = np.meshgrid(x_e, y_e)
                g_disp = cv2.resize(foot_crop, (n_cols, n_rows), interpolation=cv2.INTER_AREA)
                g_disp[~mask_dense] = 23.5
                fax1.pcolormesh(Xe, Ye, g_disp, cmap="inferno", vmin=23.5, vmax=np.max(g_disp),
                                edgecolors="#111111", linewidth=0.20, shading="flat")
                fax1.set_xlim(0.5, n_cols + 0.5)
                fax1.set_ylim(n_rows + 0.5, 0.5)
                fax1.set_aspect("equal")
                fax1.tick_params(colors="black", labelsize=8)
                fax1.set_title(f"(A)\n\nPPP (Thermal Intensity)\n{stem}", fontsize=11, fontweight="bold", pad=8)

                # Panel B
                fax2.set_facecolor("white")
                fax2.contour(np.arange(1, n_cols + 1), np.arange(1, n_rows + 1), mask_dense.astype(np.uint8),
                             levels=[0.5], colors="#94A3B8", linewidths=0.6, linestyles="--")
                g_contour = grid_smooth.astype(np.float64)
                g_contour[~mask_dense] = np.nan
                internals = g_contour[mask_dense & np.isfinite(g_contour)]
                if len(internals) > 10:
                    pmin = float(np.percentile(internals, 4))
                    pmax = float(np.percentile(internals, 98))
                    fax2.contour(np.arange(1, n_cols + 1), np.arange(1, n_rows + 1), g_contour,
                                 levels=np.linspace(pmin, pmax, n_levels), cmap=cmap_name, linewidths=lw, alpha=0.92)

                yq, xq = np.mgrid[1:n_rows+1:step, 1:n_cols+1:step]
                f_sub = mask_dense[::step, ::step]
                m_sub = grad_mag[::step, ::step]
                u_sub = sobel_x[::step, ::step]
                v_sub = sobel_y[::step, ::step]
                nrm = np.sqrt(u_sub**2 + v_sub**2) + 1e-6
                is_arr = f_sub & (m_sub >= 0.012)
                is_d = f_sub & (m_sub < 0.012)
                u_p = ((u_sub / nrm) * a_scale)[is_arr]
                v_p = ((v_sub / nrm) * a_scale)[is_arr]

                if show_dots:
                    fax2.plot(xq[is_d], yq[is_d], "o", color="#0b4db7", markersize=0.9 if step == 1 else 1.8, alpha=0.45, zorder=6)

                fax2.quiver(xq[is_arr], yq[is_arr], u_p, v_p, color="#0b4db7", angles="xy", scale_units="xy", scale=1.0,
                            width=0.0020 if step == 1 else 0.0034, headwidth=2.5 if step == 1 else 3.2,
                            headlength=3.0 if step == 1 else 3.8, alpha=0.90, zorder=8)

                for name, gx, gy, r_rad in mapped_rois:
                    fax1.add_patch(Circle((gx, gy), r_rad, edgecolor="#00e5ff", facecolor="none", lw=1.8, zorder=10))
                    fax1.add_patch(Circle((gx, gy), r_rad * 0.82, edgecolor="red", facecolor="none", lw=1.2, zorder=11))
                    fax1.plot(gx, gy, "o", color="red", markeredgecolor="white", markeredgewidth=0.8, markersize=4.0, zorder=12)
                    ty1 = 5.5 if gy < n_rows * 0.55 else -4.5
                    fax1.text(gx, gy + ty1, name, color="white", fontsize=11, fontweight="bold", ha="center", va="center", zorder=15,
                              bbox=dict(boxstyle="round,pad=0.15", facecolor="#000000", alpha=0.65, edgecolor="none"))

                    fax2.add_patch(Circle((gx, gy), r_rad, edgecolor="red", facecolor="none", lw=1.6, zorder=10))
                    fax2.add_patch(Circle((gx, gy), r_rad * 0.82, edgecolor="red", facecolor="none", lw=0.9, linestyle=":", zorder=11) )
                    fax2.plot(gx, gy, "o", color="red", markersize=3.8, zorder=12)
                    ty2 = 5.5 if gy < n_rows * 0.55 else -4.5
                    fax2.text(gx, gy + ty2, name, color="black", fontsize=11, fontweight="bold", ha="center", va="center", zorder=15)

                fax2.set_xlim(0.5, n_cols + 0.5)
                fax2.set_ylim(n_rows + 0.5, 0.5)
                fax2.set_aspect("equal")
                fax2.tick_params(colors="black", labelsize=8)
                fax2.set_title(f"(B)\n\nPPG & PGA (Hairline {lw}pt, Step {step})\n{stem}", fontsize=11, fontweight="bold", pad=8)

                fig_path = result_dir / f"Fig1_PPGPGA_{stem}.png"
                fig_out.savefig(str(fig_path), dpi=300, bbox_inches="tight", facecolor="white")
                plt.close(fig_out)

            except Exception as e:
                print(f"Error processing {stem}: {e}")

        # Build Long & Wide DataFrames
        df_long = pd.DataFrame(detailed_rows)

        # Build wide format
        wide_rows = {}
        for row in detailed_rows:
            key = (row["Image_Name"], row["Foot_Side"])
            if key not in wide_rows:
                wide_rows[key] = {"Image_Name": row["Image_Name"], "Foot_Side": row["Foot_Side"]}
            roi = row["ROI"]
            wide_rows[key][f"{roi}_PPP_Mean_C"] = row["PPP_Mean_Temp_C"]
            wide_rows[key][f"{roi}_PPP_Peak_C"] = row["PPP_Peak_Temp_C"]
            wide_rows[key][f"{roi}_PPG_Mean_Grad"] = row["PPG_Mean_Grad"]
            wide_rows[key][f"{roi}_PPG_Peak_Grad"] = row["PPG_Peak_Grad"]
            wide_rows[key][f"{roi}_PGA_Angle_Deg"] = row["PGA_Mean_Angle_Deg"]
            wide_rows[key][f"{roi}_PGA_Direction"] = row["PGA_Direction_Compass"]
            wide_rows[key][f"{roi}_PGA_Coherence_Pct"] = row["PGA_Coherence_Pct"]

        df_wide = pd.DataFrame(list(wide_rows.values()))

        # 1. Save Multi-Sheet Excel Workbook (via openpyxl)
        excel_path = result_dir / "PPP_PPG_PGA_Statistical_Summary.xlsx"
        try:
            with pd.ExcelWriter(str(excel_path), engine="openpyxl") as writer:
                df_long.to_excel(writer, sheet_name="Detailed_ROIs", index=False)
                df_wide.to_excel(writer, sheet_name="Executive_Summary", index=False)
            has_excel = True
        except Exception as e:
            print(f"Excel writer notice: {e}")
            has_excel = False

        # 2. Save Universal CSVs (UTF-8 with BOM for Excel compatibility)
        csv_long_path = result_dir / "PPP_PPG_PGA_Statistical_Summary.csv"
        csv_wide_path = result_dir / "PPP_PPG_PGA_Wide_Summary.csv"
        df_long.to_csv(str(csv_long_path), index=False, encoding="utf-8-sig")
        df_wide.to_csv(str(csv_wide_path), index=False, encoding="utf-8-sig")

        # 3. Save updated session JSON to result directory
        json_target = result_dir / "annotations_session.json"
        with open(json_target, "w", encoding="utf-8") as f:
            json.dump(self.session_data, f, indent=2)

        # Show success message with option to open folder
        summary_msg = (
            f"✓ Complete Targeted Recomputation Successful!\n\n"
            f"Processed: {len(self.image_list)} images\n"
            f"📁 Result Folder: {result_dir.name}\n\n"
            f"Outputs Generated:\n"
            f"• 📊 PPP_PPG_PGA_Statistical_Summary.xlsx (2 Sheets: Detailed & Executive)\n"
            f"• 📄 PPP_PPG_PGA_Statistical_Summary.csv (Long Format)\n"
            f"• 📄 PPP_PPG_PGA_Wide_Summary.csv (Wide Format)\n"
            f"• 🖼️ Fig1_PPGPGA_*.png (0.2 pt Hairline, Step=1 100% Nodes)\n"
            f"• 📋 annotations_session.json (Burned Paths & Foot Mask Polygons)\n\n"
            f"Would you like to open the result folder now?"
        )
        if messagebox.askyesno("Recomputation Complete", summary_msg):
            try:
                if sys.platform == "win32":
                    os.startfile(str(result_dir))
                elif sys.platform == "darwin":
                    subprocess.run(["open", str(result_dir)], check=False)
                else:
                    subprocess.run(["xdg-open", str(result_dir)], check=False)
            except Exception as e:
                print(f"Could not open folder automatically: {e}")

    # ──────── U-NET DATASET EXPORTER ────────
    def export_unet_dataset(self):
        """
        Exports pairs of normalized thermal images and full-resolution binary masks
        ready for PyTorch / TensorFlow U-Net training.
        """
        if not self.image_list:
            messagebox.showwarning("No Images", "Please load a session JSON or image folder first.")
            return

        out_dir = filedialog.askdirectory(title="Select Folder to Export U-Net Dataset")
        if not out_dir:
            return

        out_path = Path(out_dir)
        img_out = out_path / "images"
        mask_out = out_path / "masks"
        img_out.mkdir(parents=True, exist_ok=True)
        mask_out.mkdir(parents=True, exist_ok=True)

        exported_count = 0
        bg_val = float(self.scale_bg_thresh.get())

        for img_p in self.image_list:
            stem = Path(img_p).stem
            try:
                temp = load_temperature(img_p)
                H, W = temp.shape

                # 1. Normalized 8-bit image (0-255)
                t_min, t_max = np.percentile(temp, 1), np.percentile(temp, 99)
                if t_max > t_min:
                    norm_img = np.clip((temp - t_min) / (t_max - t_min) * 255.0, 0, 255).astype(np.uint8)
                else:
                    norm_img = np.zeros_like(temp, dtype=np.uint8)
                cv2.imwrite(str(img_out / f"{stem}.png"), norm_img)

                # 2. Binary ground-truth mask (0 and 255)
                full_mask = np.zeros((H, W), dtype=np.uint8)

                if self.image_path == img_p and self.mask_crop_u8 is not None:
                    full_mask[self.ymin:self.ymin+self.ch, self.offset_x+self.xmin:self.offset_x+self.xmin+self.cw] = (self.mask_crop_u8 > 0) * 255
                elif self.session_data and "foot_masks" in self.session_data and img_p in self.session_data["foot_masks"]:
                    polys = self.session_data["foot_masks"][img_p]
                    for poly in polys:
                        pts = np.array(poly, dtype=np.int32).reshape((-1, 1, 2))
                        cv2.fillPoly(full_mask, [pts], 255)
                else:
                    foot_cand = (temp > bg_val).astype(np.uint8)
                    num_l, lbls, stats, _ = cv2.connectedComponentsWithStats(foot_cand)
                    if num_l > 1:
                        lg = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
                        full_mask = ((lbls == lg) * 255).astype(np.uint8)
                    else:
                        full_mask = foot_cand * 255

                cv2.imwrite(str(mask_out / f"{stem}.png"), full_mask)
                exported_count += 1
            except Exception as e:
                print(f"Error exporting U-Net pair for {stem}: {e}")

        messagebox.showinfo("U-Net Dataset Export Complete",
                            f"✓ Successfully exported {exported_count} paired images & binary masks!\n\n"
                            f"📁 Images: {img_out}\n"
                            f"📁 Masks: {mask_out}\n\n"
                            f"Target: 0 (background) & 255 (plantar foot)\nReady for PyTorch / MONAI U-Net training.")

    # ──────── PUBLICATION EXPORT ────────
    def export_highres_png(self):
        if self.foot_crop is None:
            return
        default_name = f"Fig1_PPGPGA_{Path(self.image_path).stem if self.image_path else 'export'}.png"
        out_file = filedialog.asksaveasfilename(defaultextension=".png", initialfile=default_name,
                                                filetypes=[("PNG Image", "*.png")])
        if out_file:
            self.fig.savefig(out_file, dpi=300, bbox_inches="tight", facecolor="white")
            messagebox.showinfo("Export Successful", f"Saved publication Figure 1 at 300 DPI:\n{out_file}")

    def export_pdf(self):
        if self.foot_crop is None:
            return
        default_name = f"Fig1_PPGPGA_{Path(self.image_path).stem if self.image_path else 'export'}.pdf"
        out_file = filedialog.asksaveasfilename(defaultextension=".pdf", initialfile=default_name,
                                                filetypes=[("PDF Document", "*.pdf")])
        if out_file:
            self.fig.savefig(out_file, bbox_inches="tight", facecolor="white")
            messagebox.showinfo("Export Successful", f"Saved vector PDF:\n{out_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ThermalSight PPG/PGA Interactive Workbench")
    parser.add_argument("--session", type=str, default=None, help="Path to annotations_session.json")
    parser.add_argument("--image", type=str, default=None, help="Path to active thermal image")
    args, _ = parser.parse_known_args()

    root = tk.Tk()
    app = PPGWorkbenchApp(root, session_arg=args.session, image_arg=args.image)
    root.mainloop()
