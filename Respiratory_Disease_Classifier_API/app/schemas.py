"""
app.schemas
-----------
Pydantic models and enums shared across routers.
"""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class RespiratoryDisease(str, Enum):
    """The 8 respiratory conditions the model can classify."""

    asthma = "Asthma"
    bronchiectasis = "Bronchiectasis"
    bronchiolitis = "Bronchiolitis"
    copd = "COPD"
    healthy = "Healthy"
    lrti = "LRTI"
    pneumonia = "Pneumonia"
    urti = "URTI"


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class ReportRequest(BaseModel):
    """Request body for the /report endpoint."""

    disease: RespiratoryDisease = Field(
        ..., description="Diagnosed respiratory condition"
    )
    age: Optional[int] = Field(
        None, ge=0, le=150, description="Patient age in years"
    )
    height: Optional[float] = Field(
        None, gt=0, description="Patient height in cm"
    )
    weight: Optional[float] = Field(
        None, gt=0, description="Patient weight in kg"
    )


# ---------------------------------------------------------------------------
# Response models  (used in OpenAPI docs)
# ---------------------------------------------------------------------------

class PredictionResponse(BaseModel):
    """Response from the /predict endpoint."""

    prediction: str
    confidence: float
    all_probabilities: dict[str, float]


class ReportResponse(BaseModel):
    """Response from the /report endpoint."""

    disease: str
    patient_info: dict
    report: str
    model: str
    tokens_used: dict[str, int]


# ---------------------------------------------------------------------------
# Heart Disease — Enums
# ---------------------------------------------------------------------------

class ChestPainType(str, Enum):
    """ASY = Asymptomatic, ATA = Atypical Angina, NAP = Non-Anginal, TA = Typical Angina."""
    asy = "ASY"
    ata = "ATA"
    nap = "NAP"
    ta = "TA"


class RestingECG(str, Enum):
    normal = "Normal"
    st = "ST"
    lvh = "LVH"


class STSlope(str, Enum):
    up = "Up"
    flat = "Flat"
    down = "Down"


class Sex(str, Enum):
    male = "M"
    female = "F"


class ExerciseAngina(str, Enum):
    yes = "Y"
    no = "N"


# ---------------------------------------------------------------------------
# Heart Disease — Request model
# ---------------------------------------------------------------------------

class HeartDiseaseInput(BaseModel):
    """Clinical input for heart disease risk assessment."""

    age: int = Field(..., ge=1, le=120, description="Patient age in years")
    sex: Sex = Field(..., description="M or F")
    chest_pain_type: ChestPainType = Field(..., description="ASY / ATA / NAP / TA")
    resting_bp: int = Field(..., ge=0, le=300, description="Resting blood pressure (mm Hg)")
    cholesterol: int = Field(..., ge=0, le=700, description="Serum cholesterol (mg/dl)")
    fasting_bs: int = Field(..., ge=0, le=1, description="Fasting blood sugar > 120 mg/dl (1=true, 0=false)")
    resting_ecg: RestingECG = Field(..., description="Normal / ST / LVH")
    max_hr: int = Field(..., ge=50, le=250, description="Maximum heart rate achieved")
    exercise_angina: ExerciseAngina = Field(..., description="Exercise-induced angina (Y/N)")
    oldpeak: float = Field(..., ge=-5, le=10, description="ST depression (oldpeak)")
    st_slope: STSlope = Field(..., description="Slope of peak exercise ST segment (Up/Flat/Down)")


# ---------------------------------------------------------------------------
# Heart Disease — Response model
# ---------------------------------------------------------------------------

class HeartAnalysisResponse(BaseModel):
    """Multi-step analysis response: Triage → Diagnosis → Report."""

    patient_input: dict
    triage: dict
    diagnosis: dict
    report: str
    model: str
    tokens_used: dict[str, int]


# ---------------------------------------------------------------------------
# Medical Scan — Enums & models
# ---------------------------------------------------------------------------

class ScanType(str, Enum):
    """Supported medical scan types for image analysis."""
    chest_xray = "chest_xray"
    ecg = "ecg"
    ct_scan = "ct_scan"
    mri = "mri"


class ScanAnalysisResponse(BaseModel):
    """Response from the /scan/analyze endpoint."""

    scan_type: str
    findings: dict
    report: str
    model: str
    tokens_used: dict[str, int]


# ---------------------------------------------------------------------------
# Symptom Checker — models
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    """A single message in the symptom checker conversation."""

    role: str = Field(..., pattern="^(user|assistant)$", description="'user' or 'assistant'")
    content: str = Field(..., min_length=1, description="Message text")


class SymptomChatRequest(BaseModel):
    """
    Stateless chat — the client sends the full conversation history each time.
    This keeps the API simple (no server-side sessions).
    """

    messages: list[ChatMessage] = Field(
        ..., min_length=1, description="Conversation history (oldest first)"
    )


class SymptomChatResponse(BaseModel):
    """Response from the symptom checker chatbot."""

    reply: str
    follow_up_questions: list[str]
    suspected_conditions: list[dict]
    urgency: str
    should_continue: bool
    tokens_used: dict[str, int]


# ---------------------------------------------------------------------------
# Drug Interaction — models
# ---------------------------------------------------------------------------

class DrugCheckRequest(BaseModel):
    """Request body for drug interaction check."""

    medications: list[str] = Field(
        ..., min_length=1, max_length=20,
        description="List of medication names (1–20)",
    )
    condition: Optional[str] = Field(
        None, description="Patient's diagnosed condition (e.g., 'COPD', 'Heart Failure')",
    )
    age: Optional[int] = Field(None, ge=0, le=150, description="Patient age")
    allergies: Optional[list[str]] = Field(
        None, description="Known drug allergies",
    )


class DrugCheckResponse(BaseModel):
    """Response from the drug interaction checker."""

    medications_checked: list[str]
    interactions: list[dict]
    warnings: list[dict]
    safe_summary: str
    report: str
    model: str
    tokens_used: dict[str, int]


# ---------------------------------------------------------------------------
# Lab Report — models
# ---------------------------------------------------------------------------

class LabReportType(str, Enum):
    """Supported lab report types."""
    blood_test = "blood_test"
    urine_test = "urine_test"
    lipid_panel = "lipid_panel"
    liver_function = "liver_function"
    kidney_function = "kidney_function"
    thyroid_panel = "thyroid_panel"
    cbc = "cbc"
    metabolic_panel = "metabolic_panel"
    general = "general"


class LabReportResponse(BaseModel):
    """Response from the lab report analyzer."""

    report_type: str
    extracted_values: list[dict]
    abnormal_count: int
    critical_flags: list[str]
    summary: str
    report: str
    model: str
    tokens_used: dict[str, int]
