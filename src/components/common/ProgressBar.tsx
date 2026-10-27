// src/components/common/ProgressBar.tsx - Visual milestone progress bar

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export interface ProgressBarProps {
  progress: number; // 0 to 100
  height?: number;
  style?: ViewStyle;
  isCompleted?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  height = 8,
  style,
  isCompleted = false,
}) => {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));

  const fillColor = isCompleted
    ? colors.success
    : clamped >= 75
    ? colors.primaryLight
    : colors.primary;

  return (
    <View
      style={[
        styles.container,
        {
          height,
          backgroundColor: colors.border,
          borderRadius: height / 2,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${clamped}%`,
            height,
            backgroundColor: fillColor,
            borderRadius: height / 2,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    minWidth: 2,
  },
});
