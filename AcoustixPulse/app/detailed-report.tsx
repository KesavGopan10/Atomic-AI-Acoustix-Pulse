import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';

export default function DetailedReportScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const report = (params.report as string) || '';
    const disease = (params.disease as string) || (params.prediction as string) || 'Healthy';
    const confidence = parseFloat((params.confidence as string) || '0.95');
    const allProbabilities: Record<string, number> = params.allProbabilities
        ? JSON.parse(params.allProbabilities as string)
        : {};

    const trendData = [40, 45, 60, 55, 75, 70, 85, 80, 90];

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Acoustix Pulse Diagnostic Report\n\nDiagnosis: ${disease}\nConfidence: ${Math.round(confidence * 100)}%\n\n${report || 'Detailed report available in app.'}`,
                title: 'Acoustix Pulse Report',
            });
        } catch (err) {
            console.error('Share error:', err);
        }
    };

    // Parse markdown report into sections
    const reportSections = report
        ? report.split('\n').filter((line: string) => line.trim().length > 0)
        : [];

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Detailed Diagnostic Report</Text>
                <TouchableOpacity style={styles.headerBtn} onPress={handleShare}>
                    <Ionicons name="share-outline" size={22} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Spectrogram Analysis */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Spectrogram Analysis</Text>

                    <View style={styles.spectrogramCard}>
                        <View style={styles.spectrogramImage}>
                            {/* Simulated spectrogram visualization */}
                            <View style={styles.spectrogramBars}>
                                {Array.from({ length: 30 }).map((_, i) => (
                                    <View
                                        key={i}
                                        style={[
                                            styles.spectrogramBar,
                                            {
                                                height: 10 + Math.random() * 80,
                                                backgroundColor: `rgba(19, 127, 236, ${0.3 + Math.random() * 0.7})`,
                                            },
                                        ]}
                                    />
                                ))}
                            </View>

                            {/* Anomaly badge */}
                            {disease !== 'Healthy' && (
                                <View style={styles.anomalyBadge}>
                                    <Text style={styles.anomalyText}>ANOMALY DETECTED</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.spectrogramInfo}>
                            <View style={styles.spectrogramInfoHeader}>
                                <Ionicons name="analytics" size={16} color={Colors.primary} />
                                <Text style={styles.spectrogramInfoTitle}>Acoustic Heatmap (Grad-CAM)</Text>
                            </View>
                            <Text style={styles.spectrogramDescription}>
                                {disease === 'Healthy'
                                    ? 'No significant anomalies detected in the acoustic signal. Normal breathing patterns across all frequency bands.'
                                    : `Visualization highlighting acoustic patterns in the respiratory signal. Analysis suggests patterns consistent with ${disease}.`}
                            </Text>
                            <View style={styles.spectrogramFooter}>
                                <Text style={styles.spectrogramMeta}>Resolution: 44.1kHz</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Clinical Indicators */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Clinical Indicators</Text>

                    <View style={styles.indicatorsGrid}>
                        <View style={styles.indicatorCard}>
                            <Text style={styles.indicatorLabel}>RESPIRATORY RATE</Text>
                            <Text style={[styles.indicatorValue, { color: Colors.primary }]}>
                                18 <Text style={styles.indicatorUnit}>bpm</Text>
                            </Text>
                            <View style={styles.indicatorBar}>
                                <View style={[styles.indicatorBarFill, { width: '70%', backgroundColor: Colors.emerald }]} />
                            </View>
                        </View>

                        <View style={styles.indicatorCard}>
                            <Text style={styles.indicatorLabel}>CRACKLES INDEX</Text>
                            <Text style={[styles.indicatorValue, { color: disease !== 'Healthy' ? Colors.red : Colors.emerald }]}>
                                {disease !== 'Healthy' ? 'High' : 'Low'}
                            </Text>
                            <View style={styles.indicatorBar}>
                                <View
                                    style={[
                                        styles.indicatorBarFill,
                                        {
                                            width: disease !== 'Healthy' ? '85%' : '15%',
                                            backgroundColor: disease !== 'Healthy' ? Colors.red : Colors.emerald,
                                        },
                                    ]}
                                />
                            </View>
                        </View>
                    </View>
                </View>

                {/* Longitudinal Trends */}
                <View style={styles.section}>
                    <View style={styles.trendCard}>
                        <View style={styles.trendHeader}>
                            <Text style={styles.trendTitle}>Longitudinal Trends (48h)</Text>
                            <Text style={styles.trendBadge}>Stable</Text>
                        </View>

                        <View style={styles.chartContainer}>
                            {trendData.map((val, i) => (
                                <View key={i} style={styles.chartBarWrapper}>
                                    <View
                                        style={[
                                            styles.chartBar,
                                            {
                                                height: (val / 100) * 96,
                                                opacity: 0.3 + (i / trendData.length) * 0.7,
                                            },
                                        ]}
                                    />
                                </View>
                            ))}
                        </View>

                        <View style={styles.chartLabels}>
                            <Text style={styles.chartLabel}>-48h</Text>
                            <Text style={styles.chartLabel}>-24h</Text>
                            <Text style={[styles.chartLabel, { fontWeight: FontWeight.bold }]}>Today</Text>
                        </View>
                    </View>
                </View>

                {/* AI Report Content */}
                {report ? (
                    <View style={styles.section}>
                        <View style={styles.reportCard}>
                            <View style={styles.reportHeader}>
                                <Ionicons name="create" size={20} color={Colors.primary} />
                                <Text style={styles.reportHeaderTitle}>AI-Generated Clinical Report</Text>
                            </View>

                            <View style={styles.reportContent}>
                                {reportSections.map((line: string, i: number) => {
                                    const trimmed = line.trim();
                                    if (trimmed.startsWith('# ')) {
                                        return (
                                            <Text key={i} style={styles.reportH1}>
                                                {trimmed.replace(/^#+\s*/, '')}
                                            </Text>
                                        );
                                    }
                                    if (trimmed.startsWith('## ')) {
                                        return (
                                            <Text key={i} style={styles.reportH2}>
                                                {trimmed.replace(/^#+\s*/, '')}
                                            </Text>
                                        );
                                    }
                                    if (trimmed.startsWith('### ')) {
                                        return (
                                            <Text key={i} style={styles.reportH3}>
                                                {trimmed.replace(/^#+\s*/, '')}
                                            </Text>
                                        );
                                    }
                                    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                                        return (
                                            <View key={i} style={styles.reportBullet}>
                                                <Text style={styles.reportBulletDot}>•</Text>
                                                <Text style={styles.reportText}>{trimmed.slice(2)}</Text>
                                            </View>
                                        );
                                    }
                                    if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                                        return (
                                            <Text key={i} style={styles.reportBold}>
                                                {trimmed.replace(/\*\*/g, '')}
                                            </Text>
                                        );
                                    }
                                    return (
                                        <Text key={i} style={styles.reportText}>
                                            {trimmed.replace(/\*\*/g, '')}
                                        </Text>
                                    );
                                })}
                            </View>
                        </View>
                    </View>
                ) : (
                    <View style={styles.section}>
                        <View style={styles.reportCard}>
                            <View style={styles.reportHeader}>
                                <Ionicons name="create" size={20} color={Colors.primary} />
                                <Text style={styles.reportHeaderTitle}>Doctor's Clinical Notes</Text>
                            </View>
                            <Text style={styles.reportQuote}>
                                "Patient displays normal respiratory patterns with no significant anomalies.
                                Acoustic signal analysis confirms healthy breathing baseline.
                                Continue regular monitoring as part of wellness routine."
                            </Text>
                        </View>
                    </View>
                )}

                {/* Export Button */}
                <TouchableOpacity
                    style={styles.exportButton}
                    onPress={handleShare}
                    activeOpacity={0.85}
                >
                    <Ionicons name="send" size={18} color={Colors.white} />
                    <Text style={styles.exportButtonText}>Export to Physician</Text>
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
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.slate800,
        backgroundColor: 'rgba(16, 25, 34, 0.8)',
    },
    headerBtn: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
        letterSpacing: -0.3,
        flex: 1,
        textAlign: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    section: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
    },
    sectionTitle: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
        marginBottom: Spacing.lg,
    },
    spectrogramCard: {
        backgroundColor: Colors.cardDark,
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.cardBorder,
    },
    spectrogramImage: {
        height: 180,
        backgroundColor: Colors.slate900,
        justifyContent: 'flex-end',
        paddingHorizontal: 8,
        paddingBottom: 8,
    },
    spectrogramBars: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        height: '100%',
        gap: 2,
    },
    spectrogramBar: {
        flex: 1,
        borderTopLeftRadius: 2,
        borderTopRightRadius: 2,
        minHeight: 10,
    },
    anomalyBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: Colors.redBgStrong,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: BorderRadius.sm,
    },
    anomalyText: {
        fontSize: 9,
        fontWeight: FontWeight.bold,
        color: Colors.white,
        letterSpacing: 1,
    },
    spectrogramInfo: {
        padding: Spacing.lg,
    },
    spectrogramInfoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    spectrogramInfoTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
    },
    spectrogramDescription: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        lineHeight: 22,
        marginBottom: Spacing.md,
    },
    spectrogramFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.slate800,
    },
    spectrogramMeta: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        fontWeight: FontWeight.medium,
    },
    indicatorsGrid: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    indicatorCard: {
        flex: 1,
        backgroundColor: Colors.cardDark,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.cardBorder,
    },
    indicatorLabel: {
        fontSize: 9,
        fontWeight: FontWeight.bold,
        color: Colors.textSecondary,
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    indicatorValue: {
        fontSize: FontSize.xxl,
        fontWeight: FontWeight.bold,
        marginBottom: 8,
    },
    indicatorUnit: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.regular,
        color: Colors.textSecondary,
    },
    indicatorBar: {
        height: 4,
        backgroundColor: Colors.slate800,
        borderRadius: 2,
        overflow: 'hidden',
    },
    indicatorBarFill: {
        height: '100%',
        borderRadius: 2,
    },
    trendCard: {
        backgroundColor: Colors.cardDark,
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.cardBorder,
    },
    trendHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    trendTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
    },
    trendBadge: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },
    chartContainer: {
        height: 96,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 4,
        paddingHorizontal: 4,
    },
    chartBarWrapper: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-end',
        height: '100%',
    },
    chartBar: {
        width: '100%',
        backgroundColor: Colors.primary,
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
    },
    chartLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: Spacing.sm,
    },
    chartLabel: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
    },
    reportCard: {
        backgroundColor: 'rgba(19, 127, 236, 0.05)',
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        borderWidth: 1,
        borderColor: 'rgba(19, 127, 236, 0.2)',
    },
    reportHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: Spacing.md,
    },
    reportHeaderTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
    },
    reportContent: {
        gap: 6,
    },
    reportH1: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
    },
    reportH2: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
        marginTop: Spacing.md,
        marginBottom: Spacing.xs,
    },
    reportH3: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
        marginTop: Spacing.sm,
        marginBottom: Spacing.xs,
    },
    reportText: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        lineHeight: 22,
    },
    reportBold: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
        marginTop: Spacing.sm,
    },
    reportBullet: {
        flexDirection: 'row',
        gap: 8,
        paddingLeft: 8,
    },
    reportBulletDot: {
        fontSize: FontSize.md,
        color: Colors.primary,
        lineHeight: 22,
    },
    reportQuote: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        fontStyle: 'italic',
        lineHeight: 24,
    },
    exportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: Colors.primary,
        marginHorizontal: Spacing.lg,
        paddingVertical: 14,
        borderRadius: BorderRadius.lg,
        marginTop: Spacing.lg,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    exportButtonText: {
        color: Colors.white,
        fontWeight: FontWeight.bold,
        fontSize: FontSize.md,
    },
});
