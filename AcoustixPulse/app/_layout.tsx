import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '@/constants/theme';
import { initStorage } from '@/services/storage';
import { useEffect, useState } from 'react';
import { ThemeProvider } from '@/context/ThemeContext';

export default function RootLayout() {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        async function prepare() {
            await initStorage();
            setIsReady(true);
        }
        prepare();
    }, []);

    if (!isReady) return null;

    return (
        <ThemeProvider>
            <StatusBar style="light" />
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: Colors.backgroundDark },
                    animation: 'slide_from_right',
                }}
            />
        </ThemeProvider>
    );
}
