import io
import cv2
import numpy as np
import mediapipe as mp
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from processor import apply_tps_warp 

# CRITICAL: Import pose directly to bypass the MediaPipe AttributeError
from mediapipe.python.solutions import pose as mp_pose 

app = FastAPI(title="AI Virtual Try-On Service")

# Initialize Pose using the direct import path
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
        # 1. Read uploaded image
        request_object_content = await file.read()
        img_array = np.frombuffer(request_object_content, np.uint8)
        user_img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

        if user_img is None:
            raise HTTPException(status_code=400, detail="Invalid image file")

        # 2. Convert to RGB for MediaPipe processing
        user_rgb = cv2.cvtColor(user_img, cv2.COLOR_BGR2RGB)
        
        # 3. Detect body landmarks
        results = pose.process(user_rgb)

        if not results.pose_landmarks:
            raise HTTPException(status_code=400, detail="No person detected in photo")

        # 4. Load the Garment PNG
        # Ensure your "garments" folder has a PNG matching the garment_id
        garment_path = f"garments/{garment_id}.png"
        garment_img = cv2.imread(garment_path, cv2.IMREAD_UNCHANGED)

        if garment_img is None:
            # Fallback: if shirt file is missing, return original to prevent front-end break
            print(f"Error: Garment file {garment_path} not found.")
            res, im_png = cv2.imencode(".png", user_img)
            return StreamingResponse(io.BytesIO(im_png.tobytes()), media_type="image/png")

        # 5. Run Faizan's TPS Warp via processor.py
        processed_img = apply_tps_warp(user_img, garment_img, results.pose_landmarks.landmark)

        # 6. Encode result to PNG and stream back
        res, im_png = cv2.imencode(".png", processed_img)
        return StreamingResponse(io.BytesIO(im_png.tobytes()), media_type="image/png")

    except Exception as e:
        print(f"Exception during processing: {e}")
        return {"error": str(e)}