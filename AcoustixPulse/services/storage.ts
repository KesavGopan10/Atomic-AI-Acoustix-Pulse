/**
 * Shared in-memory store for the app session.
 * Stores user profile biometrics and recent analysis results.
 */

export interface UserProfile {
    age: number | null;
    height: number | null; // cm
    weight: number | null; // kg
}

export interface AnalysisRecord {
    prediction: string;
    confidence: number;
    all_probabilities: Record<string, number>;
    timestamp: number; // Date.now()
}

let _profile: UserProfile = { age: null, height: null, weight: null };
let _analyses: AnalysisRecord[] = [];

// ─── Profile ─────────────────────────────────────────────────────────────────

export function getProfile(): UserProfile {
    return { ..._profile };
}

export function setProfile(profile: Partial<UserProfile>): void {
    _profile = { ..._profile, ...profile };
}

// ─── Analysis History ─────────────────────────────────────────────────────────

export function addAnalysis(record: Omit<AnalysisRecord, 'timestamp'>): void {
    _analyses = [{ ...record, timestamp: Date.now() }, ..._analyses].slice(0, 20);
}

export function getAnalyses(): AnalysisRecord[] {
    return [..._analyses];
}

export function getLastAnalysis(): AnalysisRecord | null {
    return _analyses[0] ?? null;
}
