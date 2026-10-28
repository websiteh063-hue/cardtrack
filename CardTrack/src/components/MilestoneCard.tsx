// src/components/MilestoneCard.tsx - Milestone visual tracking card

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { MilestoneProgress } from '../types';
import { useTheme } from '../context/ThemeContext';
import { formatINR } from '../services/calculations';
import { ProgressBar } from './common/ProgressBar';

export interface MilestoneCardProps {
  progress: MilestoneProgress;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  style?: ViewStyle;
}

export const MilestoneCard: React.FC<MilestoneCardProps> = ({
  progress,
  onPress,
  onEdit,
  onDelete,
  style,
}) => {
  const { colors } = useTheme();
  const { milestone, cardNickname, personName, eligibleSpending, remainingAmount, progressPercentage, isCompleted, isExpired, daysRemaining } = progress;

  const getStatusBadge = () => {
    if (isCompleted) {
      return {
        label: 'COMPLETED',
        bg: colors.successBg,
        text: colors.success,
      };
    }
    if (isExpired) {
      return {
        label: 'EXPIRED',
        bg: colors.dangerBg,
        text: colors.danger,
      };
    }
    return {
      label: 'IN PROGRESS',
      bg: colors.warningBg,
      text: colors.warning,
    };
  };

  const status = getStatusBadge();

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.85 : 1}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceCard,
          borderColor: isCompleted ? colors.success : colors.border,
        },
        style,
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <Text style={[styles.milestoneName, { color: colors.textPrimary }]} numberOfLines={1}>
            {milestone.milestone_name}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {cardNickname} • {personName}
          </Text>
        </View>

        <View style={[styles.statusChip, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.text }]}>
            {status.label}
          </Text>
        </View>
      </View>

      {milestone.reward_description ? (
        <View style={[styles.rewardBox, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.rewardLabel, { color: colors.primaryLight }]}>🎁 REWARD</Text>
          <Text style={[styles.rewardText, { color: colors.textPrimary }]} numberOfLines={2}>
            {milestone.reward_description}
          </Text>
        </View>
      ) : null}

      {/* Progress metrics */}
      <View style={styles.metricRow}>
        <View>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>CURRENT SPENDING</Text>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
            {formatINR(eligibleSpending)}
          </Text>
        </View>

        <View style={styles.alignRight}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
            {isCompleted ? 'GOAL ACHIEVED' : 'REMAINING'}
          </Text>
          <Text style={[styles.metricValue, { color: isCompleted ? colors.success : colors.primaryLight }]}>
            {isCompleted ? '₹0.00' : formatINR(remainingAmount)}
          </Text>
        </View>
      </View>

      {/* Progress Bar & Percentage */}
      <View style={styles.progressSection}>
        <ProgressBar progress={progressPercentage} isCompleted={isCompleted} height={8} />
        <View style={styles.progressMeta}>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            Target: {formatINR(milestone.target_amount)}
          </Text>
          <Text style={[styles.percentageText, { color: isCompleted ? colors.success : colors.textPrimary }]}>
            {progressPercentage}%
          </Text>
        </View>
      </View>

      {/* Footer: Deadline info */}
      {milestone.end_date && (
        <View style={[styles.footer, { borderTopColor: colors.borderLight }]}>
          <Text style={[styles.deadlineText, { color: colors.textMuted }]}>
            Deadline: {milestone.end_date}
          </Text>
          {daysRemaining !== null && !isCompleted && (
            <Text
              style={[
                styles.countdownText,
                { color: daysRemaining <= 7 ? colors.danger : colors.textSecondary },
              ]}
            >
              {daysRemaining > 0 ? `${daysRemaining} days left` : 'Deadline ended'}
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  titleCol: {
    flex: 1,
    marginRight: 10,
  },
  milestoneName: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  rewardBox: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  rewardLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  rewardText: {
    fontSize: 13,
    fontWeight: '500',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  progressSection: {
    marginBottom: 10,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressText: {
    fontSize: 12,
  },
  percentageText: {
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deadlineText: {
    fontSize: 12,
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
