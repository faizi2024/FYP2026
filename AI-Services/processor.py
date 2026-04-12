import cv2
import numpy as np
import mediapipe as mp

def apply_tps_warp(user_img, garment_img, landmarks):
    h_u, w_u = user_img.shape[:2]
    h_g, w_g = garment_img.shape[:2]

    # 1. Define Source Points (On the flat garment PNG)
    # These stay consistent for your standard shirt assets
    src_pts = np.array([
        [w_g * 0.5, h_g * 0.1],  # Neck
        [w_g * 0.1, h_g * 0.25], # Left Shoulder
        [w_g * 0.9, h_g * 0.25], # Right Shoulder
        [w_g * 0.2, h_g * 0.9],  # Left Hip
        [w_g * 0.8, h_g * 0.9]   # Right Hip
    ], dtype=np.float32)

    # 2. Define Target Points (On the user via MediaPipe)
    # Note: MP landmark 11 is Left, 12 is Right from USER perspective
    dst_pts = np.array([
        [(landmarks[11].x + landmarks[12].x)/2 * w_u, landmarks[11].y * h_u],
        [landmarks[12].x * w_u, landmarks[12].y * h_u],
        [landmarks[11].x * w_u, landmarks[11].y * h_u],
        [landmarks[24].x * w_u, landmarks[24].y * h_u],
        [landmarks[23].x * w_u, landmarks[23].y * h_u]
    ], dtype=np.float32)

    # 3. Initialize and Estimate Transformation
    tps = cv2.createThinPlateSplineShapeTransformer()
    
    # Reshape points to (1, N, 2)
    src_pts_reshaped = src_pts.reshape(1, -1, 2)
    dst_pts_reshaped = dst_pts.reshape(1, -1, 2)
    
    # Matches must be identity (0 maps to 0, 1 maps to 1, etc.)
    matches = [cv2.DMatch(i, i, 0) for i in range(len(src_pts))]
    
    # Estimate the warp from Garment -> User
    tps.estimateTransformation(src_pts_reshaped, dst_pts_reshaped, matches)

    # 4. Warp the Garment to the size of the User Image
    # This is key: we warp the shirt into the coordinate space of the user's photo
    warped_garment = tps.warpImage(garment_img, output_shape=(h_u, w_u))

    # 5. Advanced Alpha Blending (The Stitch)
    # Split the warped image into color and alpha channels
    if warped_garment.shape[2] == 4: # If PNG has transparency
        b, g, r, a = cv2.split(warped_garment)
        overlay_color = cv2.merge((b, g, r))
        mask = a / 255.0
        
        # Blend each channel
        for c in range(3):
            user_img[:, :, c] = (mask * overlay_color[:, :, c] + 
                                (1 - mask) * user_img[:, :, c])
            
    return user_img