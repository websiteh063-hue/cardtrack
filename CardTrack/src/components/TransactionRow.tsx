// src/components/TransactionRow.tsx - Transaction list item component

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Transaction } from '../types';
import { useTheme } from '../context/ThemeContext';
import { formatINR } from '../services/calculations';

export interface TransactionRowProps {
  transaction: Transaction;
  cardNickname?: string;
  personName?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

export const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  cardNickname,
  personName,
  onPress,
  style,
}) => {
  const { colors } = useTheme();

  const isPositive =
    transaction.transaction_type === 'Purchase' ||
    (transaction.transaction_type === 'Adjustment' && transaction.amount > 0);

  const isRefund =
    transaction.transaction_type === 'Refund' ||
    transaction.transaction_type === 'Reversal';

  const getTypeBadge = () => {
    switch (transaction.transaction_type) {
      case 'Refund':
        return { text: 'Refund', bg: colors.successBg, color: colors.success };
      case 'Reversal':
        return { text: 'Reversal', bg: colors.warningBg, color: colors.warning };
      case 'Adjustment':
        return { text: 'Adj', bg: colors.surfaceElevated, color: colors.textSecondary };
      case 'Purchase':
      default:
        return { text: 'Purchase', bg: 'rgba(99, 102, 241, 0.12)', color: colors.primaryLight };
    }
  };

  const badge = getTypeBadge();

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.75 : 1}
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: colors.surfaceCard,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <View style={styles.leftCol}>
        <View style={styles.merchantRow}>
          <Text style={[styles.merchantName, { color: colors.textPrimary }]} numberOfLines={1}>
            {transaction.merchant_name}
          </Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
          </View>
        </View>

        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
          {cardNickname ? `${cardNickname} • ` : ''}
          {transaction.transaction_date}
        </Text>

        {transaction.description ? (
          <Text style={[styles.descText, { color: colors.textMuted }]} numberOfLines={1}>
            {transaction.description}
          </Text>
        ) : null}
      </View>

      <View style={styles.rightCol}>
        <Text
          style={[
            styles.amount,
            {
              color: isRefund ? colors.success : colors.textPrimary,
            },
          ]}
        >
          {isRefund ? '-' : ''}
          {formatINR(transaction.amount)}
        </Text>

        {transaction.is_milestone_eligible ? (
          <View style={[styles.eligibleChip, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
            <Text style={[styles.eligibleText, { color: colors.success }]}>✓ Milestone</Text>
          </View>
        ) : (
          <View style={[styles.eligibleChip, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.eligibleText, { color: colors.textMuted }]}>Ineligible</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  leftCol: {
    flex: 1,
    marginRight: 12,
  },
  merchantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  merchantName: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  descText: {
    fontSize: 12,
    marginTop: 2,
  },
  rightCol: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  eligibleChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  eligibleText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
