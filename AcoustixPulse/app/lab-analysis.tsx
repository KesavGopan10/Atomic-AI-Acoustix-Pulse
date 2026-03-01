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
import { analyzeLabReport, LabReportResponse } from '@/services/api';

const reportTypes = [
    { value: 'general', label: 'General', icon: 'document-text' as const },
    { value: 'blood_test', label: 'Blood Test', icon: 'water' as const },
    { value: 'cbc', label: 'CBC', icon: 'analytics' as const },
    { value: 'lipid_panel', label: 'Lipid Panel', icon: 'heart' as const },
    { value: 'liver_function', label: 'Liver', icon: 'fitness' as const },
    { value: 'kidney_function', label: 'Kidney', icon: 'leaf' as const },
    { value: 'thyroid_panel', label: 'Thyroid', icon: 'nuclear' as const },
    { value: 'metabolic_panel', label: 'Metabolic', icon: 'flask' as const },
];

export default function LabAnalysisScreen() {
    const router = useRouter();
    const [selectedType, setSelectedType] = useState('general');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<LabReportResponse | null>(null);

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
            analyzeImage(pickerResult.assets[0].uri, pickerResult.assets[0].fileName || 'lab_report.jpg');
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Camera access needed.');
            return;
        }

        const pickerResult = await ImagePicker.launchCameraAsync({ quality: 0.8 });
        if (!pickerResult.canceled && pickerResult.assets[0]) {
            analyzeImage(pickerResult.assets[0].uri, pickerResult.assets[0].fileName || 'lab_report.jpg');
        }
    };

    const analyzeImage = async (uri: string, name: string) => {
        setIsLoading(true);
        try {
            const ext = (name.split('.').pop() || uri.split('.').pop() || 'jpg').toLowerCase();
            const mimeMap: Record<string, string> = {
                jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
                webp: 'image/webp', gif: 'image/gif',
            };
            const mimeType = mimeMap[ext] || 'image/jpeg';
            const safeFileName = name || `lab_report.${ext}`;
            const res = await analyzeLabReport(uri, safeFileName, selectedType, mimeType);
            setResult(res);
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to analyze lab report.');
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
                <Text style={styles.headerTitle}>Lab Report Analysis</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {!result ? (
                    <>
                        <View style={styles.heroSection}>
                            <View style={[styles.heroIcon, { backgroundColor: 'rgba(6,182,212,0.1)' }]}>
                                <Ionicons name="document-text" size={28} color="#06b6d4" />
                            </View>
                            <Text style={styles.heroTitle}>Upload Lab Report</Text>
                            <Text style={styles.heroSubtitle}>
                                Take a photo of your lab report and get AI-powered analysis with extracted values and interpretation.
                            </Text>
                        </View>

                        <Text style={styles.sectionTitle}>Report Type</Text>
                        <View style={styles.typeGrid}>
                            {reportTypes.map((rt) => (
                                <TouchableOpacity
                                    key={rt.value}
                                    style={[styles.typeCard, selectedType === rt.value && styles.typeCardActive]}
                                    onPress={() => setSelectedType(rt.value)}
                                >
                                    <Ionicons name={rt.icon} size={20} color={selectedType === rt.value ? '#06b6d4' : Colors.textSecondary} />
                                    <Text style={[styles.typeLabel, selectedType === rt.value && { color: '#06b6d4' }]}>
                                        {rt.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.sectionTitle}>Upload Image</Text>

                        <TouchableOpacity style={styles.uploadCard} onPress={pickImage} disabled={isLoading}>
                            <Ionicons name="images" size={40} color="#06b6d4" />
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
                                <ActivityIndicator size="large" color="#06b6d4" />
                                <Text style={styles.loadingText}>Analyzing lab report...</Text>
                            </View>
                        )}
                    </>
                ) : (
                    <>
                        <View style={styles.resultHeader}>
                            <Text style={styles.sectionTitle}>Analysis Results</Text>
                            <TouchableOpacity onPress={() => setResult(null)}>
                                <Text style={styles.newText}>New Report</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Summary */}
                        <View style={styles.summaryCard}>
                            <Text style={styles.summaryTitle}>Summary</Text>
                            <Text style={styles.summaryText}>{result.summary}</Text>
                            <View style={styles.summaryStats}>
                                <View style={styles.summaryStat}>
                                    <Text style={styles.summaryStatValue}>{result.extracted_values.length}</Text>
                                    <Text style={styles.summaryStatLabel}>Values</Text>
                                </View>
                                <View style={styles.summaryStat}>
                                    <Text style={[styles.summaryStatValue, result.abnormal_count > 0 && { color: Colors.amber }]}>
                                        {result.abnormal_count}
                                    </Text>
                                    <Text style={styles.summaryStatLabel}>Abnormal</Text>
                                </View>
                                <View style={styles.summaryStat}>
                                    <Text style={[styles.summaryStatValue, result.critical_flags.length > 0 && { color: Colors.rose }]}>
                                        {result.critical_flags.length}
                                    </Text>
                                    <Text style={styles.summaryStatLabel}>Critical</Text>
                                </View>
                            </View>
                        </View>

                        {/* Critical Flags */}
                        {result.critical_flags.length > 0 && (
                            <View style={styles.criticalSection}>
                                <Text style={styles.criticalTitle}>⚠️ Critical Flags</Text>
                                {result.critical_flags.map((flag, i) => (
                                    <View key={i} style={styles.criticalCard}>
                                        <Ionicons name="alert-circle" size={18} color={Colors.rose} />
                                        <Text style={styles.criticalText}>{flag}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Extracted Values */}
                        {result.extracted_values.length > 0 && (
                            <View style={styles.valuesSection}>
                                <Text style={styles.sectionTitle}>Extracted Values</Text>
                                {result.extracted_values.map((val, i) => (
                                    <View key={i} style={styles.valueCard}>
                                        {Object.entries(val).map(([key, value], j) => (
                                            <View key={j} style={styles.valueRow}>
                                                <Text style={styles.valueLabel}>{key.replace(/_/g, ' ').toUpperCase()}</Text>
                                                <Text style={styles.valueText}>{String(value)}</Text>
                                            </View>
                                        ))}
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Full Report */}
                        {reportLines.length > 0 && (
                            <View style={styles.reportCard}>
                                <Text style={styles.reportTitle}>Full Report</Text>
                                {reportLines.map((line: string, i: number) => {
                                    const t = line.trim();
                                    if (t.startsWith('# ')) return <Text key={i} style={styles.rH1}>{t.replace(/^#+\s*/, '')}</Text>;
                                    if (t.startsWith('## ')) return <Text key={i} style={styles.rH2}>{t.replace(/^#+\s*/, '')}</Text>;
                                    if (t.startsWith('- ')) return (
                                        <View key={i} style={{ flexDirection: 'row', gap: 8, paddingLeft: 8 }}>
                                            <Text style={{ color: '#06b6d4', lineHeight: 22 }}>•</Text>
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
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xl },
    typeCard: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.cardDark, paddingHorizontal: 14, paddingVertical: 10, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.cardBorder },
    typeCardActive: { borderColor: '#06b6d4', borderWidth: 2, backgroundColor: 'rgba(6,182,212,0.08)' },
    typeLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
    uploadCard: { backgroundColor: Colors.cardDark, borderRadius: BorderRadius.xl, padding: Spacing.xxl, alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder, borderStyle: 'dashed', marginBottom: Spacing.md, gap: 8 },
    uploadTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
    uploadSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary },
    loadingContainer: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
    loadingText: { fontSize: FontSize.md, color: Colors.textSecondary },
    resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.lg },
    newText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#06b6d4' },
    summaryCard: { backgroundColor: Colors.cardDark, borderRadius: BorderRadius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.cardBorder, marginBottom: Spacing.lg },
    summaryTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
    summaryText: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.lg },
    summaryStats: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: Colors.slate800, paddingTop: Spacing.lg },
    summaryStat: { alignItems: 'center' },
    summaryStatValue: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, color: Colors.primary },
    summaryStatLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    criticalSection: { marginBottom: Spacing.lg },
    criticalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.rose, marginBottom: Spacing.sm },
    criticalCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: Colors.roseBg, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(244,63,94,0.2)', marginBottom: Spacing.xs },
    criticalText: { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1, lineHeight: 20 },
    valuesSection: { marginBottom: Spacing.lg },
    valueCard: { backgroundColor: Colors.cardDark, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.cardBorder, marginBottom: Spacing.sm },
    valueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
    valueLabel: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.textSecondary, letterSpacing: 0.5 },
    valueText: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.medium },
    reportCard: { backgroundColor: 'rgba(6,182,212,0.05)', borderRadius: BorderRadius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: 'rgba(6,182,212,0.2)', gap: 6 },
    reportTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
    rH1: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: Spacing.md },
    rH2: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: Spacing.sm },
    rText: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22 },
});
