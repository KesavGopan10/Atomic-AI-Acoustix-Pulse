# 🩺 AcoustixPulse - Atomic AI

**AcoustixPulse** is a cutting-edge respiratory health monitoring system that leverages artificial intelligence to classify lung sounds (Wheeze, Crackle, Normal) and provide intelligent health insights. The system combines a powerful FastAPI backend with a modern React Native (Expo) mobile application.

---

## 🚀 Overview

AcoustixPulse provides an end-to-end solution for respiratory disease screening:
1.  **Audio Analysis**: High-precision classification of respiratory sounds using an ML model.
2.  **AI Orchestration**: Integration with LLMs (via Groq or Amazon Bedrock) for personalized health reports and recommendations.
3.  **Cross-Platform App**: A seamless mobile experience built with React Native for real-time monitoring and historical tracking.

---

## 🏗 Project Structure

This repository is organized as a monorepo containing both the backend and frontend components:

```text
.
├── AcoustixPulse/                           # React Native (Expo) Mobile App
│   ├── app/                                 # App routing and screens
│   ├── assets/                              # Multimedia assets
│   ├── services/                            # API integration services
│   └── package.json
└── Respiratory_Disease_Classifier_API/      # FastAPI Backend
    ├── app/                                 # API routers and logic
    ├── static/                              # Static dashboard/assets
    ├── pyproject.toml                       # Python dependencies (UV managed)
    └── respiratory_classifier.pkl            # Pre-trained ML model
```

---

## 🛠 Tech Stack

### Backend
- **Framework**: FastAPI
- **Language**: Python 3.11+
- **Audio Processing**: Librosa, Pydub
- **Machine Learning**: Scikit-learn, NumPy, Pandas
- **AI Providers**: Groq (Llama 3/4) and Amazon Bedrock (Claude 3.5)
- **Package Manager**: [uv](https://github.com/astral-sh/uv)

### Frontend
- **Framework**: React Native with Expo (SDK 54)
- **Navigation**: Expo Router
- **Styling**: Vanilla CSS / React Native Styles
- **Icons**: Expo Vector Icons (Lucide/FontAwesome)

---

## ⚙️ Installation & Setup

### 1. Prerequisites
- **Python**: Install [uv](https://docs.astral.sh/uv/getting-started/installation/) for faster dependency management.
- **Node.js**: LTS version (18+ recommended).
- **FFmpeg**: Required for audio processing. (Install via `brew install ffmpeg` or `choco install ffmpeg`).

### 2. Backend Setup
Navigate to the API folder and install dependencies:
```bash
cd Respiratory_Disease_Classifier_API
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uv sync
```

### 3. Frontend Setup
Navigate to the mobile app folder and install dependencies:
```bash
cd AcoustixPulse
npm install
```

---

## 🔑 Environment Variables

### Backend (`Respiratory_Disease_Classifier_API/.env`)
Create a `.env` file in the API directory:
```env
AI_PROVIDER=groq # or 'bedrock'
GROQ_API_KEY=your_groq_key
GROQ_MODEL=meta-llama/llama-3.1-70b-versatile

# If using Bedrock
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
# AWS_REGION_NAME=us-east-1
```

### Frontend (`AcoustixPulse/.env`)
Create a `.env` file in the AcoustixPulse directory:
```env
# Replace with your PC's local IP address for mobile testing
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000
```

---

## 🏃 Running the Application

### Start the Backend
```bash
cd Respiratory_Disease_Classifier_API
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Start the Frontend
```bash
cd AcoustixPulse
npx expo start
```

---

## 🌟 Key Features
- **Real-time Audio Recording**: Capture lung sounds directly from your device.
- **Instant Classification**: Detect abnormal patterns like Wheezes and Crackles using advanced signal processing.
- **AI-Driven Reports**: Generate detailed clinical-style reports using state-of-the-art LLMs.
- **Health Dashboard**: Track your symptoms, medications, and previous scans in one place.
- **Responsive Web Dashboard**: Included FastAPI-based frontend for desktop viewing.

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.

---
*Disclaimer: This tool is for educational/screening purposes and is not a substitute for professional medical advice.*
