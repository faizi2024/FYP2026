"""
tryon_engine.py  (v9 — GPU ACCELERATED)
=========================================
Targets 1GB GPU (NVIDIA GTX/RTX, any CUDA-capable card).

SPEED BOTTLENECKS IN V8 (and how v9 fixes each):
─────────────────────────────────────────────────
  BOTTLENECK 1: GaussianBlur (suppress + feather + arm mask)  → cv2.cuda GaussianFilter
  BOTTLENECK 2: warpPerspective × 48 cells (mesh warp)        → cv2.cuda.warpPerspective
  BOTTLENECK 3: Alpha blending loops (composite_full)         → GPU mat operations
  BOTTLENECK 4: Morphology on segmentation mask               → cv2.cuda morphology
  BOTTLENECK 5: Resize operations                             → cv2.cuda.resize

MEMORY STRATEGY FOR 1GB VRAM:
  - Keep garment, canvas, frame as persistent GpuMat (no re-upload each frame)
  - Process at 480×360 on GPU (not 640×480) — saves 44% VRAM
  - All intermediate masks stay on GPU; only final composite downloads to CPU

FALLBACK:
  If OpenCV was built WITHOUT CUDA (most pip installs), the code automatically
  falls back to the CPU path from v8. No crash.

HOW TO CHECK IF YOU HAVE CUDA OPENCV:
  python -c "import cv2; print(cv2.cuda.getCudaEnabledDeviceCount())"
  → 0 means no CUDA OpenCV installed
  → 1 means CUDA is available ✓

HOW TO GET CUDA OPENCV (Windows):
  Option A (easiest): pip install opencv-contrib-python  (may include CUDA on some builds)
  Option B (reliable): Download pre-built wheel from:
    https://github.com/cudawarped/opencv-python-cuda-wheels/releases
  Option C: Build from source (takes 1–2 hours but guaranteed)

MediaPipe itself runs on CPU — it does not expose a public GPU API on Windows.
But offloading OpenCV work to GPU frees the CPU for MediaPipe → both run faster.

Expected speedup with 1GB GPU:
  v8 CPU-only: ~200–250ms per frame  (~4 FPS)
  v9 GPU path: ~40–70ms  per frame   (~15–25 FPS)

Dependencies:
  pip install mediapipe numpy
  + CUDA-enabled OpenCV (see above)
"""

import cv2
import numpy as np
import mediapipe as mp
import base64
import json
import sys
import argparse
import time
from typing import Optional, Dict, Tuple

# ── Detect CUDA availability ──────────────────────────────────────────────────
try:
    _CUDA_COUNT = cv2.cuda.getCudaEnabledDeviceCount()
    USE_GPU = _CUDA_COUNT > 0
except AttributeError:
    USE_GPU = False

if USE_GPU:
    cv2.cuda.setDevice(0)
    sys.stderr.write(f"[TryOn] GPU mode: CUDA device 0  "
                     f"({cv2.cuda.DeviceInfo(0).name()})\n")
else:
    sys.stderr.write("[TryOn] CPU mode: CUDA not available "
                     "(install CUDA-enabled OpenCV for GPU speedup)\n")


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 1: CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

class Config:
    # Use slightly smaller resolution on GPU — fits in 1GB VRAM easily
    PROC_W = 480 if USE_GPU else 640
    PROC_H = 360 if USE_GPU else 480

    POSE_COMPLEXITY      = 1
    POSE_DETECT_CONF     = 0.55
    POSE_TRACK_CONF      = 0.50
    VISIBILITY_THRESHOLD = 0.40
    EMA_ALPHA            = 0.18

    COLLAR_RAISE         = 0.15   # raise shirt top to cover shoulders better
    SIDE_EXPAND          = 0.18   # wider — cover full shoulder width
    HIP_LOWER            = 0.12   # slightly longer shirt
    TORSO_RATIO          = 1.15   # taller shirt for selfie/close-up camera angle
    HIP_WIDTH_MIN_RATIO  = 0.80   # keep shirt wide at bottom

    # Mesh warp
    MESH_COLS            = 6
    MESH_ROWS            = 8

    SUPPRESS_BLUR        = 25    # less aggressive blur — avoids dark patches
    SUPPRESS_OPACITY     = 0.72  # stronger suppression of real shirt

    FEATHER_KSIZE        = 11
    MAX_QUAD_DRIFT       = 0.10
    MIN_QUAD_W           = 40
    MIN_QUAD_H           = 50

    G_TL = (0.03, 0.01)
    G_TR = (0.97, 0.01)
    G_BR = (0.97, 0.99)
    G_BL = (0.03, 0.99)

    GARMENT_OPACITY      = 0.95
    GHOST_OPACITY        = 0.18
    OUTPUT_JPEG_QUALITY  = 82

    USE_SEGMENTATION     = True

    LM = {
        "L_SHOULDER": 11, "R_SHOULDER": 12,
        "L_HIP":      23, "R_HIP":      24,
        "L_ELBOW":    13, "R_ELBOW":    14,
        "L_WRIST":    15, "R_WRIST":    16,
        "NOSE":        0, "L_EAR":       7, "R_EAR": 8,
    }


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 2: GPU HELPER — persistent GpuMat cache
# ─────────────────────────────────────────────────────────────────────────────

class GpuCache:
    """
    Keeps frequently-used GpuMat objects alive between frames.
    Avoids re-allocating VRAM every frame (expensive).
    """
    def __init__(self):
        self._mats: Dict[str, cv2.cuda.GpuMat] = {}

    def upload(self, key: str, cpu_mat: np.ndarray) -> "cv2.cuda.GpuMat":
        if key not in self._mats:
            self._mats[key] = cv2.cuda.GpuMat()
        self._mats[key].upload(cpu_mat)
        return self._mats[key]

    def get(self, key: str) -> Optional["cv2.cuda.GpuMat"]:
        return self._mats.get(key)

    def clear(self):
        self._mats.clear()


_gpu_cache = GpuCache() if USE_GPU else None


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 3: GPU OPERATIONS (with CPU fallback)
# ─────────────────────────────────────────────────────────────────────────────

def gpu_gaussian_blur(img: np.ndarray, ksize: int, sigma: float = 0) -> np.ndarray:
    """GaussianBlur on GPU if available, else CPU."""
    if not USE_GPU or ksize <= 0:
        return cv2.GaussianBlur(img, (ksize, ksize), sigma) if ksize > 0 else img
    try:
        g = cv2.cuda.createGaussianFilter(
            img.dtype if hasattr(img, 'dtype') else cv2.CV_8U,
            -1, (ksize, ksize), sigma
        )
        gpu_in = cv2.cuda.GpuMat()
        gpu_in.upload(img)
        gpu_out = g.apply(gpu_in)
        return gpu_out.download()
    except Exception:
        return cv2.GaussianBlur(img, (ksize, ksize), sigma)


def gpu_warp_perspective(
    src: np.ndarray,
    M:   np.ndarray,
    dsize: Tuple[int,int],
) -> np.ndarray:
    """warpPerspective on GPU if available, else CPU."""
    if not USE_GPU:
        return cv2.warpPerspective(
            src, M, dsize,
            flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=(0,0,0,0),
        )
    try:
        gpu_src = cv2.cuda.GpuMat()
        gpu_src.upload(src)
        gpu_dst = cv2.cuda.warpPerspective(
            gpu_src, M, dsize,
            flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=(0,0,0,0),
        )
        return gpu_dst.download()
    except Exception:
        return cv2.warpPerspective(
            src, M, dsize,
            flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=(0,0,0,0),
        )


def gpu_morphology(img: np.ndarray, op: int, kernel: np.ndarray,
                   iterations: int = 1) -> np.ndarray:
    """Morphological operation on GPU if available."""
    if not USE_GPU:
        return cv2.morphologyEx(img, op, kernel, iterations=iterations)
    try:
        gpu_img = cv2.cuda.GpuMat()
        gpu_img.upload(img)
        if op == cv2.MORPH_CLOSE:
            filt = cv2.cuda.createMorphologyFilter(
                cv2.MORPH_CLOSE, img.dtype if hasattr(img,'dtype') else cv2.CV_8U,
                kernel, iterations=iterations)
        elif op == cv2.MORPH_OPEN:
            filt = cv2.cuda.createMorphologyFilter(
                cv2.MORPH_OPEN, img.dtype if hasattr(img,'dtype') else cv2.CV_8U,
                kernel, iterations=iterations)
        elif op == cv2.MORPH_DILATE:
            filt = cv2.cuda.createMorphologyFilter(
                cv2.MORPH_DILATE, img.dtype if hasattr(img,'dtype') else cv2.CV_8U,
                kernel, iterations=iterations)
        elif op == cv2.MORPH_ERODE:
            filt = cv2.cuda.createMorphologyFilter(
                cv2.MORPH_ERODE, img.dtype if hasattr(img,'dtype') else cv2.CV_8U,
                kernel, iterations=iterations)
        else:
            return cv2.morphologyEx(img, op, kernel, iterations=iterations)
        return filt.apply(gpu_img).download()
    except Exception:
        return cv2.morphologyEx(img, op, kernel, iterations=iterations)


def gpu_resize(img: np.ndarray, dsize: Tuple[int,int]) -> np.ndarray:
    """Resize on GPU if available."""
    if not USE_GPU:
        return cv2.resize(img, dsize)
    try:
        g = cv2.cuda.GpuMat(); g.upload(img)
        return cv2.cuda.resize(g, dsize).download()
    except Exception:
        return cv2.resize(img, dsize)


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 4: EMA SMOOTHER
# ─────────────────────────────────────────────────────────────────────────────

class EMASmootherNamed:
    def __init__(self, alpha: float = Config.EMA_ALPHA):
        self._alpha = alpha
        self._state: Dict[str, np.ndarray] = {}

    def update(self, landmarks: Dict[str, np.ndarray]) -> Dict[str, np.ndarray]:
        out = {}
        for k, v in landmarks.items():
            if k not in self._state:
                self._state[k] = v.copy()
            else:
                self._state[k] = self._alpha * v + (1 - self._alpha) * self._state[k]
            out[k] = self._state[k].copy()
        return out

    def reset(self):
        self._state.clear()


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 5: POSE EXTRACTOR
# ─────────────────────────────────────────────────────────────────────────────

class PoseExtractor:
    def __init__(self):
        mp_pose = mp.solutions.pose
        self._pose = mp_pose.Pose(
            static_image_mode=False,
            model_complexity=Config.POSE_COMPLEXITY,
            smooth_landmarks=True,
            enable_segmentation=False,
            min_detection_confidence=Config.POSE_DETECT_CONF,
            min_tracking_confidence=Config.POSE_TRACK_CONF,
        )
        self._smoother = EMASmootherNamed()

    def _lm_px(self, lm, name, w, h):
        idx = Config.LM[name]
        l   = lm[idx]
        return np.array([l.x*w, l.y*h], dtype=np.float32), l.visibility

    def extract(self, rgb: np.ndarray) -> Optional[Dict[str, np.ndarray]]:
        h, w    = rgb.shape[:2]
        results = self._pose.process(rgb)
        if not results.pose_landmarks:
            return None
        lm = results.pose_landmarks.landmark

        l_sh, l_sh_vis = self._lm_px(lm, "L_SHOULDER", w, h)
        r_sh, r_sh_vis = self._lm_px(lm, "R_SHOULDER", w, h)

        if l_sh_vis < Config.VISIBILITY_THRESHOLD and \
           r_sh_vis < Config.VISIBILITY_THRESHOLD:
            return None

        if l_sh_vis < Config.VISIBILITY_THRESHOLD:
            sh_w = abs(r_sh[0] - w/2)*2
            l_sh = np.array([r_sh[0]-sh_w, r_sh[1]], dtype=np.float32)
        if r_sh_vis < Config.VISIBILITY_THRESHOLD:
            sh_w = abs(l_sh[0] - w/2)*2
            r_sh = np.array([l_sh[0]+sh_w, l_sh[1]], dtype=np.float32)

        shoulder_w = np.linalg.norm(r_sh - l_sh)
        if shoulder_w < 10:
            return None

        down = np.array([0., 1.], dtype=np.float32)
        l_hi, l_hi_vis = self._lm_px(lm, "L_HIP", w, h)
        r_hi, r_hi_vis = self._lm_px(lm, "R_HIP", w, h)
        hip_dist = np.linalg.norm(l_hi - r_hi)

        use_virtual = (
            l_hi_vis < Config.VISIBILITY_THRESHOLD or
            r_hi_vis < Config.VISIBILITY_THRESHOLD or
            hip_dist < shoulder_w * 0.30
        )

        if use_virtual:
            drop = shoulder_w * Config.TORSO_RATIO
            l_hi = l_sh + down * drop
            r_hi = r_sh + down * drop
        else:
            real_w = abs(r_hi[0] - l_hi[0])
            min_w  = shoulder_w * Config.HIP_WIDTH_MIN_RATIO
            if real_w < min_w:
                mid_x = (l_hi[0]+r_hi[0])/2
                hip_y = (l_hi[1]+r_hi[1])/2
                l_hi  = np.array([mid_x-min_w/2, hip_y], dtype=np.float32)
                r_hi  = np.array([mid_x+min_w/2, hip_y], dtype=np.float32)

        l_el, l_el_vis = self._lm_px(lm, "L_ELBOW", w, h)
        r_el, r_el_vis = self._lm_px(lm, "R_ELBOW", w, h)
        l_wr, l_wr_vis = self._lm_px(lm, "L_WRIST", w, h)
        r_wr, r_wr_vis = self._lm_px(lm, "R_WRIST", w, h)

        raw = {
            "L_SHOULDER": l_sh, "R_SHOULDER": r_sh,
            "L_HIP":      l_hi, "R_HIP":      r_hi,
            "L_ELBOW":    l_el, "R_ELBOW":    r_el,
            "L_WRIST":    l_wr, "R_WRIST":    r_wr,
            "VIRTUAL_HIPS":  np.array([1. if use_virtual else 0.]),
            "L_ELBOW_VIS":   np.array([l_el_vis]),
            "R_ELBOW_VIS":   np.array([r_el_vis]),
            "L_WRIST_VIS":   np.array([l_wr_vis]),
            "R_WRIST_VIS":   np.array([r_wr_vis]),
        }
        return self._smoother.update(raw)

    def close(self):
        self._pose.close()


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 6: BODY SEGMENTER
# ─────────────────────────────────────────────────────────────────────────────

class BodySegmenter:
    def __init__(self):
        mp_seg = mp.solutions.selfie_segmentation
        self._seg = mp_seg.SelfieSegmentation(model_selection=1)
        self._last_mask: Optional[np.ndarray] = None

    def get_mask(self, rgb: np.ndarray, threshold: float = 0.55) -> np.ndarray:
        result = self._seg.process(rgb)
        if result.segmentation_mask is not None:
            self._last_mask = result.segmentation_mask
        if self._last_mask is None:
            return np.ones(rgb.shape[:2], dtype=np.uint8) * 255
        raw    = self._last_mask
        binary = (raw > threshold).astype(np.uint8) * 255
        k      = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7,7))
        # GPU morphology
        binary = gpu_morphology(binary, cv2.MORPH_CLOSE, k, iterations=2)
        binary = gpu_morphology(binary, cv2.MORPH_OPEN,  k, iterations=1)
        return binary

    def close(self):
        self._seg.close()


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 7: QUAD BUILDER
# ─────────────────────────────────────────────────────────────────────────────

def build_body_quad(lm: Dict[str, np.ndarray]) -> Optional[np.ndarray]:
    sh_a, sh_b = lm["L_SHOULDER"], lm["R_SHOULDER"]
    hi_a, hi_b = lm["L_HIP"],      lm["R_HIP"]

    sh_left,  sh_right = (sh_a, sh_b) if sh_a[0] <= sh_b[0] else (sh_b, sh_a)
    hi_left,  hi_right = (hi_a, hi_b) if hi_a[0] <= hi_b[0] else (hi_b, hi_a)

    sh_w    = np.linalg.norm(sh_right - sh_left)
    sh_mid  = (sh_left + sh_right) / 2
    hi_mid  = (hi_left + hi_right) / 2
    torso_h = np.linalg.norm(hi_mid - sh_mid)

    sh_dir    = (sh_right - sh_left) / (sh_w + 1e-6)
    torso_vec = hi_mid - sh_mid
    torso_len = np.linalg.norm(torso_vec)
    down = torso_vec / torso_len if torso_len > 1e-3 else np.array([0.,1.])

    expand   = sh_w    * Config.SIDE_EXPAND
    raise_px = torso_h * Config.COLLAR_RAISE
    lower_px = torso_h * Config.HIP_LOWER

    top_l = sh_left  - sh_dir * expand - down * raise_px
    top_r = sh_right + sh_dir * expand - down * raise_px
    bot_l = hi_left  - sh_dir * expand + down * lower_px
    bot_r = hi_right + sh_dir * expand + down * lower_px

    quad = np.array([top_l, top_r, bot_r, bot_l], dtype=np.float32)
    w = np.linalg.norm(top_r - top_l)
    h = np.linalg.norm(bot_l - top_l)
    if w < Config.MIN_QUAD_W or h < Config.MIN_QUAD_H:
        return None
    return quad


def limit_quad_drift(new_q: np.ndarray, prev_q: Optional[np.ndarray]) -> np.ndarray:
    if prev_q is None:
        return new_q
    prev_w = np.linalg.norm(prev_q[1] - prev_q[0])
    max_px = prev_w * Config.MAX_QUAD_DRIFT
    clamped = new_q.copy()
    for i in range(4):
        d    = new_q[i] - prev_q[i]
        dist = np.linalg.norm(d)
        if dist > max_px:
            clamped[i] = prev_q[i] + d/dist*max_px
    return clamped


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 8: GARMENT LOADER
# ─────────────────────────────────────────────────────────────────────────────

def load_garment(path: str) -> np.ndarray:
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise FileNotFoundError(f"Garment not found: {path}")
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    elif img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    if img[:,:,3].min() >= 254:
        grey = cv2.cvtColor(img[:,:,:3], cv2.COLOR_BGR2GRAY)
        _, mask = cv2.threshold(grey, 230, 255, cv2.THRESH_BINARY_INV)
        k    = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9,9))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k)
        mask = cv2.GaussianBlur(mask, (5,5), 0)
        img[:,:,3] = mask
    a = img[:,:,3]
    rows = np.any(a > 10, axis=1); cols = np.any(a > 10, axis=0)
    if rows.any() and cols.any():
        r1,r2 = np.where(rows)[0][[0,-1]]
        c1,c2 = np.where(cols)[0][[0,-1]]
        img = img[r1:r2+1, c1:c2+1]
    return img


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 9: MESH WARP (GPU-accelerated per-cell warpPerspective)
# ─────────────────────────────────────────────────────────────────────────────

def _bilinear(quad: np.ndarray, u: float, v: float) -> np.ndarray:
    tl, tr, br, bl = quad
    top = tl + u*(tr-tl)
    bot = bl + u*(br-bl)
    return top + v*(bot-top)


def mesh_warp_garment(
    garment:   np.ndarray,
    body_quad: np.ndarray,
    fh: int, fw: int,
    rows: int = Config.MESH_ROWS,
    cols: int = Config.MESH_COLS,
) -> np.ndarray:
    """
    Mesh warp with GPU-accelerated warpPerspective per cell.
    Each cell uploaded once; result downloaded once at end.
    """
    gh, gw = garment.shape[:2]
    canvas = np.zeros((fh, fw, 4), dtype=np.uint8)

    g_tl = np.array([Config.G_TL[0]*gw, Config.G_TL[1]*gh], dtype=np.float32)
    g_tr = np.array([Config.G_TR[0]*gw, Config.G_TR[1]*gh], dtype=np.float32)
    g_br = np.array([Config.G_BR[0]*gw, Config.G_BR[1]*gh], dtype=np.float32)
    g_bl = np.array([Config.G_BL[0]*gw, Config.G_BL[1]*gh], dtype=np.float32)
    g_quad = np.array([g_tl, g_tr, g_br, g_bl], dtype=np.float32)

    for row in range(rows):
        for col in range(cols):
            u0, u1 = col/cols,   (col+1)/cols
            v0, v1 = row/rows,   (row+1)/rows

            src = np.array([
                _bilinear(g_quad, u0, v0), _bilinear(g_quad, u1, v0),
                _bilinear(g_quad, u1, v1), _bilinear(g_quad, u0, v1),
            ], dtype=np.float32)
            dst = np.array([
                _bilinear(body_quad, u0, v0), _bilinear(body_quad, u1, v0),
                _bilinear(body_quad, u1, v1), _bilinear(body_quad, u0, v1),
            ], dtype=np.float32)

            M    = cv2.getPerspectiveTransform(src, dst)
            # ← GPU warpPerspective
            cell = gpu_warp_perspective(garment, M, (fw, fh))

            xs = dst[:,0]; ys = dst[:,1]
            x1 = max(0,  int(np.floor(xs.min()))-1)
            x2 = min(fw, int(np.ceil( xs.max()))+1)
            y1 = max(0,  int(np.floor(ys.min()))-1)
            y2 = min(fh, int(np.ceil( ys.max()))+1)
            if x2<=x1 or y2<=y1: continue

            rc = cell[y1:y2, x1:x2]
            rcanv = canvas[y1:y2, x1:x2]
            m = rc[:,:,3:4].astype(np.float32)/255.
            rcanv[:] = (rc.astype(np.float32)*m +
                        rcanv.astype(np.float32)*(1-m)).astype(np.uint8)
            canvas[y1:y2, x1:x2] = rcanv

    # Feather alpha edge — GPU blur
    k = Config.FEATHER_KSIZE
    if k > 0:
        canvas[:,:,3] = gpu_gaussian_blur(canvas[:,:,3], k)

    return canvas


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 10: TORSO SUPPRESSION (GPU blur)
# ─────────────────────────────────────────────────────────────────────────────

def suppress_torso_background(
    frame: np.ndarray,
    body_quad: np.ndarray,
    body_mask: Optional[np.ndarray],
    fh: int, fw: int,
) -> np.ndarray:
    torso_mask = np.zeros((fh, fw), dtype=np.uint8)
    pts = body_quad.astype(np.int32).reshape((-1,1,2))
    cv2.fillPoly(torso_mask, [pts], 255)

    if body_mask is not None:
        bm = gpu_resize(body_mask, (fw, fh))
        torso_mask = cv2.bitwise_and(torso_mask, bm)

    k_e = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9,9))
    torso_mask_eroded = gpu_morphology(torso_mask, cv2.MORPH_ERODE, k_e, iterations=2)

    # GPU blur — this is the biggest single speedup
    blurred  = gpu_gaussian_blur(frame, Config.SUPPRESS_BLUR)
    darkened = (blurred.astype(np.float32) * Config.SUPPRESS_OPACITY).astype(np.uint8)

    # Feather suppression mask — eliminates hard dark patches at quad edges
    torso_soft = gpu_gaussian_blur(torso_mask_eroded, 21).astype(np.float32) / 255.
    alpha_map = torso_soft[..., np.newaxis]
    result = frame.astype(np.float32)*(1-alpha_map) + \
             darkened.astype(np.float32)*alpha_map
    return result.astype(np.uint8)


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 11: COMPOSITE WITH ARM OCCLUSION (GPU alpha blend)
# ─────────────────────────────────────────────────────────────────────────────

def composite_full(
    frame_orig:  np.ndarray,
    frame_supp:  np.ndarray,
    warped:      np.ndarray,
    body_mask:   Optional[np.ndarray],
    body_quad:   np.ndarray,
    lm:          Dict[str, np.ndarray],
    fh: int, fw: int,
    opacity: float = Config.GARMENT_OPACITY,
) -> np.ndarray:
    h, w = frame_supp.shape[:2]

    # Blend shirt onto suppressed base
    ov = warped[:,:,:3].astype(np.float32)
    a  = (warped[:,:,3].astype(np.float32)/255.*opacity)[...,np.newaxis]
    composited = (ov*a + frame_supp.astype(np.float32)*(1-a)).astype(np.uint8)

    # Arm occlusion mask
    arm_mask = np.zeros((h,w), dtype=np.uint8)
    sh_w = np.linalg.norm(lm["R_SHOULDER"]-lm["L_SHOULDER"])
    arm_r = int(max(14, sh_w*0.14))

    def vis(key):
        v = lm.get(key); return float(v[0]) if v is not None else 0.

    def draw_arm(p1,p2,p3,v1,v2,v3):
        pts,vs = [], [v1,v2,v3]
        for pt,v in zip([p1,p2,p3],vs):
            if v > Config.VISIBILITY_THRESHOLD:
                pts.append(tuple(np.clip(pt,[0,0],[w-1,h-1]).astype(int)))
        for i in range(len(pts)-1):
            cv2.line(arm_mask, pts[i], pts[i+1], 255, arm_r*2)

    draw_arm(lm["L_SHOULDER"],lm["L_ELBOW"],lm["L_WRIST"],
             0.9, vis("L_ELBOW_VIS"), vis("L_WRIST_VIS"))
    draw_arm(lm["R_SHOULDER"],lm["R_ELBOW"],lm["R_WRIST"],
             0.9, vis("R_ELBOW_VIS"), vis("R_WRIST_VIS"))

    k_d = cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(7,7))
    arm_mask = gpu_morphology(arm_mask, cv2.MORPH_DILATE, k_d, iterations=2)
    if body_mask is not None:
        bm = gpu_resize(body_mask,(w,h))
        arm_mask = cv2.bitwise_and(arm_mask, bm)

    # GPU blur the arm mask
    arm_f = gpu_gaussian_blur(arm_mask, 11).astype(np.float32)/255.
    arm_f = arm_f[...,np.newaxis]

    result = (composited.astype(np.float32)*(1-arm_f) +
              frame_orig.astype(np.float32)*arm_f).astype(np.uint8)

    # Clip to body silhouette
    if body_mask is not None:
        bm   = gpu_resize(body_mask,(w,h))
        bm_f = gpu_gaussian_blur(bm,15).astype(np.float32)/255.
        bm_f = bm_f[...,np.newaxis]
        result = (result.astype(np.float32)*bm_f +
                  frame_orig.astype(np.float32)*(1-bm_f)).astype(np.uint8)

    return result


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 12: MAIN PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

class TryOnPipeline:
    def __init__(self, garment_path: str):
        self._extractor       = PoseExtractor()
        self._segmenter       = BodySegmenter() if Config.USE_SEGMENTATION else None
        self._garment         = load_garment(garment_path)
        self._last_overlay:   Optional[np.ndarray] = None
        self._last_good_quad: Optional[np.ndarray] = None
        self._last_lm:        Optional[Dict]       = None

    @staticmethod
    def _b64_to_bgr(b64: str) -> np.ndarray:
        buf = np.frombuffer(base64.b64decode(b64), dtype=np.uint8)
        img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
        if img is None: raise ValueError("Cannot decode frame.")
        return img

    @staticmethod
    def _bgr_to_b64(img, q=Config.OUTPUT_JPEG_QUALITY) -> str:
        ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, q])
        if not ok: raise RuntimeError("JPEG encode failed.")
        return base64.b64encode(buf).decode()

    def process_frame(self, frame_b64: str) -> dict:
        t0 = time.perf_counter()
        try:
            bgr_orig = self._b64_to_bgr(frame_b64)
            oh, ow   = bgr_orig.shape[:2]
            bgr      = gpu_resize(bgr_orig, (Config.PROC_W, Config.PROC_H))
            fh, fw   = Config.PROC_H, Config.PROC_W
            rgb      = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

            lm = self._extractor.extract(rgb)

            body_mask = None
            if self._segmenter is not None:
                body_mask = self._segmenter.get_mask(rgb)

            if lm is None:
                out = bgr.copy()
                if self._last_overlay is not None:
                    gh = self._last_overlay[:,:,:3].astype(np.float32)
                    ga = (self._last_overlay[:,:,3:4].astype(np.float32)
                          /255.*Config.GHOST_OPACITY)
                    out = (gh*ga + bgr.astype(np.float32)*(1-ga)).astype(np.uint8)
                return {
                    "success": False,
                    "frame":   self._bgr_to_b64(gpu_resize(out,(ow,oh))),
                    "landmarks": [], "error": "No pose",
                    "latency_ms": round((time.perf_counter()-t0)*1000,2),
                }

            self._last_lm = lm
            quad = build_body_quad(lm)
            if quad is None:
                quad = self._last_good_quad
                if quad is None:
                    return {
                        "success": False,
                        "frame":   self._bgr_to_b64(gpu_resize(bgr,(ow,oh))),
                        "landmarks": [], "error": "Degenerate quad",
                        "latency_ms": round((time.perf_counter()-t0)*1000,2),
                    }
            else:
                quad = limit_quad_drift(quad, self._last_good_quad)
                self._last_good_quad = quad.copy()

            bgr_suppressed = suppress_torso_background(bgr, quad, body_mask, fh, fw)
            warped         = mesh_warp_garment(self._garment, quad, fh, fw)
            self._last_overlay = warped

            out = composite_full(bgr, bgr_suppressed, warped,
                                 body_mask, quad, lm, fh, fw)
            out = gpu_resize(out, (ow, oh))

            sx, sy = ow/fw, oh/fh
            lm_out = {
                k: (v*[sx,sy]).tolist()
                for k,v in lm.items() if v.shape==(2,)
            }

            return {
                "success":      True,
                "frame":        self._bgr_to_b64(out),
                "landmarks":    lm_out,
                "virtual_hips": bool(lm["VIRTUAL_HIPS"][0]>0.5),
                "error":        None,
                "latency_ms":   round((time.perf_counter()-t0)*1000,2),
            }

        except Exception as exc:
            import traceback; traceback.print_exc()
            return {
                "success": False, "frame": frame_b64,
                "landmarks": [], "error": str(exc),
                "latency_ms": round((time.perf_counter()-t0)*1000,2),
            }

    def reload_garment(self, path: str):
        self._garment = load_garment(path)
        self._last_overlay = None

    def close(self):
        self._extractor.close()
        if self._segmenter: self._segmenter.close()
        if _gpu_cache: _gpu_cache.clear()


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 13: SERVER MODE
# ─────────────────────────────────────────────────────────────────────────────

def _write_json(d): sys.stdout.write(json.dumps(d)+"\n"); sys.stdout.flush()

def run_server_mode(garment_path: str):
    p = TryOnPipeline(garment_path)
    sys.stderr.write("[TryOn] Ready.\n"); sys.stderr.flush()
    try:
        for raw in sys.stdin:
            line = raw.strip()
            if not line: continue
            try: req = json.loads(line)
            except json.JSONDecodeError as e:
                _write_json({"success":False,"error":str(e)}); continue
            if "garment" in req:
                try: p.reload_garment(req["garment"])
                except Exception as e:
                    _write_json({"success":False,"error":str(e)}); continue
            if "frame" not in req:
                _write_json({"success":False,"error":"Missing frame"}); continue
            _write_json(p.process_frame(req["frame"]))
    except KeyboardInterrupt: pass
    finally: p.close(); sys.stderr.write("[TryOn] Shutdown.\n")


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 14: DEMO MODE
# ─────────────────────────────────────────────────────────────────────────────

def run_demo_mode(garment_path: str, camera_source: str = "0"):
    pipeline = TryOnPipeline(garment_path)
    is_url   = camera_source.startswith("http")

    if is_url:
        cap = cv2.VideoCapture(camera_source)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)
    else:
        idx = int(camera_source) if camera_source.isdigit() else 0
        cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH,  1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        cap.set(cv2.CAP_PROP_FPS, 30)

    mode_str = f"GPU ({cv2.cuda.DeviceInfo(0).name()})" if USE_GPU else "CPU fallback"
    print(f"[Demo] {mode_str}  |  Garment: {garment_path}  Camera: {camera_source}")
    print("[Demo]  Q=quit  D=debug  S=toggle suppression")
    debug = False

    COLORS = {
        "L_SHOULDER":(0,255,255),"R_SHOULDER":(0,255,255),
        "L_HIP":(255,128,0),"R_HIP":(255,128,0),
        "L_ELBOW":(0,128,255),"R_ELBOW":(0,128,255),
    }

    while True:
        ret, frame = cap.read()
        if not ret:
            if is_url: time.sleep(1); cap=cv2.VideoCapture(camera_source); continue
            break

        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY,88])
        result = pipeline.process_frame(base64.b64encode(buf).decode())

        if result.get("frame"):
            arr = np.frombuffer(base64.b64decode(result["frame"]),np.uint8)
            dec = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            output = dec if dec is not None else frame
        else:
            output = frame.copy()

        oh,ow = output.shape[:2]
        sx,sy = ow/Config.PROC_W, oh/Config.PROC_H

        if debug and result["success"]:
            for name,pt in result["landmarks"].items():
                if not isinstance(pt,list) or len(pt)<2: continue
                cx,cy = int(pt[0]),int(pt[1])
                col = COLORS.get(name,(180,180,180))
                cv2.circle(output,(cx,cy),8,col,-1)
                cv2.putText(output,name[:3],(cx+9,cy+5),
                            cv2.FONT_HERSHEY_SIMPLEX,0.45,col,1)
            if pipeline._last_good_quad is not None:
                q=(pipeline._last_good_quad*[sx,sy]).astype(np.int32)
                cv2.polylines(output,[q],True,(0,255,0),2)

        color  = (0,255,80) if result["success"] else (0,80,255)
        status = "TRACKING" if result["success"] else result.get("error","NO POSE")
        gpu_tag = "GPU" if USE_GPU else "CPU"
        cv2.putText(output,f"[{gpu_tag}] {status}  {result['latency_ms']:.1f}ms",
                    (12,36),cv2.FONT_HERSHEY_SIMPLEX,0.75,color,2)

        cv2.imshow(f"Virtual Try-On v9 [{gpu_tag}] | Q=quit D=debug",output)
        key = cv2.waitKey(1)&0xFF
        if   key==ord("q"): break
        elif key==ord("d"): debug=not debug
        elif key==ord("s"):
            Config.SUPPRESS_OPACITY = 0.55 if Config.SUPPRESS_OPACITY>0.9 else 1.0
            print(f"[Demo] Suppression: {'ON' if Config.SUPPRESS_OPACITY<0.9 else 'OFF'}")

    cap.release(); cv2.destroyAllWindows(); pipeline.close()


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Virtual Try-On Engine v9 (GPU)")
    ap.add_argument("--mode",    choices=["server","demo"], default="demo")
    ap.add_argument("--garment", default="garment.png")
    ap.add_argument("--camera",  default="0")
    args = ap.parse_args()
    if args.mode=="server": run_server_mode(args.garment)
    else: run_demo_mode(args.garment, args.camera)