# Requirements Document

## Introduction

Acoustix Pulse is an AI-powered respiratory analysis tool that enables users to perform on-demand breath sound analysis using their smartphone microphone. The system analyzes controlled breath sounds to provide early risk indicators for cardio-pulmonary abnormalities through acoustic signature analysis, delivering explainable results with visual heatmaps.

## Glossary

- **Audio_Recorder**: Component responsible for capturing breath sounds via microphone
- **Audio_Preprocessor**: Component that filters and transforms raw audio into analysis-ready format
- **Mel_Spectrogram_Generator**: Component that converts audio into mel-scale frequency representation
- **AI_Classifier**: Neural network model that predicts respiratory risk categories
- **Grad_CAM_Explainer**: Component that generates visual explanations of AI predictions
- **Result_Presenter**: Component that displays analysis results to users
- **System**: The complete Acoustix Pulse application
- **User**: Person using the application to analyze their breath sounds
- **Breath_Recording**: Audio capture of controlled exhalation into microphone
- **Risk_Category**: Classification output (Normal, Wheeze Pattern, Crackle Pattern, Mixed Abnormality)
- **Confidence_Score**: Numerical measure of prediction certainty (0-100%)
- **Heatmap**: Visual overlay showing spectral regions contributing to abnormality detection

## Requirements

### Requirement 1: Audio Recording

**User Story:** As a user, I want to record my breath sounds through my phone's microphone, so that the system can analyze my respiratory health.

#### Acceptance Criteria

1. WHEN a user initiates recording, THE Audio_Recorder SHALL capture audio at 16 kHz sample rate in mono format
2. WHEN recording is active, THE Audio_Recorder SHALL enforce a duration between 5 and 10 seconds
3. WHEN the recording duration reaches 10 seconds, THE Audio_Recorder SHALL automatically stop recording
4. WHEN a user attempts to submit a recording shorter than 5 seconds, THE System SHALL reject the recording and prompt for re-recording
5. WHEN recording is in progress, THE System SHALL display visual feedback indicating recording status and remaining time
6. WHEN recording completes successfully, THE System SHALL proceed to audio preprocessing

### Requirement 2: Audio Preprocessing

**User Story:** As a system, I want to preprocess raw breath recordings, so that the AI model receives clean, standardized input for accurate analysis.

#### Acceptance Criteria

1. WHEN raw audio is received, THE Audio_Preprocessor SHALL apply a bandpass filter with cutoff frequencies of 100 Hz and 2500 Hz
2. WHEN filtering is complete, THE Audio_Preprocessor SHALL apply noise reduction to remove background interference
3. WHEN preprocessing is complete, THE Mel_Spectrogram_Generator SHALL convert the filtered audio into a mel-scale spectrogram representation
4. WHEN generating the spectrogram, THE Mel_Spectrogram_Generator SHALL use parameters suitable for respiratory sound analysis
5. WHEN preprocessing fails due to invalid audio, THE System SHALL return an error message and request re-recording

### Requirement 3: AI Classification

**User Story:** As a user, I want the system to classify my breath sounds into risk categories, so that I can understand potential respiratory abnormalities.

#### Acceptance Criteria

1. WHEN a mel-spectrogram is provided, THE AI_Classifier SHALL predict one of four risk categories: Normal, Wheeze Pattern, Crackle Pattern, or Mixed Abnormality
2. WHEN classification is performed, THE AI_Classifier SHALL generate a confidence score between 0% and 100%
3. WHEN the confidence score is 90% or above, THE System SHALL label the prediction as "High Confidence"
4. WHEN the confidence score is between 70% and 89%, THE System SHALL label the prediction as "Moderate Confidence"
5. WHEN the confidence score is below 70%, THE System SHALL label the prediction as "Low Confidence"
6. WHEN classification completes, THE System SHALL proceed to generate explainability visualizations

### Requirement 4: Explainability Visualization

**User Story:** As a user, I want to see which parts of my breath sound contributed to the analysis result, so that I can understand the AI's reasoning.

#### Acceptance Criteria

1. WHEN classification is complete, THE Grad_CAM_Explainer SHALL generate a heatmap overlay on the mel-spectrogram
2. WHEN generating the heatmap, THE Grad_CAM_Explainer SHALL highlight spectral regions that contributed most to the abnormality detection
3. WHEN displaying results, THE Result_Presenter SHALL overlay the heatmap on the original spectrogram
4. WHEN the prediction is "Normal", THE System SHALL display a heatmap showing uniform low activation
5. WHEN the prediction indicates abnormality, THE System SHALL display a heatmap with highlighted regions corresponding to detected patterns

### Requirement 5: Results Display

**User Story:** As a user, I want to view my analysis results in a clear format, so that I can understand my respiratory health status.

#### Acceptance Criteria

1. WHEN analysis completes, THE Result_Presenter SHALL display the predicted risk category
2. WHEN displaying results, THE Result_Presenter SHALL show the confidence score as a percentage
3. WHEN displaying results, THE Result_Presenter SHALL show the mel-spectrogram with Grad-CAM heatmap overlay
4. WHEN displaying results, THE Result_Presenter SHALL include a medical disclaimer stating this is not a diagnostic tool
5. WHEN results are displayed, THE System SHALL provide an option to perform a new recording

### Requirement 6: Performance Requirements

**User Story:** As a user, I want fast analysis results, so that I can get immediate feedback on my respiratory health.

#### Acceptance Criteria

1. WHEN audio processing begins, THE System SHALL complete the entire analysis pipeline within 3 seconds
2. WHEN the AI model performs inference, THE AI_Classifier SHALL return predictions within 1 second of receiving the spectrogram
3. WHEN preprocessing audio, THE Audio_Preprocessor SHALL complete filtering and spectrogram generation within 2 seconds

### Requirement 7: Privacy and Data Handling

**User Story:** As a user, I want my breath recordings to be handled securely, so that my health data remains private.

#### Acceptance Criteria

1. WHEN audio processing completes, THE System SHALL delete the raw audio file from storage
2. WHEN analysis results are generated, THE System SHALL retain only the spectrogram image and prediction results
3. WHEN a user closes the application, THE System SHALL clear all temporary audio data from memory
4. THE System SHALL NOT transmit raw audio to external servers without explicit user consent
5. WHEN storing analysis results, THE System SHALL NOT associate recordings with personally identifiable information

### Requirement 8: User Guidance

**User Story:** As a user, I want clear instructions on how to record my breath, so that I can provide a quality sample for analysis.

#### Acceptance Criteria

1. WHEN a user launches the application, THE System SHALL display an instruction screen explaining the recording process
2. WHEN recording begins, THE System SHALL display animated visual guidance showing proper breath technique
3. WHEN recording is in progress, THE System SHALL provide real-time feedback on audio input levels
4. WHEN audio input is too quiet, THE System SHALL prompt the user to blow harder into the microphone
5. WHEN audio input is too loud or clipping, THE System SHALL warn the user to reduce breath intensity

### Requirement 9: Model Accuracy

**User Story:** As a system operator, I want the AI model to achieve reliable accuracy, so that users receive trustworthy analysis results.

#### Acceptance Criteria

1. WHEN evaluated on the ICBHI 2017 test dataset, THE AI_Classifier SHALL achieve at least 80% classification accuracy
2. WHEN evaluated on the ICBHI 2017 test dataset, THE AI_Classifier SHALL achieve at least 75% sensitivity for abnormality detection
3. WHEN evaluated on the ICBHI 2017 test dataset, THE AI_Classifier SHALL achieve at least 85% specificity for normal classification

### Requirement 10: Web Application Architecture

**User Story:** As a developer, I want a clean separation between frontend and backend, so that the system is maintainable and scalable.

#### Acceptance Criteria

1. THE System SHALL implement a React-based frontend for user interface
2. THE System SHALL implement a FastAPI-based backend for audio processing and AI inference
3. WHEN the frontend needs analysis, THE System SHALL communicate with the backend via REST API
4. WHEN audio is recorded, THE frontend SHALL send audio data to the backend as a multipart form upload
5. WHEN analysis completes, THE backend SHALL return results as JSON containing risk category, confidence score, and spectrogram image data
