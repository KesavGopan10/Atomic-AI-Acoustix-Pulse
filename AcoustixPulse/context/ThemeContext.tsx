import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/theme';

type ThemeType = 'light' | 'dark';

interface ThemeContextType {
    theme: ThemeType;
    isDark: boolean;
    toggleTheme: () => void;
    currentColors: typeof Colors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<ThemeType>('dark');

    useEffect(() => {
        AsyncStorage.getItem('@acoustix_theme').then(savedTheme => {
            if (savedTheme === 'light' || savedTheme === 'dark') {
                setTheme(savedTheme);
            }
        });
    }, []);

    const toggleTheme = React.useCallback(() => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        AsyncStorage.setItem('@acoustix_theme', newTheme);
    }, [theme]);

    const isDark = theme === 'dark';

    // Memoize the colors object so it doesn't change on every render unless the theme changes
    const currentColors = React.useMemo(() => ({
        ...Colors,
        backgroundDark: isDark ? Colors.backgroundDark : Colors.backgroundLight,
        cardDark: isDark ? Colors.cardDark : Colors.white,
        cardBorder: isDark ? Colors.cardBorder : Colors.slate200,
        textPrimary: isDark ? Colors.textPrimary : Colors.slate900,
        textSecondary: isDark ? Colors.textSecondary : Colors.slate500,
    }), [isDark]);

    const value = React.useMemo(() => ({
        theme,
        isDark,
        toggleTheme,
        currentColors
    }), [theme, isDark, toggleTheme, currentColors]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
