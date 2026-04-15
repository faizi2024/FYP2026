# 👕 AI Virtual Try-On System

## 📌 Project Overview

This project is an AI-based Virtual Try-On System that allows users to try clothes virtually using images or live camera. It uses computer vision techniques to overlay garments on the human body and provide a realistic preview before purchase.

---

## 🚀 Features

* Upload image or use live camera
* Detect human body using pose estimation
* Overlay clothes on user body
* Real-time preview (basic)
* Privacy-focused (no data storage)
* Responsive modern UI
* Fast API-based processing

---

## 🏗️ Project Structure

```bash
SDS EVALUATION 1/
├── .vscode/
├── AI-Services/
│   ├── __pycache__/
│   ├── garments/
│   ├── venv/
│   ├── main.py
│   ├── processor.py
│   └── requirement.txt
├── Backend/
│   ├── models/
│   ├── node_modules/
│   ├── routes/
│   │   ├── ai.js
│   │   └── auth.js
│   ├── server/
│   ├── .env
│   ├── index.js
│   ├── package.json
│   └── package-lock.json
├── Frontend/
├── .gitignore
└── README.md
```

---

## ⚙️ Tech Stack

### Frontend:

* Next.js
* Tailwind CSS
* JavaScript / TypeScript

### Backend:

* FastAPI
* OpenCV
* MediaPipe
* Python

---

## 🧠 Methodology

1. Capture image/video from camera or upload.
2. Detect body keypoints using MediaPipe.
3. Process frames using OpenCV.
4. Resize and align clothing image.
5. Overlay clothing on detected body.
6. Return and display final result on frontend.

---

## 🎯 Objectives

* Provide realistic virtual try-on
* Improve online shopping experience
* Maintain user privacy
* Reduce product returns
* Enhance customer confidence

---

## 📦 How to Run

### Frontend

```bash
cd Frontend
npm install
npm run dev
```

### Backend

```bash
cd Backend
pip install -r requirements.txt
uvicorn main:app --reload
```

---

## 🔮 Future Improvements

* Better cloth fitting
* Multiple outfit categories
* AI size recommendation
* Advanced real-time performance
* Mobile support

---

## 👨‍💻 Author

Developed as a Final Year Project.
