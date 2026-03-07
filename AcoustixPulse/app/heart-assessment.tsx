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
import { useTheme } from '@/context/ThemeContext';

type OptionType = { label: string; value: string };

function OptionSelector({
    label,
    options,
    selected,
    onSelect,
    infoAlert,
}: {
    label: string;
    options: OptionType[];
    selected: string;
    onSelect: (val: string) => void;
    infoAlert?: { title: string; message: string };
}) {
    const { currentColors, isDark } = useTheme();
    return (
        <View style={styles.fieldSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm }}>
                <Text style={[styles.fieldLabel, { color: currentColors.textPrimary, marginBottom: 0 }]}>{label}</Text>
                {infoAlert && (
                    <TouchableOpacity onPress={() => Alert.alert(infoAlert.title, infoAlert.message)}>
                        <Ionicons name="information-circle-outline" size={18} color={currentColors.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>
            <View style={styles.optionRow}>
                {options.map((opt) => (
                    <TouchableOpacity
                        key={opt.value}
                        style={[
                            styles.optionBtn,
                            { backgroundColor: isDark ? currentColors.slate800 : currentColors.slate100, borderColor: currentColors.cardBorder },
                            selected === opt.value && [styles.optionBtnActive, { backgroundColor: isDark ? 'rgba(19, 127, 236, 0.15)' : 'rgba(19, 127, 236, 0.1)', borderColor: currentColors.primary }]
                        ]}
                        onPress={() => onSelect(opt.value)}
                    >
                        <Text style={[styles.optionText, { color: currentColors.textSecondary }, selected === opt.value && [styles.optionTextActive, { color: currentColors.primary }]]}>
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
    const { currentColors, isDark } = useTheme();
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
        <SafeAreaView style={[styles.container, { backgroundColor: currentColors.backgroundDark }]}>
            <View style={[styles.header, { borderBottomColor: isDark ? currentColors.slate800 : currentColors.slate200 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <Ionicons name="chevron-back" size={24} color={currentColors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: currentColors.textPrimary }]}>Heart Risk Assessment</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.scrollContent, { flexGrow: 1 }]}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.heroSection}>
                    <View style={[styles.heroIcon, { backgroundColor: isDark ? 'rgba(244, 63, 94, 0.15)' : 'rgba(244, 63, 94, 0.1)' }]}>
                        <Ionicons name="heart" size={28} color={Colors.rose} />
                    </View>
                    <Text style={[styles.heroTitle, { color: currentColors.textPrimary }]}>Cardiac Risk Analysis</Text>
                    <Text style={[styles.heroSubtitle, { color: currentColors.textSecondary }]}>
                        Enter clinical data to receive AI-powered heart disease risk assessment with triage and diagnostic report.
                    </Text>
                </View>

                <View style={[styles.formCard, { backgroundColor: currentColors.cardDark, borderColor: currentColors.cardBorder }]}>
                    {/* Age & Sex Row */}
                    <View style={styles.rowFields}>
                        <View style={[styles.fieldSection, { flex: 1 }]}>
                            <Text style={[styles.fieldLabel, { color: currentColors.textPrimary }]}>Age</Text>
                            <TextInput
                                style={[styles.textInput, { backgroundColor: isDark ? currentColors.slate800 : currentColors.slate100, color: currentColors.textPrimary, borderColor: currentColors.cardBorder }]}
                                value={age}
                                onChangeText={setAge}
                                keyboardType="number-pad"
                                placeholderTextColor={currentColors.textSecondary}
                            />
                        </View>

                        <View style={[styles.fieldSection, { flex: 1 }]}>
                            <Text style={[styles.fieldLabel, { color: currentColors.textPrimary }]}>Sex</Text>
                            <View style={styles.optionRow}>
                                <TouchableOpacity
                                    style={[
                                        styles.optionBtn,
                                        { backgroundColor: isDark ? currentColors.slate800 : currentColors.slate100, borderColor: currentColors.cardBorder },
                                        sex === 'M' && [styles.optionBtnActive, { backgroundColor: isDark ? 'rgba(19, 127, 236, 0.15)' : 'rgba(19, 127, 236, 0.1)', borderColor: currentColors.primary }]
                                    ]}
                                    onPress={() => setSex('M')}
                                >
                                    <Text style={[styles.optionText, { color: currentColors.textSecondary }, sex === 'M' && [styles.optionTextActive, { color: currentColors.primary }]]}>M</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.optionBtn,
                                        { backgroundColor: isDark ? currentColors.slate800 : currentColors.slate100, borderColor: currentColors.cardBorder },
                                        sex === 'F' && [styles.optionBtnActive, { backgroundColor: isDark ? 'rgba(19, 127, 236, 0.15)' : 'rgba(19, 127, 236, 0.1)', borderColor: currentColors.primary }]
                                    ]}
                                    onPress={() => setSex('F')}
                                >
                                    <Text style={[styles.optionText, { color: currentColors.textSecondary }, sex === 'F' && [styles.optionTextActive, { color: currentColors.primary }]]}>F</Text>
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
                        infoAlert={{
                            title: 'Chest Pain Types',
                            message: 'ASY: Asymptomatic (no symptoms)\nATA: Atypical Angina (differs from classic heart pain)\nNAP: Non-Anginal Pain (pain not caused by heart)\nTA: Typical Angina (classic heart pain)'
                        }}
                    />

                    <View style={styles.rowFields}>
                        <View style={[styles.fieldSection, { flex: 1 }]}>
                            <Text style={[styles.fieldLabel, { color: currentColors.textPrimary }]}>Resting BP (mmHg)</Text>
                            <TextInput
                                style={[styles.textInput, { backgroundColor: isDark ? currentColors.slate800 : currentColors.slate100, color: currentColors.textPrimary, borderColor: currentColors.cardBorder }]}
                                value={restingBP}
                                onChangeText={setRestingBP}
                                keyboardType="number-pad"
                                placeholderTextColor={currentColors.textSecondary}
                            />
                        </View>
                        <View style={[styles.fieldSection, { flex: 1 }]}>
                            <Text style={[styles.fieldLabel, { color: currentColors.textPrimary }]}>Cholesterol (mg/dl)</Text>
                            <TextInput
                                style={[styles.textInput, { backgroundColor: isDark ? currentColors.slate800 : currentColors.slate100, color: currentColors.textPrimary, borderColor: currentColors.cardBorder }]}
                                value={cholesterol}
                                onChangeText={setCholesterol}
                                keyboardType="number-pad"
                                placeholderTextColor={currentColors.textSecondary}
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
                        infoAlert={{
                            title: 'Fasting Blood Sugar',
                            message: 'A fasting blood sugar level over 120 mg/dl can indicate diabetes, a risk factor for heart disease.'
                        }}
                    />

                    <OptionSelector
                        label="Resting ECG (Electrocardiogram)"
                        options={[
                            { label: 'Normal', value: 'Normal' },
                            { label: 'ST', value: 'ST' },
                            { label: 'LVH', value: 'LVH' },
                        ]}
                        selected={restingECG}
                        onSelect={setRestingECG}
                        infoAlert={{
                            title: 'Resting ECG',
                            message: 'Normal: Normal reading\nST: Features ST-T wave abnormalities\nLVH: Left Ventricular Hypertrophy (enlarged heart muscle)'
                        }}
                    />

                    <View style={styles.fieldSection}>
                        <Text style={[styles.fieldLabel, { color: currentColors.textPrimary }]}>Max Heart Rate</Text>
                        <TextInput
                            style={[styles.textInput, { backgroundColor: isDark ? currentColors.slate800 : currentColors.slate100, color: currentColors.textPrimary, borderColor: currentColors.cardBorder }]}
                            value={maxHR}
                            onChangeText={setMaxHR}
                            keyboardType="number-pad"
                            placeholderTextColor={currentColors.textSecondary}
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm }}>
                            <Text style={[styles.fieldLabel, { color: currentColors.textPrimary, marginBottom: 0 }]}>ST Depression (Oldpeak)</Text>
                            <TouchableOpacity onPress={() => Alert.alert('Oldpeak', 'Refers to ST segment depression induced by exercise relative to rest. It helps determine heart stress under effort.')}>
                                <Ionicons name="information-circle-outline" size={18} color={currentColors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={[styles.textInput, { backgroundColor: isDark ? currentColors.slate800 : currentColors.slate100, color: currentColors.textPrimary, borderColor: currentColors.cardBorder }]}
                            value={oldpeak}
                            onChangeText={setOldpeak}
                            keyboardType="decimal-pad"
                            placeholderTextColor={currentColors.textSecondary}
                        />
                    </View>

                    <OptionSelector
                        label="ST Slope (Heart Peak Exercise)"
                        options={[
                            { label: 'Up', value: 'Up' },
                            { label: 'Flat', value: 'Flat' },
                            { label: 'Down', value: 'Down' },
                        ]}
                        selected={stSlope}
                        onSelect={setStSlope}
                        infoAlert={{
                            title: 'ST Slope',
                            message: 'The slope of the peak exercise ST segment.\nUp: Upsloping (often typical/healthy)\nFlat: Flat (could suggest lower oxygen)\nDown: Downsloping (often a sign of an unhealthy heart response)'
                        }}
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
