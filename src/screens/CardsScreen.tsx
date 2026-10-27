// src/screens/CardsScreen.tsx - Credit Card Portfolio Management

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { CreditCard, CardNetwork, CardStatus } from '../types';
import { createCard, updateCard, deleteCard } from '../db/cardsRepo';
import { rupeesToPaise, paiseToRupees, formatINR } from '../services/calculations';
import { encryptText } from '../services/crypto';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { CreditCardView } from '../components/CreditCardView';
import { MilestoneCard } from '../components/MilestoneCard';
import { TransactionRow } from '../components/TransactionRow';

interface CardsScreenProps {
  onNavigateToTransactions: (cardId: string) => void;
}

export const CardsScreen: React.FC<CardsScreenProps> = ({
  onNavigateToTransactions,
}) => {
  const { colors } = useTheme();
  const { db, cards, people, transactions, milestoneProgressList, refreshData } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPersonFilter, setSelectedPersonFilter] = useState<string>('all');
  const [selectedNetworkFilter, setSelectedNetworkFilter] = useState<string>('all');

  // Form Modal
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);

  // Form Fields
  const [personId, setPersonId] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [cardNickname, setCardNickname] = useState('');
  const [bankName, setBankName] = useState('');
  const [cardIssuer, setCardIssuer] = useState('');
  const [cardNetwork, setCardNetwork] = useState<CardNetwork>('Visa');
  const [lastFourDigits, setLastFourDigits] = useState('');
  const [fullCardNumber, setFullCardNumber] = useState('');
  const [enableFullStorage, setEnableFullStorage] = useState(false);
  const [expiryMonth, setExpiryMonth] = useState('12');
  const [expiryYear, setExpiryYear] = useState(String(new Date().getFullYear() + 3));
  const [creditLimitRupees, setCreditLimitRupees] = useState('');
  const [annualFeeRupees, setAnnualFeeRupees] = useState('0');
  const [openingDate, setOpeningDate] = useState('');
  const [statementDay, setStatementDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [cardStatus, setCardStatus] = useState<CardStatus>('Active');
  const [notes, setNotes] = useState('');

  // Detail Modal
  const [selectedCard, setSelectedCard] = useState<CreditCard | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // Delete Modal
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<CreditCard | null>(null);

  const peopleMap = new Map(people.map(p => [p.id, p.full_name]));

  const handleOpenAdd = () => {
    if (people.length === 0) {
      Alert.alert('Person Required', 'Please add at least one person in the People tab before adding a credit card.');
      return;
    }
    setEditingCard(null);
    setPersonId(people[0].id);
    setCardholderName(people[0].full_name);
    setCardNickname('');
    setBankName('HDFC Bank');
    setCardIssuer('HDFC Bank');
    setCardNetwork('Visa');
    setLastFourDigits('');
    setFullCardNumber('');
    setEnableFullStorage(false);
    setExpiryMonth('12');
    setExpiryYear(String(new Date().getFullYear() + 3));
    setCreditLimitRupees('100000');
    setAnnualFeeRupees('0');
    setOpeningDate(new Date().toISOString().split('T')[0]);
    setStatementDay('15');
    setDueDay('5');
    setCardStatus('Active');
    setNotes('');
    setFormModalVisible(true);
  };

  const handleOpenEdit = (card: CreditCard) => {
    setEditingCard(card);
    setPersonId(card.person_id);
    setCardholderName(card.cardholder_name);
    setCardNickname(card.card_nickname);
    setBankName(card.bank_name);
    setCardIssuer(card.card_issuer);
    setCardNetwork(card.card_network);
    setLastFourDigits(card.last_four_digits);
    setFullCardNumber('');
    setEnableFullStorage(Boolean(card.encrypted_full_number));
    setExpiryMonth(String(card.expiry_month));
    setExpiryYear(String(card.expiry_year));
    setCreditLimitRupees(String(paiseToRupees(card.total_credit_limit)));
    setAnnualFeeRupees(String(paiseToRupees(card.annual_fee)));
    setOpeningDate(card.opening_date || '');
    setStatementDay(card.statement_generation_day ? String(card.statement_generation_day) : '');
    setDueDay(card.payment_due_day ? String(card.payment_due_day) : '');
    setCardStatus(card.card_status);
    setNotes(card.notes || '');
    setFormModalVisible(true);
  };

  const handleSaveCard = async () => {
    if (!db) return;
    if (!personId) {
      Alert.alert('Validation Error', 'Associated Person is required.');
      return;
    }
    if (!cardNickname.trim()) {
      Alert.alert('Validation Error', 'Card Nickname is required.');
      return;
    }
    if (!bankName.trim()) {
      Alert.alert('Validation Error', 'Bank Name is required.');
      return;
    }

    let last4 = lastFourDigits.trim().replace(/\D/g, '');
    if (fullCardNumber.trim().length >= 4) {
      last4 = fullCardNumber.trim().replace(/\D/g, '').slice(-4);
    }

    if (!last4 || last4.length !== 4) {
      Alert.alert('Validation Error', 'Please enter a valid 4-digit last card number.');
      return;
    }

    let encryptedFullNumber: string | null = null;
    if (enableFullStorage && fullCardNumber.trim().length >= 12) {
      // Encrypt full number using AES-GCM
      try {
        const { ciphertext, iv, salt } = await encryptText(
          fullCardNumber.trim(),
          'CardTrack_Local_Device_Master_Secret'
        );
        encryptedFullNumber = JSON.stringify({ ciphertext, iv, salt });
      } catch (err: any) {
        console.error('Encryption failed:', err);
      }
    }

    try {
      if (editingCard) {
        await updateCard(db, {
          id: editingCard.id,
          person_id: personId,
          cardholder_name: cardholderName.trim() || 'Cardholder',
          card_nickname: cardNickname.trim(),
          bank_name: bankName.trim(),
          card_issuer: cardIssuer.trim() || bankName.trim(),
          card_network: cardNetwork,
          last_four_digits: last4,
          encrypted_full_number: encryptedFullNumber || editingCard.encrypted_full_number,
          expiry_month: Number(expiryMonth) || 12,
          expiry_year: Number(expiryYear) || (new Date().getFullYear() + 3),
          total_credit_limit: rupeesToPaise(creditLimitRupees),
          annual_fee: rupeesToPaise(annualFeeRupees),
          opening_date: openingDate.trim() || null,
          statement_generation_day: Number(statementDay) || null,
          payment_due_day: Number(dueDay) || null,
          card_status: cardStatus,
          notes: notes.trim() || null,
        });
      } else {
        await createCard(db, {
          id: `card_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          person_id: personId,
          cardholder_name: cardholderName.trim() || 'Cardholder',
          card_nickname: cardNickname.trim(),
          bank_name: bankName.trim(),
          card_issuer: cardIssuer.trim() || bankName.trim(),
          card_network: cardNetwork,
          last_four_digits: last4,
          encrypted_full_number: encryptedFullNumber,
          expiry_month: Number(expiryMonth) || 12,
          expiry_year: Number(expiryYear) || (new Date().getFullYear() + 3),
          total_credit_limit: rupeesToPaise(creditLimitRupees),
          annual_fee: rupeesToPaise(annualFeeRupees),
          opening_date: openingDate.trim() || null,
          statement_generation_day: Number(statementDay) || null,
          payment_due_day: Number(dueDay) || null,
          card_status: cardStatus,
          notes: notes.trim() || null,
        });
      }

      await refreshData();
      setFormModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save credit card.');
    }
  };

  const handlePromptDelete = (card: CreditCard) => {
    setCardToDelete(card);
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!db || !cardToDelete) return;
    try {
      await deleteCard(db, cardToDelete.id);
      await refreshData();
      setDeleteModalVisible(false);
      setDetailModalVisible(false);
      setCardToDelete(null);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to delete card.');
    }
  };

  // Filter cards
  const filteredCards = cards.filter(c => {
    if (selectedPersonFilter !== 'all' && c.person_id !== selectedPersonFilter) return false;
    if (selectedNetworkFilter !== 'all' && c.card_network !== selectedNetworkFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const personName = peopleMap.get(c.person_id) || '';
      return (
        c.card_nickname.toLowerCase().includes(q) ||
        c.bank_name.toLowerCase().includes(q) ||
        c.card_issuer.toLowerCase().includes(q) ||
        c.cardholder_name.toLowerCase().includes(q) ||
        c.last_four_digits.includes(q) ||
        personName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Calculate card transactions and milestones for detail modal
  const cardTransactions = selectedCard ? transactions.filter(t => t.card_id === selectedCard.id) : [];
  const cardMilestones = selectedCard ? milestoneProgressList.filter(mp => mp.milestone.card_id === selectedCard.id) : [];

  let cardSpending = 0;
  cardTransactions.forEach(t => {
    if (t.transaction_type === 'Purchase') cardSpending += t.amount;
    else if (t.transaction_type === 'Refund' || t.transaction_type === 'Reversal') cardSpending -= t.amount;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Action Bar */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Input
            label=""
            placeholder="Search by nickname, bank, last 4 digits..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>
        <Button
          title="Add Card"
          variant="primary"
          size="md"
          onPress={handleOpenAdd}
          style={{ marginLeft: 10, height: 48 }}
        />
      </View>

      {/* Filter Row */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              { backgroundColor: selectedPersonFilter === 'all' ? colors.primary : colors.surfaceElevated }
            ]}
            onPress={() => setSelectedPersonFilter('all')}
          >
            <Text style={[styles.filterChipText, { color: selectedPersonFilter === 'all' ? '#FFF' : colors.textSecondary }]}>
              All People
            </Text>
          </TouchableOpacity>
          {people.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.filterChip,
                { backgroundColor: selectedPersonFilter === p.id ? colors.primary : colors.surfaceElevated }
              ]}
              onPress={() => setSelectedPersonFilter(p.id)}
            >
              <Text style={[styles.filterChipText, { color: selectedPersonFilter === p.id ? '#FFF' : colors.textSecondary }]}>
                {p.full_name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Cards List */}
      <ScrollView contentContainerStyle={styles.listContent}>
        {filteredCards.length > 0 ? (
          filteredCards.map(c => (
            <View key={c.id} style={styles.cardItemWrapper}>
              <CreditCardView
                card={c}
                onPress={() => {
                  setSelectedCard(c);
                  setDetailModalVisible(true);
                }}
              />
              <View style={styles.cardQuickBar}>
                <Text style={[styles.linkedPersonText, { color: colors.textSecondary }]}>
                  👤 {peopleMap.get(c.person_id) || 'Unknown Person'}
                </Text>
                <View style={styles.cardActionBtns}>
                  <TouchableOpacity
                    onPress={() => handleOpenEdit(c)}
                    style={[styles.smallBtn, { backgroundColor: colors.surfaceElevated }]}
                  >
                    <Text style={{ fontSize: 12 }}>✏️ Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handlePromptDelete(c)}
                    style={[styles.smallBtn, { backgroundColor: colors.dangerBg }]}
                  >
                    <Text style={{ fontSize: 12, color: colors.danger }}>🗑️ Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={[styles.emptyContainer, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>💳</Text>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {searchQuery ? 'No matching cards found' : 'No credit cards added yet'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Add your Visa, Mastercard, or RuPay credit cards to track limits, billing cycles, and milestones.
            </Text>
            <Button
              title="Add New Card"
              variant="primary"
              size="md"
              onPress={handleOpenAdd}
              style={{ marginTop: 14 }}
            />
          </View>
        )}
      </ScrollView>

      {/* Add / Edit Card Modal */}
      <Modal
        visible={formModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFormModalVisible(false)}
      >
        <View style={[styles.modalWrapper, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {editingCard ? 'Edit Credit Card' : 'Add New Credit Card'}
            </Text>
            <TouchableOpacity onPress={() => setFormModalVisible(false)}>
              <Text style={[styles.closeText, { color: colors.primaryLight }]}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll}>
            {/* Person Selector */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Associated Person *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.personPickerScroll}>
              {people.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.pickerChip,
                    { backgroundColor: personId === p.id ? colors.primary : colors.surfaceElevated }
                  ]}
                  onPress={() => {
                    setPersonId(p.id);
                    if (!cardholderName) setCardholderName(p.full_name);
                  }}
                >
                  <Text style={[styles.pickerChipText, { color: personId === p.id ? '#FFF' : colors.textPrimary }]}>
                    {p.full_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Input
              label="Card Nickname (e.g. HDFC Regalia, SBI Cashback)"
              placeholder="e.g. HDFC Regalia Gold"
              value={cardNickname}
              onChangeText={setCardNickname}
              required
            />

            <View style={styles.rowTwoInputs}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Bank Name"
                  placeholder="e.g. HDFC Bank"
                  value={bankName}
                  onChangeText={setBankName}
                  required
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Card Issuer"
                  placeholder="e.g. HDFC Bank"
                  value={cardIssuer}
                  onChangeText={setCardIssuer}
                />
              </View>
            </View>

            <Input
              label="Cardholder Printed Name"
              placeholder="e.g. JOHN DOE"
              value={cardholderName}
              onChangeText={setCardholderName}
            />

            {/* Card Network Selector */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Card Network</Text>
            <View style={styles.networkRow}>
              {(['Visa', 'Mastercard', 'RuPay', 'American Express', 'Diners Club'] as CardNetwork[]).map(net => (
                <TouchableOpacity
                  key={net}
                  style={[
                    styles.networkChip,
                    { backgroundColor: cardNetwork === net ? colors.primary : colors.surfaceElevated }
                  ]}
                  onPress={() => setCardNetwork(net)}
                >
                  <Text style={[styles.networkChipText, { color: cardNetwork === net ? '#FFF' : colors.textPrimary }]}>
                    {net}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Card Numbers & Security Notice */}
            <View style={[styles.securityNoticeBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Text style={[styles.securityTitle, { color: colors.primaryLight }]}>
                🔒 Security Architecture Notice
              </Text>
              <Text style={[styles.securityText, { color: colors.textSecondary }]}>
                CardTrack strictly does NOT store, log, or export CVC/CVV codes.
                Only the last 4 digits are stored by default for identification.
              </Text>
            </View>

            <Input
              label="Last 4 Digits of Card Number"
              placeholder="e.g. 4321"
              maxLength={4}
              keyboardType="number-pad"
              value={lastFourDigits}
              onChangeText={setLastFourDigits}
              required
            />

            <View style={styles.rowTwoInputs}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Expiry Month (1-12)"
                  placeholder="12"
                  maxLength={2}
                  keyboardType="number-pad"
                  value={expiryMonth}
                  onChangeText={setExpiryMonth}
                  required
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Expiry Year"
                  placeholder="2028"
                  maxLength={4}
                  keyboardType="number-pad"
                  value={expiryYear}
                  onChangeText={setExpiryYear}
                  required
                />
              </View>
            </View>

            <View style={styles.rowTwoInputs}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Credit Limit (₹)"
                  placeholder="e.g. 500000"
                  keyboardType="decimal-pad"
                  value={creditLimitRupees}
                  onChangeText={setCreditLimitRupees}
                  required
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Annual Fee (₹)"
                  placeholder="0"
                  keyboardType="decimal-pad"
                  value={annualFeeRupees}
                  onChangeText={setAnnualFeeRupees}
                />
              </View>
            </View>

            <View style={styles.rowTwoInputs}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Statement Day of Month"
                  placeholder="15"
                  maxLength={2}
                  keyboardType="number-pad"
                  value={statementDay}
                  onChangeText={setStatementDay}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Payment Due Day"
                  placeholder="5"
                  maxLength={2}
                  keyboardType="number-pad"
                  value={dueDay}
                  onChangeText={setDueDay}
                />
              </View>
            </View>

            {/* Card Status */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Card Status</Text>
            <View style={styles.networkRow}>
              {(['Active', 'Inactive', 'Closed'] as CardStatus[]).map(st => (
                <TouchableOpacity
                  key={st}
                  style={[
                    styles.networkChip,
                    { backgroundColor: cardStatus === st ? colors.primary : colors.surfaceElevated }
                  ]}
                  onPress={() => setCardStatus(st)}
                >
                  <Text style={[styles.networkChipText, { color: cardStatus === st ? '#FFF' : colors.textPrimary }]}>
                    {st}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Notes"
              placeholder="e.g. Complimentary lounge access card"
              multiline
              numberOfLines={2}
              value={notes}
              onChangeText={setNotes}
            />

            <Button
              title={editingCard ? 'Update Card' : 'Save Credit Card'}
              variant="primary"
              size="lg"
              onPress={handleSaveCard}
              style={{ marginTop: 12, marginBottom: 40 }}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Card Details Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        {selectedCard && (
          <View style={[styles.modalWrapper, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  {selectedCard.card_nickname}
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  {selectedCard.bank_name} • {peopleMap.get(selectedCard.person_id) || 'Cardholder'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <Text style={[styles.closeText, { color: colors.primaryLight }]}>Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll}>
              <CreditCardView card={selectedCard} />

              <View style={[styles.cardStatsBox, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
                <View style={styles.statCol}>
                  <Text style={[styles.cardStatLabel, { color: colors.textMuted }]}>TOTAL SPENT</Text>
                  <Text style={[styles.cardStatVal, { color: colors.primaryLight }]}>
                    {formatINR(cardSpending)}
                  </Text>
                </View>
                <View style={styles.statCol}>
                  <Text style={[styles.cardStatLabel, { color: colors.textMuted }]}>STATEMENT DAY</Text>
                  <Text style={[styles.cardStatVal, { color: colors.textPrimary }]}>
                    {selectedCard.statement_generation_day ? `${selectedCard.statement_generation_day}th` : 'N/A'}
                  </Text>
                </View>
                <View style={styles.statCol}>
                  <Text style={[styles.cardStatLabel, { color: colors.textMuted }]}>DUE DAY</Text>
                  <Text style={[styles.cardStatVal, { color: colors.textPrimary }]}>
                    {selectedCard.payment_due_day ? `${selectedCard.payment_due_day}th` : 'N/A'}
                  </Text>
                </View>
              </View>

              {/* Milestones on this card */}
              <View style={{ marginTop: 18 }}>
                <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
                  Active Milestones ({cardMilestones.length})
                </Text>
                {cardMilestones.length > 0 ? (
                  cardMilestones.map(mp => (
                    <MilestoneCard key={mp.milestone.id} progress={mp} />
                  ))
                ) : (
                  <Text style={[styles.emptySubText, { color: colors.textMuted }]}>
                    No milestones configured for this card.
                  </Text>
                )}
              </View>

              {/* Card Transactions */}
              <View style={{ marginTop: 22 }}>
                <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
                  Transactions ({cardTransactions.length})
                </Text>
                {cardTransactions.slice(0, 8).map(tx => (
                  <TransactionRow key={tx.id} transaction={tx} />
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmationModal
        visible={deleteModalVisible}
        title={`Delete Card: ${cardToDelete?.card_nickname || ''}?`}
        message="Deleting this credit card will permanently remove all associated transactions and milestones recorded for this card."
        confirmLabel="Delete Card"
        cancelLabel="Keep Card"
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
    paddingVertical: 6,
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
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  cardItemWrapper: {
    marginBottom: 16,
  },
  cardQuickBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -8,
    paddingHorizontal: 4,
  },
  linkedPersonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardActionBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
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
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
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
    letterSpacing: 0.3,
  },
  personPickerScroll: {
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
  networkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  networkChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  networkChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  securityNoticeBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  securityTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  securityText: {
    fontSize: 11,
    lineHeight: 16,
  },
  cardStatsBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginTop: 14,
  },
  statCol: {
    alignItems: 'center',
  },
  cardStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  cardStatVal: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptySubText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});
