import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { generateReport } from '@/services/api';
import { getProfile } from '@/services/storage';

type RiskLevel = 'Low' | 'Moderate' | 'High';

interface RiskMetric {
    name: string;
    icon: keyof typeof Ionicons.glyphMap;
    description: string;
    level: RiskLevel;
    probability: number;
    color: string;
    bgColor: string;
}

function getRiskColor(level: RiskLevel) {
    switch (level) {
        case 'Low': return Colors.emerald;
        case 'Moderate': return Colors.amber;
        case 'High': return Colors.rose;
    }
}

function getRiskBgColor(level: RiskLevel) {
    switch (level) {
        case 'Low': return Colors.emeraldBg;
        case 'Moderate': return Colors.amberBg;
        case 'High': return Colors.roseBg;
    }
}

function getRiskLevel(prob: number): RiskLevel {
    if (prob < 0.3) return 'Low';
    if (prob < 0.6) return 'Moderate';
    return 'High';
}

export default function ResultsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [isLoadingReport, setIsLoadingReport] = useState(false);

    const prediction = (params.prediction as string) || 'Healthy';
    const confidence = parseFloat((params.confidence as string) || '0.95');
    const allProbabilities: Record<string, number> = params.allProbabilities
        ? JSON.parse(params.allProbabilities as string)
        : {};

    const overallRisk = Math.round((1 - (allProbabilities.Healthy || 0)) * 100);
    const overallRiskLevel = getRiskLevel(overallRisk / 100);

    // Map conditions to risk metrics
    const riskMetrics: RiskMetric[] = [
        {
            name: 'Asthma',
            icon: 'cloudy',
            description:
                allProbabilities.Asthma > 0.2
                    ? 'Wheezing patterns detected'
                    : 'Clear breathing patterns detected',
            level: getRiskLevel(allProbabilities.Asthma || 0),
            probability: allProbabilities.Asthma || 0,
            color: getRiskColor(getRiskLevel(allProbabilities.Asthma || 0)),
            bgColor: getRiskBgColor(getRiskLevel(allProbabilities.Asthma || 0)),
        },
        {
            name: 'Pneumonia',
            icon: 'bug',
            description:
                allProbabilities.Pneumonia > 0.2
                    ? 'Crackle sounds identified'
                    : 'No crackle sounds identified',
            level: getRiskLevel(allProbabilities.Pneumonia || 0),
            probability: allProbabilities.Pneumonia || 0,
            color: getRiskColor(getRiskLevel(allProbabilities.Pneumonia || 0)),
            bgColor: getRiskBgColor(getRiskLevel(allProbabilities.Pneumonia || 0)),
        },
        {
            name: 'COPD',
            icon: 'warning',
            description:
                allProbabilities.COPD > 0.2
                    ? 'Obstructive patterns noted'
                    : 'Normal airway dynamics',
            level: getRiskLevel(allProbabilities.COPD || 0),
            probability: allProbabilities.COPD || 0,
            color: getRiskColor(getRiskLevel(allProbabilities.COPD || 0)),
            bgColor: getRiskBgColor(getRiskLevel(allProbabilities.COPD || 0)),
        },
        {
            name: 'URTI',
            icon: 'thermometer',
            description:
                allProbabilities.URTI > 0.2
                    ? 'Upper tract congestion detected'
                    : 'Clear upper respiratory tract',
            level: getRiskLevel(allProbabilities.URTI || 0),
            probability: allProbabilities.URTI || 0,
            color: getRiskColor(getRiskLevel(allProbabilities.URTI || 0)),
            bgColor: getRiskBgColor(getRiskLevel(allProbabilities.URTI || 0)),
        },
    ];

    const handleViewReport = async () => {
        setIsLoadingReport(true);
        const profile = getProfile();
        try {
            const reportData = await generateReport({
                disease: prediction as any,
                age: profile.age ?? undefined,
                height: profile.height ?? undefined,
                weight: profile.weight ?? undefined,
            });

            router.push({
                pathname: '/detailed-report',
                params: {
                    report: reportData.report,
                    disease: reportData.disease,
                    prediction,
                    confidence: String(confidence),
                    allProbabilities: JSON.stringify(allProbabilities),
                },
            });
        } catch (err: any) {
            // Navigate anyway with basic data
            router.push({
                pathname: '/detailed-report',
                params: {
                    prediction,
                    confidence: String(confidence),
                    allProbabilities: JSON.stringify(allProbabilities),
                    report: '',
                },
            });
        } finally {
            setIsLoadingReport(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Probability Assessment</Text>
                <TouchableOpacity style={styles.headerBtn}>
                    <Ionicons name="share-outline" size={22} color={Colors.textPrimary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >


                {/* Health Snapshot Header */}
                <View style={styles.snapshotHeader}>
                    <Text style={styles.snapshotTitle}>Health Snapshot</Text>
                    <Text style={styles.snapshotDate}>Last analyzed: Today, {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>

                {/* Donut Gauge */}
                <View style={styles.gaugeContainer}>
                    <View style={styles.gaugeOuter}>
                        {/* Background ring */}
                        <View style={styles.gaugeBg} />
                        {/* Active arc (simulated with a bordered partial circle) */}
                        <View
                            style={[
                                styles.gaugeArc,
                                {
                                    borderColor: Colors.primary,
                                    borderTopColor: 'transparent',
                                    borderRightColor: 'transparent',
                                    borderBottomColor: 'transparent',
                                    transform: [{ rotate: `${-12 + (overallRisk / 100) * 360}deg` }],
                                },
                            ]}
                        />
                        {/* Center Content */}
                        <View style={styles.gaugeCenter}>
                            <View style={[styles.riskBadge, { backgroundColor: getRiskBgColor(overallRiskLevel) }]}>
                                <Text style={[styles.riskBadgeText, { color: getRiskColor(overallRiskLevel) }]}>
                                    {overallRiskLevel === 'Low' ? 'Low Risk' : overallRiskLevel === 'Moderate' ? 'Moderate Risk' : 'High Risk'}
                                </Text>
                            </View>
                            <Text style={styles.gaugeValue}>{overallRisk}%</Text>
                            <Text style={styles.gaugeLabel}>Probability of{'\n'}Respiratory Issue</Text>
                        </View>
                    </View>

                    <Text style={styles.gaugeDescription}>
                        {prediction === 'Healthy'
                            ? 'Your respiratory acoustic signals indicate a stable baseline with no significant abnormalities.'
                            : `AI analysis detected patterns consistent with ${prediction}. Confidence: ${Math.round(confidence * 100)}%.`}
                    </Text>
                </View>

                {/* Risk Breakdown */}
                <Text style={styles.sectionTitle}>Risk Breakdown</Text>

                {riskMetrics.map((metric, index) => (
                    <View key={index} style={styles.riskCard}>
                        <View style={[styles.riskIcon, { backgroundColor: metric.bgColor }]}>
                            <Ionicons name={metric.icon} size={22} color={metric.color} />
                        </View>
                        <View style={styles.riskContent}>
                            <Text style={styles.riskName}>{metric.name}</Text>
                            <Text style={styles.riskDescription}>{metric.description}</Text>
                        </View>
                        <View style={styles.riskRight}>
                            <Text style={[styles.riskLevel, { color: metric.color }]}>
                                {metric.level} Risk
                            </Text>
                            <View style={styles.riskBar}>
                                <View
                                    style={[
                                        styles.riskBarFill,
                                        {
                                            width: `${Math.max(metric.probability * 100, 8)}%`,
                                            backgroundColor: metric.color,
                                        },
                                    ]}
                                />
                            </View>
                        </View>
                    </View>
                ))}

                {/* View Report Button */}
                <TouchableOpacity
                    style={styles.reportButton}
                    onPress={handleViewReport}
                    disabled={isLoadingReport}
                    activeOpacity={0.85}
                >
                    {isLoadingReport ? (
                        <ActivityIndicator color={Colors.white} />
                    ) : (
                        <>
                            <Ionicons name="document-text" size={20} color={Colors.white} />
                            <Text style={styles.reportButtonText}>View Detailed Report</Text>
                        </>
                    )}
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
    },
    headerBtn: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
        letterSpacing: -0.3,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: 40,
    },
    toggleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.cardDark,
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        marginTop: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.cardBorder,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
    },
    toggleCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    toggleIcon: {
        width: 40,
        height: 40,
        borderRadius: BorderRadius.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toggleTitle: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
    },
    toggleSubtitle: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    toggleCardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: Colors.cardDark,
        borderRadius: BorderRadius.xl,
        padding: Spacing.md,
        paddingHorizontal: Spacing.lg,
        borderWidth: 1,
        borderTopWidth: 0,
        borderColor: Colors.cardBorder,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        marginBottom: Spacing.md,
    },
    biomarkerText: {
        fontSize: 9,
        fontWeight: FontWeight.bold,
        color: Colors.textSecondary,
        letterSpacing: 1.5,
    },
    snapshotHeader: {
        paddingVertical: Spacing.lg,
    },
    snapshotTitle: {
        fontSize: FontSize.xxxl,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
        letterSpacing: -0.5,
    },
    snapshotDate: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    gaugeContainer: {
        alignItems: 'center',
        paddingVertical: Spacing.xxl,
    },
    gaugeOuter: {
        width: 220,
        height: 220,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.xxl,
    },
    gaugeBg: {
        position: 'absolute',
        width: 220,
        height: 220,
        borderRadius: 110,
        borderWidth: 14,
        borderColor: Colors.slate800,
    },
    gaugeArc: {
        position: 'absolute',
        width: 220,
        height: 220,
        borderRadius: 110,
        borderWidth: 14,
    },
    gaugeCenter: {
        alignItems: 'center',
    },
    riskBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: BorderRadius.full,
        marginBottom: Spacing.sm,
    },
    riskBadgeText: {
        fontSize: 10,
        fontWeight: FontWeight.bold,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    gaugeValue: {
        fontSize: FontSize.hero,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
        marginVertical: 2,
    },
    gaugeLabel: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 18,
    },
    gaugeDescription: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        maxWidth: 320,
    },
    sectionTitle: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
        marginTop: Spacing.xxl,
        marginBottom: Spacing.lg,
    },
    riskCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.cardDark,
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.cardBorder,
        gap: Spacing.lg,
    },
    riskIcon: {
        width: 48,
        height: 48,
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    riskContent: {
        flex: 1,
    },
    riskName: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.textPrimary,
        marginBottom: 2,
    },
    riskDescription: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        fontStyle: 'italic',
    },
    riskRight: {
        alignItems: 'flex-end',
    },
    riskLevel: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        marginBottom: 6,
    },
    riskBar: {
        width: 64,
        height: 6,
        backgroundColor: Colors.slate800,
        borderRadius: 3,
        overflow: 'hidden',
    },
    riskBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    reportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: BorderRadius.xl,
        marginTop: Spacing.xxl,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    reportButtonText: {
        color: Colors.white,
        fontWeight: FontWeight.bold,
        fontSize: FontSize.lg,
    },
});
