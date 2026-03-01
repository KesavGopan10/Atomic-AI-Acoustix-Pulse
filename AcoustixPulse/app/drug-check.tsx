import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    TextInput,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { checkDrugs, DrugCheckResponse } from '@/services/api';

export default function DrugCheckScreen() {
    const router = useRouter();
    const [medications, setMedications] = useState<string[]>(['']);
    const [condition, setCondition] = useState('');
    const [age, setAge] = useState('');
    const [allergies, setAllergies] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<DrugCheckResponse | null>(null);

    const addMedication = () => setMedications([...medications, '']);
    const updateMedication = (index: number, value: string) => {
        const updated = [...medications];
        updated[index] = value;
        setMedications(updated);
    };
    const removeMedication = (index: number) => {
        if (medications.length > 1) {
            setMedications(medications.filter((_, i) => i !== index));
        }
    };

    const handleCheck = async () => {
        const validMeds = medications.filter((m) => m.trim());
        if (validMeds.length === 0) {
            Alert.alert('Error', 'Please add at least one medication.');
            return;
        }

        setIsLoading(true);
        try {
            const res = await checkDrugs({
                medications: validMeds,
                condition: condition.trim() || undefined,
                age: age ? parseInt(age) : undefined,
                allergies: allergies.trim() ? allergies.split(',').map((a) => a.trim()) : undefined,
            });
            setResult(res);
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to check drug interactions.');
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
                <Text style={styles.headerTitle}>Drug Interactions</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {!result ? (
                    <>
                        <View style={styles.heroSection}>
                            <View style={[styles.heroIcon, { backgroundColor: 'rgba(168,85,247,0.1)' }]}>
                                <Ionicons name="medkit" size={28} color="#a855f7" />
                            </View>
                            <Text style={styles.heroTitle}>Medication Safety Check</Text>
                            <Text style={styles.heroSubtitle}>
                                Enter your medications to check for interactions, warnings, and contraindications.
                            </Text>
                        </View>

                        <View style={styles.formCard}>
                            <Text style={styles.fieldLabel}>Medications</Text>
                            {medications.map((med, i) => (
                                <View key={i} style={styles.medRow}>
                                    <TextInput
                                        style={[styles.textInput, { flex: 1 }]}
                                        value={med}
                                        onChangeText={(val) => updateMedication(i, val)}
                                        placeholder={`Medication ${i + 1}`}
                                        placeholderTextColor={Colors.textMuted}
                                    />
                                    {medications.length > 1 && (
                                        <TouchableOpacity style={styles.removeBtn} onPress={() => removeMedication(i)}>
                                            <Ionicons name="close-circle" size={22} color={Colors.rose} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}
                            <TouchableOpacity style={styles.addBtn} onPress={addMedication}>
                                <Ionicons name="add-circle" size={20} color={Colors.primary} />
                                <Text style={styles.addBtnText}>Add Medication</Text>
                            </TouchableOpacity>

                            <Text style={[styles.fieldLabel, { marginTop: Spacing.xl }]}>Condition (optional)</Text>
                            <TextInput
                                style={styles.textInput}
                                value={condition}
                                onChangeText={setCondition}
                                placeholder="e.g., COPD, Heart Failure"
                                placeholderTextColor={Colors.textMuted}
                            />

                            <View style={styles.rowFields}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.fieldLabel}>Age (optional)</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        value={age}
                                        onChangeText={setAge}
                                        keyboardType="number-pad"
                                        placeholder="Age"
                                        placeholderTextColor={Colors.textMuted}
                                    />
                                </View>
                            </View>

                            <Text style={styles.fieldLabel}>Allergies (optional, comma-separated)</Text>
                            <TextInput
                                style={styles.textInput}
                                value={allergies}
                                onChangeText={setAllergies}
                                placeholder="e.g., Penicillin, Sulfa"
                                placeholderTextColor={Colors.textMuted}
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.checkButton}
                            onPress={handleCheck}
                            disabled={isLoading}
                            activeOpacity={0.85}
                        >
                            {isLoading ? (
                                <ActivityIndicator color={Colors.white} />
                            ) : (
                                <>
                                    <Ionicons name="shield-checkmark" size={20} color={Colors.white} />
                                    <Text style={styles.checkButtonText}>Check Interactions</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <View style={styles.resultHeader}>
                            <Text style={styles.sectionTitle}>Results</Text>
                            <TouchableOpacity onPress={() => setResult(null)}>
                                <Text style={styles.newCheckText}>New Check</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Safety Summary */}
                        <View style={styles.summaryCard}>
                            <Ionicons name="shield-checkmark" size={24} color={Colors.emerald} />
                            <Text style={styles.summaryText}>{result.safe_summary}</Text>
                        </View>

                        {/* Interactions */}
                        {result.interactions.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Interactions</Text>
                                {result.interactions.map((interaction, i) => (
                                    <View key={i} style={styles.interactionCard}>
                                        <Ionicons name="warning" size={20} color={Colors.amber} />
                                        <Text style={styles.interactionText}>
                                            {typeof interaction === 'object' ? JSON.stringify(interaction) : String(interaction)}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Warnings */}
                        {result.warnings.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Warnings</Text>
                                {result.warnings.map((warning, i) => (
                                    <View key={i} style={styles.warningCard}>
                                        <Ionicons name="alert-circle" size={20} color={Colors.rose} />
                                        <Text style={styles.warningText}>
                                            {typeof warning === 'object' ? JSON.stringify(warning) : String(warning)}
                                        </Text>
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
    headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
    heroSection: { alignItems: 'center', paddingVertical: Spacing.xxl },
    heroIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
    heroTitle: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
    heroSubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
    formCard: { backgroundColor: Colors.cardDark, borderRadius: BorderRadius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.cardBorder, marginBottom: Spacing.xxl },
    fieldLabel: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
    textInput: { backgroundColor: Colors.slate800, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.lg, paddingVertical: 12, color: Colors.textPrimary, fontSize: FontSize.md, borderWidth: 1, borderColor: Colors.cardBorder, marginBottom: Spacing.sm },
    medRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    removeBtn: { padding: 4, marginBottom: Spacing.sm },
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.sm },
    addBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
    rowFields: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
    checkButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#a855f7', paddingVertical: 16, borderRadius: BorderRadius.xl, shadowColor: '#a855f7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
    checkButtonText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.lg },
    resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.lg, marginBottom: Spacing.md },
    newCheckText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
    sectionTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
    summaryCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, backgroundColor: Colors.emeraldBg, borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)', marginBottom: Spacing.lg },
    summaryText: { fontSize: FontSize.md, color: Colors.textPrimary, lineHeight: 22, flex: 1 },
    section: { marginBottom: Spacing.lg },
    interactionCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, backgroundColor: Colors.amberBg, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.2)', marginBottom: Spacing.sm },
    interactionText: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20, flex: 1 },
    warningCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, backgroundColor: Colors.roseBg, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: 'rgba(244, 63, 94, 0.2)', marginBottom: Spacing.sm },
    warningText: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20, flex: 1 },
    reportCard: { backgroundColor: 'rgba(168,85,247,0.05)', borderRadius: BorderRadius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: 'rgba(168,85,247,0.2)', gap: 6, marginTop: Spacing.lg },
    reportTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
    rH1: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: Spacing.md },
    rH2: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: Spacing.sm },
    rText: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22 },
});
