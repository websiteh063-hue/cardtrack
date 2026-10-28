// src/screens/CardsScreen.tsx - Credit Card Portfolio Management

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
  Platform,
  ToastAndroid,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { CreditCard, CardNetwork, CardStatus } from '../types';
import { createCard, updateCard, deleteCard } from '../db/cardsRepo';
import { createPerson } from '../db/peopleRepo';
import { rupeesToPaise, paiseToRupees, formatINR } from '../services/calculations';
import { encryptText, decryptText, maskCardNumber } from '../services/crypto';
import { AuthService } from '../services/auth';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { CreditCardView } from '../components/CreditCardView';
import { MilestoneCard } from '../components/MilestoneCard';
import { TransactionRow } from '../components/TransactionRow';
import {
  INDIAN_BANKS,
  IndianBank,
  detectCardNetwork,
  formatCardNumberInput,
} from '../constants/banks';

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

  // Bank Picker Modal
  const [bankPickerVisible, setBankPickerVisible] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [isCustomBankMode, setIsCustomBankMode] = useState(false);

  // Form Fields
  const [personName, setPersonName] = useState('');
  const [personId, setPersonId] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [cardNickname, setCardNickname] = useState('');
  const [bankName, setBankName] = useState('HDFC Bank');
  const [cardIssuer, setCardIssuer] = useState('HDFC Bank');
  const [cardNetwork, setCardNetwork] = useState<CardNetwork>('Visa');
  const [fullCardNumber, setFullCardNumber] = useState('');
  const [lastFourDigits, setLastFourDigits] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('12');
  const [expiryYear, setExpiryYear] = useState(String(new Date().getFullYear() + 3));
  const [creditLimitRupees, setCreditLimitRupees] = useState('');
  const [annualFeeRupees, setAnnualFeeRupees] = useState('0');
  const [openingDate, setOpeningDate] = useState('');
  const [statementDay, setStatementDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [cardStatus, setCardStatus] = useState<CardStatus>('Active');
  const [notes, setNotes] = useState('');
  const [showAdvancedCardDetails, setShowAdvancedCardDetails] = useState(false);

  // Detail Modal
  const [selectedCard, setSelectedCard] = useState<CreditCard | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [revealedNumberInDetail, setRevealedNumberInDetail] = useState<string | null>(null);

  // Delete Modal
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<CreditCard | null>(null);

  const peopleMap = new Map(people.map(p => [p.id, p.full_name]));

  // Priority BackHandler for open modals in CardsScreen
  useEffect(() => {
    const isAnyModalOpen =
      bankPickerVisible || formModalVisible || detailModalVisible || deleteModalVisible;

    if (!isAnyModalOpen) return;

    const onBackPress = () => {
      if (bankPickerVisible) {
        setBankPickerVisible(false);
        return true;
      }
      if (deleteModalVisible) {
        setDeleteModalVisible(false);
        return true;
      }
      if (formModalVisible) {
        setFormModalVisible(false);
        return true;
      }
      if (detailModalVisible) {
        setDetailModalVisible(false);
        return true;
      }
      return false;
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSub.remove();
  }, [bankPickerVisible, formModalVisible, detailModalVisible, deleteModalVisible]);

  const handleOpenAdd = () => {
    setEditingCard(null);
    const defaultPerson = people.length > 0 ? people[0].full_name : 'Self';
    const defaultPersonId = people.length > 0 ? people[0].id : '';

    setPersonName(defaultPerson);
    setPersonId(defaultPersonId);
    setCardholderName(defaultPerson);
    setBankName('HDFC Bank');
    setCardIssuer('HDFC Bank');
    setCardNickname('HDFC Bank Card');
    setCardNetwork('Visa');
    setFullCardNumber('');
    setLastFourDigits('');
    setExpiryMonth('12');
    setExpiryYear(String(new Date().getFullYear() + 3));
    setCreditLimitRupees('100000');
    setAnnualFeeRupees('0');
    setOpeningDate(new Date().toISOString().split('T')[0]);
    setStatementDay('15');
    setDueDay('5');
    setCardStatus('Active');
    setNotes('');
    setShowAdvancedCardDetails(false);
    setFormModalVisible(true);
  };

  const handleOpenEdit = (card: CreditCard) => {
    setEditingCard(card);
    const person = peopleMap.get(card.person_id) || 'Self';
    setPersonName(person);
    setPersonId(card.person_id);
    setCardholderName(card.cardholder_name);
    setCardNickname(card.card_nickname);
    setBankName(card.bank_name);
    setCardIssuer(card.card_issuer);
    setCardNetwork(card.card_network);
    setLastFourDigits(card.last_four_digits);
    setFullCardNumber(card.last_four_digits ? `•••• •••• •••• ${card.last_four_digits}` : '');
    setExpiryMonth(String(card.expiry_month));
    setExpiryYear(String(card.expiry_year));
    setCreditLimitRupees(String(paiseToRupees(card.total_credit_limit)));
    setAnnualFeeRupees(String(paiseToRupees(card.annual_fee)));
    setOpeningDate(card.opening_date || '');
    setStatementDay(card.statement_generation_day ? String(card.statement_generation_day) : '');
    setDueDay(card.payment_due_day ? String(card.payment_due_day) : '');
    setCardStatus(card.card_status);
    setNotes(card.notes || '');
    setShowAdvancedCardDetails(true);
    setFormModalVisible(true);
  };

  // Select bank from dropdown
  const handleSelectBank = (bank: IndianBank) => {
    setBankName(bank.name);
    setCardIssuer(bank.name);
    // Card nickname = bank name card (e.g. SBI Card, HDFC Bank Card)
    setCardNickname(`${bank.popularName} Card`);
    if (bank.defaultNetwork) {
      setCardNetwork(bank.defaultNetwork);
    }
    setBankPickerVisible(false);
  };

  const handleSaveCard = async () => {
    if (!db) return;

    const trimmedPersonName = personName.trim() || 'Self';
    if (!trimmedPersonName) {
      Alert.alert('Validation Error', 'Person / Profile Name is required.');
      return;
    }

    if (!bankName.trim()) {
      Alert.alert('Validation Error', 'Bank Name is required.');
      return;
    }

    const cleanDigits = fullCardNumber.replace(/\D/g, '');
    let last4 = lastFourDigits.replace(/\D/g, '');

    if (cleanDigits.length >= 4) {
      last4 = cleanDigits.slice(-4);
    }

    if (!last4 || last4.length !== 4) {
      Alert.alert('Validation Error', 'Please enter a valid 16-digit card number or at least the last 4 digits.');
      return;
    }

    // Encrypt full card number if provided
    let encryptedFullNumber: string | null = null;
    if (cleanDigits.length >= 12) {
      try {
        const { ciphertext, iv, salt } = await encryptText(
          cleanDigits,
          'CardTrack_Local_Device_Master_Secret'
        );
        encryptedFullNumber = JSON.stringify({ ciphertext, iv, salt });
      } catch (err: any) {
        console.error('Card encryption failed:', err);
      }
    }

    try {
      // 1. Resolve or Auto-Create Person Record
      let targetPersonId = personId;
      const existingPerson = people.find(
        p => p.full_name.toLowerCase() === trimmedPersonName.toLowerCase()
      );

      if (existingPerson) {
        targetPersonId = existingPerson.id;
      } else {
        // Auto-create person directly while saving card details
        targetPersonId = `person_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await createPerson(db, {
          id: targetPersonId,
          full_name: trimmedPersonName,
          phone: null,
          email: null,
          notes: 'Auto-created via Card entry',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      const finalNickname = cardNickname.trim() || `${bankName.trim()} Card`;
      const finalIssuer = cardIssuer.trim() || bankName.trim();
      const finalHolder = cardholderName.trim() || trimmedPersonName;

      if (editingCard) {
        await updateCard(db, {
          id: editingCard.id,
          person_id: targetPersonId,
          cardholder_name: finalHolder,
          card_nickname: finalNickname,
          bank_name: bankName.trim(),
          card_issuer: finalIssuer,
          card_network: cardNetwork,
          last_four_digits: last4,
          encrypted_full_number: encryptedFullNumber || editingCard.encrypted_full_number,
          expiry_month: Number(expiryMonth) || 12,
          expiry_year: Number(expiryYear) || (new Date().getFullYear() + 3),
          total_credit_limit: rupeesToPaise(creditLimitRupees || '100000'),
          annual_fee: rupeesToPaise(annualFeeRupees || '0'),
          opening_date: openingDate.trim() || null,
          statement_generation_day: Number(statementDay) || null,
          payment_due_day: Number(dueDay) || null,
          card_status: cardStatus,
          notes: notes.trim() || null,
        });
      } else {
        await createCard(db, {
          id: `card_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          person_id: targetPersonId,
          cardholder_name: finalHolder,
          card_nickname: finalNickname,
          bank_name: bankName.trim(),
          card_issuer: finalIssuer,
          card_network: cardNetwork,
          last_four_digits: last4,
          encrypted_full_number: encryptedFullNumber,
          expiry_month: Number(expiryMonth) || 12,
          expiry_year: Number(expiryYear) || (new Date().getFullYear() + 3),
          total_credit_limit: rupeesToPaise(creditLimitRupees || '100000'),
          annual_fee: rupeesToPaise(annualFeeRupees || '0'),
          opening_date: openingDate.trim() || null,
          statement_generation_day: Number(statementDay) || null,
          payment_due_day: Number(dueDay) || null,
          card_status: cardStatus,
          notes: notes.trim() || null,
        });
      }

      await refreshData();
      setFormModalVisible(false);

      if (Platform.OS === 'android') {
        ToastAndroid.show('Card saved successfully!', ToastAndroid.SHORT);
      }
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

  // Reveal decrypted full number in Detail Modal
  const handleRevealFullNumberInDetail = async (card: CreditCard) => {
    if (revealedNumberInDetail) {
      setRevealedNumberInDetail(null);
      return;
    }

    const authenticated = await AuthService.authenticateForCardReveal(card.card_nickname);
    if (!authenticated) return;

    if (card.encrypted_full_number) {
      try {
        const payload = JSON.parse(card.encrypted_full_number);
        if (payload.ciphertext && payload.iv && payload.salt) {
          const decrypted = await decryptText(
            payload.ciphertext,
            payload.iv,
            payload.salt,
            'CardTrack_Local_Device_Master_Secret'
          );
          setRevealedNumberInDetail(formatCardNumberInput(decrypted));
          return;
        }
      } catch (err) {
        console.error('Decryption failed:', err);
      }
    }
    setRevealedNumberInDetail(`•••• •••• •••• ${card.last_four_digits}`);
  };

  // Filtered Cards
  const filteredCards = cards.filter(c => {
    if (selectedPersonFilter !== 'all' && c.person_id !== selectedPersonFilter) return false;
    if (selectedNetworkFilter !== 'all' && c.card_network !== selectedNetworkFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const person = peopleMap.get(c.person_id) || '';
      return (
        c.card_nickname.toLowerCase().includes(q) ||
        c.bank_name.toLowerCase().includes(q) ||
        c.card_issuer.toLowerCase().includes(q) ||
        c.cardholder_name.toLowerCase().includes(q) ||
        c.last_four_digits.includes(q) ||
        person.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Filtered Banks for Dropbox
  const filteredBanks = INDIAN_BANKS.filter(b => {
    if (!bankSearchQuery.trim()) return true;
    const q = bankSearchQuery.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      b.popularName.toLowerCase().includes(q) ||
      b.shortCode.toLowerCase().includes(q) ||
      b.category.toLowerCase().includes(q)
    );
  });

  // Card stats for detail modal
  const cardMilestones = selectedCard
    ? milestoneProgressList.filter(mp => mp.milestone.card_id === selectedCard.id)
    : [];

  const cardTransactions = selectedCard
    ? transactions.filter(t => t.card_id === selectedCard.id)
    : [];

  const cardSpending = cardTransactions.reduce((acc, t) => {
    if (t.transaction_status === 'Disputed' || t.transaction_status === 'Pending') return acc;
    if (t.transaction_type === 'Purchase') return acc + t.amount;
    if (t.transaction_type === 'Refund' || t.transaction_type === 'Reversal') return acc - t.amount;
    return acc;
  }, 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search & Action Bar */}
      <View style={styles.topBar}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Input
            placeholder="Search cards, banks, last 4 digits..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <Button
          title="+ Add Card"
          variant="primary"
          size="md"
          onPress={handleOpenAdd}
        />
      </View>

      {/* Network Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <TouchableOpacity
          style={[
            styles.filterChip,
            { backgroundColor: selectedNetworkFilter === 'all' ? colors.primary : colors.surfaceElevated, marginRight: 6 }
          ]}
          onPress={() => setSelectedNetworkFilter('all')}
        >
          <Text style={[styles.filterChipText, { color: selectedNetworkFilter === 'all' ? '#FFF' : colors.textPrimary }]}>
            All Networks
          </Text>
        </TouchableOpacity>
        {(['Visa', 'Mastercard', 'RuPay', 'American Express'] as CardNetwork[]).map(net => (
          <TouchableOpacity
            key={net}
            style={[
              styles.filterChip,
              { backgroundColor: selectedNetworkFilter === net ? colors.primary : colors.surfaceElevated, marginRight: 6 }
            ]}
            onPress={() => setSelectedNetworkFilter(selectedNetworkFilter === net ? 'all' : net)}
          >
            <Text style={[styles.filterChipText, { color: selectedNetworkFilter === net ? '#FFF' : colors.textPrimary }]}>
              {net}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Credit Cards List */}
      <ScrollView contentContainerStyle={styles.listContent}>
        {filteredCards.length > 0 ? (
          filteredCards.map(card => {
            const person = peopleMap.get(card.person_id) || 'Cardholder';
            return (
              <View key={card.id} style={styles.cardItemWrapper}>
                <CreditCardView
                  card={card}
                  onPress={() => {
                    setSelectedCard(card);
                    setRevealedNumberInDetail(null);
                    setDetailModalVisible(true);
                  }}
                />
                <View style={styles.cardQuickBar}>
                  <Text style={[styles.linkedPersonText, { color: colors.textSecondary }]}>
                    👤 {person}
                  </Text>
                  <View style={styles.cardActionBtns}>
                    <TouchableOpacity
                      style={[styles.smallBtn, { backgroundColor: colors.surfaceElevated }]}
                      onPress={() => handleOpenEdit(card)}
                    >
                      <Text style={{ color: colors.textPrimary, fontSize: 12 }}>✏️ Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.smallBtn, { backgroundColor: colors.dangerBg }]}
                      onPress={() => handlePromptDelete(card)}
                    >
                      <Text style={{ color: colors.danger, fontSize: 12 }}>🗑️ Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <View style={[styles.emptyContainer, { backgroundColor: colors.surfaceCard }]}>
            <Text style={{ fontSize: 44, marginBottom: 12 }}>💳</Text>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {searchQuery ? 'No matching credit cards found' : 'No credit cards added yet'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {searchQuery
                ? 'Try a different search term.'
                : 'Tap "+ Add Card" above to save your first credit card. You can enter the person name right inside the form!'}
            </Text>
            {!searchQuery && (
              <Button
                title="+ Add Card Now"
                variant="primary"
                onPress={handleOpenAdd}
                style={{ marginTop: 16 }}
              />
            )}
          </View>
        )}
      </ScrollView>

      {/* ========================================================= */}
      {/* ADD / EDIT CARD MODAL */}
      {/* ========================================================= */}
      <Modal
        visible={formModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFormModalVisible(false)}
      >
        <View style={[styles.modalWrapper, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {editingCard ? 'Edit Credit Card' : 'Add New Credit Card'}
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Save credit card details, limits, and billing cycle
              </Text>
            </View>
            <TouchableOpacity onPress={() => setFormModalVisible(false)}>
              <Text style={[styles.closeText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
            {/* 1. PERSON / CARDHOLDER NAME (Direct entry) */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
              Person / Profile Name *
            </Text>

            {people.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.personPickerScroll}
              >
                {people.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.pickerChip,
                      {
                        backgroundColor:
                          personName.toLowerCase() === p.full_name.toLowerCase()
                            ? colors.primary
                            : colors.surfaceElevated,
                      },
                    ]}
                    onPress={() => {
                      setPersonName(p.full_name);
                      setPersonId(p.id);
                      setCardholderName(p.full_name);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerChipText,
                        {
                          color:
                            personName.toLowerCase() === p.full_name.toLowerCase()
                              ? '#FFF'
                              : colors.textPrimary,
                        },
                      ]}
                    >
                      {p.full_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <Input
              placeholder="e.g. Aman, Self, Dad, Wife"
              value={personName}
              onChangeText={val => {
                setPersonName(val);
                const matched = people.find(
                  p => p.full_name.toLowerCase() === val.trim().toLowerCase()
                );
                if (matched) {
                  setPersonId(matched.id);
                } else {
                  setPersonId('');
                }
                if (!cardholderName || cardholderName === personName) {
                  setCardholderName(val);
                }
              }}
              required
            />

            {/* 2. BANK NAME PICKER (Searchable Indian Banks Dropbox) */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 4 }]}>
              Bank Name * (Tap to pick from all Indian banks or type)
            </Text>
            <TouchableOpacity
              style={[
                styles.bankSelectorBox,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
              onPress={() => {
                setBankSearchQuery('');
                setIsCustomBankMode(false);
                setBankPickerVisible(true);
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.bankSelectorTitle, { color: colors.textPrimary }]}>
                  🏦 {bankName || 'Select Indian Bank'}
                </Text>
                <Text style={[styles.bankSelectorSub, { color: colors.textSecondary }]}>
                  Tap to search SBI, HDFC, ICICI, Axis, Kotak, Amex, etc.
                </Text>
              </View>
              <Text style={{ fontSize: 16, color: colors.primaryLight }}>▼</Text>
            </TouchableOpacity>

            {/* 3. CARD NUMBER (16-Digit Full Number or Last 4) */}
            <View style={{ marginTop: 12 }}>
              <View style={styles.cardNumberLabelRow}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary, marginBottom: 0 }]}>
                  Card Number (16-Digit or Last 4) *
                </Text>
                <View style={[styles.detectedNetworkPill, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.detectedNetworkText, { color: colors.primaryLight }]}>
                    💳 {cardNetwork}
                  </Text>
                </View>
              </View>

              <Input
                placeholder="e.g. 4532 1234 5678 9012 or 4321"
                value={fullCardNumber}
                keyboardType="number-pad"
                onChangeText={text => {
                  const formatted = formatCardNumberInput(text);
                  setFullCardNumber(formatted);
                  const clean = text.replace(/\D/g, '');
                  if (clean.length >= 4) {
                    setLastFourDigits(clean.slice(-4));
                    const detected = detectCardNetwork(clean);
                    setCardNetwork(detected);
                  }
                }}
                required
              />
              <Text style={[styles.helperSecurityText, { color: colors.textMuted }]}>
                🔒 Full number is AES-256-GCM encrypted locally. CVC/CVV is never stored.
              </Text>
            </View>

            {/* 4. EXPIRY & CREDIT LIMIT */}
            <View style={[styles.rowTwoInputs, { marginTop: 6 }]}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Expiry Month (MM)"
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
                  label="Expiry Year (YYYY)"
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
                  placeholder="e.g. 200000"
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

            {/* 5. STATEMENT & DUE DATES */}
            <View style={styles.rowTwoInputs}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Statement Day (1-31)"
                  placeholder="15"
                  maxLength={2}
                  keyboardType="number-pad"
                  value={statementDay}
                  onChangeText={setStatementDay}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Payment Due Day (1-31)"
                  placeholder="5"
                  maxLength={2}
                  keyboardType="number-pad"
                  value={dueDay}
                  onChangeText={setDueDay}
                />
              </View>
            </View>

            {/* ADVANCED CUSTOMIZATION TOGGLE */}
            <TouchableOpacity
              style={styles.advancedToggleBtn}
              onPress={() => setShowAdvancedCardDetails(!showAdvancedCardDetails)}
            >
              <Text style={[styles.advancedToggleText, { color: colors.primaryLight }]}>
                {showAdvancedCardDetails ? '▲ Hide Advanced Details' : '▼ More Card Details (Nickname, Issuer, Notes)'}
              </Text>
            </TouchableOpacity>

            {showAdvancedCardDetails && (
              <View style={{ marginTop: 8 }}>
                <Input
                  label="Card Nickname (Auto-synced from Bank)"
                  placeholder="e.g. HDFC Regalia, SBI Cashback"
                  value={cardNickname}
                  onChangeText={setCardNickname}
                />

                <Input
                  label="Card Issuer"
                  placeholder="e.g. HDFC Bank"
                  value={cardIssuer}
                  onChangeText={setCardIssuer}
                />

                <Input
                  label="Cardholder Printed Name"
                  placeholder="e.g. AMAN SINGH"
                  value={cardholderName}
                  onChangeText={setCardholderName}
                />

                {/* Card Status */}
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Card Status</Text>
                <View style={styles.networkRow}>
                  {(['Active', 'Inactive', 'Closed'] as CardStatus[]).map(st => (
                    <TouchableOpacity
                      key={st}
                      style={[
                        styles.networkChip,
                        { backgroundColor: cardStatus === st ? colors.primary : colors.surfaceElevated },
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
                  placeholder="e.g. 5% cashback on online purchases"
                  multiline
                  numberOfLines={2}
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>
            )}

            <Button
              title={editingCard ? 'Update Credit Card' : 'Save Credit Card'}
              variant="primary"
              size="lg"
              onPress={handleSaveCard}
              style={{ marginTop: 18, marginBottom: 40 }}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* SEARCHABLE INDIAN BANKS DROPBOX MODAL */}
      {/* ========================================================= */}
      <Modal
        visible={bankPickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setBankPickerVisible(false)}
      >
        <View style={[styles.modalWrapper, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Select Bank
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                All Indian banks & card issuers
              </Text>
            </View>
            <TouchableOpacity onPress={() => setBankPickerVisible(false)}>
              <Text style={[styles.closeText, { color: colors.textMuted }]}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <Input
              placeholder="Search bank name (e.g. SBI, HDFC, ICICI, Axis...)"
              value={bankSearchQuery}
              onChangeText={setBankSearchQuery}
            />

            {/* Custom Bank Manual Entry Option */}
            <TouchableOpacity
              style={[
                styles.customBankBtn,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
              onPress={() => setIsCustomBankMode(!isCustomBankMode)}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primaryLight }}>
                ✏️ {isCustomBankMode ? 'Close Custom Entry' : 'Type Custom Bank Name Manually'}
              </Text>
            </TouchableOpacity>

            {isCustomBankMode && (
              <View style={{ marginTop: 8, marginBottom: 8 }}>
                <Input
                  placeholder="Enter bank name manually..."
                  value={bankName}
                  onChangeText={val => {
                    setBankName(val);
                    setCardIssuer(val);
                    setCardNickname(`${val.trim()} Card`);
                  }}
                />
                <Button
                  title="Use This Bank"
                  variant="primary"
                  size="sm"
                  onPress={() => setBankPickerVisible(false)}
                  style={{ marginTop: 6 }}
                />
              </View>
            )}
          </View>

          <ScrollView style={styles.bankListScroll} showsVerticalScrollIndicator={false}>
            {filteredBanks.map(bank => {
              const isSelected = bankName === bank.name;
              return (
                <TouchableOpacity
                  key={bank.name}
                  style={[
                    styles.bankRowItem,
                    {
                      backgroundColor: isSelected ? colors.primary + '18' : colors.surfaceCard,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => handleSelectBank(bank)}
                >
                  <View style={[styles.bankIconCircle, { backgroundColor: colors.surfaceElevated }]}>
                    <Text style={{ fontSize: 16 }}>🏦</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.bankRowName, { color: colors.textPrimary }]}>
                      {bank.popularName}
                    </Text>
                    <Text style={[styles.bankRowFullName, { color: colors.textSecondary }]}>
                      {bank.name} • {bank.category}
                    </Text>
                  </View>
                  {isSelected && (
                    <Text style={{ fontSize: 18, color: colors.primary, fontWeight: '800' }}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* CARD DETAILS MODAL */}
      {/* ========================================================= */}
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

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              <CreditCardView card={selectedCard} />

              {/* Reveal Full Card Number Button */}
              <TouchableOpacity
                style={[
                  styles.revealActionBox,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
                onPress={() => handleRevealFullNumberInDetail(selectedCard)}
              >
                <Text style={{ fontSize: 18, marginRight: 10 }}>
                  {revealedNumberInDetail ? '🔒' : '👁️'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.revealActionTitle, { color: colors.textPrimary }]}>
                    {revealedNumberInDetail
                      ? revealedNumberInDetail
                      : `•••• •••• •••• ${selectedCard.last_four_digits}`}
                  </Text>
                  <Text style={[styles.revealActionSub, { color: colors.textSecondary }]}>
                    {revealedNumberInDetail
                      ? 'Decrypted Full Card Number (Tap to hide)'
                      : 'Tap to authenticate & reveal full 16-digit card number'}
                  </Text>
                </View>
              </TouchableOpacity>

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
              <View style={{ marginTop: 22, marginBottom: 40 }}>
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
    marginBottom: 10,
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
  bankSelectorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  bankSelectorTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  bankSelectorSub: {
    fontSize: 11,
    marginTop: 2,
  },
  cardNumberLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detectedNetworkPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  detectedNetworkText: {
    fontSize: 12,
    fontWeight: '700',
  },
  helperSecurityText: {
    fontSize: 11,
    marginTop: 4,
    marginBottom: 12,
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
  advancedToggleBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginVertical: 6,
  },
  advancedToggleText: {
    fontSize: 13,
    fontWeight: '700',
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
  customBankBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 8,
  },
  bankListScroll: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  bankRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  bankIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankRowName: {
    fontSize: 14,
    fontWeight: '700',
  },
  bankRowFullName: {
    fontSize: 11,
    marginTop: 2,
  },
  revealActionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
  },
  revealActionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  revealActionSub: {
    fontSize: 11,
    marginTop: 2,
  },
});
