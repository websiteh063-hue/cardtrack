// src/screens/PeopleScreen.tsx - Comprehensive People Profile Management

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
import { Person, CreditCard, Transaction, MilestoneProgress } from '../types';
import { createPerson, updatePerson, deletePerson, getPersonCascadeImpact } from '../db/peopleRepo';
import { formatINR } from '../services/calculations';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { CreditCardView } from '../components/CreditCardView';
import { MilestoneCard } from '../components/MilestoneCard';
import { TransactionRow } from '../components/TransactionRow';

interface PeopleScreenProps {
  onNavigateToCard: (cardId: string) => void;
  onNavigateToTransactions: (personId: string) => void;
}

export const PeopleScreen: React.FC<PeopleScreenProps> = ({
  onNavigateToCard,
  onNavigateToTransactions,
}) => {
  const { colors } = useTheme();
  const { db, people, cards, transactions, milestoneProgressList, refreshData } = useApp();

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  // Detail Modal
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // Delete Confirmation Modal
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [personToDelete, setPersonToDelete] = useState<Person | null>(null);
  const [cascadeImpact, setCascadeImpact] = useState<{ cardsCount: number; transactionsCount: number; milestonesCount: number }>({
    cardsCount: 0,
    transactionsCount: 0,
    milestonesCount: 0,
  });

  // Priority BackHandler for open modals in PeopleScreen
  useEffect(() => {
    const isAnyModalOpen = formModalVisible || detailModalVisible || deleteModalVisible;
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
      if (detailModalVisible) {
        setDetailModalVisible(false);
        return true;
      }
      return false;
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSub.remove();
  }, [formModalVisible, detailModalVisible, deleteModalVisible]);

  const handleOpenAdd = () => {
    setEditingPerson(null);
    setFullName('');
    setPhone('');
    setEmail('');
    setNotes('');
    setFormModalVisible(true);
  };

  const handleOpenEdit = (person: Person) => {
    setEditingPerson(person);
    setFullName(person.full_name);
    setPhone(person.phone || '');
    setEmail(person.email || '');
    setNotes(person.notes || '');
    setFormModalVisible(true);
  };

  const handleSavePerson = async () => {
    if (!db) return;
    if (!fullName.trim()) {
      Alert.alert('Validation Error', 'Full Name is required.');
      return;
    }

    try {
      if (editingPerson) {
        await updatePerson(db, {
          id: editingPerson.id,
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          notes: notes.trim() || null,
        });
      } else {
        await createPerson(db, {
          id: `person_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          notes: notes.trim() || null,
        });
      }

      await refreshData();
      setFormModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save person.');
    }
  };

  const handlePromptDelete = async (person: Person) => {
    if (!db) return;
    const impact = await getPersonCascadeImpact(db, person.id);
    setCascadeImpact(impact);
    setPersonToDelete(person);
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!db || !personToDelete) return;
    try {
      await deletePerson(db, personToDelete.id);
      await refreshData();
      setDeleteModalVisible(false);
      setDetailModalVisible(false);
      setPersonToDelete(null);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to delete person.');
    }
  };

  const handleOpenDetails = (person: Person) => {
    setSelectedPerson(person);
    setDetailModalVisible(true);
  };

  // Filter people
  const filteredPeople = people.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.full_name.toLowerCase().includes(q) ||
      (p.phone && p.phone.toLowerCase().includes(q)) ||
      (p.email && p.email.toLowerCase().includes(q))
    );
  });

  // Calculate detailed data for detail view
  const personCards = selectedPerson ? cards.filter(c => c.person_id === selectedPerson.id) : [];
  const personCardIds = new Set(personCards.map(c => c.id));
  const personTransactions = selectedPerson
    ? transactions.filter(t => t.person_id === selectedPerson.id || personCardIds.has(t.card_id))
    : [];
  const personMilestones = selectedPerson
    ? milestoneProgressList.filter(mp => mp.milestone.person_id === selectedPerson.id || personCardIds.has(mp.milestone.card_id))
    : [];

  let totalSpending = 0;
  for (const t of personTransactions) {
    if (t.transaction_type === 'Purchase') totalSpending += t.amount;
    else if (t.transaction_type === 'Refund' || t.transaction_type === 'Reversal') totalSpending -= t.amount;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Action Bar */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Input
            label=""
            placeholder="Search profiles by name, phone, email..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>
        <Button
          title="Add Person"
          variant="primary"
          size="md"
          onPress={handleOpenAdd}
          style={{ marginLeft: 10, height: 48 }}
        />
      </View>

      {/* People Profiles List */}
      <ScrollView contentContainerStyle={styles.listContent}>
        {filteredPeople.length > 0 ? (
          filteredPeople.map(p => {
            const pCards = cards.filter(c => c.person_id === p.id);
            const pCardIds = new Set(pCards.map(c => c.id));
            const pTx = transactions.filter(t => t.person_id === p.id || pCardIds.has(t.card_id));
            let pSpend = 0;
            pTx.forEach(t => {
              if (t.transaction_type === 'Purchase') pSpend += t.amount;
              else if (t.transaction_type === 'Refund' || t.transaction_type === 'Reversal') pSpend -= t.amount;
            });

            return (
              <TouchableOpacity
                key={p.id}
                activeOpacity={0.8}
                onPress={() => handleOpenDetails(p)}
                style={[
                  styles.personCard,
                  {
                    backgroundColor: colors.surfaceCard,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.personName, { color: colors.textPrimary }]}>
                      {p.full_name}
                    </Text>
                    {p.phone ? (
                      <Text style={[styles.contactText, { color: colors.textSecondary }]}>
                        📞 {p.phone}
                      </Text>
                    ) : null}
                    {p.email ? (
                      <Text style={[styles.contactText, { color: colors.textSecondary }]}>
                        ✉️ {p.email}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.actionsGroup}>
                    <TouchableOpacity
                      onPress={() => handleOpenEdit(p)}
                      style={[styles.smallIconBtn, { backgroundColor: colors.surfaceElevated }]}
                    >
                      <Text style={{ fontSize: 13 }}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handlePromptDelete(p)}
                      style={[styles.smallIconBtn, { backgroundColor: colors.dangerBg }]}
                    >
                      <Text style={{ fontSize: 13 }}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {p.notes ? (
                  <Text style={[styles.notesText, { color: colors.textMuted }]} numberOfLines={2}>
                    {p.notes}
                  </Text>
                ) : null}

                {/* Footer statistics */}
                <View style={[styles.statsFooter, { borderTopColor: colors.borderLight }]}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>CARDS</Text>
                    <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                      {pCards.length}
                    </Text>
                  </View>

                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>TRANSACTIONS</Text>
                    <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                      {pTx.length}
                    </Text>
                  </View>

                  <View style={styles.statItemRight}>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>NET SPENDING</Text>
                    <Text style={[styles.statValueHighlight, { color: colors.primaryLight }]}>
                      {formatINR(pSpend)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={[styles.emptyContainer, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>👥</Text>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {searchQuery ? 'No matching profiles found' : 'No profiles created yet'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Add individuals to manage multiple credit cards and personal spending milestones.
            </Text>
            <Button
              title="Add New Person"
              variant="primary"
              size="md"
              onPress={handleOpenAdd}
              style={{ marginTop: 14 }}
            />
          </View>
        )}
      </ScrollView>

      {/* Add / Edit Person Form Modal */}
      <Modal
        visible={formModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFormModalVisible(false)}
      >
        <View style={[styles.modalWrapper, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {editingPerson ? 'Edit Profile' : 'Add New Person'}
            </Text>
            <TouchableOpacity onPress={() => setFormModalVisible(false)}>
              <Text style={[styles.closeText, { color: colors.primaryLight }]}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll}>
            <Input
              label="Full Name"
              placeholder="e.g. Johnathan Doe"
              value={fullName}
              onChangeText={setFullName}
              required
            />
            <Input
              label="Phone Number (Optional)"
              placeholder="e.g. +91 9876543210"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            <Input
              label="Email Address (Optional)"
              placeholder="e.g. john@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <Input
              label="Notes (Optional)"
              placeholder="e.g. Primary family account holder"
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
            />

            <Button
              title={editingPerson ? 'Save Changes' : 'Create Profile'}
              variant="primary"
              size="lg"
              onPress={handleSavePerson}
              style={{ marginTop: 12, marginBottom: 30 }}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Detailed Person Overview Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        {selectedPerson && (
          <View style={[styles.modalWrapper, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  {selectedPerson.full_name}
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  Personal Profile & Credit Portfolio
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <Text style={[styles.closeText, { color: colors.primaryLight }]}>Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll}>
              {/* Financial Snapshot Card */}
              <View style={[styles.personSnapshot, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
                <View style={styles.snapshotRow}>
                  <View>
                    <Text style={[styles.snapshotLabel, { color: colors.textMuted }]}>NET SPENDING</Text>
                    <Text style={[styles.snapshotVal, { color: colors.primaryLight }]}>
                      {formatINR(totalSpending)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.snapshotLabel, { color: colors.textMuted }]}>PORTFOLIO CARDS</Text>
                    <Text style={[styles.snapshotVal, { color: colors.textPrimary }]}>
                      {personCards.length}
                    </Text>
                  </View>
                </View>

                {selectedPerson.phone ? (
                  <Text style={[styles.snapshotSub, { color: colors.textSecondary }]}>
                    📞 {selectedPerson.phone}
                  </Text>
                ) : null}
                {selectedPerson.email ? (
                  <Text style={[styles.snapshotSub, { color: colors.textSecondary }]}>
                    ✉️ {selectedPerson.email}
                  </Text>
                ) : null}
              </View>

              {/* Associated Credit Cards Section */}
              <View style={styles.detailSection}>
                <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
                  Credit Cards ({personCards.length})
                </Text>
                {personCards.length > 0 ? (
                  personCards.map(c => (
                    <CreditCardView
                      key={c.id}
                      card={c}
                      onPress={() => {
                        setDetailModalVisible(false);
                        onNavigateToCard(c.id);
                      }}
                    />
                  ))
                ) : (
                  <Text style={[styles.emptySubText, { color: colors.textMuted }]}>
                    No credit cards linked to this person yet.
                  </Text>
                )}
              </View>

              {/* Milestones Section */}
              <View style={styles.detailSection}>
                <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
                  Milestones ({personMilestones.length})
                </Text>
                {personMilestones.length > 0 ? (
                  personMilestones.map(mp => (
                    <MilestoneCard key={mp.milestone.id} progress={mp} />
                  ))
                ) : (
                  <Text style={[styles.emptySubText, { color: colors.textMuted }]}>
                    No active or completed milestones for this profile.
                  </Text>
                )}
              </View>

              {/* Recent Transactions Section */}
              <View style={styles.detailSection}>
                <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
                  Recent Transactions ({personTransactions.length})
                </Text>
                {personTransactions.slice(0, 5).map(tx => (
                  <TransactionRow key={tx.id} transaction={tx} />
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Explicit Cascade Impact Confirmation Modal */}
      <ConfirmationModal
        visible={deleteModalVisible}
        title={`Delete Profile: ${personToDelete?.full_name || ''}?`}
        message="Deleting this profile will permanently delete all associated credit cards, recorded transactions, and reward milestones."
        cascadeDetails={cascadeImpact}
        confirmLabel="Permanently Delete Profile"
        cancelLabel="Keep Profile"
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
    paddingBottom: 8,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  personCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  personName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  contactText: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  actionsGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  smallIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesText: {
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  statsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
  },
  statItem: {
    alignItems: 'flex-start',
  },
  statItemRight: {
    alignItems: 'flex-end',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  statValueHighlight: {
    fontSize: 14,
    fontWeight: '800',
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
  personSnapshot: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
  },
  snapshotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  snapshotLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  snapshotVal: {
    fontSize: 22,
    fontWeight: '800',
  },
  snapshotSub: {
    fontSize: 13,
    marginTop: 4,
  },
  detailSection: {
    marginBottom: 24,
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
