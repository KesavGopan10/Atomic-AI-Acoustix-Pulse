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
import { analyzeHeart, HeartDiseaseInput } from '@/services/api';

type OptionType = { label: string; value: string };

function OptionSelector({
    label,
    options,
    selected,
    onSelect,
}: {
    label: string;
    options: OptionType[];
    selected: string;
    onSelect: (val: string) => void;
}) {
    return (
        <View style={styles.fieldSection}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <View style={styles.optionRow}>
                {options.map((opt) => (
                    <TouchableOpacity
                        key={opt.value}
                        style={[styles.optionBtn, selected === opt.value && styles.optionBtnActive]}
                        onPress={() => onSelect(opt.value)}
                    >
                        <Text style={[styles.optionText, selected === opt.value && styles.optionTextActive]}>
                            {opt.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}

export default function HeartAssessmentScreen() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const [age, setAge] = useState('55');
    const [sex, setSex] = useState<'M' | 'F'>('M');
    const [chestPainType, setChestPainType] = useState('ASY');
    const [restingBP, setRestingBP] = useState('140');
    const [cholesterol, setCholesterol] = useState('250');
    const [fastingBS, setFastingBS] = useState('0');
    const [restingECG, setRestingECG] = useState('Normal');
    const [maxHR, setMaxHR] = useState('150');
    const [exerciseAngina, setExerciseAngina] = useState('N');
    const [oldpeak, setOldpeak] = useState('1.5');
    const [stSlope, setStSlope] = useState('Flat');

    const handleAnalyze = async () => {
        setIsLoading(true);
        try {
            const data: HeartDiseaseInput = {
                age: parseInt(age) || 55,
                sex: sex,
                chest_pain_type: chestPainType as any,
                resting_bp: parseInt(restingBP) || 140,
                cholesterol: parseInt(cholesterol) || 250,
                fasting_bs: (parseInt(fastingBS) || 0) as 0 | 1,
                resting_ecg: restingECG as any,
                max_hr: parseInt(maxHR) || 150,
                exercise_angina: exerciseAngina as 'Y' | 'N',
                oldpeak: parseFloat(oldpeak) || 1.5,
                st_slope: stSlope as any,
            };

            const result = await analyzeHeart(data);

            router.push({
                pathname: '/heart-results',
                params: {
                    triage: JSON.stringify(result.triage),
                    diagnosis: JSON.stringify(result.diagnosis),
                    report: result.report,
                },
            });
        } catch (err: any) {
            Alert.alert('Analysis Error', err.message || 'Failed to analyze heart data.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Heart Risk Assessment</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.heroSection}>
                    <View style={[styles.heroIcon, { backgroundColor: Colors.roseBg }]}>
                        <Ionicons name="heart" size={28} color={Colors.rose} />
                    </View>
                    <Text style={styles.heroTitle}>Cardiac Risk Analysis</Text>
                    <Text style={styles.heroSubtitle}>
                        Enter clinical data to receive AI-powered heart disease risk assessment with triage and diagnostic report.
                    </Text>
                </View>

                <View style={styles.formCard}>
                    {/* Age & Sex Row */}
                    <View style={styles.rowFields}>
                        <View style={[styles.fieldSection, { flex: 1 }]}>
                            <Text style={styles.fieldLabel}>Age</Text>
                            <TextInput
                                style={styles.textInput}
                                value={age}
                                onChangeText={setAge}
                                keyboardType="number-pad"
                                placeholderTextColor={Colors.textMuted}
                            />
                        </View>

                        <View style={[styles.fieldSection, { flex: 1 }]}>
                            <Text style={styles.fieldLabel}>Sex</Text>
                            <View style={styles.optionRow}>
                                <TouchableOpacity
                                    style={[styles.optionBtn, sex === 'M' && styles.optionBtnActive]}
                                    onPress={() => setSex('M')}
                                >
                                    <Text style={[styles.optionText, sex === 'M' && styles.optionTextActive]}>M</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.optionBtn, sex === 'F' && styles.optionBtnActive]}
                                    onPress={() => setSex('F')}
                                >
                                    <Text style={[styles.optionText, sex === 'F' && styles.optionTextActive]}>F</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    <OptionSelector
                        label="Chest Pain Type"
                        options={[
                            { label: 'ASY', value: 'ASY' },
                            { label: 'ATA', value: 'ATA' },
                            { label: 'NAP', value: 'NAP' },
                            { label: 'TA', value: 'TA' },
                        ]}
                        selected={chestPainType}
                        onSelect={setChestPainType}
                    />

                    <View style={styles.rowFields}>
                        <View style={[styles.fieldSection, { flex: 1 }]}>
                            <Text style={styles.fieldLabel}>Resting BP (mmHg)</Text>
                            <TextInput
                                style={styles.textInput}
                                value={restingBP}
                                onChangeText={setRestingBP}
                                keyboardType="number-pad"
                                placeholderTextColor={Colors.textMuted}
                            />
                        </View>
                        <View style={[styles.fieldSection, { flex: 1 }]}>
                            <Text style={styles.fieldLabel}>Cholesterol (mg/dl)</Text>
                            <TextInput
                                style={styles.textInput}
                                value={cholesterol}
                                onChangeText={setCholesterol}
                                keyboardType="number-pad"
                                placeholderTextColor={Colors.textMuted}
                            />
                        </View>
                    </View>

                    <OptionSelector
                        label="Fasting Blood Sugar > 120mg/dl"
                        options={[
                            { label: 'No', value: '0' },
                            { label: 'Yes', value: '1' },
                        ]}
                        selected={fastingBS}
                        onSelect={setFastingBS}
                    />

                    <OptionSelector
                        label="Resting ECG"
                        options={[
                            { label: 'Normal', value: 'Normal' },
                            { label: 'ST', value: 'ST' },
                            { label: 'LVH', value: 'LVH' },
                        ]}
                        selected={restingECG}
                        onSelect={setRestingECG}
                    />

                    <View style={styles.fieldSection}>
                        <Text style={styles.fieldLabel}>Max Heart Rate</Text>
                        <TextInput
                            style={styles.textInput}
                            value={maxHR}
                            onChangeText={setMaxHR}
                            keyboardType="number-pad"
                            placeholderTextColor={Colors.textMuted}
                        />
                    </View>

                    <OptionSelector
                        label="Exercise-Induced Angina"
                        options={[
                            { label: 'No', value: 'N' },
                            { label: 'Yes', value: 'Y' },
                        ]}
                        selected={exerciseAngina}
                        onSelect={setExerciseAngina}
                    />

                    <View style={styles.fieldSection}>
                        <Text style={styles.fieldLabel}>ST Depression (Oldpeak)</Text>
                        <TextInput
                            style={styles.textInput}
                            value={oldpeak}
                            onChangeText={setOldpeak}
                            keyboardType="decimal-pad"
                            placeholderTextColor={Colors.textMuted}
                        />
                    </View>

                    <OptionSelector
                        label="ST Slope"
                        options={[
                            { label: 'Up', value: 'Up' },
                            { label: 'Flat', value: 'Flat' },
                            { label: 'Down', value: 'Down' },
                        ]}
                        selected={stSlope}
                        onSelect={setStSlope}
                    />
                </View>

                <TouchableOpacity
                    style={styles.analyzeButton}
                    onPress={handleAnalyze}
                    disabled={isLoading}
                    activeOpacity={0.85}
                >
                    {isLoading ? (
                        <ActivityIndicator color={Colors.white} />
                    ) : (
                        <>
                            <Ionicons name="heart-circle" size={22} color={Colors.white} />
                            <Text style={styles.analyzeButtonText}>Analyze Heart Risk</Text>
                        </>
                    )}
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.backgroundDark },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderBottomWidth: 1, borderBottomColor: Colors.slate800,
    },
    headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
    heroSection: { alignItems: 'center', paddingVertical: Spacing.xxl },
    heroIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
    heroTitle: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
    heroSubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: Spacing.md },
    formCard: { backgroundColor: Colors.cardDark, borderRadius: BorderRadius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.cardBorder, marginBottom: Spacing.xxl },
    rowFields: { flexDirection: 'row', gap: Spacing.md },
    fieldSection: { marginBottom: Spacing.xl },
    fieldLabel: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
    textInput: {
        backgroundColor: Colors.slate800, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.lg,
        paddingVertical: 12, color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.semibold,
        borderWidth: 1, borderColor: Colors.cardBorder,
    },
    optionRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
    optionBtn: {
        flex: 1, minWidth: 60, alignItems: 'center', paddingVertical: 10, borderRadius: BorderRadius.md,
        borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.slate800,
    },
    optionBtnActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary, borderWidth: 2 },
    optionText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
    optionTextActive: { color: Colors.primary, fontWeight: FontWeight.bold },
    analyzeButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: Colors.rose, paddingVertical: 16, borderRadius: BorderRadius.xl,
        shadowColor: Colors.rose, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
    },
    analyzeButtonText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.lg },
});
