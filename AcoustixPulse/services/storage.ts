/**
 * Shared storage for the app session.
 * Stores user profile biometrics and recent analysis results persistently.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Storage Keys
const PROFILE_KEY = '@acoustix_profile';
const ANALYSES_KEY = '@acoustix_analyses';

// ─── Initialization ──────────────────────────────────────────────────────────

export async function initStorage() {
    try {
        const storedProfile = await AsyncStorage.getItem(PROFILE_KEY);
        if (storedProfile) {
            _profile = JSON.parse(storedProfile);
        }

        const storedAnalyses = await AsyncStorage.getItem(ANALYSES_KEY);
        if (storedAnalyses) {
            _analyses = JSON.parse(storedAnalyses);
        }
    } catch (e) {
        console.error('Failed to load data from storage', e);
    }
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export function getProfile(): UserProfile {
    return { ..._profile };
}

export async function setProfile(profile: Partial<UserProfile>): Promise<void> {
    _profile = { ..._profile, ...profile };
    try {
        await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(_profile));
    } catch (e) {
        console.error('Failed to save profile', e);
    }
}

// ─── Analysis History ─────────────────────────────────────────────────────────

export async function addAnalysis(record: Omit<AnalysisRecord, 'timestamp'>): Promise<void> {
    _analyses = [{ ...record, timestamp: Date.now() }, ..._analyses].slice(0, 20);
    try {
        await AsyncStorage.setItem(ANALYSES_KEY, JSON.stringify(_analyses));
    } catch (e) {
        console.error('Failed to save analyses', e);
    }
}

export function getAnalyses(): AnalysisRecord[] {
    return [..._analyses];
}

export function getLastAnalysis(): AnalysisRecord | null {
    return _analyses[0] ?? null;
}
