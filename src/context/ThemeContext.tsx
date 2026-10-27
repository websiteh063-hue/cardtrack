// src/context/ThemeContext.tsx - Theme management (Dark / Light / System)

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'dark' | 'light' | 'system';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceCard: string;
  border: string;
  borderLight: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  danger: string;
  dangerBg: string;
  accent: string;
  cardGradient1: string;
  cardGradient2: string;
}

export const darkThemeColors: ThemeColors = {
  background: '#0B0F17',
  surface: '#131B26',
  surfaceElevated: '#1A2433',
  surfaceCard: '#1E293B',
  border: '#273549',
  borderLight: '#33435C',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  primary: '#6366F1',
  primaryLight: '#818CF8',
  primaryDark: '#4F46E5',
  success: '#10B981',
  successBg: 'rgba(16, 185, 129, 0.12)',
  warning: '#F59E0B',
  warningBg: 'rgba(245, 158, 11, 0.12)',
  danger: '#EF4444',
  dangerBg: 'rgba(239, 68, 68, 0.12)',
  accent: '#38BDF8',
  cardGradient1: '#1E293B',
  cardGradient2: '#0F172A',
};

export const lightThemeColors: ThemeColors = {
  background: '#F1F5F9',
  surface: '#FFFFFF',
  surfaceElevated: '#F8FAFC',
  surfaceCard: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#CBD5E1',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  primary: '#4F46E5',
  primaryLight: '#6366F1',
  primaryDark: '#3730A3',
  success: '#059669',
  successBg: 'rgba(5, 150, 105, 0.1)',
  warning: '#D97706',
  warningBg: 'rgba(217, 119, 6, 0.1)',
  danger: '#DC2626',
  dangerBg: 'rgba(220, 38, 38, 0.1)',
  accent: '#0284C7',
  cardGradient1: '#334155',
  cardGradient2: '#1E293B',
};

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  isDark: true,
  colors: darkThemeColors,
  setMode: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('dark');

  const isDark = mode === 'system' ? systemColorScheme !== 'light' : mode === 'dark';
  const colors = isDark ? darkThemeColors : lightThemeColors;

  return (
    <ThemeContext.Provider value={{ mode, isDark, colors, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
