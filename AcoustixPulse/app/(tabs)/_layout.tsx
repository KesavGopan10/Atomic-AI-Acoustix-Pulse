import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { View, Platform } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

export default function TabsLayout() {
    const { currentColors, isDark } = useTheme();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                    borderTopColor: isDark ? Colors.slate800 : Colors.slate200,
                    borderTopWidth: 1,
                    height: Platform.OS === 'ios' ? 88 : 68,
                    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
                    paddingTop: 8,
                },
                tabBarActiveTintColor: currentColors.primary,
                tabBarInactiveTintColor: isDark ? Colors.tabInactive : '#64748b',
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="home" size={22} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="breath"
                options={{
                    title: 'Breath',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="pulse" size={22} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="insights"
                options={{
                    title: 'Insights',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="analytics" size={22} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="person-circle" size={22} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
