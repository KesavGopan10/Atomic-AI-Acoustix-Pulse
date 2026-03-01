const BASE_URL = process.env.EXPO_PUBLIC_API_URL;
if (!BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is not set. Add it to your .env file.');
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PredictionResponse {
    prediction: string;
    confidence: number;
    all_probabilities: Record<string, number>;
}

export interface ReportRequest {
    disease: string;
    age?: number;
    height?: number;
    weight?: number;
}

export interface ReportResponse {
    disease: string;
    patient_info: Record<string, any>;
    report: string;
    model: string;
    tokens_used: Record<string, number>;
}

export interface HeartDiseaseInput {
    age: number;
    sex: 'M' | 'F';
    chest_pain_type: 'ASY' | 'ATA' | 'NAP' | 'TA';
    resting_bp: number;
    cholesterol: number;
    fasting_bs: 0 | 1;
    resting_ecg: 'Normal' | 'ST' | 'LVH';
    max_hr: number;
    exercise_angina: 'Y' | 'N';
    oldpeak: number;
    st_slope: 'Up' | 'Flat' | 'Down';
}

export interface HeartAnalysisResponse {
    patient_input: Record<string, any>;
    triage: Record<string, any>;
    diagnosis: Record<string, any>;
    report: string;
    model: string;
    tokens_used: Record<string, number>;
}

export interface ScanAnalysisResponse {
    scan_type: string;
    findings: Record<string, any>;
    report: string;
    model: string;
    tokens_used: Record<string, number>;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface SymptomChatResponse {
    reply: string;
    follow_up_questions: string[];
    suspected_conditions: Array<Record<string, any>>;
    urgency: string;
    should_continue: boolean;
    tokens_used: Record<string, number>;
}

export interface DrugCheckRequest {
    medications: string[];
    condition?: string;
    age?: number;
    allergies?: string[];
}

export interface DrugCheckResponse {
    medications_checked: string[];
    interactions: Array<Record<string, any>>;
    warnings: Array<Record<string, any>>;
    safe_summary: string;
    report: string;
    model: string;
    tokens_used: Record<string, number>;
}

export interface LabReportResponse {
    report_type: string;
    extracted_values: Array<Record<string, any>>;
    abnormal_count: number;
    critical_flags: string[];
    summary: string;
    report: string;
    model: string;
    tokens_used: Record<string, number>;
}

// ─── API Functions ───────────────────────────────────────────────────────────

export async function healthCheck(): Promise<any> {
    const res = await fetch(`${BASE_URL}/health`);
    return res.json();
}

export async function getClasses(): Promise<any> {
    const res = await fetch(`${BASE_URL}/classes`);
    return res.json();
}

export async function predictAudio(fileUri: string, fileName: string): Promise<PredictionResponse> {
    // Infer MIME type from actual file extension so backend content_type check passes
    const ext = fileName.split('.').pop()?.toLowerCase() || 'm4a';
    const mimeTypeMap: Record<string, string> = {
        wav: 'audio/wav',
        ogg: 'audio/ogg',
        flac: 'audio/flac',
        m4a: 'audio/mp4',
        mp4: 'audio/mp4',
        aac: 'audio/aac',
        webm: 'audio/webm',
        '3gp': 'audio/3gpp',
    };
    const mimeType = mimeTypeMap[ext] || 'audio/mp4';

    const formData = new FormData();
    formData.append('file', {
        uri: fileUri,
        name: fileName,
        type: mimeType,
    } as any);

    const res = await fetch(`${BASE_URL}/predict`, {
        method: 'POST',
        body: formData,
        // Do NOT set Content-Type manually — fetch sets it with the correct boundary
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Prediction failed: ${res.status}`);
    }

    return res.json();
}

export async function generateReport(data: ReportRequest): Promise<ReportResponse> {
    const res = await fetch(`${BASE_URL}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Report generation failed: ${res.status}`);
    }

    return res.json();
}

export async function analyzeHeart(data: HeartDiseaseInput): Promise<HeartAnalysisResponse> {
    const res = await fetch(`${BASE_URL}/heart/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Heart analysis failed: ${res.status}`);
    }

    return res.json();
}

export async function analyzeScan(
    fileUri: string,
    fileName: string,
    scanType: 'chest_xray' | 'ecg' | 'ct_scan' | 'mri' = 'chest_xray',
    mimeType: string = 'image/jpeg'
): Promise<ScanAnalysisResponse> {
    // --- Guard: ensure fileUri is actually a string ---
    if (!fileUri || typeof fileUri !== 'string') {
        throw new Error('Invalid file URI provided for scan upload.');
    }

    // --- Derive a safe filename with extension ---
    // On Android, fileName may be null or a bare content:// path without an extension.
    // We fall back to extracting the extension from the URI or from the mimeType.
    const extFromUri = fileUri.split('.').pop()?.toLowerCase() ?? '';
    const extFromMime = mimeType === 'image/png' ? 'png'
        : mimeType === 'image/webp' ? 'webp'
            : 'jpg';
    const validImageExts = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
    const resolvedExt = validImageExts.has(extFromUri) ? extFromUri : extFromMime;
    // Strip any path component from fileName; if it has no extension, append one.
    const baseName = (fileName || '').split('/').pop()?.split('?')[0] || '';
    const safeFileName = baseName.includes('.') ? baseName : `scan.${resolvedExt}`;

    const formData = new FormData();
    formData.append('file', {
        uri: fileUri,
        name: safeFileName,
        type: mimeType,
    } as any);
    formData.append('scan_type', scanType);

    const res = await fetch(`${BASE_URL}/scan/analyze`, {
        method: 'POST',
        body: formData,
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Scan analysis failed: ${res.status}`);
    }

    return res.json();
}

export async function symptomChat(messages: ChatMessage[]): Promise<SymptomChatResponse> {
    const res = await fetch(`${BASE_URL}/symptoms/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Symptom chat failed: ${res.status}`);
    }

    return res.json();
}

export async function checkDrugs(data: DrugCheckRequest): Promise<DrugCheckResponse> {
    const res = await fetch(`${BASE_URL}/drugs/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Drug check failed: ${res.status}`);
    }

    return res.json();
}

export async function analyzeLabReport(
    fileUri: string,
    fileName: string,
    reportType: string = 'general',
    mimeType: string = 'image/jpeg'
): Promise<LabReportResponse> {
    // --- Guard: ensure fileUri is actually a string ---
    // On some Expo versions, the full asset object can accidentally be passed.
    if (!fileUri || typeof fileUri !== 'string') {
        throw new Error('Invalid file URI provided for lab report upload.');
    }

    // --- Derive a safe filename with extension ---
    // On Android, fileName can be null when picking from gallery (content:// URI).
    // Silently fall back to a safe name derived from MIME type.
    const extFromUri = fileUri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? '';
    const extFromMime = mimeType === 'image/png' ? 'png'
        : mimeType === 'image/webp' ? 'webp'
            : 'jpg';
    const validImageExts = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
    const resolvedExt = validImageExts.has(extFromUri) ? extFromUri : extFromMime;
    // Strip any path component from fileName; if it has no extension, append one.
    const baseName = (fileName || '').split('/').pop()?.split('?')[0] || '';
    const safeFileName = baseName.includes('.') ? baseName : `lab_report.${resolvedExt}`;

    const formData = new FormData();
    formData.append('file', {
        uri: fileUri,
        name: safeFileName,
        type: mimeType,
    } as any);
    formData.append('report_type', reportType);

    const res = await fetch(`${BASE_URL}/lab/analyze`, {
        method: 'POST',
        body: formData,
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Lab analysis failed: ${res.status}`);
    }

    return res.json();
}
