# Design Document: Acoustix Pulse Respiratory Analysis

## Overview

Acoustix Pulse is a web-based respiratory analysis system that processes breath sounds captured through a smartphone microphone to detect potential cardio-pulmonary abnormalities. The system uses a deep learning model trained on the ICBHI 2017 Respiratory Sound Database to classify breath patterns and provides explainable results through Grad-CAM visualizations.

The architecture follows a client-server model with a React frontend handling user interaction and audio capture, and a Python FastAPI backend performing signal processing and AI inference. The system prioritizes user privacy by deleting raw audio immediately after processing and maintaining sub-3-second latency for real-time feedback.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Instruction  │  │   Recording  │  │   Results    │      │
│  │    Screen    │→ │   Interface  │→ │   Display    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  ↑              │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
          │                  ↓                  │
          │          ┌──────────────┐           │
          │          │  Web Audio   │           │
          │          │     API      │           │
          │          └──────────────┘           │
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │ HTTP POST /analyze
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                    Backend (FastAPI)                         │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Audio      │→ │     Mel      │→ │      AI      │      │
│  │ Preprocessor │  │ Spectrogram  │  │  Classifier  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                              │               │
│                                              ↓               │
│                                     ┌──────────────┐        │
│                                     │   Grad-CAM   │        │
│                                     │  Explainer   │        │
│                                     └──────────────┘        │
│                                              │               │
└──────────────────────────────────────────────┼───────────────┘
                                               │
                                               ↓
                                        JSON Response
                                    {category, confidence,
                                     spectrogram_image}
```

### Technology Stack

**Frontend:**
- React 18+ for UI components
- Web Audio API for microphone access and recording
- Axios for HTTP communication
- Canvas API for spectrogram visualization

**Backend:**
- FastAPI for REST API endpoints
- Librosa for audio processing and spectrogram generation
- PyTorch for deep learning model inference
- NumPy for numerical operations
- Grad-CAM implementation for explainability

**Model:**
- CNN-based architecture (ResNet18 or similar) trained on ICBHI 2017 dataset
- Input: Mel-spectrogram (128 mel bins × time frames)
- Output: 4-class classification (Normal, Wheeze, Crackle, Mixed)

## Components and Interfaces

### Frontend Components

#### InstructionScreen Component
```typescript
interface InstructionScreenProps {
  onStart: () => void;
}

// Displays:
// - Step-by-step recording instructions
// - Visual diagram of proper breath technique
// - "Start Recording" button
```

#### RecordingInterface Component
```typescript
interface RecordingInterfaceProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  onCancel: () => void;
}

interface RecordingState {
  isRecording: boolean;
  elapsedTime: number;
  audioLevel: number;
}

// Responsibilities:
// - Access microphone via navigator.mediaDevices.getUserMedia()
// - Record audio using MediaRecorder API
// - Display animated breathing guide
// - Show real-time audio level meter
// - Enforce 5-10 second duration
// - Convert recorded audio to WAV format (16kHz mono)
```

#### ResultsDisplay Component
```typescript
interface AnalysisResult {
  riskCategory: 'Normal' | 'Wheeze Pattern' | 'Crackle Pattern' | 'Mixed Abnormality';
  confidenceScore: number;
  confidenceLevel: 'High' | 'Moderate' | 'Low';
  spectrogramImage: string; // Base64 encoded PNG
  timestamp: string;
}

interface ResultsDisplayProps {
  result: AnalysisResult;
  onNewRecording: () => void;
}

// Displays:
// - Risk category with color coding
// - Confidence score and level
// - Spectrogram with Grad-CAM heatmap overlay
// - Medical disclaimer
// - "New Recording" button
```

### Backend Components

#### Audio Preprocessor
```python
class AudioPreprocessor:
    def __init__(self, sample_rate: int = 16000):
        self.sample_rate = sample_rate
        self.lowcut = 100  # Hz
        self.highcut = 2500  # Hz
    
    def preprocess(self, audio_data: np.ndarray) -> np.ndarray:
        """
        Apply bandpass filter and noise reduction
        
        Args:
            audio_data: Raw audio samples
            
        Returns:
            Filtered audio samples
        """
        pass
    
    def bandpass_filter(self, audio: np.ndarray) -> np.ndarray:
        """Apply Butterworth bandpass filter"""
        pass
    
    def reduce_noise(self, audio: np.ndarray) -> np.ndarray:
        """Apply spectral subtraction noise reduction"""
        pass
```

#### Mel Spectrogram Generator
```python
class MelSpectrogramGenerator:
    def __init__(
        self,
        sample_rate: int = 16000,
        n_fft: int = 2048,
        hop_length: int = 512,
        n_mels: int = 128
    ):
        self.sample_rate = sample_rate
        self.n_fft = n_fft
        self.hop_length = hop_length
        self.n_mels = n_mels
    
    def generate(self, audio: np.ndarray) -> np.ndarray:
        """
        Generate mel-spectrogram from audio
        
        Args:
            audio: Preprocessed audio samples
            
        Returns:
            Mel-spectrogram (n_mels × time_frames)
        """
        pass
    
    def normalize(self, spectrogram: np.ndarray) -> np.ndarray:
        """Normalize spectrogram to [0, 1] range"""
        pass
```

#### AI Classifier
```python
class RespiratoryClassifier:
    def __init__(self, model_path: str):
        self.model = self.load_model(model_path)
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model.to(self.device)
        self.model.eval()
        
        self.classes = ['Normal', 'Wheeze Pattern', 'Crackle Pattern', 'Mixed Abnormality']
    
    def predict(self, spectrogram: np.ndarray) -> tuple[str, float, np.ndarray]:
        """
        Classify respiratory sound
        
        Args:
            spectrogram: Mel-spectrogram input
            
        Returns:
            Tuple of (predicted_class, confidence_score, class_probabilities)
        """
        pass
    
    def load_model(self, path: str) -> torch.nn.Module:
        """Load pretrained PyTorch model"""
        pass
```

#### Grad-CAM Explainer
```python
class GradCAMExplainer:
    def __init__(self, model: torch.nn.Module, target_layer: str):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None
    
    def generate_heatmap(
        self,
        input_tensor: torch.Tensor,
        target_class: int
    ) -> np.ndarray:
        """
        Generate Grad-CAM heatmap
        
        Args:
            input_tensor: Model input (spectrogram)
            target_class: Class index for explanation
            
        Returns:
            Heatmap array (same spatial dimensions as input)
        """
        pass
    
    def overlay_heatmap(
        self,
        spectrogram: np.ndarray,
        heatmap: np.ndarray
    ) -> np.ndarray:
        """
        Overlay heatmap on spectrogram
        
        Returns:
            RGB image with heatmap overlay
        """
        pass
```

#### FastAPI Endpoints
```python
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse

app = FastAPI()

@app.post("/analyze")
async def analyze_breath(audio_file: UploadFile = File(...)) -> JSONResponse:
    """
    Analyze breath recording
    
    Request:
        - audio_file: WAV file (16kHz mono, 5-10 seconds)
    
    Response:
        {
            "risk_category": str,
            "confidence_score": float,
            "confidence_level": str,
            "spectrogram_image": str,  # Base64 PNG
            "timestamp": str
        }
    """
    pass

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
```

## Data Models

### Audio Recording Format
```python
class AudioRecording:
    sample_rate: int = 16000  # Hz
    channels: int = 1  # Mono
    duration_min: float = 5.0  # seconds
    duration_max: float = 10.0  # seconds
    format: str = "WAV"
    bit_depth: int = 16
```

### Analysis Result
```python
from enum import Enum
from datetime import datetime

class RiskCategory(Enum):
    NORMAL = "Normal"
    WHEEZE = "Wheeze Pattern"
    CRACKLE = "Crackle Pattern"
    MIXED = "Mixed Abnormality"

class ConfidenceLevel(Enum):
    HIGH = "High"  # >= 90%
    MODERATE = "Moderate"  # 70-89%
    LOW = "Low"  # < 70%

class AnalysisResult:
    risk_category: RiskCategory
    confidence_score: float  # 0.0 to 1.0
    confidence_level: ConfidenceLevel
    spectrogram_image: bytes  # PNG image data
    timestamp: datetime
    
    def to_dict(self) -> dict:
        """Convert to JSON-serializable dictionary"""
        pass
```

### Model Configuration
```python
class ModelConfig:
    architecture: str = "resnet18"
    num_classes: int = 4
    input_shape: tuple = (1, 128, 128)  # (channels, height, width)
    pretrained_weights: str = "models/respiratory_classifier.pth"
    
    # Training metadata
    training_dataset: str = "ICBHI 2017"
    accuracy: float = 0.82
    sensitivity: float = 0.78
    specificity: float = 0.87
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

After analyzing all acceptance criteria, I identified several areas where properties can be consolidated:

**Confidence Level Classification (3.3, 3.4, 3.5)**: These three criteria all test the same confidence level classification logic with different thresholds. They can be combined into a single comprehensive property that tests the entire classification function.

**Performance Requirements (6.1, 6.2, 6.3)**: While these test different components, 6.1 (total pipeline < 3s) subsumes 6.2 and 6.3 since if the total is under 3s, the components must also meet their individual requirements. We'll keep 6.1 as the primary property.

**Audio Format Properties (1.1, 1.2)**: These both validate audio recording configuration. They can be combined into a single property that validates all audio format requirements.

**Result Display Properties (5.1, 5.2, 5.3, 5.4)**: These all test that the result output contains required fields. They can be combined into a single property that validates the complete result structure.

### Properties

Property 1: Audio recording format compliance
*For any* recording session, the captured audio SHALL have a sample rate of 16 kHz, mono channel configuration, and duration between 5 and 10 seconds
**Validates: Requirements 1.1, 1.2**

Property 2: Invalid recording rejection
*For any* audio recording with duration less than 5 seconds, the system SHALL reject the recording and return an error
**Validates: Requirements 1.4**

Property 3: Bandpass filter frequency attenuation
*For any* audio signal, after applying the bandpass filter, frequencies below 100 Hz and above 2500 Hz SHALL be attenuated by at least 40 dB compared to passband frequencies
**Validates: Requirements 2.1**

Property 4: Mel-spectrogram output shape
*For any* valid audio input, the generated mel-spectrogram SHALL have 128 mel bins and a time dimension corresponding to the audio duration
**Validates: Requirements 2.3**

Property 5: Error handling for invalid audio
*For any* invalid audio input (corrupted, wrong format, or empty), the preprocessing pipeline SHALL return an error response without crashing
**Validates: Requirements 2.5**

Property 6: Classification output domain
*For any* mel-spectrogram input, the AI classifier SHALL output exactly one of the four valid risk categories: Normal, Wheeze Pattern, Crackle Pattern, or Mixed Abnormality
**Validates: Requirements 3.1**

Property 7: Confidence score bounds
*For any* classification result, the confidence score SHALL be a value between 0.0 and 1.0 (or 0% and 100% when displayed as percentage)
**Validates: Requirements 3.2**

Property 8: Confidence level classification
*For any* confidence score, the system SHALL correctly classify it as "High" (≥90%), "Moderate" (70-89%), or "Low" (<70%)
**Validates: Requirements 3.3, 3.4, 3.5**

Property 9: Heatmap generation
*For any* classification result, the Grad-CAM explainer SHALL generate a heatmap with the same spatial dimensions as the input spectrogram
**Validates: Requirements 4.1**

Property 10: Heatmap overlay composition
*For any* spectrogram and heatmap pair, the overlay operation SHALL produce an RGB image containing visual information from both inputs
**Validates: Requirements 4.3**

Property 11: Complete result structure
*For any* analysis result, the output SHALL contain all required fields: risk category, confidence score, confidence level, spectrogram image, and medical disclaimer text
**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

Property 12: End-to-end processing latency
*For any* valid audio recording, the complete analysis pipeline (preprocessing, classification, and visualization) SHALL complete within 3 seconds
**Validates: Requirements 6.1**

Property 13: Raw audio deletion
*For any* completed analysis, the raw audio file SHALL be deleted from storage, with only the spectrogram image and prediction results retained
**Validates: Requirements 7.1, 7.2**

Property 14: Privacy-preserving storage
*For any* stored analysis result, the data SHALL NOT contain personally identifiable information fields (name, email, phone, address, etc.)
**Validates: Requirements 7.5**

Property 15: Quiet audio feedback
*For any* audio input with RMS amplitude below a defined threshold, the system SHALL generate a prompt instructing the user to blow harder
**Validates: Requirements 8.4**

Property 16: Loud audio warning
*For any* audio input with peak amplitude exceeding 0.95 of maximum range (clipping threshold), the system SHALL generate a warning to reduce breath intensity
**Validates: Requirements 8.5**

Property 17: API request format
*For any* analysis request from frontend to backend, the audio data SHALL be transmitted as a multipart form upload with correct content-type headers
**Validates: Requirements 10.4**

Property 18: API response format
*For any* successful analysis, the backend SHALL return a JSON response containing risk_category, confidence_score, confidence_level, spectrogram_image, and timestamp fields
**Validates: Requirements 10.5**

## Error Handling

### Audio Recording Errors

**Microphone Access Denied:**
- Error: User denies microphone permission
- Response: Display clear message explaining microphone access is required, with instructions to enable permissions

**Recording Too Short:**
- Error: User stops recording before 5 seconds
- Response: Display message "Recording too short. Please record for at least 5 seconds" and return to recording interface

**Recording Device Unavailable:**
- Error: No microphone detected or device in use
- Response: Display error message and suggest checking device connections

### Audio Processing Errors

**Invalid Audio Format:**
- Error: Uploaded file is not valid audio or has unsupported format
- Response: Return HTTP 400 with error message "Invalid audio format. Please upload WAV file"

**Preprocessing Failure:**
- Error: Audio filtering or spectrogram generation fails
- Response: Return HTTP 500 with error message "Audio processing failed. Please try recording again"

**Audio Quality Issues:**
- Error: Audio is too noisy or has insufficient signal
- Response: Return HTTP 400 with error message "Audio quality insufficient for analysis. Please record in a quieter environment"

### Model Inference Errors

**Model Loading Failure:**
- Error: AI model file not found or corrupted
- Response: Return HTTP 503 with error message "Service temporarily unavailable"

**Inference Timeout:**
- Error: Model inference exceeds timeout threshold
- Response: Return HTTP 504 with error message "Analysis timeout. Please try again"

**Low Confidence Result:**
- Error: Model confidence below 50% (extremely uncertain)
- Response: Return result with warning "Low confidence result. Consider recording again for better accuracy"

### API Errors

**File Size Exceeded:**
- Error: Uploaded audio file exceeds maximum size (e.g., 10 MB)
- Response: Return HTTP 413 with error message "File too large. Maximum size is 10 MB"

**Rate Limiting:**
- Error: Too many requests from same client
- Response: Return HTTP 429 with error message "Too many requests. Please wait before trying again"

**Server Overload:**
- Error: Backend server at capacity
- Response: Return HTTP 503 with error message "Service temporarily unavailable. Please try again shortly"

## Testing Strategy

### Dual Testing Approach

The system requires both unit testing and property-based testing for comprehensive coverage:

**Unit Tests** focus on:
- Specific examples demonstrating correct behavior
- Edge cases (e.g., exactly 5-second recording, exactly 10-second recording)
- Error conditions (invalid formats, missing data)
- Integration points between components
- Model performance metrics on ICBHI 2017 dataset

**Property-Based Tests** focus on:
- Universal properties that hold for all inputs
- Comprehensive input coverage through randomization
- Invariants that must be maintained across operations
- Boundary conditions with generated test cases

Together, unit tests catch concrete bugs while property tests verify general correctness across the input space.

### Property-Based Testing Configuration

**Framework Selection:**
- **Python Backend**: Use Hypothesis for property-based testing
- **TypeScript Frontend**: Use fast-check for property-based testing

**Test Configuration:**
- Each property test MUST run minimum 100 iterations
- Each test MUST include a comment tag referencing the design property
- Tag format: `# Feature: acoustix-pulse-respiratory-analysis, Property N: [property text]`

**Example Property Test Structure (Python):**
```python
from hypothesis import given, strategies as st
import numpy as np

@given(st.lists(st.floats(min_value=-1.0, max_value=1.0), min_size=80000, max_size=160000))
def test_property_7_confidence_score_bounds(audio_samples):
    """
    Feature: acoustix-pulse-respiratory-analysis
    Property 7: Confidence score bounds
    
    For any classification result, the confidence score SHALL be 
    a value between 0.0 and 1.0
    """
    audio = np.array(audio_samples, dtype=np.float32)
    spectrogram = mel_spectrogram_generator.generate(audio)
    category, confidence, _ = classifier.predict(spectrogram)
    
    assert 0.0 <= confidence <= 1.0
```

### Unit Testing Strategy

**Frontend Unit Tests (Jest + React Testing Library):**
- Test RecordingInterface component state transitions
- Test ResultsDisplay component rendering with mock data
- Test audio level meter calculations
- Test timer display formatting
- Test error message display

**Backend Unit Tests (pytest):**
- Test bandpass filter with known frequency signals
- Test mel-spectrogram generation with synthetic audio
- Test confidence level classification with boundary values (69.9%, 70%, 89.9%, 90%)
- Test API endpoint request/response formats
- Test error handling for various failure modes

**Integration Tests:**
- End-to-end test: record audio → process → display results
- Test complete API flow with real audio samples
- Test model inference with ICBHI dataset samples
- Verify performance requirements with timing measurements

**Model Validation Tests:**
- Evaluate on ICBHI 2017 test set (Requirements 9.1, 9.2, 9.3)
- Verify accuracy ≥ 80%
- Verify sensitivity ≥ 75%
- Verify specificity ≥ 85%
- Test with edge cases: very quiet breathing, coughing, speech

### Test Data

**Synthetic Audio Generation:**
- Generate sine waves at various frequencies for filter testing
- Generate white noise for noise reduction testing
- Generate audio clips of varying durations (1s, 5s, 10s, 15s)

**Real Audio Samples:**
- Use ICBHI 2017 dataset for model validation
- Collect sample recordings for integration testing
- Include edge cases: background noise, quiet breathing, loud breathing

### Continuous Testing

- Run unit tests on every commit
- Run property tests nightly (due to longer execution time)
- Run integration tests before deployment
- Monitor model performance metrics in production
