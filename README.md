# 🩺 AcoustixPulse - Atomic AI (Enterprise Health Platform)

[![AWS Powered](https://img.shields.io/badge/AWS-Powered-orange?style=for-the-badge&logo=amazon-aws)](https://aws.amazon.com/bedrock/)
**AcoustixPulse** is an enterprise-grade respiratory health monitoring system. It leverages **Amazon Bedrock** for sophisticated medical reasoning and a high-precision Random Forest model for real-time lung sound classification, hosted on AWS's robust cloud infrastructure.

---

## 🚀 High-Performance AWS Architecture

This project is built on a foundation of AWS services to ensure clinical-grade reliability and scalability:
1.  **Amazon Bedrock**: The primary intelligence engine using **Claude 3.5 Sonnet** for deep clinical insights, radiology reports, and lab analysis.
2.  **Hybrid AI Resiliency**: Features a high-speed fallback to Groq to guarantee 100% availability for critical health analysis.
3.  **Production-Ready Hosting**: The FastAPI backend is containerized and optimized for **AWS App Runner** and **Amazon ECS**, providing a serverless, scalable environment.

---

## 🏗 Project Structure

```text
.
├── AcoustixPulse/                           # React Native (Expo) Mobile App
│   ├── app/                                 # AI-Integrated Health Dashboard
│   └── services/                            # AWS Backend Integration
└── Respiratory_Disease_Classifier_API/      # AWS-Powered FastAPI Backend
    ├── main.py                              # Bedrock & Groq Orchestration
    ├── Dockerfile                           # AWS Deployment Container
    └── respiratory_classifier.pkl            # Optimized ML Model
```

---

## 🛠 Tech Stack (Boosted)

### Backend
- **Core**: FastAPI (Python 3.11+)
- **Primary AI**: **Amazon Bedrock** (Claude 3.5 Sonnet)
- **High-Speed Fallback**: Groq (Llama 3.1)
- **Edge ML**: Scikit-Learn (Random Forest) for sub-100ms on-CPU inference.
- **Infrastructure**: Dockerized for **AWS Fargate / App Runner**.

### Frontend
- **Framework**: React Native with Expo (SDK 54)
- **AI Integration**: Custom hooks for real-time Bedrock-powered diagnosis.

---

## 🏃 Running the Application

### 1. Configure Environment
**Backend (`Respiratory_Disease_Classifier_API/.env`):**
```env
AI_PROVIDER=bedrock  # Switches to AWS Bedrock
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION_NAME=us-east-1
GROQ_API_KEY=...     # For fallback support
```

### 2. Launch Backend
```bash
cd Respiratory_Disease_Classifier_API
uv run uvicorn main:app --host 0.0.0.0 --port 8000
```

### 3. Launch Mobile App
```bash
cd AcoustixPulse
npx expo start
```

---

## 🌟 Key Features
- **Bedrock Vision**: Analyze chest X-rays and lab reports using Claude 3.5 Sonnet.
- **Real-time Audio Analysis**: Instant detection of Wheezes/Crackles.
- **Hybrid AI Fallback**: Resilient medical reporting that never goes offline.
- **Enterprise Security**: Built with AWS best practices for data handling.

---

## 📄 License
This project is licensed under the MIT License.

---

## 🚀 The Future of AcoustixPulse on AWS

We are planning to expand our integration with AWS to further enhance clinical accuracy and data management:

- **Amazon HealthLake**: Implementation of a HIPAA-eligible data store for patient records and longitudinal analysis.
- **Amazon SageMaker**: Continuous model monitoring and automated retraining for our respiratory sound classifiers.
- **AWS Amplify**: Streamlining the mobile app deployment and patient authentication via Amazon Cognito.
- **AWS IoT Core**: Potential integration with smart stethoscopes for real-time, high-fidelity audio capture.

---

*Disclaimer: This tool is for educational/screening purposes and is not a substitute for professional medical advice.*
