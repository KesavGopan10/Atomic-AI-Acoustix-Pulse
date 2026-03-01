import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { setProfile } from '@/services/storage';

export default function ProfileScreen() {
    const router = useRouter();
    const [age, setAge] = useState(28);
    const [height, setHeight] = useState(178);
    const [weight, setWeight] = useState(75);
    const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
    const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');

    const displayWeight = weightUnit === 'lbs' ? Math.round(weight * 2.20462) : weight;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>User Biometrics</Text>
                <TouchableOpacity style={styles.editBtn}>
                    <Ionicons name="create-outline" size={20} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero */}
                <View style={styles.heroSection}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="fitness" size={36} color={Colors.primary} />
                    </View>
                    <Text style={styles.heroTitle}>Personalize Your Health Signals</Text>
                    <Text style={styles.heroSubtitle}>
                        Provide your biometrics to help Acoustix Pulse calibrate its respiratory monitoring AI.
                    </Text>
                </View>

                {/* Form Card */}
                <View style={styles.formCard}>
                    {/* Age */}
                    <View style={styles.formSection}>
                        <Text style={styles.formLabel}>Age</Text>
                        <View style={styles.ageSelector}>
                            <TouchableOpacity
                                style={styles.ageOption}
                                onPress={() => setAge(Math.max(1, age - 1))}
                            >
                                <Text style={styles.ageOptionText}>{age - 1}</Text>
                            </TouchableOpacity>
                            <View style={styles.ageOptionActive}>
                                <Text style={styles.ageOptionActiveText}>{age}</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.ageOption}
                                onPress={() => setAge(Math.min(120, age + 1))}
                            >
                                <Text style={styles.ageOptionText}>{age + 1}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Height */}
                    <View style={styles.formSection}>
                        <View style={styles.formLabelRow}>
                            <Text style={styles.formLabel}>Height</Text>
                            <View style={styles.unitToggle}>
                                <TouchableOpacity
                                    style={[styles.unitBtn, heightUnit === 'cm' && styles.unitBtnActive]}
                                    onPress={() => setHeightUnit('cm')}
                                >
                                    <Text
                                        style={[styles.unitBtnText, heightUnit === 'cm' && styles.unitBtnTextActive]}
                                    >
                                        cm
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.unitBtn, heightUnit === 'ft' && styles.unitBtnActive]}
                                    onPress={() => setHeightUnit('ft')}
                                >
                                    <Text
                                        style={[styles.unitBtnText, heightUnit === 'ft' && styles.unitBtnTextActive]}
                                    >
                                        ft
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.sliderSection}>
                            <View style={styles.sliderValues}>
                                <Text style={styles.sliderMin}>140cm</Text>
                                <Text style={styles.sliderCurrent}>
                                    {height} <Text style={styles.sliderUnit}>cm</Text>
                                </Text>
                                <Text style={styles.sliderMax}>220cm</Text>
                            </View>
                            <View style={styles.sliderTrack}>
                                <View
                                    style={[
                                        styles.sliderFill,
                                        { width: `${((height - 140) / 80) * 100}%` },
                                    ]}
                                />
                            </View>
                            <View style={styles.rulerMarks}>
                                {Array.from({ length: 13 }).map((_, i) => (
                                    <View
                                        key={i}
                                        style={[
                                            styles.rulerMark,
                                            i % 4 === 0 && styles.rulerMarkMajor,
                                        ]}
                                    />
                                ))}
                            </View>
                            <View style={styles.sliderButtons}>
                                <TouchableOpacity
                                    style={styles.adjustBtn}
                                    onPress={() => setHeight(Math.max(140, height - 1))}
                                >
                                    <Ionicons name="remove" size={18} color={Colors.textPrimary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.adjustBtn}
                                    onPress={() => setHeight(Math.min(220, height + 1))}
                                >
                                    <Ionicons name="add" size={18} color={Colors.textPrimary} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Weight */}
                    <View style={styles.formSection}>
                        <View style={styles.formLabelRow}>
                            <Text style={styles.formLabel}>Weight</Text>
                            <View style={styles.unitToggle}>
                                <TouchableOpacity
                                    style={[styles.unitBtn, weightUnit === 'kg' && styles.unitBtnActive]}
                                    onPress={() => setWeightUnit('kg')}
                                >
                                    <Text
                                        style={[styles.unitBtnText, weightUnit === 'kg' && styles.unitBtnTextActive]}
                                    >
                                        kg
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.unitBtn, weightUnit === 'lbs' && styles.unitBtnActive]}
                                    onPress={() => setWeightUnit('lbs')}
                                >
                                    <Text
                                        style={[styles.unitBtnText, weightUnit === 'lbs' && styles.unitBtnTextActive]}
                                    >
                                        lbs
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.sliderSection}>
                            <View style={styles.sliderValues}>
                                <Text style={styles.sliderMin}>30{weightUnit}</Text>
                                <Text style={styles.sliderCurrent}>
                                    {displayWeight} <Text style={styles.sliderUnit}>{weightUnit}</Text>
                                </Text>
                                <Text style={styles.sliderMax}>200{weightUnit}</Text>
                            </View>
                            <View style={styles.sliderTrack}>
                                <View
                                    style={[
                                        styles.sliderFill,
                                        {
                                            width: `${weightUnit === 'kg'
                                                ? ((weight - 30) / 170) * 100
                                                : ((displayWeight - 66) / 374) * 100
                                                }%`,
                                        },
                                    ]}
                                />
                            </View>
                            <View style={styles.rulerMarks}>
                                {Array.from({ length: 13 }).map((_, i) => (
                                    <View
                                        key={i}
                                        style={[
                                            styles.rulerMark,
                                            i % 4 === 0 && styles.rulerMarkMajor,
                                        ]}
                                    />
                                ))}
                            </View>
                            <View style={styles.sliderButtons}>
                                <TouchableOpacity
                                    style={styles.adjustBtn}
                                    onPress={() => setWeight(Math.max(30, weight - 1))}
                                >
                                    <Ionicons name="remove" size={18} color={Colors.textPrimary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.adjustBtn}
                                    onPress={() => setWeight(Math.min(200, weight + 1))}
                                >
                                    <Ionicons name="add" size={18} color={Colors.textPrimary} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Continue Button */}
                <TouchableOpacity
                    style={styles.continueButton}
                    activeOpacity={0.85}
                    onPress={() => {
                        setProfile({ age, height, weight });
                        router.push('/(tabs)/breath');
                    }}
                >
                    <Text style={styles.continueButtonText}>Continue to Analysis</Text>
                    <Ionicons name="arrow-forward" size={20} color={Colors.white} />
                </TouchableOpacity>

                <View style={{ height: 30 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.backgroundDark,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    headerTitle: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
        letterSpacing: -0.3,
    },
    editBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.cardDark,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.cardBorder,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: 100,
    },
    heroSection: {
        alignItems: 'center',
        paddingVertical: Spacing.xxl,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.lg,
    },
    heroTitle: {
        fontSize: FontSize.xxxl,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
        textAlign: 'center',
        letterSpacing: -0.5,
        marginBottom: Spacing.sm,
    },
    heroSubtitle: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: Spacing.md,
    },
    formCard: {
        backgroundColor: Colors.cardDark,
        borderRadius: BorderRadius.xxl,
        padding: Spacing.xxl,
        borderWidth: 1,
        borderColor: Colors.cardBorder,
        marginBottom: Spacing.xxl,
    },
    formSection: {
        marginBottom: Spacing.xxxl,
    },
    formLabel: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
        marginBottom: Spacing.lg,
    },
    formLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    ageSelector: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: Spacing.md,
    },
    ageOption: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 14,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.cardBorder,
    },
    ageOptionText: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.medium,
        color: Colors.textSecondary,
    },
    ageOptionActive: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 14,
        borderRadius: BorderRadius.lg,
        backgroundColor: Colors.primaryLight,
        borderWidth: 2,
        borderColor: Colors.primary,
    },
    ageOptionActiveText: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },
    unitToggle: {
        flexDirection: 'row',
        backgroundColor: Colors.slate800,
        padding: 3,
        borderRadius: BorderRadius.md,
    },
    unitBtn: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 6,
    },
    unitBtnActive: {
        backgroundColor: Colors.slate700,
    },
    unitBtnText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: Colors.textSecondary,
    },
    unitBtnTextActive: {
        color: Colors.textPrimary,
    },
    sliderSection: {
        gap: Spacing.sm,
    },
    sliderValues: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    sliderMin: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    sliderCurrent: {
        fontSize: FontSize.xxxl,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },
    sliderUnit: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.medium,
    },
    sliderMax: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    sliderTrack: {
        height: 8,
        backgroundColor: Colors.slate800,
        borderRadius: 4,
        overflow: 'hidden',
    },
    sliderFill: {
        height: '100%',
        backgroundColor: Colors.primary,
        borderRadius: 4,
    },
    rulerMarks: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    rulerMark: {
        width: 1,
        height: 4,
        backgroundColor: Colors.slate700,
    },
    rulerMarkMajor: {
        height: 8,
        backgroundColor: Colors.slate600,
    },
    sliderButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: Spacing.sm,
    },
    adjustBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.slate800,
        alignItems: 'center',
        justifyContent: 'center',
    },
    continueButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: BorderRadius.xl,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    continueButtonText: {
        color: Colors.white,
        fontWeight: FontWeight.bold,
        fontSize: FontSize.lg,
    },
});
