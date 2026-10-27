// src/components/CreditCardView.tsx - Luxury Visual Credit Card Component

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { CreditCard } from '../types';
import { useTheme } from '../context/ThemeContext';
import { formatINR } from '../services/calculations';
import { maskCardNumber, formatFullCardNumber } from '../services/crypto';
import { AuthService } from '../services/auth';

export interface CreditCardViewProps {
  card: CreditCard;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  style?: ViewStyle;
}

export const CreditCardView: React.FC<CreditCardViewProps> = ({
  card,
  onPress,
  onEdit,
  onDelete,
  style,
}) => {
  const { colors } = useTheme();
  const [isRevealed, setIsRevealed] = useState(false);
  const [unlockedFullNumber, setUnlockedFullNumber] = useState<string | null>(null);

  // Network badge coloring
  const getNetworkColor = () => {
    switch (card.card_network) {
      case 'Visa':
        return '#2563EB';
      case 'Mastercard':
        return '#EA580C';
      case 'RuPay':
        return '#059669';
      case 'American Express':
        return '#0284C7';
      default:
        return '#6366F1';
    }
  };

  const handleToggleReveal = async () => {
    if (isRevealed) {
      setIsRevealed(false);
      setUnlockedFullNumber(null);
      return;
    }

    // Device authentication required before revealing full card number
    const authenticated = await AuthService.authenticateForCardReveal(card.card_nickname);
    if (authenticated) {
      setIsRevealed(true);
      // In production, decrypt with secure key
      setUnlockedFullNumber(card.encrypted_full_number ? '4111 2222 3333 ' + card.last_four_digits : null);
    }
  };

  const expiryStr = `${card.expiry_month.toString().padStart(2, '0')}/${card.expiry_year.toString().slice(-2)}`;

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.85 : 1}
      onPress={onPress}
      style={[
        styles.cardContainer,
        {
          backgroundColor: '#111827',
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {/* Top row: Bank name & Card Network */}
      <View style={styles.topRow}>
        <View>
          <Text style={styles.bankName}>{card.bank_name.toUpperCase()}</Text>
          <Text style={styles.cardNickname}>{card.card_nickname}</Text>
        </View>
        <View style={[styles.networkBadge, { backgroundColor: getNetworkColor() }]}>
          <Text style={styles.networkText}>{card.card_network}</Text>
        </View>
      </View>

      {/* Chip graphic */}
      <View style={styles.chipRow}>
        <View style={styles.chip} />
        <View style={[
          styles.statusBadge,
          {
            backgroundColor: card.card_status === 'Active' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'
          }
        ]}>
          <Text style={[
            styles.statusText,
            { color: card.card_status === 'Active' ? '#10B981' : '#EF4444' }
          ]}>
            {card.card_status}
          </Text>
        </View>
      </View>

      {/* Card Number & Reveal Action */}
      <View style={styles.numberRow}>
        <Text style={styles.cardNumber}>
          {isRevealed && unlockedFullNumber
            ? unlockedFullNumber
            : maskCardNumber(null, card.last_four_digits)}
        </Text>
        {card.encrypted_full_number ? (
          <TouchableOpacity
            onPress={handleToggleReveal}
            style={styles.revealBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.revealText}>
              {isRevealed ? 'Hide' : 'Reveal'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Bottom row: Cardholder Name, Expiry, Credit Limit */}
      <View style={styles.bottomRow}>
        <View style={styles.bottomCol}>
          <Text style={styles.labelMuted}>CARDHOLDER</Text>
          <Text style={styles.cardholderName} numberOfLines={1}>
            {card.cardholder_name.toUpperCase()}
          </Text>
        </View>

        <View style={styles.bottomCol}>
          <Text style={styles.labelMuted}>EXPIRES</Text>
          <Text style={styles.valueText}>{expiryStr}</Text>
        </View>

        <View style={styles.bottomColRight}>
          <Text style={styles.labelMuted}>CREDIT LIMIT</Text>
          <Text style={styles.limitText}>
            {formatINR(card.total_credit_limit)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    minHeight: 200,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bankName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.2,
  },
  cardNickname: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 2,
  },
  networkBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  networkText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },
  chip: {
    width: 38,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#D97706',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  cardNumber: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 2,
    color: '#F8FAFC',
    fontVariant: ['tabular-nums'],
  },
  revealBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  revealText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 6,
  },
  bottomCol: {
    flex: 1,
  },
  bottomColRight: {
    alignItems: 'flex-end',
  },
  labelMuted: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  cardholderName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  valueText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  limitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38BDF8',
  },
});
