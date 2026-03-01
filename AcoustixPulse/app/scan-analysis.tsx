import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { analyzeScan, ScanAnalysisResponse } from '@/services/api';

type ScanType = 'chest_xray' | 'ecg' | 'ct_scan' | 'mri';

const scanTypes: { type: ScanType; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
    { type: 'chest_xray', label: 'Chest X-Ray', icon: 'body', color: Colors.primary },
    { type: 'ecg', label: 'ECG', icon: 'heart', color: Colors.rose },
    { type: 'ct_scan', label: 'CT Scan', icon: 'scan-circle', color: Colors.amber },
    { type: 'mri', label: 'MRI', icon: 'magnet', color: '#a855f7' },
];

export default function ScanAnalysisScreen() {
    const router = useRouter();
    const [selectedType, setSelectedType] = useState<ScanType>('chest_xray');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<ScanAnalysisResponse | null>(null);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Photo library access is needed.');
            return;
        }

        const pickerResult = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
        });

        if (!pickerResult.canceled && pickerResult.assets[0]) {
            const asset = pickerResult.assets[0];
            const uri = typeof asset.uri === 'string' ? asset.uri : '';
            if (!uri) { Alert.alert('Error', 'Could not read image URI.'); return; }
            analyzeImage(uri, asset.fileName || '');
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Camera access is needed.');
            return;
        }

        const pickerResult = await ImagePicker.launchCameraAsync({
            quality: 0.8,
        });

        if (!pickerResult.canceled && pickerResult.assets[0]) {
            const asset = pickerResult.assets[0];
            const uri = typeof asset.uri === 'string' ? asset.uri : '';
            if (!uri) { Alert.alert('Error', 'Could not read camera URI.'); return; }
            analyzeImage(uri, asset.fileName || '');
        }
    };

    const analyzeImage = async (uri: string, name: string) => {
        setIsLoading(true);
        try {
            // Infer MIME from URI extension for accurate Content-Type
            const ext = (name.split('.').pop() || uri.split('.').pop() || 'jpg').toLowerCase();
            const mimeMap: Record<string, string> = {
                jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
                webp: 'image/webp', gif: 'image/gif',
            };
            const mimeType = mimeMap[ext] || 'image/jpeg';
            const safeFileName = name || `scan.${ext}`;
            const res = await analyzeScan(uri, safeFileName, selectedType, mimeType);
            setResult(res);
        } catch (err: any) {
            Alert.alert('Analysis Error', err.message || 'Failed to analyze scan.');
        } finally {
            setIsLoading(false);
        }
    };

    const reportLines = result?.report ? result.report.split('\n').filter((l: string) => l.trim()) : [];

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Medical Image Analysis</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {!result ? (
                    <>
                        <View style={styles.heroSection}>
                            <View style={[styles.heroIcon, { backgroundColor: Colors.amberBg }]}>
                                <Ionicons name="scan" size={28} color={Colors.amber} />
                            </View>
                            <Text style={styles.heroTitle}>Upload Medical Scan</Text>
                            <Text style={styles.heroSubtitle}>
                                Upload an X-ray, ECG, CT, or MRI image for AI-powered analysis and findings.
                            </Text>
                        </View>

                        <Text style={styles.sectionTitle}>Scan Type</Text>
                        <View style={styles.scanTypeGrid}>
                            {scanTypes.map((s) => (
                                <TouchableOpacity
                                    key={s.type}
                                    style={[styles.scanTypeCard, selectedType === s.type && { borderColor: s.color, borderWidth: 2 }]}
                                    onPress={() => setSelectedType(s.type)}
                                >
                                    <View style={[styles.scanTypeIcon, { backgroundColor: s.color + '20' }]}>
                                        <Ionicons name={s.icon} size={22} color={s.color} />
                                    </View>
                                    <Text style={[styles.scanTypeLabel, selectedType === s.type && { color: s.color }]}>{s.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.sectionTitle}>Upload Image</Text>

                        <TouchableOpacity style={styles.uploadCard} onPress={pickImage} disabled={isLoading}>
                            <Ionicons name="images" size={40} color={Colors.primary} />
                            <Text style={styles.uploadTitle}>Choose from Gallery</Text>
                            <Text style={styles.uploadSubtitle}>JPEG, PNG, WebP</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.uploadCard} onPress={takePhoto} disabled={isLoading}>
                            <Ionicons name="camera" size={40} color={Colors.amber} />
                            <Text style={styles.uploadTitle}>Take a Photo</Text>
                            <Text style={styles.uploadSubtitle}>Use camera to capture</Text>
                        </TouchableOpacity>

                        {isLoading && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={Colors.primary} />
                                <Text style={styles.loadingText}>Analyzing image with AI...</Text>
                            </View>
                        )}
                    </>
                ) : (
                    <>
                        <View style={styles.resultHeader}>
                            <Text style={styles.sectionTitle}>Scan Results</Text>
                            <TouchableOpacity onPress={() => setResult(null)}>
                                <Text style={styles.newScanText}>New Scan</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Findings */}
                        {result.findings && Object.keys(result.findings).length > 0 && (
                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Findings</Text>
                                {Object.entries(result.findings).map(([key, value], i) => (
                                    <View key={i} style={styles.dataRow}>
                                        <Text style={styles.dataLabel}>{key.replace(/_/g, ' ').toUpperCase()}</Text>
                                        <Text style={styles.dataValue}>
                                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Report */}
                        {reportLines.length > 0 && (
                            <View style={styles.reportCard}>
                                <Text style={styles.cardTitle}>AI Report</Text>
                                {reportLines.map((line: string, i: number) => {
                                    const t = line.trim();
                                    if (t.startsWith('# ')) return <Text key={i} style={styles.rH1}>{t.replace(/^#+\s*/, '')}</Text>;
                                    if (t.startsWith('## ')) return <Text key={i} style={styles.rH2}>{t.replace(/^#+\s*/, '')}</Text>;
                                    if (t.startsWith('- ')) return (
                                        <View key={i} style={{ flexDirection: 'row', gap: 8, paddingLeft: 8 }}>
                                            <Text style={{ color: Colors.primary, lineHeight: 22 }}>•</Text>
                                            <Text style={styles.rText}>{t.slice(2).replace(/\*\*/g, '')}</Text>
                                        </View>
                                    );
                                    return <Text key={i} style={styles.rText}>{t.replace(/\*\*/g, '')}</Text>;
                                })}
                            </View>
                        )}
                    </>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.backgroundDark },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.slate800 },
    headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex: 1, textAlign: 'center' },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
    heroSection: { alignItems: 'center', paddingVertical: Spacing.xxl },
    heroIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
    heroTitle: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
    heroSubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
    sectionTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md, marginTop: Spacing.md },
    scanTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xl },
    scanTypeCard: { flex: 1, minWidth: '45%', backgroundColor: Colors.cardDark, borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder, gap: 8 },
    scanTypeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    scanTypeLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
    uploadCard: { backgroundColor: Colors.cardDark, borderRadius: BorderRadius.xl, padding: Spacing.xxl, alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder, borderStyle: 'dashed', marginBottom: Spacing.md, gap: 8 },
    uploadTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
    uploadSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary },
    loadingContainer: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
    loadingText: { fontSize: FontSize.md, color: Colors.textSecondary },
    resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.lg },
    newScanText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
    card: { backgroundColor: Colors.cardDark, borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.cardBorder, marginBottom: Spacing.lg },
    cardTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
    dataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.slate800 },
    dataLabel: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.textSecondary, letterSpacing: 0.5, flex: 1 },
    dataValue: { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1, textAlign: 'right' },
    reportCard: { backgroundColor: 'rgba(19,127,236,0.05)', borderRadius: BorderRadius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: 'rgba(19,127,236,0.2)', gap: 6, marginBottom: Spacing.lg },
    rH1: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: Spacing.md },
    rH2: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: Spacing.sm },
    rText: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22 },
});
