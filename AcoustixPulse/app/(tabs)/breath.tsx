import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    Animated,
    Alert,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
    useAudioRecorder,
    AudioModule,
    setAudioModeAsync,
    useAudioRecorderState,
    RecordingPresets,
    IOSOutputFormat,
    AudioQuality,
} from 'expo-audio';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { predictAudio } from '@/services/api';
import { addAnalysis } from '@/services/storage';

/**
 * Recording strategy:
 *  - Android: HIGH_QUALITY preset → m4a/AAC — backend now has ffmpeg so librosa reads it ✅
 *  - iOS: LinearPCM → WAV — libsndfile reads natively ✅
 */
const RECORDING_OPTIONS = {
    ...RecordingPresets.HIGH_QUALITY,
    // Override iOS to record as LinearPCM (.wav) — bypasses the need for ffmpeg on iOS path
    ios: {
        outputFormat: IOSOutputFormat.LINEARPCM,
        audioQuality: AudioQuality.MAX,
        sampleRate: 44100,
        numberOfChannels: 1,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
    },
};

export default function BreathCaptureScreen() {
    const router = useRouter();
    const audioRecorder = useAudioRecorder(RECORDING_OPTIONS as any);
    const recorderState = useAudioRecorderState(audioRecorder);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('Waiting for respiratory input...');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const autoStopTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const ringAnim1 = useRef(new Animated.Value(0.8)).current;
    const ringAnim2 = useRef(new Animated.Value(0.6)).current;
    const waveAnims = useRef(
        Array.from({ length: 7 }, () => new Animated.Value(0.3))
    ).current;

    useEffect(() => {
        (async () => {
            const status = await AudioModule.requestRecordingPermissionsAsync();
            if (!status.granted) {
                Alert.alert('Permission Required', 'Microphone access is needed to record breath sounds.');
            }
            await setAudioModeAsync({
                playsInSilentMode: true,
                allowsRecording: true,
            });
        })();
        return () => {
            if (progressInterval.current) clearInterval(progressInterval.current);
            if (autoStopTimeout.current) clearTimeout(autoStopTimeout.current);
        };
    }, []);

    useEffect(() => {
        if (recorderState.isRecording) {
            startPulseAnimation();
            startWaveAnimation();
        }
    }, [recorderState.isRecording]);

    const startPulseAnimation = () => {
        Animated.loop(Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])).start();
        Animated.loop(Animated.sequence([
            Animated.timing(ringAnim1, { toValue: 1.1, duration: 1500, useNativeDriver: true }),
            Animated.timing(ringAnim1, { toValue: 0.9, duration: 1500, useNativeDriver: true }),
        ])).start();
        Animated.loop(Animated.sequence([
            Animated.timing(ringAnim2, { toValue: 1.05, duration: 2000, useNativeDriver: true }),
            Animated.timing(ringAnim2, { toValue: 0.85, duration: 2000, useNativeDriver: true }),
        ])).start();
    };

    const startWaveAnimation = () => {
        waveAnims.forEach((anim) => {
            Animated.loop(Animated.sequence([
                Animated.timing(anim, { toValue: 0.5 + Math.random() * 0.5, duration: 300 + Math.random() * 400, useNativeDriver: true }),
                Animated.timing(anim, { toValue: 0.2 + Math.random() * 0.3, duration: 300 + Math.random() * 400, useNativeDriver: true }),
            ])).start();
        });
    };

    const startRecording = async () => {
        try {
            await audioRecorder.prepareToRecordAsync();
            audioRecorder.record();
            setProgress(0);
            setStatusText('Recording breath sounds...');

            let prog = 0;
            progressInterval.current = setInterval(() => {
                prog += 1;
                setProgress(Math.min(prog, 100));
                if (prog >= 100 && progressInterval.current) clearInterval(progressInterval.current);
            }, 100);

            autoStopTimeout.current = setTimeout(() => handleStopRecording(), 10000);
        } catch (err: any) {
            console.error('Failed to start recording:', err);
            Alert.alert('Recording Error', err.message || 'Failed to start recording.');
        }
    };

    const handleStopRecording = async () => {
        if (progressInterval.current) clearInterval(progressInterval.current);
        if (autoStopTimeout.current) clearTimeout(autoStopTimeout.current);
        setProgress(100);
        setStatusText('Processing audio...');

        try {
            await audioRecorder.stop();
            const uri = audioRecorder.uri;

            if (!uri) {
                Alert.alert('Recording Error', 'No recording found. Please try again.');
                setStatusText('Waiting for respiratory input...');
                return;
            }

            setIsAnalyzing(true);
            setStatusText('Analyzing with AI...');

            const uriParts = uri.split('/');
            const rawName = uriParts[uriParts.length - 1] || '';
            const ext = Platform.OS === 'ios' ? '.wav' : '.m4a';
            const fileName = rawName || `breath_recording${ext}`;

            try {
                const result = await predictAudio(uri, fileName);
                // Persist to history for home/insights screens
                addAnalysis({
                    prediction: result.prediction,
                    confidence: result.confidence,
                    all_probabilities: result.all_probabilities,
                });
                router.push({
                    pathname: '/results',
                    params: {
                        prediction: result.prediction,
                        confidence: String(result.confidence),
                        allProbabilities: JSON.stringify(result.all_probabilities),
                    },
                });
            } catch (apiErr: any) {
                console.error('Prediction API error:', apiErr);
                Alert.alert('Analysis Failed', apiErr.message || 'Server could not analyze audio. Please try again.');
                setStatusText('Analysis failed. Try again.');
            } finally {
                setIsAnalyzing(false);
            }
        } catch (err: any) {
            console.error('Failed to stop recording:', err);
            setStatusText('Recording error. Try again.');
        }
    };

    const handlePress = () => {
        if (recorderState.isRecording) {
            handleStopRecording();
        } else if (!isAnalyzing) {
            startRecording();
        }
    };

    const isRecording = recorderState.isRecording;
    const waveHeights = [32, 48, 64, 80, 64, 48, 32];
    const waveOpacities = [0.4, 0.6, 0.8, 1, 0.8, 0.6, 0.4];

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Initial Breath Capture</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.mainContent}>
                <View style={styles.brandSection}>
                    <View style={styles.brandBadge}>
                        <Ionicons name="fitness" size={14} color={Colors.primary} />
                        <Text style={styles.brandText}>ACOUSTIX PULSE AI</Text>
                    </View>
                    <Text style={styles.instruction}>
                        Position the microphone{'\n'}and exhale steadily.
                    </Text>
                </View>

                <View style={styles.visualizerContainer}>
                    <Animated.View style={[styles.outerRing2, { transform: [{ scale: ringAnim2 }] }]} />
                    <Animated.View style={[styles.outerRing1, { transform: [{ scale: ringAnim1 }] }]} />
                    <Animated.View style={[styles.mainCircle, { transform: [{ scale: pulseAnim }] }]}>
                        <View style={styles.innerCircle}>
                            <Ionicons
                                name="mic"
                                size={48}
                                color={isRecording ? '#22d3ee' : Colors.primary}
                            />
                        </View>
                        {isRecording && (
                            <View style={styles.wavesOverlay}>
                                {waveAnims.map((anim, i) => (
                                    <Animated.View
                                        key={i}
                                        style={[styles.waveBar, {
                                            height: waveHeights[i],
                                            opacity: waveOpacities[i],
                                            backgroundColor: Colors.primary,
                                            transform: [{ scaleY: anim }],
                                        }]}
                                    />
                                ))}
                            </View>
                        )}
                    </Animated.View>
                </View>

                <View style={styles.progressSection}>
                    <View style={styles.progressHeader}>
                        <Text style={styles.progressLabel}>Analysis Progress</Text>
                        <Text style={styles.progressValue}>{Math.round(progress)}%</Text>
                    </View>
                    <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                    </View>
                    <Text style={styles.statusText}>{statusText}</Text>
                </View>

                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        isRecording && styles.actionButtonRecording,
                        isAnalyzing && styles.actionButtonDisabled,
                    ]}
                    onPress={handlePress}
                    disabled={isAnalyzing}
                    activeOpacity={0.85}
                >
                    <Text style={styles.actionButtonText}>
                        {isAnalyzing ? 'Analyzing...' : isRecording ? 'Stop Recording' : 'Start Test'}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.backgroundDark },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, letterSpacing: -0.3 },
    mainContent: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.xxl, paddingTop: Spacing.xxxl },
    brandSection: { alignItems: 'center', gap: Spacing.lg, marginBottom: Spacing.xxxl },
    brandBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: Colors.primaryLight, paddingHorizontal: 14, paddingVertical: 6,
        borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.primaryMedium,
    },
    brandText: { fontSize: 10, fontWeight: FontWeight.semibold, color: Colors.primary, letterSpacing: 1.5 },
    instruction: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center', lineHeight: 34, letterSpacing: -0.5 },
    visualizerContainer: { width: 280, height: 280, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xxxl },
    outerRing2: { position: 'absolute', width: 280, height: 280, borderRadius: 140, borderWidth: 1, borderColor: 'rgba(19,127,236,0.05)' },
    outerRing1: { position: 'absolute', width: 240, height: 240, borderRadius: 120, borderWidth: 2, borderColor: 'rgba(19,127,236,0.1)' },
    mainCircle: {
        width: 200, height: 200, borderRadius: 100,
        backgroundColor: 'rgba(19,127,236,0.12)', alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: 'rgba(19,127,236,0.3)',
        shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 25, elevation: 10,
    },
    innerCircle: { width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(19,127,236,0.2)', alignItems: 'center', justifyContent: 'center' },
    wavesOverlay: { position: 'absolute', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
    waveBar: { width: 3, borderRadius: 2 },
    progressSection: { width: '100%', gap: Spacing.md, marginBottom: Spacing.xxl },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    progressLabel: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.textSecondary },
    progressValue: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, color: Colors.primary },
    progressBarBg: { height: 10, backgroundColor: Colors.slate800, borderRadius: BorderRadius.full, overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: BorderRadius.full },
    statusText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
    actionButton: {
        width: '100%', backgroundColor: Colors.primary, paddingVertical: 16,
        borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center',
        shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
    },
    actionButtonRecording: { backgroundColor: Colors.rose },
    actionButtonDisabled: { backgroundColor: Colors.slate700, opacity: 0.7 },
    actionButtonText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.lg },
});
