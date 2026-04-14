import cv2
import numpy as np

def apply_tps_warp(user_img, garment_img, landmarks):
    h_u, w_u = user_img.shape[:2]
    h_g, w_g = garment_img.shape[:2]

    # 1. Coordinate Scaling (Convert 0-1 to Pixels)
    # Landmark 11: L_Shoulder, 12: R_Shoulder, 23: L_Hip, 24: R_Hip
    def get_ptr(idx):
        return [landmarks[idx].x * w_u, landmarks[idx].y * h_u]

    l_sh = get_ptr(11)
    r_sh = get_ptr(12)
    l_hip = get_ptr(23)
    r_hip = get_ptr(24)
    neck = [(l_sh[0] + r_sh[0]) / 2, (l_sh[1] + r_sh[1]) / 2]

    # 2. Target Points on User
    dst_pts = np.array([neck, l_sh, r_sh, l_hip, r_hip], dtype=np.float32)

    # 3. Source Points on Garment PNG
    src_pts = np.array([
        [w_g * 0.5, h_g * 0.1], # Neck
        [w_g * 0.1, h_g * 0.2], # L_Shoulder
        [w_g * 0.9, h_g * 0.2], # R_Shoulder
        [w_g * 0.1, h_g * 0.9], # L_Hip
        [w_g * 0.9, h_g * 0.9]  # R_Hip
    ], dtype=np.float32)

    # 4. TPS Warping
    tps = cv2.createThinPlateSplineShapeTransformer()
    matches = [cv2.DMatch(i, i, 0) for i in range(len(src_pts))]
    tps.estimateTransformation(dst_pts.reshape(1, -1, 2), src_pts.reshape(1, -1, 2), matches)
    
    # Warp the garment to the size of the user image
    warped_garment = tps.warpImage(garment_img)
    warped_garment = cv2.resize(warped_garment, (w_u, h_u))

    # 5. Forced Blending Logic
    if warped_garment.shape[2] == 4:
        # Split channels
        b, g, r, a = cv2.split(warped_garment)
        overlay_color = cv2.merge((b, g, r))
        
        # Normalize alpha to 0.0 - 1.0
        mask = a.astype(float) / 255.0
        
        # Blend manually to ensure visibility
        for c in range(3):
            user_img[:, :, c] = ((1.0 - mask) * user_img[:, :, c] + mask * overlay_color[:, :, c]).astype(np.uint8)

    return user_img