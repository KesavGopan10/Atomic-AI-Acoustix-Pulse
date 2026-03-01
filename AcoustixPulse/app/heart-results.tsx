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

export default function HeartResultsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const triage = params.triage ? JSON.parse(params.triage as string) : {};
    const diagnosis = params.diagnosis ? JSON.parse(params.diagnosis as string) : {};
    const report = (params.report as string) || '';

    const urgency = triage.urgency_level || triage.urgency || 'Low';
    const riskScore = diagnosis.risk_score || diagnosis.risk_percentage || 'N/A';

    const getUrgencyColor = (u: string) => {
        const lower = u.toLowerCase();
        if (lower.includes('high') || lower.includes('emergency')) return Colors.rose;
        if (lower.includes('moderate') || lower.includes('medium')) return Colors.amber;
        return Colors.emerald;
    };

    const reportLines = report ? report.split('\n').filter((l: string) => l.trim()) : [];

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Heart Analysis Results</Text>
                <TouchableOpacity
                    style={styles.headerBtn}
                    onPress={() =>
                        Share.share({ message: `Heart Analysis Report\n\n${report}`, title: 'Heart Risk Report' })
                    }
                >
                    <Ionicons name="share-outline" size={22} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Urgency Card */}
                <View style={[styles.urgencyCard, { borderColor: getUrgencyColor(urgency) + '40' }]}>
                    <View style={[styles.urgencyIcon, { backgroundColor: getUrgencyColor(urgency) + '20' }]}>
                        <Ionicons name="heart" size={28} color={getUrgencyColor(urgency)} />
                    </View>
                    <Text style={[styles.urgencyLevel, { color: getUrgencyColor(urgency) }]}>{urgency}</Text>
                    <Text style={styles.urgencyLabel}>Urgency Level</Text>
                </View>

                {/* Triage Summary */}
                {Object.keys(triage).length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Triage Assessment</Text>
                        <View style={styles.card}>
                            {Object.entries(triage).map(([key, value], i) => (
                                <View key={i} style={styles.dataRow}>
                                    <Text style={styles.dataLabel}>{key.replace(/_/g, ' ').toUpperCase()}</Text>
                                    <Text style={styles.dataValue}>
                                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Diagnosis Summary */}
                {Object.keys(diagnosis).length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Diagnosis</Text>
                        <View style={styles.card}>
                            {Object.entries(diagnosis).map(([key, value], i) => (
                                <View key={i} style={styles.dataRow}>
                                    <Text style={styles.dataLabel}>{key.replace(/_/g, ' ').toUpperCase()}</Text>
                                    <Text style={styles.dataValue}>
                                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Full Report */}
                {report ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Full Report</Text>
                        <View style={styles.reportCard}>
                            {reportLines.map((line: string, i: number) => {
                                const t = line.trim();
                                if (t.startsWith('# ')) return <Text key={i} style={styles.rH1}>{t.replace(/^#+\s*/, '')}</Text>;
                                if (t.startsWith('## ')) return <Text key={i} style={styles.rH2}>{t.replace(/^#+\s*/, '')}</Text>;
                                if (t.startsWith('### ')) return <Text key={i} style={styles.rH3}>{t.replace(/^#+\s*/, '')}</Text>;
                                if (t.startsWith('- ') || t.startsWith('* ')) return (
                                    <View key={i} style={styles.bulletRow}>
                                        <Text style={styles.bullet}>•</Text>
                                        <Text style={styles.rText}>{t.slice(2).replace(/\*\*/g, '')}</Text>
                                    </View>
                                );
                                return <Text key={i} style={styles.rText}>{t.replace(/\*\*/g, '')}</Text>;
                            })}
                        </View>
                    </View>
                ) : null}

                <View style={{ height: 30 }} />
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
    headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex: 1, textAlign: 'center' },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
    urgencyCard: {
        alignItems: 'center', backgroundColor: Colors.cardDark, borderRadius: BorderRadius.xl,
        padding: Spacing.xxl, marginTop: Spacing.lg, borderWidth: 1, borderColor: Colors.cardBorder,
    },
    urgencyIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
    urgencyLevel: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, marginBottom: 4 },
    urgencyLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
    section: { marginTop: Spacing.xxl },
    sectionTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
    card: {
        backgroundColor: Colors.cardDark, borderRadius: BorderRadius.xl, padding: Spacing.lg,
        borderWidth: 1, borderColor: Colors.cardBorder,
    },
    dataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.slate800 },
    dataLabel: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.textSecondary, letterSpacing: 0.5, flex: 1 },
    dataValue: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.medium, flex: 1, textAlign: 'right' },
    reportCard: { backgroundColor: 'rgba(19,127,236,0.05)', borderRadius: BorderRadius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: 'rgba(19,127,236,0.2)', gap: 6 },
    rH1: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: Spacing.md },
    rH2: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: Spacing.sm },
    rH3: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary, marginTop: Spacing.sm },
    rText: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22 },
    bulletRow: { flexDirection: 'row', gap: 8, paddingLeft: 8 },
    bullet: { fontSize: FontSize.md, color: Colors.primary, lineHeight: 22 },
});
