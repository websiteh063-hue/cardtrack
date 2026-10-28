// src/screens/TransactionsScreen.tsx - Manual Transaction Management & Filtering

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  BackHandler,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { Transaction, TransactionType, TransactionStatus } from '../types';
import { createTransaction, updateTransaction, deleteTransaction } from '../db/transactionsRepo';
import { rupeesToPaise, paiseToRupees, formatINR } from '../services/calculations';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { TransactionRow } from '../components/TransactionRow';

interface TransactionsScreenProps {
  initialCardId?: string;
  initialPersonId?: string;
}

export const TransactionsScreen: React.FC<TransactionsScreenProps> = ({
  initialCardId,
  initialPersonId,
}) => {
  const { colors } = useTheme();
  const { db, transactions, cards, people, refreshData } = useApp();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCardId, setFilterCardId] = useState<string>(initialCardId || 'all');
  const [filterPersonId, setFilterPersonId] = useState<string>(initialPersonId || 'all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterEligible, setFilterEligible] = useState<string>('all');

  // Form Modal
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Form Fields
  const [formCardId, setFormCardId] = useState('');
  const [formPersonId, setFormPersonId] = useState('');
  const [txDate, setTxDate] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [description, setDescription] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [txType, setTxType] = useState<TransactionType>('Purchase');
  const [txStatus, setTxStatus] = useState<TransactionStatus>('Cleared');
  const [isMilestoneEligible, setIsMilestoneEligible] = useState(true);
  const [notes, setNotes] = useState('');

  // Delete Modal
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

  const cardMap = new Map(cards.map(c => [c.id, c]));
  const personMap = new Map(people.map(p => [p.id, p.full_name]));

  // Priority BackHandler for open modals in TransactionsScreen
  useEffect(() => {
    const isAnyModalOpen = formModalVisible || deleteModalVisible;
    if (!isAnyModalOpen) return;

    const onBackPress = () => {
      if (deleteModalVisible) {
        setDeleteModalVisible(false);
        return true;
      }
      if (formModalVisible) {
        setFormModalVisible(false);
        return true;
      }
      return false;
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSub.remove();
  }, [formModalVisible, deleteModalVisible]);

  const handleOpenAdd = () => {
    if (cards.length === 0) {
      Alert.alert('Credit Card Required', 'Please create at least one credit card before recording transactions.');
      return;
    }

    const defaultCard = initialCardId ? cardMap.get(initialCardId) : cards[0];
    const targetCard = defaultCard || cards[0];

    setEditingTx(null);
    setFormCardId(targetCard.id);
    setFormPersonId(targetCard.person_id);
    setTxDate(new Date().toISOString().split('T')[0]);
    setMerchantName('');
    setDescription('');
    setAmountRupees('');
    setTxType('Purchase');
    setTxStatus('Cleared');
    setIsMilestoneEligible(true);
    setNotes('');
    setFormModalVisible(true);
  };

  const handleOpenEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setFormCardId(tx.card_id);
    setFormPersonId(tx.person_id);
    setTxDate(tx.transaction_date);
    setMerchantName(tx.merchant_name);
    setDescription(tx.description || '');
    setAmountRupees(String(paiseToRupees(tx.amount)));
    setTxType(tx.transaction_type);
    setTxStatus(tx.transaction_status);
    setIsMilestoneEligible(tx.is_milestone_eligible);
    setNotes(tx.notes || '');
    setFormModalVisible(true);
  };

  const handleSaveTransaction = async () => {
    if (!db) return;
    if (!formCardId) {
      Alert.alert('Validation Error', 'Please select a Credit Card.');
      return;
    }
    if (!merchantName.trim()) {
      Alert.alert('Validation Error', 'Merchant Name is required.');
      return;
    }
    if (!amountRupees || isNaN(Number(amountRupees)) || Number(amountRupees) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid positive amount.');
      return;
    }
    if (!txDate || !/^\d{4}-\d{2}-\d{2}$/.test(txDate.trim())) {
      Alert.alert('Validation Error', 'Please enter a valid date in YYYY-MM-DD format.');
      return;
    }

    const targetCard = cardMap.get(formCardId);
    const resolvedPersonId = targetCard ? targetCard.person_id : formPersonId;

    try {
      if (editingTx) {
        await updateTransaction(db, {
          id: editingTx.id,
          card_id: formCardId,
          person_id: resolvedPersonId,
          transaction_date: txDate.trim(),
          merchant_name: merchantName.trim(),
          description: description.trim() || null,
          amount: rupeesToPaise(amountRupees),
          transaction_type: txType,
          transaction_status: txStatus,
          is_milestone_eligible: isMilestoneEligible,
          notes: notes.trim() || null,
        });
      } else {
        await createTransaction(db, {
          id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          card_id: formCardId,
          person_id: resolvedPersonId,
          transaction_date: txDate.trim(),
          merchant_name: merchantName.trim(),
          description: description.trim() || null,
          amount: rupeesToPaise(amountRupees),
          transaction_type: txType,
          transaction_status: txStatus,
          is_milestone_eligible: isMilestoneEligible,
          notes: notes.trim() || null,
        });
      }

      await refreshData();
      setFormModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save transaction.');
    }
  };

  const handlePromptDelete = (tx: Transaction) => {
    setTxToDelete(tx);
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!db || !txToDelete) return;
    try {
      await deleteTransaction(db, txToDelete.id);
      await refreshData();
      setDeleteModalVisible(false);
      setTxToDelete(null);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to delete transaction.');
    }
  };

  // Filter logic
  const filteredTransactions = transactions.filter(tx => {
    if (filterCardId !== 'all' && tx.card_id !== filterCardId) return false;
    if (filterPersonId !== 'all' && tx.person_id !== filterPersonId) return false;
    if (filterType !== 'all' && tx.transaction_type !== filterType) return false;
    if (filterEligible === 'eligible' && !tx.is_milestone_eligible) return false;
    if (filterEligible === 'ineligible' && tx.is_milestone_eligible) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMerchant = tx.merchant_name.toLowerCase().includes(q);
      const matchDesc = tx.description ? tx.description.toLowerCase().includes(q) : false;
      const matchNotes = tx.notes ? tx.notes.toLowerCase().includes(q) : false;
      if (!matchMerchant && !matchDesc && !matchNotes) return false;
    }
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Input
            label=""
            placeholder="Search merchant, description..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>
        <Button
          title="+ Add"
          variant="primary"
          size="md"
          onPress={handleOpenAdd}
          style={{ marginLeft: 10, height: 48 }}
        />
      </View>

      {/* Filter Row 1: Cards */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              { backgroundColor: filterCardId === 'all' ? colors.primary : colors.surfaceElevated }
            ]}
            onPress={() => setFilterCardId('all')}
          >
            <Text style={[styles.filterChipText, { color: filterCardId === 'all' ? '#FFF' : colors.textSecondary }]}>
              All Cards
            </Text>
          </TouchableOpacity>
          {cards.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[
                styles.filterChip,
                { backgroundColor: filterCardId === c.id ? colors.primary : colors.surfaceElevated }
              ]}
              onPress={() => setFilterCardId(c.id)}
            >
              <Text style={[styles.filterChipText, { color: filterCardId === c.id ? '#FFF' : colors.textSecondary }]}>
                {c.card_nickname}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Filter Row 2: Types & Eligibility */}
      <View style={styles.filterRowSmall}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {['all', 'Purchase', 'Refund', 'Reversal', 'Adjustment'].map(type => (
            <TouchableOpacity
              key={type}
              style={[
                styles.typeChip,
                { backgroundColor: filterType === type ? colors.primaryLight : colors.surfaceCard }
              ]}
              onPress={() => setFilterType(type)}
            >
              <Text style={[styles.typeChipText, { color: filterType === type ? '#FFF' : colors.textMuted }]}>
                {type === 'all' ? 'All Types' : type}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[
              styles.typeChip,
              { backgroundColor: filterEligible === 'eligible' ? colors.success : colors.surfaceCard }
            ]}
            onPress={() => setFilterEligible(filterEligible === 'eligible' ? 'all' : 'eligible')}
          >
            <Text style={[styles.typeChipText, { color: filterEligible === 'eligible' ? '#FFF' : colors.textMuted }]}>
              ✓ Milestone Only
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Transactions List */}
      <ScrollView contentContainerStyle={styles.listContent}>
        {filteredTransactions.length > 0 ? (
          filteredTransactions.map(tx => {
            const card = cardMap.get(tx.card_id);
            return (
              <View key={tx.id} style={styles.txRowWrapper}>
                <TransactionRow
                  transaction={tx}
                  cardNickname={card?.card_nickname}
                  personName={personMap.get(tx.person_id)}
                  onPress={() => handleOpenEdit(tx)}
                />
                <View style={styles.quickActionRow}>
                  <TouchableOpacity
                    onPress={() => handleOpenEdit(tx)}
                    style={[styles.actionBtnTiny, { backgroundColor: colors.surfaceElevated }]}
                  >
                    <Text style={{ fontSize: 11 }}>✏️ Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handlePromptDelete(tx)}
                    style={[styles.actionBtnTiny, { backgroundColor: colors.dangerBg }]}
                  >
                    <Text style={{ fontSize: 11, color: colors.danger }}>🗑️ Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        ) : (
          <View style={[styles.emptyContainer, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🧾</Text>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {searchQuery ? 'No matching transactions' : 'No transactions recorded'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Record manually entered credit card purchases and refunds to track milestone eligibility.
            </Text>
            <Button
              title="Add Transaction"
              variant="primary"
              size="md"
              onPress={handleOpenAdd}
              style={{ marginTop: 14 }}
            />
          </View>
        )}
      </ScrollView>

      {/* Add / Edit Transaction Modal */}
      <Modal
        visible={formModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFormModalVisible(false)}
      >
        <View style={[styles.modalWrapper, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {editingTx ? 'Edit Transaction' : 'Record Transaction'}
            </Text>
            <TouchableOpacity onPress={() => setFormModalVisible(false)}>
              <Text style={[styles.closeText, { color: colors.primaryLight }]}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll}>
            {/* Card Picker */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Credit Card *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
              {cards.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.pickerChip,
                    { backgroundColor: formCardId === c.id ? colors.primary : colors.surfaceElevated }
                  ]}
                  onPress={() => {
                    setFormCardId(c.id);
                    setFormPersonId(c.person_id);
                  }}
                >
                  <Text style={[styles.pickerChipText, { color: formCardId === c.id ? '#FFF' : colors.textPrimary }]}>
                    {c.card_nickname} ({c.bank_name})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.rowTwoInputs}>
              <View style={{ flex: 1.2 }}>
                <Input
                  label="Transaction Amount (₹)"
                  placeholder="e.g. 4500.00"
                  keyboardType="decimal-pad"
                  value={amountRupees}
                  onChangeText={setAmountRupees}
                  required
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Date (YYYY-MM-DD)"
                  placeholder="YYYY-MM-DD"
                  maxLength={10}
                  value={txDate}
                  onChangeText={setTxDate}
                  required
                />
              </View>
            </View>

            <Input
              label="Merchant Name"
              placeholder="e.g. Amazon, Apple Store, Zomato"
              value={merchantName}
              onChangeText={setMerchantName}
              required
            />

            <Input
              label="Description (Optional)"
              placeholder="e.g. Flight booking for vacation"
              value={description}
              onChangeText={setDescription}
            />

            {/* Transaction Type Picker */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Transaction Type</Text>
            <View style={styles.chipsRow}>
              {(['Purchase', 'Refund', 'Reversal', 'Adjustment'] as TransactionType[]).map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.networkChip,
                    { backgroundColor: txType === type ? colors.primary : colors.surfaceElevated }
                  ]}
                  onPress={() => setTxType(type)}
                >
                  <Text style={[styles.networkChipText, { color: txType === type ? '#FFF' : colors.textPrimary }]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Milestone Eligibility Toggle */}
            <View style={[styles.eligibilityBox, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[styles.eligibilityTitle, { color: colors.textPrimary }]}>
                  Milestone Eligible Spending
                </Text>
                <Text style={[styles.eligibilityDesc, { color: colors.textMuted }]}>
                  {txType === 'Purchase'
                    ? 'Counts towards spend milestones and reward bonuses.'
                    : 'Refunds/reversals automatically reduce eligible spending totals.'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsMilestoneEligible(!isMilestoneEligible)}
                style={[
                  styles.toggleBtn,
                  { backgroundColor: isMilestoneEligible ? colors.success : colors.surfaceElevated }
                ]}
              >
                <Text style={{ color: isMilestoneEligible ? '#FFF' : colors.textMuted, fontWeight: '700' }}>
                  {isMilestoneEligible ? 'YES' : 'NO'}
                </Text>
              </TouchableOpacity>
            </View>

            <Input
              label="Notes (Optional)"
              placeholder="e.g. 5X reward points on weekend offer"
              multiline
              numberOfLines={2}
              value={notes}
              onChangeText={setNotes}
            />

            <Button
              title={editingTx ? 'Update Transaction' : 'Save Transaction'}
              variant="primary"
              size="lg"
              onPress={handleSaveTransaction}
              style={{ marginTop: 12, marginBottom: 40 }}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmationModal
        visible={deleteModalVisible}
        title="Delete Transaction?"
        message="Deleting this transaction will update your overall spending totals and automatically recalculate affected milestone progress."
        confirmLabel="Delete"
        cancelLabel="Keep"
        isDestructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  filterRowSmall: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 6,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  txRowWrapper: {
    marginBottom: 12,
  },
  quickActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: -4,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  actionBtnTiny: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  emptyContainer: {
    padding: 28,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  modalWrapper: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
  },
  formScroll: {
    padding: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  pickerScroll: {
    marginBottom: 16,
  },
  pickerChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
  },
  pickerChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  rowTwoInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  networkChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  networkChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  eligibilityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  eligibilityTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  eligibilityDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
});
