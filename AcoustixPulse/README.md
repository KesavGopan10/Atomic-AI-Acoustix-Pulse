# Acoustix Pulse

A comprehensive medical AI diagnostic React Native app built with Expo.

## Features

- 🫁 **Breath Analysis** — Record breathing sounds and classify respiratory conditions using AI
- ❤️ **Heart Risk Assessment** — Multi-step cardiac risk analysis with clinical inputs
- 🔬 **Medical Image Scan** — AI-powered X-ray, ECG, CT, and MRI analysis
- 💬 **Symptom Checker** — Conversational AI symptom assessment
- 💊 **Drug Interactions** — Check medication safety and interactions
- 🧪 **Lab Report Analysis** — Upload lab reports for AI interpretation

## Backend

This app connects to the Medical AI Platform API:
- **API:** https://hackathon-atomic-ai-production.up.railway.app
- **Docs:** https://hackathon-atomic-ai-production.up.railway.app/docs

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npx expo start
```

3. Run on your device:
   - **Android:** Press `a` in the terminal, or scan the QR code with the Expo Go app
   - **iOS:** Press `i` in the terminal, or scan the QR code with the Camera app
   - **Web:** Press `w` in the terminal

## Project Structure

```
AcoustixPulse/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Root layout (Stack navigator)
│   ├── (tabs)/             # Tab navigation
│   │   ├── _layout.tsx     # Tab bar config
│   │   ├── index.tsx       # Home screen
│   │   ├── breath.tsx      # Breath capture & recording
│   │   ├── insights.tsx    # Health insights & trends
│   │   └── profile.tsx     # User biometrics profile
│   ├── results.tsx         # Probability assessment results
│   ├── detailed-report.tsx # Full diagnostic report
│   ├── heart-assessment.tsx# Heart disease risk input
│   ├── heart-results.tsx   # Heart analysis results
│   ├── scan-analysis.tsx   # Medical image upload & analysis
│   ├── symptom-chat.tsx    # Conversational symptom checker
│   ├── drug-check.tsx      # Drug interaction checker
│   └── lab-analysis.tsx    # Lab report analyzer
├── constants/
│   └── theme.ts            # Design system tokens
├── services/
│   └── api.ts              # Backend API service layer
├── app.json                # Expo config
├── package.json            # Dependencies
└── tsconfig.json           # TypeScript config
```

## Tech Stack

- **React Native** with **Expo SDK 52**
- **Expo Router** for file-based navigation
- **Expo AV** for audio recording
- **Expo Image Picker** for camera/gallery access
- **TypeScript** for type safety
