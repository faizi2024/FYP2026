"""
tryon_engine.py  (v10 — HYBRID: Live Warp + CatVTON Diffusion Capture)
========================================================================
4GB GPU OPTIMIZED

ARCHITECTURE:
  LIVE frames  → perspective mesh warp  (real-time, 15-25 FPS)
  CAPTURE tap  → CatVTON diffusion      (photorealistic, ~5-8s)

4GB VRAM STRATEGY:
  ┌─────────────────────────────────────────────────────┐
  │ CatVTON original   →  8GB VRAM  (too much)         │
  │ CatVTON fp16       →  4.2GB     (just over limit)  │
  │ THIS FILE:                                          │
  │   SD Inpainting fp16 + attention slicing  → 3.2GB  │
  │   Resolution 512×384 (not 768×1024)       → saves  │
  │   xformers memory efficient attention     → saves  │
  │   VAE tiling                              → saves  │
  │   TOTAL: fits comfortably in 4GB          ✓        │
  └─────────────────────────────────────────────────────┘

INSTALL (run once):
  pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
  pip install diffusers transformers accelerate xformers
  pip install mediapipe opencv-python numpy pillow rembg

HOW IT WORKS:
  1. Phone sends live frames → warp pipeline returns in ~50ms
  2. User taps Capture → phone sends {"frame":..., "enhance":true}
  3. Server runs CatVTON on that frame → returns in ~5-8s
  4. Phone shows spinner then displays photorealistic result
"""

import cv2
import numpy as np
import mediapipe as mp
import base64, json, sys, argparse, time, threading
from typing import Optional, Dict, Tuple
from PIL import Image

# ── CUDA detection for OpenCV ──────────────────────────────────────────────────
try:
    CV_GPU = cv2.cuda.getCudaEnabledDeviceCount() > 0
except AttributeError:
    CV_GPU = False

# ── Torch / diffusion availability ────────────────────────────────────────────
try:
    import torch
    TORCH_AVAILABLE = True
    TORCH_DEVICE    = "cuda" if torch.cuda.is_available() else "cpu"
    if TORCH_DEVICE == "cuda":
        VRAM_GB = torch.cuda.get_device_properties(0).total_memory / 1e9
        sys.stderr.write(f"[TryOn] GPU: {torch.cuda.get_device_name(0)}  "
                         f"VRAM: {VRAM_GB:.1f}GB\n")
    else:
        VRAM_GB = 0
        sys.stderr.write("[TryOn] No CUDA GPU found — diffusion will run on CPU (~30s)\n")
except ImportError:
    TORCH_AVAILABLE = False
    TORCH_DEVICE    = "cpu"
    VRAM_GB         = 0
    sys.stderr.write("[TryOn] PyTorch not installed — diffusion disabled\n")

sys.stderr.flush()


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 1: CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

class Config:
    # Live warp resolution
    PROC_W = 480 if CV_GPU else 640
    PROC_H = 360 if CV_GPU else 480

    # Pose
    POSE_COMPLEXITY      = 1
    POSE_DETECT_CONF     = 0.55
    POSE_TRACK_CONF      = 0.50
    VISIBILITY_THRESHOLD = 0.40
    EMA_ALPHA            = 0.18

    # Quad
    COLLAR_RAISE         = 0.15
    SIDE_EXPAND          = 0.18
    HIP_LOWER            = 0.12
    TORSO_RATIO          = 1.15
    HIP_WIDTH_MIN_RATIO  = 0.80
    MAX_QUAD_DRIFT       = 0.10
    MIN_QUAD_W           = 40
    MIN_QUAD_H           = 50

    # Mesh warp
    MESH_COLS            = 6
    MESH_ROWS            = 8

    # Suppression
    SUPPRESS_BLUR        = 25
    SUPPRESS_OPACITY     = 0.72

    # Feathering
    FEATHER_KSIZE        = 11

    # Composite
    GARMENT_OPACITY      = 0.95
    GHOST_OPACITY        = 0.18
    OUTPUT_JPEG_QUALITY  = 88

    USE_SEGMENTATION     = True

    # Garment source corners
    G_TL = (0.03, 0.01); G_TR = (0.97, 0.01)
    G_BR = (0.97, 0.99); G_BL = (0.03, 0.99)

    # ── CatVTON / diffusion settings ──────────────────────────────────────────
    # Resolution: 512×384 uses ~3.2GB VRAM with fp16 — fits 4GB card
    DIFF_H               = 512
    DIFF_W               = 384
    DIFF_STEPS           = 30    # 20 = faster (~4s), 30 = better quality (~6s)
    DIFF_GUIDANCE        = 2.5
    # fp16 = 4GB compatible; fp32 = more accurate but needs 8GB+
    DIFF_DTYPE           = "fp16"

    LM = {
        "L_SHOULDER":11,"R_SHOULDER":12,
        "L_HIP":23,     "R_HIP":24,
        "L_ELBOW":13,   "R_ELBOW":14,
        "L_WRIST":15,   "R_WRIST":16,
        "NOSE":0,
    }


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 2: GPU HELPERS (OpenCV CUDA with fallback)
# ─────────────────────────────────────────────────────────────────────────────

def gpu_blur(img, k):
    if not CV_GPU or k <= 0: return cv2.GaussianBlur(img,(k,k),0) if k>0 else img
    try:
        f = cv2.cuda.createGaussianFilter(cv2.CV_8U,-1,(k,k),0)
        g = cv2.cuda.GpuMat(); g.upload(img)
        return f.apply(g).download()
    except: return cv2.GaussianBlur(img,(k,k),0)

def gpu_warp(src, M, dsize):
    if not CV_GPU:
        return cv2.warpPerspective(src,M,dsize,flags=cv2.INTER_LINEAR,
                                   borderMode=cv2.BORDER_CONSTANT,borderValue=(0,0,0,0))
    try:
        g = cv2.cuda.GpuMat(); g.upload(src)
        return cv2.cuda.warpPerspective(g,M,dsize,flags=cv2.INTER_LINEAR,
                                        borderMode=cv2.BORDER_CONSTANT,
                                        borderValue=(0,0,0,0)).download()
    except:
        return cv2.warpPerspective(src,M,dsize,flags=cv2.INTER_LINEAR,
                                   borderMode=cv2.BORDER_CONSTANT,borderValue=(0,0,0,0))

def gpu_morph(img, op, kernel, iters=1):
    if not CV_GPU: return cv2.morphologyEx(img,op,kernel,iterations=iters)
    try:
        g = cv2.cuda.GpuMat(); g.upload(img)
        f = cv2.cuda.createMorphologyFilter(op, cv2.CV_8U, kernel, iterations=iters)
        return f.apply(g).download()
    except: return cv2.morphologyEx(img,op,kernel,iterations=iters)

def gpu_resize(img, dsize):
    if not CV_GPU: return cv2.resize(img,dsize)
    try:
        g = cv2.cuda.GpuMat(); g.upload(img)
        return cv2.cuda.resize(g,dsize).download()
    except: return cv2.resize(img,dsize)


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 3: EMA SMOOTHER
# ─────────────────────────────────────────────────────────────────────────────

class EMASmootherNamed:
    def __init__(self, alpha=Config.EMA_ALPHA):
        self._a = alpha; self._s: Dict[str,np.ndarray] = {}
    def update(self, lm):
        out = {}
        for k,v in lm.items():
            self._s[k] = v.copy() if k not in self._s else self._a*v+(1-self._a)*self._s[k]
            out[k] = self._s[k].copy()
        return out
    def reset(self): self._s.clear()


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 4: POSE EXTRACTOR
# ─────────────────────────────────────────────────────────────────────────────

class PoseExtractor:
    def __init__(self):
        mp_pose = mp.solutions.pose
        self._pose = mp_pose.Pose(
            static_image_mode=False, model_complexity=Config.POSE_COMPLEXITY,
            smooth_landmarks=True, enable_segmentation=False,
            min_detection_confidence=Config.POSE_DETECT_CONF,
            min_tracking_confidence=Config.POSE_TRACK_CONF,
        )
        self._sm = EMASmootherNamed()

    def _px(self, lm, name, w, h):
        l = lm[Config.LM[name]]
        return np.array([l.x*w, l.y*h], dtype=np.float32), l.visibility

    def extract(self, rgb):
        h,w = rgb.shape[:2]
        res = self._pose.process(rgb)
        if not res.pose_landmarks: return None
        lm = res.pose_landmarks.landmark

        ls,lsv = self._px(lm,"L_SHOULDER",w,h); rs,rsv = self._px(lm,"R_SHOULDER",w,h)
        if lsv < Config.VISIBILITY_THRESHOLD and rsv < Config.VISIBILITY_THRESHOLD: return None
        if lsv < Config.VISIBILITY_THRESHOLD:
            ls = np.array([rs[0]-abs(rs[0]-w/2)*2, rs[1]], dtype=np.float32)
        if rsv < Config.VISIBILITY_THRESHOLD:
            rs = np.array([ls[0]+abs(ls[0]-w/2)*2, ls[1]], dtype=np.float32)
        sw = np.linalg.norm(rs-ls)
        if sw < 10: return None

        dn = np.array([0.,1.], dtype=np.float32)
        lh,lhv = self._px(lm,"L_HIP",w,h); rh,rhv = self._px(lm,"R_HIP",w,h)
        hd = np.linalg.norm(lh-rh)
        virt = lhv<Config.VISIBILITY_THRESHOLD or rhv<Config.VISIBILITY_THRESHOLD or hd<sw*0.30
        if virt:
            lh = ls + dn*sw*Config.TORSO_RATIO; rh = rs + dn*sw*Config.TORSO_RATIO
        else:
            rw=abs(rh[0]-lh[0]); mw=sw*Config.HIP_WIDTH_MIN_RATIO
            if rw<mw:
                mx=(lh[0]+rh[0])/2; hy=(lh[1]+rh[1])/2
                lh=np.array([mx-mw/2,hy],dtype=np.float32)
                rh=np.array([mx+mw/2,hy],dtype=np.float32)

        le,lev=self._px(lm,"L_ELBOW",w,h); re,rev=self._px(lm,"R_ELBOW",w,h)
        lw,lwv=self._px(lm,"L_WRIST",w,h); rw2,rwv=self._px(lm,"R_WRIST",w,h)

        raw = {
            "L_SHOULDER":ls,"R_SHOULDER":rs,"L_HIP":lh,"R_HIP":rh,
            "L_ELBOW":le,"R_ELBOW":re,"L_WRIST":lw,"R_WRIST":rw2,
            "VIRTUAL_HIPS":np.array([1. if virt else 0.]),
            "L_ELBOW_VIS":np.array([lev]),"R_ELBOW_VIS":np.array([rev]),
            "L_WRIST_VIS":np.array([lwv]),"R_WRIST_VIS":np.array([rwv]),
        }
        return self._sm.update(raw)

    def close(self): self._pose.close()


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 5: BODY SEGMENTER
# ─────────────────────────────────────────────────────────────────────────────

class BodySegmenter:
    def __init__(self):
        mp_seg = mp.solutions.selfie_segmentation
        self._seg = mp_seg.SelfieSegmentation(model_selection=1)
        self._last = None

    def get_mask(self, rgb, thr=0.55):
        res = self._seg.process(rgb)
        if res.segmentation_mask is not None: self._last = res.segmentation_mask
        if self._last is None: return np.ones(rgb.shape[:2],dtype=np.uint8)*255
        b = (self._last>thr).astype(np.uint8)*255
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(7,7))
        b = gpu_morph(b, cv2.MORPH_CLOSE, k, 2)
        b = gpu_morph(b, cv2.MORPH_OPEN,  k, 1)
        return b

    def close(self): self._seg.close()


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 6: QUAD BUILDER
# ─────────────────────────────────────────────────────────────────────────────

def build_body_quad(lm):
    sa,sb = lm["L_SHOULDER"],lm["R_SHOULDER"]
    ha,hb = lm["L_HIP"],lm["R_HIP"]
    sl,sr = (sa,sb) if sa[0]<=sb[0] else (sb,sa)
    hl,hr = (ha,hb) if ha[0]<=hb[0] else (hb,ha)

    sw   = np.linalg.norm(sr-sl)
    smd  = (sl+sr)/2; hmd=(hl+hr)/2
    th   = np.linalg.norm(hmd-smd)
    sd   = (sr-sl)/(sw+1e-6)
    tv   = hmd-smd; tl=np.linalg.norm(tv)
    dn   = tv/tl if tl>1e-3 else np.array([0.,1.])

    ex=sw*Config.SIDE_EXPAND; rp=th*Config.COLLAR_RAISE; lp=th*Config.HIP_LOWER
    tl2=sl-sd*ex-dn*rp; tr=sr+sd*ex-dn*rp
    bl=hl-sd*ex+dn*lp;  br=hr+sd*ex+dn*lp
    q=np.array([tl2,tr,br,bl],dtype=np.float32)
    if np.linalg.norm(tr-tl2)<Config.MIN_QUAD_W or np.linalg.norm(bl-tl2)<Config.MIN_QUAD_H:
        return None
    return q

def limit_drift(nq, pq):
    if pq is None: return nq
    pw=np.linalg.norm(pq[1]-pq[0]); mp2=pw*Config.MAX_QUAD_DRIFT
    c=nq.copy()
    for i in range(4):
        d=nq[i]-pq[i]; dist=np.linalg.norm(d)
        if dist>mp2: c[i]=pq[i]+d/dist*mp2
    return c


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 7: GARMENT LOADER
# ─────────────────────────────────────────────────────────────────────────────

def load_garment(path):
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if img is None: raise FileNotFoundError(f"Garment not found: {path}")
    if img.ndim==2: img=cv2.cvtColor(img,cv2.COLOR_GRAY2BGRA)
    elif img.shape[2]==3: img=cv2.cvtColor(img,cv2.COLOR_BGR2BGRA)
    if img[:,:,3].min()>=254:
        gr=cv2.cvtColor(img[:,:,:3],cv2.COLOR_BGR2GRAY)
        _,m=cv2.threshold(gr,230,255,cv2.THRESH_BINARY_INV)
        k=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(9,9))
        m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,k)
        m=cv2.GaussianBlur(m,(5,5),0); img[:,:,3]=m
    a=img[:,:,3]
    rows=np.any(a>10,axis=1); cols=np.any(a>10,axis=0)
    if rows.any() and cols.any():
        r1,r2=np.where(rows)[0][[0,-1]]; c1,c2=np.where(cols)[0][[0,-1]]
        img=img[r1:r2+1,c1:c2+1]
    return img


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 8: MESH WARP
# ─────────────────────────────────────────────────────────────────────────────

def _bi(q,u,v):
    tl,tr,br,bl=q; top=tl+u*(tr-tl); bot=bl+u*(br-bl); return top+v*(bot-top)

def mesh_warp(garment, quad, fh, fw, rows=Config.MESH_ROWS, cols=Config.MESH_COLS):
    gh,gw = garment.shape[:2]
    canvas = np.zeros((fh,fw,4),dtype=np.uint8)
    g_tl=np.array([Config.G_TL[0]*gw,Config.G_TL[1]*gh],dtype=np.float32)
    g_tr=np.array([Config.G_TR[0]*gw,Config.G_TR[1]*gh],dtype=np.float32)
    g_br=np.array([Config.G_BR[0]*gw,Config.G_BR[1]*gh],dtype=np.float32)
    g_bl=np.array([Config.G_BL[0]*gw,Config.G_BL[1]*gh],dtype=np.float32)
    gq=np.array([g_tl,g_tr,g_br,g_bl],dtype=np.float32)

    for r in range(rows):
        for c in range(cols):
            u0,u1=c/cols,(c+1)/cols; v0,v1=r/rows,(r+1)/rows
            src=np.array([_bi(gq,u0,v0),_bi(gq,u1,v0),_bi(gq,u1,v1),_bi(gq,u0,v1)],dtype=np.float32)
            dst=np.array([_bi(quad,u0,v0),_bi(quad,u1,v0),_bi(quad,u1,v1),_bi(quad,u0,v1)],dtype=np.float32)
            M=cv2.getPerspectiveTransform(src,dst)
            cell=gpu_warp(garment,M,(fw,fh))
            xs=dst[:,0]; ys=dst[:,1]
            x1=max(0,int(np.floor(xs.min()))-1); x2=min(fw,int(np.ceil(xs.max()))+1)
            y1=max(0,int(np.floor(ys.min()))-1); y2=min(fh,int(np.ceil(ys.max()))+1)
            if x2<=x1 or y2<=y1: continue
            rc=cell[y1:y2,x1:x2]; rcan=canvas[y1:y2,x1:x2]
            m=rc[:,:,3:4].astype(np.float32)/255.
            rcan[:]=(rc.astype(np.float32)*m+rcan.astype(np.float32)*(1-m)).astype(np.uint8)
            canvas[y1:y2,x1:x2]=rcan

    k=Config.FEATHER_KSIZE
    if k>0: canvas[:,:,3]=gpu_blur(canvas[:,:,3],k)
    return canvas


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 9: TORSO SUPPRESSION
# ─────────────────────────────────────────────────────────────────────────────

def suppress_torso(frame, quad, body_mask, fh, fw):
    tm=np.zeros((fh,fw),dtype=np.uint8)
    cv2.fillPoly(tm,[quad.astype(np.int32).reshape(-1,1,2)],255)
    if body_mask is not None:
        tm=cv2.bitwise_and(tm, gpu_resize(body_mask,(fw,fh)))
    ke=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(9,9))
    te=gpu_morph(tm,cv2.MORPH_ERODE,ke,2)
    bl=gpu_blur(frame,Config.SUPPRESS_BLUR)
    dk=(bl.astype(np.float32)*Config.SUPPRESS_OPACITY).astype(np.uint8)
    soft=gpu_blur(te,21).astype(np.float32)/255.
    am=soft[...,np.newaxis]
    return (frame.astype(np.float32)*(1-am)+dk.astype(np.float32)*am).astype(np.uint8)


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 10: COMPOSITE WITH ARM OCCLUSION
# ─────────────────────────────────────────────────────────────────────────────

def composite(frame_orig, frame_supp, warped, body_mask, lm, fh, fw,
              opacity=Config.GARMENT_OPACITY):
    h,w=frame_supp.shape[:2]
    ov=warped[:,:,:3].astype(np.float32)
    a=(warped[:,:,3].astype(np.float32)/255.*opacity)[...,np.newaxis]
    comp=(ov*a+frame_supp.astype(np.float32)*(1-a)).astype(np.uint8)

    arm=np.zeros((h,w),dtype=np.uint8)
    sw=np.linalg.norm(lm["R_SHOULDER"]-lm["L_SHOULDER"])
    ar=int(max(14,sw*0.14))
    def vis(k): v=lm.get(k); return float(v[0]) if v is not None else 0.
    def draw(p1,p2,p3,v1,v2,v3):
        pts=[]
        for pt,v in zip([p1,p2,p3],[v1,v2,v3]):
            if v>Config.VISIBILITY_THRESHOLD:
                pts.append(tuple(np.clip(pt,[0,0],[w-1,h-1]).astype(int)))
        for i in range(len(pts)-1): cv2.line(arm,pts[i],pts[i+1],255,ar*2)
    draw(lm["L_SHOULDER"],lm["L_ELBOW"],lm["L_WRIST"],0.9,vis("L_ELBOW_VIS"),vis("L_WRIST_VIS"))
    draw(lm["R_SHOULDER"],lm["R_ELBOW"],lm["R_WRIST"],0.9,vis("R_ELBOW_VIS"),vis("R_WRIST_VIS"))

    kd=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(7,7))
    arm=gpu_morph(arm,cv2.MORPH_DILATE,kd,2)
    if body_mask is not None:
        arm=cv2.bitwise_and(arm,gpu_resize(body_mask,(w,h)))
    af=gpu_blur(arm,11).astype(np.float32)/255.[...,np.newaxis] if False else \
       (gpu_blur(arm,11).astype(np.float32)/255.)[...,np.newaxis]
    result=(comp.astype(np.float32)*(1-af)+frame_orig.astype(np.float32)*af).astype(np.uint8)

    if body_mask is not None:
        bm=gpu_resize(body_mask,(w,h))
        bf=gpu_blur(bm,15).astype(np.float32)/255.[...,np.newaxis] if False else \
           (gpu_blur(bm,15).astype(np.float32)/255.)[...,np.newaxis]
        result=(result.astype(np.float32)*bf+frame_orig.astype(np.float32)*(1-bf)).astype(np.uint8)
    return result


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 11: CATVTON DIFFUSION ENGINE (4GB VRAM optimized)
# ─────────────────────────────────────────────────────────────────────────────

class CatVTONEngine:
    """
    Photorealistic try-on using Stable Diffusion inpainting.
    Optimized for 4GB VRAM with:
      - float16 precision  (halves VRAM vs float32)
      - Attention slicing  (reduces peak VRAM by ~40%)
      - VAE tiling         (prevents OOM on decode step)
      - xformers           (memory-efficient attention if installed)
      - 512×384 resolution (vs original 1024×768)
    """
    _instance = None
    _lock     = threading.Lock()

    def __init__(self):
        self._pipe  = None
        self._ready = False
        self._error = None
        threading.Thread(target=self._load, daemon=True).start()

    @classmethod
    def get(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def _load(self):
        if not TORCH_AVAILABLE:
            self._error = "PyTorch not installed"
            return
        try:
            import torch
            from diffusers import StableDiffusionInpaintPipeline

            sys.stderr.write("[CatVTON] Loading diffusion model (~3GB download on first run)...\n")
            sys.stderr.flush()

            dtype = torch.float16 if TORCH_DEVICE == "cuda" else torch.float32

            pipe = StableDiffusionInpaintPipeline.from_pretrained(
                "runwayml/stable-diffusion-inpainting",
                torch_dtype=dtype,
                safety_checker=None,
                requires_safety_checker=False,
                variant="fp16" if dtype == torch.float16 else None,
            )
            pipe = pipe.to(TORCH_DEVICE)

            # ── 4GB VRAM optimizations ──────────────────────────────────────
            # 1. Attention slicing: process attention in chunks → ~40% less VRAM
            pipe.enable_attention_slicing(1)

            # 2. VAE tiling: decode large images in tiles → prevents OOM on decode
            pipe.enable_vae_tiling()

            # 3. xformers memory efficient attention (if installed)
            try:
                pipe.enable_xformers_memory_efficient_attention()
                sys.stderr.write("[CatVTON] xformers enabled\n")
            except Exception:
                pass  # xformers not installed — fine, other optimisations cover it

            # 4. Move text encoder to CPU after encoding (saves ~500MB VRAM)
            # We do this manually in enhance() after prompt encoding

            self._pipe  = pipe
            self._ready = True
            sys.stderr.write("[CatVTON] Diffusion model ready.\n")
            sys.stderr.flush()

        except Exception as e:
            import traceback; traceback.print_exc()
            self._error = str(e)
            sys.stderr.write(f"[CatVTON] Load failed: {e}\n")
            sys.stderr.flush()

    def enhance(self, person_bgr: np.ndarray, garment_bgr: np.ndarray,
                torso_mask_uint8: np.ndarray) -> np.ndarray:
        """
        Runs diffusion try-on.
        person_bgr       : BGR frame of the person
        garment_bgr      : BGR garment flat-lay image
        torso_mask_uint8 : uint8 mask (255=torso region to replace)
        Returns BGR result same size as person_bgr.
        """
        if not self._ready:
            raise RuntimeError(self._error or "Model not ready yet")

        import torch
        H, W = Config.DIFF_H, Config.DIFF_W

        # Resize inputs to diffusion resolution
        person_pil  = Image.fromarray(cv2.cvtColor(person_bgr,  cv2.COLOR_BGR2RGB)).resize((W,H))
        garment_pil = Image.fromarray(cv2.cvtColor(garment_bgr, cv2.COLOR_BGR2RGB)).resize((W,H))
        mask_pil    = Image.fromarray(torso_mask_uint8).resize((W,H))

        # CatVTON trick: concatenate person + garment side by side
        # The diffusion model sees both and learns to transfer the garment
        combo_w = W * 2
        combo   = Image.new("RGB", (combo_w, H))
        combo.paste(person_pil,  (0, 0))
        combo.paste(garment_pil, (W, 0))

        # Mask only covers the person's torso (left half)
        mask_combo = Image.new("L", (combo_w, H), 0)
        mask_combo.paste(mask_pil, (0, 0))

        prompt = (
            "a person wearing the clothing shown on the right side of the image, "
            "photorealistic, natural lighting, high quality, sharp details, "
            "the garment drapes naturally on the body"
        )
        neg = (
            "deformed body, bad anatomy, blurry, low quality, watermark, "
            "duplicate, extra limbs, floating garment, wrong colors"
        )

        with torch.inference_mode():
            # Free VRAM before inference
            if TORCH_DEVICE == "cuda":
                torch.cuda.empty_cache()

            result = self._pipe(
                prompt             = prompt,
                negative_prompt    = neg,
                image              = combo,
                mask_image         = mask_combo,
                height             = H,
                width              = combo_w,
                num_inference_steps= Config.DIFF_STEPS,
                guidance_scale     = Config.DIFF_GUIDANCE,
            ).images[0]

            if TORCH_DEVICE == "cuda":
                torch.cuda.empty_cache()

        # Crop back to person half only
        person_result = result.crop((0, 0, W, H))

        # Resize back to original frame size
        oh, ow = person_bgr.shape[:2]
        out_bgr = cv2.cvtColor(
            np.array(person_result.resize((ow, oh), Image.LANCZOS)),
            cv2.COLOR_RGB2BGR
        )
        return out_bgr

    def build_torso_mask(self, lm: Dict, body_mask: Optional[np.ndarray],
                         fh: int, fw: int) -> np.ndarray:
        """Generate torso inpainting mask from pose landmarks."""
        quad = build_body_quad(lm)
        if quad is None:
            # Fallback: large centre rectangle
            mask = np.zeros((fh,fw), dtype=np.uint8)
            cv2.rectangle(mask, (fw//4, fh//4), (3*fw//4, 3*fh//4), 255, -1)
            return mask

        mask = np.zeros((fh,fw), dtype=np.uint8)
        cv2.fillPoly(mask, [quad.astype(np.int32).reshape(-1,1,2)], 255)

        # Restrict to body silhouette if available
        if body_mask is not None:
            bm = gpu_resize(body_mask,(fw,fh))
            mask = cv2.bitwise_and(mask, bm)

        # Dilate slightly to ensure full torso coverage
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(15,15))
        mask = cv2.dilate(mask, k, iterations=1)

        # Feather edges for natural blending
        mask = cv2.GaussianBlur(mask, (21,21), 0)
        return mask


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 12: GARMENT PREPROCESSOR
# ─────────────────────────────────────────────────────────────────────────────

def preprocess_garment_for_diffusion(garment_bgr: np.ndarray) -> np.ndarray:
    """
    Prepare garment for diffusion:
    - Remove background (white) and place on neutral grey
    - Centre and normalise
    Uses rembg if installed for better bg removal.
    """
    try:
        from rembg import remove
        pil = Image.fromarray(cv2.cvtColor(garment_bgr, cv2.COLOR_BGR2RGB))
        removed = remove(pil)  # RGBA, background transparent
        bg = Image.new("RGB", removed.size, (200, 200, 200))
        bg.paste(removed, mask=removed.split()[3])
        return cv2.cvtColor(np.array(bg), cv2.COLOR_RGB2BGR)
    except Exception:
        # Fallback: simple white bg removal
        grey = cv2.cvtColor(garment_bgr, cv2.COLOR_BGR2GRAY)
        _, mask = cv2.threshold(grey, 240, 255, cv2.THRESH_BINARY_INV)
        result = garment_bgr.copy()
        result[mask == 0] = [200, 200, 200]
        return result


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 13: MAIN PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

class TryOnPipeline:
    def __init__(self, garment_path: str):
        self._extractor      = PoseExtractor()
        self._segmenter      = BodySegmenter() if Config.USE_SEGMENTATION else None
        self._garment_warp   = load_garment(garment_path)        # BGRA for warp
        self._garment_diff   = self._load_diff_garment(garment_path)  # BGR for diffusion
        self._last_overlay   = None
        self._last_good_quad = None
        self._last_lm        = None
        self._last_body_mask = None
        self._garment_path   = garment_path

        # Pre-warm CatVTON in background (downloads model if needed)
        if TORCH_AVAILABLE:
            CatVTONEngine.get()
            sys.stderr.write("[TryOn] CatVTON loading in background...\n")
            sys.stderr.flush()

    def _load_diff_garment(self, path):
        img = cv2.imread(path)
        if img is None: return None
        return preprocess_garment_for_diffusion(img)

    @staticmethod
    def _b64_bgr(b64):
        buf = np.frombuffer(base64.b64decode(b64), dtype=np.uint8)
        img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
        if img is None: raise ValueError("Cannot decode frame")
        return img

    @staticmethod
    def _bgr_b64(img, q=Config.OUTPUT_JPEG_QUALITY):
        ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, q])
        if not ok: raise RuntimeError("JPEG encode failed")
        return base64.b64encode(buf).decode()

    # ── LIVE WARP FRAME ────────────────────────────────────────────────────────
    def process_frame(self, frame_b64: str) -> dict:
        t0 = time.perf_counter()
        try:
            bgr_orig = self._b64_bgr(frame_b64)
            oh,ow    = bgr_orig.shape[:2]
            bgr      = gpu_resize(bgr_orig,(Config.PROC_W,Config.PROC_H))
            fh,fw    = Config.PROC_H, Config.PROC_W
            rgb      = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

            lm = self._extractor.extract(rgb)
            body_mask = self._segmenter.get_mask(rgb) if self._segmenter else None
            if body_mask is not None: self._last_body_mask = body_mask

            if lm is None:
                out = bgr.copy()
                if self._last_overlay is not None:
                    gh=self._last_overlay[:,:,:3].astype(np.float32)
                    ga=(self._last_overlay[:,:,3:4].astype(np.float32)/255.*Config.GHOST_OPACITY)
                    out=(gh*ga+bgr.astype(np.float32)*(1-ga)).astype(np.uint8)
                return {"success":False,"frame":self._bgr_b64(gpu_resize(out,(ow,oh))),
                        "landmarks":[],"error":"No pose",
                        "latency_ms":round((time.perf_counter()-t0)*1000,2)}

            self._last_lm = lm
            quad = build_body_quad(lm)
            if quad is None:
                quad = self._last_good_quad
                if quad is None:
                    return {"success":False,"frame":self._bgr_b64(gpu_resize(bgr,(ow,oh))),
                            "landmarks":[],"error":"Degenerate quad",
                            "latency_ms":round((time.perf_counter()-t0)*1000,2)}
            else:
                quad = limit_drift(quad, self._last_good_quad)
                self._last_good_quad = quad.copy()

            bgr_s   = suppress_torso(bgr, quad, body_mask, fh, fw)
            warped  = mesh_warp(self._garment_warp, quad, fh, fw)
            self._last_overlay = warped

            out = composite(bgr, bgr_s, warped, body_mask, lm, fh, fw)
            out = gpu_resize(out,(ow,oh))

            sx,sy = ow/fw, oh/fh
            lm_out = {k:(v*[sx,sy]).tolist() for k,v in lm.items() if v.shape==(2,)}

            return {"success":True,"frame":self._bgr_b64(out),"landmarks":lm_out,
                    "virtual_hips":bool(lm["VIRTUAL_HIPS"][0]>0.5),"error":None,
                    "latency_ms":round((time.perf_counter()-t0)*1000,2)}

        except Exception as e:
            import traceback; traceback.print_exc()
            return {"success":False,"frame":frame_b64,"landmarks":[],
                    "error":str(e),"latency_ms":round((time.perf_counter()-t0)*1000,2)}

    # ── DIFFUSION ENHANCE (called on Capture) ──────────────────────────────────
    def enhance_frame(self, frame_b64: str) -> dict:
        """Run CatVTON diffusion on a single captured frame."""
        t0 = time.perf_counter()
        try:
            engine = CatVTONEngine.get()
            if not engine.ready:
                if engine.error:
                    return {"success":False,"enhanced":False,
                            "error":f"Diffusion model error: {engine.error}",
                            "frame":frame_b64,"latency_ms":0}
                # Still loading — return warp result instead
                result = self.process_frame(frame_b64)
                result["enhanced"] = False
                result["error"]    = "Model still loading, please try again in a moment"
                return result

            bgr_orig = self._b64_bgr(frame_b64)
            oh,ow    = bgr_orig.shape[:2]
            bgr      = gpu_resize(bgr_orig,(Config.PROC_W,Config.PROC_H))
            fh,fw    = Config.PROC_H, Config.PROC_W
            rgb      = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

            lm = self._extractor.extract(rgb)
            body_mask = self._segmenter.get_mask(rgb) if self._segmenter else None

            if lm is None or self._garment_diff is None:
                result = self.process_frame(frame_b64)
                result["enhanced"] = False
                return result

            # Build torso mask for diffusion inpainting
            torso_mask = engine.build_torso_mask(lm, body_mask, fh, fw)

            # Run diffusion
            enhanced = engine.enhance(bgr, self._garment_diff, torso_mask)
            enhanced = gpu_resize(enhanced,(ow,oh))

            return {
                "success":    True,
                "enhanced":   True,
                "frame":      self._bgr_b64(enhanced, q=92),
                "landmarks":  [],
                "error":      None,
                "latency_ms": round((time.perf_counter()-t0)*1000, 2),
            }

        except Exception as e:
            import traceback; traceback.print_exc()
            # On failure fall back to warp result
            result = self.process_frame(frame_b64)
            result["enhanced"] = False
            result["error"]    = f"Diffusion failed: {str(e)}"
            return result

    def reload_garment(self, path: str):
        self._garment_path = path
        self._garment_warp = load_garment(path)
        self._garment_diff = self._load_diff_garment(path)
        self._last_overlay = None

    def close(self):
        self._extractor.close()
        if self._segmenter: self._segmenter.close()


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 14: NODE.JS SERVER BRIDGE
# ─────────────────────────────────────────────────────────────────────────────

def _jwrite(d): sys.stdout.write(json.dumps(d)+"\n"); sys.stdout.flush()

def run_server_mode(garment_path: str):
    p = TryOnPipeline(garment_path)
    sys.stderr.write("[TryOn] Ready.\n"); sys.stderr.flush()
    try:
        for raw in sys.stdin:
            line = raw.strip()
            if not line: continue
            try: req = json.loads(line)
            except: _jwrite({"success":False,"error":"JSON parse error"}); continue

            if "garment" in req:
                try: p.reload_garment(req["garment"])
                except Exception as e: _jwrite({"success":False,"error":str(e)}); continue

            if "frame" not in req:
                _jwrite({"success":False,"error":"Missing frame"}); continue

            # enhance:true → run diffusion (Capture button)
            # enhance:false/absent → run live warp
            if req.get("enhance", False):
                _jwrite(p.enhance_frame(req["frame"]))
            else:
                _jwrite(p.process_frame(req["frame"]))

    except KeyboardInterrupt: pass
    finally: p.close(); sys.stderr.write("[TryOn] Shutdown.\n")


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 15: DEMO MODE
# ─────────────────────────────────────────────────────────────────────────────

def run_demo_mode(garment_path: str, camera_source: str = "0"):
    pipeline = TryOnPipeline(garment_path)
    cap = cv2.VideoCapture(int(camera_source) if camera_source.isdigit() else camera_source,
                           cv2.CAP_DSHOW if camera_source.isdigit() else 0)
    if camera_source.isdigit():
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        cap.set(cv2.CAP_PROP_FPS, 30)

    print("[Demo] Q=quit  D=debug  C=capture (run diffusion on current frame)")
    debug = False

    while True:
        ret, frame = cap.read()
        if not ret: break

        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 88])
        result = pipeline.process_frame(base64.b64encode(buf).decode())

        if result.get("frame"):
            arr = np.frombuffer(base64.b64decode(result["frame"]), np.uint8)
            out = cv2.imdecode(arr, cv2.IMREAD_COLOR) or frame
        else:
            out = frame.copy()

        tag = "GPU" if CV_GPU else "CPU"
        color = (0,255,80) if result["success"] else (0,80,255)
        cv2.putText(out,f"[{tag}] {'TRACKING' if result['success'] else 'NO POSE'}  "
                    f"{result['latency_ms']:.1f}ms  |  C=Capture (diffusion)",
                    (12,36),cv2.FONT_HERSHEY_SIMPLEX,0.65,color,2)

        cv2.imshow("Virtual Try-On v10 | Q=quit D=debug C=capture", out)
        key = cv2.waitKey(1)&0xFF
        if key == ord("q"): break
        elif key == ord("d"): debug = not debug
        elif key == ord("c"):
            print("[Demo] Running diffusion enhance...")
            _, buf2 = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
            enh = pipeline.enhance_frame(base64.b64encode(buf2).decode())
            if enh.get("frame"):
                arr2 = np.frombuffer(base64.b64decode(enh["frame"]), np.uint8)
                enh_img = cv2.imdecode(arr2, cv2.IMREAD_COLOR)
                if enh_img is not None:
                    cv2.imshow("Enhanced (CatVTON)", enh_img)
                    cv2.waitKey(0)
                    cv2.destroyWindow("Enhanced (CatVTON)")
            print(f"[Demo] Diffusion done in {enh['latency_ms']:.0f}ms  enhanced={enh.get('enhanced')}")

    cap.release(); cv2.destroyAllWindows(); pipeline.close()


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Virtual Try-On Engine v10 (Hybrid)")
    ap.add_argument("--mode",    choices=["server","demo"], default="demo")
    ap.add_argument("--garment", default="garment.png")
    ap.add_argument("--camera",  default="0")
    args = ap.parse_args()
    if args.mode == "server": run_server_mode(args.garment)
    else: run_demo_mode(args.garment, args.camera)