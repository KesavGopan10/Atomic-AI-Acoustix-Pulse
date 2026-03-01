import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { symptomChat, ChatMessage, SymptomChatResponse } from '@/services/api';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    urgency?: string;
    conditions?: Array<Record<string, any>>;
    followUps?: string[];
}

export default function SymptomChatScreen() {
    const router = useRouter();
    const scrollRef = useRef<ScrollView>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

    const sendMessage = async (text?: string) => {
        const msg = text || inputText.trim();
        if (!msg || isLoading) return;

        const userMsg: Message = { role: 'user', content: msg };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInputText('');

        const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', content: msg }];
        setChatHistory(newHistory);

        setIsLoading(true);
        try {
            const res: SymptomChatResponse = await symptomChat(newHistory);

            const assistantMsg: Message = {
                role: 'assistant',
                content: res.reply,
                urgency: res.urgency,
                conditions: res.suspected_conditions,
                followUps: res.follow_up_questions,
            };

            setMessages([...newMessages, assistantMsg]);
            setChatHistory([...newHistory, { role: 'assistant', content: res.reply }]);

            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        } catch (err: any) {
            const errorMsg: Message = {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
            };
            setMessages([...newMessages, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const getUrgencyColor = (u?: string) => {
        if (!u) return Colors.textSecondary;
        const lower = u.toLowerCase();
        if (lower.includes('high') || lower.includes('emergency')) return Colors.rose;
        if (lower.includes('moderate') || lower.includes('medium')) return Colors.amber;
        return Colors.emerald;
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Symptom Checker</Text>
                <TouchableOpacity
                    style={styles.headerBtn}
                    onPress={() => {
                        setMessages([]);
                        setChatHistory([]);
                    }}
                >
                    <Ionicons name="refresh" size={22} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    ref={scrollRef}
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                >
                    {messages.length === 0 && (
                        <View style={styles.emptyState}>
                            <View style={[styles.emptyIcon, { backgroundColor: Colors.emeraldBg }]}>
                                <Ionicons name="chatbubbles" size={36} color={Colors.emerald} />
                            </View>
                            <Text style={styles.emptyTitle}>AI Symptom Checker</Text>
                            <Text style={styles.emptySubtitle}>
                                Describe your symptoms and I'll help assess them. Start by telling me what you're experiencing.
                            </Text>

                            <View style={styles.suggestionsContainer}>
                                <Text style={styles.suggestionsTitle}>Try saying:</Text>
                                {[
                                    'I have a persistent cough and chest pain',
                                    'I feel shortness of breath when walking',
                                    'I have been experiencing headaches and fever',
                                ].map((s, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        style={styles.suggestionChip}
                                        onPress={() => sendMessage(s)}
                                    >
                                        <Text style={styles.suggestionText}>{s}</Text>
                                        <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    {messages.map((msg, i) => (
                        <View
                            key={i}
                            style={[
                                styles.messageBubble,
                                msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
                            ]}
                        >
                            {msg.role === 'assistant' && (
                                <View style={styles.botAvatar}>
                                    <Ionicons name="medical" size={16} color={Colors.primary} />
                                </View>
                            )}
                            <View
                                style={[
                                    styles.messageContent,
                                    msg.role === 'user' ? styles.userContent : styles.assistantContent,
                                ]}
                            >
                                <Text style={[styles.messageText, msg.role === 'user' && styles.userText]}>
                                    {msg.content}
                                </Text>

                                {msg.urgency && (
                                    <View style={styles.urgencyBadge}>
                                        <View style={[styles.urgencyDot, { backgroundColor: getUrgencyColor(msg.urgency) }]} />
                                        <Text style={[styles.urgencyText, { color: getUrgencyColor(msg.urgency) }]}>
                                            Urgency: {msg.urgency}
                                        </Text>
                                    </View>
                                )}

                                {msg.conditions && msg.conditions.length > 0 && (
                                    <View style={styles.conditionsContainer}>
                                        <Text style={styles.conditionsTitle}>Suspected Conditions:</Text>
                                        {msg.conditions.map((c, j) => (
                                            <Text key={j} style={styles.conditionText}>
                                                • {typeof c === 'object' ? (c.condition || c.name || JSON.stringify(c)) : c}
                                            </Text>
                                        ))}
                                    </View>
                                )}

                                {msg.followUps && msg.followUps.length > 0 && (
                                    <View style={styles.followUpsContainer}>
                                        {msg.followUps.map((q, j) => (
                                            <TouchableOpacity
                                                key={j}
                                                style={styles.followUpChip}
                                                onPress={() => sendMessage(q)}
                                            >
                                                <Text style={styles.followUpText}>{q}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                        </View>
                    ))}

                    {isLoading && (
                        <View style={styles.loadingBubble}>
                            <View style={styles.botAvatar}>
                                <Ionicons name="medical" size={16} color={Colors.primary} />
                            </View>
                            <View style={styles.assistantContent}>
                                <ActivityIndicator color={Colors.primary} size="small" />
                                <Text style={styles.loadingText}>Analyzing symptoms...</Text>
                            </View>
                        </View>
                    )}
                </ScrollView>

                {/* Input Bar */}
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.textInput}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Describe your symptoms..."
                        placeholderTextColor={Colors.textMuted}
                        multiline
                        maxLength={500}
                        onSubmitEditing={() => sendMessage()}
                    />
                    <TouchableOpacity
                        style={[styles.sendBtn, (!inputText.trim() || isLoading) && styles.sendBtnDisabled]}
                        onPress={() => sendMessage()}
                        disabled={!inputText.trim() || isLoading}
                    >
                        <Ionicons name="send" size={20} color={Colors.white} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.backgroundDark },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.slate800 },
    headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, paddingTop: Spacing.md },
    emptyState: { alignItems: 'center', paddingVertical: Spacing.xxxl },
    emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
    emptyTitle: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
    emptySubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xxl },
    suggestionsContainer: { width: '100%', gap: Spacing.sm },
    suggestionsTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, marginBottom: Spacing.xs },
    suggestionChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.cardDark, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderWidth: 1, borderColor: Colors.cardBorder },
    suggestionText: { fontSize: FontSize.md, color: Colors.textPrimary, flex: 1 },
    messageBubble: { flexDirection: 'row', marginBottom: Spacing.md, gap: Spacing.sm },
    userBubble: { justifyContent: 'flex-end' },
    assistantBubble: { justifyContent: 'flex-start' },
    botAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    messageContent: { maxWidth: '80%', borderRadius: BorderRadius.xl, padding: Spacing.lg },
    userContent: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
    assistantContent: { backgroundColor: Colors.cardDark, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.cardBorder },
    messageText: { fontSize: FontSize.md, color: Colors.textPrimary, lineHeight: 22 },
    userText: { color: Colors.white },
    urgencyBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.slate800 },
    urgencyDot: { width: 8, height: 8, borderRadius: 4 },
    urgencyText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
    conditionsContainer: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.slate800 },
    conditionsTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, marginBottom: 4 },
    conditionText: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
    followUpsContainer: { marginTop: Spacing.sm, gap: Spacing.xs },
    followUpChip: { backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: Colors.primaryMedium },
    followUpText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },
    loadingBubble: { flexDirection: 'row', marginBottom: Spacing.md, gap: Spacing.sm },
    loadingText: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 6 },
    inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.slate800, backgroundColor: 'rgba(15, 23, 42, 0.95)', gap: Spacing.sm },
    textInput: { flex: 1, backgroundColor: Colors.slate800, borderRadius: BorderRadius.xl, paddingHorizontal: Spacing.lg, paddingVertical: 12, color: Colors.textPrimary, fontSize: FontSize.md, maxHeight: 100, borderWidth: 1, borderColor: Colors.cardBorder },
    sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
    sendBtnDisabled: { opacity: 0.4 },
});
