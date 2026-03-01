import React, { useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { getAnalyses, AnalysisRecord } from '@/services/storage';
import { useFocusEffect } from 'expo-router';

function formatTime(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today, ${time}`;
    if (isYesterday) return `Yesterday, ${time}`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

function getRiskColor(prediction: string): string {
    if (prediction === 'Healthy') return Colors.emerald;
    return Colors.amber;
}

function getRiskIcon(prediction: string): keyof typeof Ionicons.glyphMap {
    if (prediction === 'Healthy') return 'checkmark-circle';
    return 'warning';
}

function getRiskBg(prediction: string): string {
    if (prediction === 'Healthy') return Colors.emeraldBg;
    return Colors.amberBg;
}

export default function InsightsScreen() {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);
    useFocusEffect(useCallback(() => { forceUpdate(); }, []));

    const analyses = getAnalyses();
    const totalScans = analyses.length;

    // Compute overall health: average of Healthy probability across all analyses
    const avgHealthy = totalScans > 0
        ? Math.round(analyses.reduce((sum, a) => sum + (a.all_probabilities['Healthy'] ?? 0), 0) / totalScans * 100)
        : null;

    // Risk level based on last result
    const lastAnalysis = analyses[0] ?? null;
    const lastRisk = lastAnalysis
        ? Math.round((1 - (lastAnalysis.all_probabilities['Healthy'] ?? 0)) * 100)
        : null;
    const riskLabel = lastRisk === null ? '—'
        : lastRisk < 30 ? 'Low'
            : lastRisk < 60 ? 'Moderate'
                : 'High';
    const riskColor = lastRisk === null ? Colors.textSecondary
        : lastRisk < 30 ? Colors.emerald
            : lastRisk < 60 ? Colors.amber
                : Colors.rose;

    // Chart: last 9 analyses (oldest → newest), bar = Healthy%
    const chartData = [...analyses].reverse().slice(0, 9);

    const hasData = totalScans > 0;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Insights</Text>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Overview Card */}
                <View style={styles.overviewCard}>
                    <Text style={styles.overviewTitle}>Health Overview</Text>
                    <Text style={styles.overviewSubtitle}>
                        {hasData ? 'Based on your recorded analyses' : 'Complete your first analysis to see insights'}
                    </Text>

                    <View style={styles.overviewStats}>
                        <View style={styles.overviewStat}>
                            <Text style={styles.overviewStatValue}>
                                {avgHealthy !== null ? `${avgHealthy}%` : '—'}
                            </Text>
                            <Text style={styles.overviewStatLabel}>Overall Health</Text>
                        </View>
                        <View style={styles.overviewDivider} />
                        <View style={styles.overviewStat}>
                            <Text style={styles.overviewStatValue}>{totalScans}</Text>
                            <Text style={styles.overviewStatLabel}>Tests Done</Text>
                        </View>
                        <View style={styles.overviewDivider} />
                        <View style={styles.overviewStat}>
                            <Text style={[styles.overviewStatValue, { color: riskColor }]}>{riskLabel}</Text>
                            <Text style={styles.overviewStatLabel}>Risk Level</Text>
                        </View>
                    </View>
                </View>

                {/* Trend Chart */}
                {hasData ? (
                    <View style={styles.trendCard}>
                        <View style={styles.trendHeader}>
                            <Text style={styles.trendTitle}>Respiratory Health Trend</Text>
                            <View style={[styles.trendBadge, { backgroundColor: riskLabel === 'Low' ? Colors.emeraldBg : Colors.amberBg }]}>
                                <Text style={[styles.trendBadgeText, { color: riskLabel === 'Low' ? Colors.emerald : Colors.amber }]}>
                                    {riskLabel}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.chartContainer}>
                            {chartData.map((a, i) => {
                                const healthyPct = a.all_probabilities['Healthy'] ?? 0;
                                const barH = Math.max(healthyPct * 100, 4);
                                const clr = healthyPct > 0.7 ? Colors.emerald : healthyPct > 0.4 ? Colors.amber : Colors.rose;
                                return (
                                    <View key={i} style={styles.chartBarWrapper}>
                                        <View style={[styles.chartBar, { height: barH, backgroundColor: clr }]} />
                                    </View>
                                );
                            })}
                        </View>

                        <View style={styles.chartLabels}>
                            <Text style={styles.chartLabel}>Oldest</Text>
                            <Text style={[styles.chartLabel, { fontWeight: FontWeight.bold }]}>Latest</Text>
                        </View>
                    </View>
                ) : null}

                {/* Recent Analyses */}
                <Text style={styles.sectionTitle}>Recent Analyses</Text>

                {!hasData ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="mic-outline" size={48} color={Colors.slate600} />
                        <Text style={styles.emptyTitle}>No analyses yet</Text>
                        <Text style={styles.emptySubtitle}>
                            Go to the Breath tab and record your first sample to see your results here.
                        </Text>
                    </View>
                ) : (
                    analyses.map((a, i) => (
                        <View key={i} style={styles.analysisCard}>
                            <View style={[styles.analysisIcon, { backgroundColor: getRiskBg(a.prediction) }]}>
                                <Ionicons name={getRiskIcon(a.prediction)} size={20} color={getRiskColor(a.prediction)} />
                            </View>
                            <View style={styles.analysisContent}>
                                <Text style={styles.analysisTitle}>{a.prediction} Classification</Text>
                                <Text style={styles.analysisDate}>
                                    {formatTime(a.timestamp)} • {Math.round(a.confidence * 100)}% confidence
                                </Text>
                            </View>
                        </View>
                    ))
                )}

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
    headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary, letterSpacing: -0.5 },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
    overviewCard: {
        backgroundColor: 'rgba(19,127,236,0.08)', borderRadius: BorderRadius.xl,
        padding: Spacing.xl, borderWidth: 1, borderColor: 'rgba(19,127,236,0.2)', marginBottom: Spacing.lg,
    },
    overviewTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
    overviewSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.lg },
    overviewStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    overviewStat: { flex: 1, alignItems: 'center' },
    overviewStatValue: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, color: Colors.primary, marginBottom: 2 },
    overviewStatLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    overviewDivider: { width: 1, height: 40, backgroundColor: Colors.slate800 },
    trendCard: {
        backgroundColor: Colors.cardDark, borderRadius: BorderRadius.xl,
        padding: Spacing.lg, borderWidth: 1, borderColor: Colors.cardBorder, marginBottom: Spacing.xxl,
    },
    trendHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
    trendTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
    trendBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
    trendBadgeText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
    chartContainer: { height: 100, flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingHorizontal: 4 },
    chartBarWrapper: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
    chartBar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
    chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
    chartLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
    sectionTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
    emptyState: { alignItems: 'center', paddingVertical: Spacing.xxxl, gap: Spacing.md },
    emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textSecondary },
    emptySubtitle: { fontSize: FontSize.md, color: Colors.slate600, textAlign: 'center', lineHeight: 22, paddingHorizontal: Spacing.lg },
    analysisCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.cardDark,
        borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.sm,
        borderWidth: 1, borderColor: Colors.cardBorder, gap: Spacing.md,
    },
    analysisIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    analysisContent: { flex: 1 },
    analysisTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 2 },
    analysisDate: { fontSize: FontSize.sm, color: Colors.textSecondary },
});
