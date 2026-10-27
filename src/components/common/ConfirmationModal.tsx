// src/components/common/ConfirmationModal.tsx - Deletion & safe action confirmation modal

import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Button } from './Button';

export interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  cascadeDetails?: {
    cardsCount?: number;
    transactionsCount?: number;
    milestonesCount?: number;
  };
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  title,
  message,
  cascadeDetails,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isDestructive = true,
  onConfirm,
  onCancel,
}) => {
  const { colors } = useTheme();

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {title}
              </Text>
              <Text style={[styles.message, { color: colors.textSecondary }]}>
                {message}
              </Text>

              {cascadeDetails && (
                <View
                  style={[
                    styles.cascadeBox,
                    {
                      backgroundColor: colors.dangerBg,
                      borderColor: colors.danger,
                    },
                  ]}
                >
                  <Text style={[styles.cascadeTitle, { color: colors.danger }]}>
                    ⚠️ Cascade Impact Warning:
                  </Text>
                  <Text style={[styles.cascadeItem, { color: colors.textPrimary }]}>
                    • Credit Cards: {cascadeDetails.cardsCount || 0}
                  </Text>
                  <Text style={[styles.cascadeItem, { color: colors.textPrimary }]}>
                    • Transactions: {cascadeDetails.transactionsCount || 0}
                  </Text>
                  <Text style={[styles.cascadeItem, { color: colors.textPrimary }]}>
                    • Milestones: {cascadeDetails.milestonesCount || 0}
                  </Text>
                  <Text style={[styles.cascadeFootnote, { color: colors.textMuted }]}>
                    All associated records will be permanently removed from your phone.
                  </Text>
                </View>
              )}

              <View style={styles.actionRow}>
                <Button
                  title={cancelLabel}
                  variant="secondary"
                  size="md"
                  onPress={onCancel}
                  style={styles.actionBtn}
                />
                <Button
                  title={confirmLabel}
                  variant={isDestructive ? 'danger' : 'primary'}
                  size="md"
                  onPress={onConfirm}
                  style={styles.actionBtn}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  cascadeBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  cascadeTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  cascadeItem: {
    fontSize: 13,
    marginBottom: 3,
  },
  cascadeFootnote: {
    fontSize: 11,
    marginTop: 6,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
  },
});
