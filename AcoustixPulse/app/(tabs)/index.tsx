import React, { useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { getAnalyses, getLastAnalysis } from '@/services/storage';

interface FeatureCardProps {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle: string;
    color: string;
    bgColor: string;
    onPress: () => void;
}

function FeatureCard({ icon, title, subtitle, color, bgColor, onPress }: FeatureCardProps) {
    return (
        <TouchableOpacity style={styles.featureCard} onPress={onPress} activeOpacity={0.7}>
            <View style={[styles.featureIcon, { backgroundColor: bgColor }]}>
                <Ionicons name={icon} size={24} color={color} />
            </View>
            <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{title}</Text>
                <Text style={styles.featureSubtitle}>{subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.slate500} />
        </TouchableOpacity>
    );
}

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
}

export default function HomeScreen() {
    const router = useRouter();

    // Re-render when screen gains focus so stats refresh after a new scan
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);
    useFocusEffect(useCallback(() => { forceUpdate(); }, []));

    const analyses = getAnalyses();
    const lastAnalysis = getLastAnalysis();
    const totalScans = analyses.length;
    const lastResult = lastAnalysis ? lastAnalysis.prediction : '—';
    const riskScore = lastAnalysis
        ? Math.round((1 - (lastAnalysis.all_probabilities['Healthy'] ?? 0)) * 100)
        : null;

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>{getGreeting()}</Text>
                    <Text style={styles.headerTitle}>Acoustix Pulse</Text>
                </View>
                <TouchableOpacity style={styles.notifBtn}>
                    <Ionicons name="notifications-outline" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero Card */}
                <TouchableOpacity
                    style={styles.heroCard}
                    activeOpacity={0.85}
                    onPress={() => router.push('/(tabs)/breath')}
                >
                    <View style={styles.heroBadge}>
                        <Ionicons name="fitness" size={14} color={Colors.primary} />
                        <Text style={styles.heroBadgeText}>ACOUSTIX PULSE AI</Text>
                    </View>
                    <Text style={styles.heroTitle}>Respiratory Health Analysis</Text>
                    <Text style={styles.heroSubtitle}>
                        Record a breath sample and let our AI analyze your respiratory patterns in real-time.
                    </Text>
                    <View style={styles.heroButton}>
                        <Text style={styles.heroButtonText}>Start Analysis</Text>
                        <Ionicons name="arrow-forward" size={18} color={Colors.white} />
                    </View>
                </TouchableOpacity>

                {/* Quick Stats — all from real data */}
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <View style={[styles.statDot, {
                            backgroundColor: !lastAnalysis ? Colors.slate700
                                : lastResult === 'Healthy' ? Colors.emerald : Colors.amber
                        }]} />
                        <Text style={styles.statValue} numberOfLines={1}>{lastResult}</Text>
                        <Text style={styles.statLabel}>Last Result</Text>
                    </View>
                    <View style={styles.statCard}>
                        <View style={[styles.statDot, { backgroundColor: Colors.primary }]} />
                        <Text style={styles.statValue}>{totalScans}</Text>
                        <Text style={styles.statLabel}>Total Scans</Text>
                    </View>
                    <View style={styles.statCard}>
                        <View style={[styles.statDot, {
                            backgroundColor: riskScore === null ? Colors.slate700
                                : riskScore < 30 ? Colors.emerald
                                    : riskScore < 60 ? Colors.amber : Colors.rose
                        }]} />
                        <Text style={styles.statValue}>
                            {riskScore === null ? '—' : `${riskScore}%`}
                        </Text>
                        <Text style={styles.statLabel}>Risk Score</Text>
                    </View>
                </View>

                {/* Section: Features */}
                <Text style={styles.sectionTitle}>Diagnostic Tools</Text>

                <FeatureCard
                    icon="mic"
                    title="Breath Analysis"
                    subtitle="Record & classify respiratory sounds"
                    color={Colors.primary}
                    bgColor={Colors.primaryLight}
                    onPress={() => router.push('/(tabs)/breath')}
                />

                <FeatureCard
                    icon="heart"
                    title="Heart Risk Assessment"
                    subtitle="AI-powered cardiac risk analysis"
                    color={Colors.rose}
                    bgColor={Colors.roseBg}
                    onPress={() => router.push('/heart-assessment')}
                />

                <FeatureCard
                    icon="scan"
                    title="Medical Image Scan"
                    subtitle="X-ray, ECG, CT, MRI analysis"
                    color={Colors.amber}
                    bgColor={Colors.amberBg}
                    onPress={() => router.push('/scan-analysis')}
                />

                <FeatureCard
                    icon="chatbubbles"
                    title="Symptom Checker"
                    subtitle="Conversational AI diagnosis"
                    color={Colors.emerald}
                    bgColor={Colors.emeraldBg}
                    onPress={() => router.push('/symptom-chat')}
                />

                <FeatureCard
                    icon="medkit"
                    title="Drug Interactions"
                    subtitle="Check medication safety"
                    color="#a855f7"
                    bgColor="rgba(168, 85, 247, 0.1)"
                    onPress={() => router.push('/drug-check')}
                />

                <FeatureCard
                    icon="document-text"
                    title="Lab Report Analysis"
                    subtitle="Upload & analyze lab reports"
                    color="#06b6d4"
                    bgColor="rgba(6, 182, 212, 0.1)"
                    onPress={() => router.push('/lab-analysis')}
                />

                <View style={{ height: 20 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.backgroundDark },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
    },
    greeting: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
    headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary, letterSpacing: -0.5 },
    notifBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: Colors.cardDark, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: Colors.cardBorder,
    },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
    heroCard: {
        backgroundColor: 'rgba(19, 127, 236, 0.08)', borderRadius: BorderRadius.xl,
        padding: Spacing.xl, borderWidth: 1, borderColor: 'rgba(19, 127, 236, 0.2)',
        marginTop: Spacing.md, marginBottom: Spacing.lg,
    },
    heroBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: Colors.primaryLight, paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: BorderRadius.full, alignSelf: 'flex-start',
        borderWidth: 1, borderColor: Colors.primaryMedium, marginBottom: Spacing.md,
    },
    heroBadgeText: { fontSize: 10, fontWeight: FontWeight.semibold, color: Colors.primary, letterSpacing: 1, textTransform: 'uppercase' },
    heroTitle: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm, letterSpacing: -0.5 },
    heroSubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.lg },
    heroButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: BorderRadius.lg,
        shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
    },
    heroButtonText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.lg },
    statsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xxl },
    statCard: {
        flex: 1, backgroundColor: Colors.cardDark, borderRadius: BorderRadius.lg,
        padding: Spacing.lg, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center',
    },
    statDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 8 },
    statValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 2 },
    statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    sectionTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.lg },
    featureCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.cardDark,
        borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.md,
        borderWidth: 1, borderColor: Colors.cardBorder, gap: Spacing.lg,
    },
    featureIcon: { width: 48, height: 48, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center' },
    featureContent: { flex: 1 },
    featureTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 2 },
    featureSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary },
});
