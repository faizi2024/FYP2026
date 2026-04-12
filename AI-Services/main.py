import io
import cv2
import numpy as np
import mediapipe as mp
from processor import apply_tps_warpa
# CRITICAL: Import pose directly to bypass the AttributeError
from mediapipe.python.solutions import pose as mp_pose 
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from processor import apply_tps_warp

app = FastAPI(title="AI Virtual Try-On Service")

# Initialize Pose using the direct import path
# Use model_complexity=1 for a good balance of speed and accuracy
pose = mp_pose.Pose(
    static_image_mode=True, 
    min_detection_confidence=0.5,
    model_complexity=1 
)

# --- CORS CONFIG ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:9002"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/try-on")
async def try_on(
    file: UploadFile = File(...), 
    garment_id: str = Form(...)
):
    try:
        # Read uploaded image
        request_object_content = await file.read()
        img_array = np.frombuffer(request_object_content, np.uint8)
        user_img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

        if user_img is None:
            raise HTTPException(status_code=400, detail="Invalid image file")

        # Convert to RGB for MediaPipe
        user_rgb = cv2.cvtColor(user_img, cv2.COLOR_BGR2RGB)
        
        # Detect landmarks
        results = pose.process(user_rgb)

        if not results.pose_landmarks:
            raise HTTPException(status_code=400, detail="No person detected in photo")

        # Load Garment
        garment_path = f"garments/{garment_id}.png"
        garment_img = cv2.imread(garment_path, cv2.IMREAD_UNCHANGED)

        if garment_img is None:
            # If shirt not found, return original for now to avoid crash
            res, im_png = cv2.imencode(".png", user_img)
            return StreamingResponse(io.BytesIO(im_png.tobytes()), media_type="image/png")

        # Run Faizan's TPS Warp
        processed_img = apply_tps_warp(user_img, garment_img, results.pose_landmarks.landmark)

        # Return result
        res, im_png = cv2.imencode(".png", processed_img)
        return StreamingResponse(io.BytesIO(im_png.tobytes()), media_type="image/png")

    except Exception as e:
        return {"error": str(e)}