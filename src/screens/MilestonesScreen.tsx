// src/screens/MilestonesScreen.tsx - Milestone Tracking & Calculations

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
import { Milestone, MilestoneType, MilestoneStatus, MilestoneProgress } from '../types';
import { createMilestone, updateMilestone, deleteMilestone } from '../db/milestonesRepo';
import { rupeesToPaise, paiseToRupees, formatINR } from '../services/calculations';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { MilestoneCard } from '../components/MilestoneCard';

interface MilestonesScreenProps {
  initialCardId?: string;
}

export const MilestonesScreen: React.FC<MilestonesScreenProps> = ({
  initialCardId,
}) => {
  const { colors } = useTheme();
  const { db, milestoneProgressList, cards, people, refreshData } = useApp();

  const [filterCardId, setFilterCardId] = useState<string>(initialCardId || 'all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Form Modal
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);

  // Form Fields
  const [cardId, setCardId] = useState('');
  const [milestoneName, setMilestoneName] = useState('');
  const [description, setDescription] = useState('');
  const [milestoneType, setMilestoneType] = useState<MilestoneType>('Spending');
  const [targetAmountRupees, setTargetAmountRupees] = useState('100000');
  const [targetCount, setTargetCount] = useState('10');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rewardDescription, setRewardDescription] = useState('');
  const [notes, setNotes] = useState('');

  // Delete Modal
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [milestoneToDelete, setMilestoneToDelete] = useState<Milestone | null>(null);

  const cardMap = new Map(cards.map(c => [c.id, c]));

  const handleOpenAdd = () => {
    if (cards.length === 0) {
      Alert.alert('Credit Card Required', 'Please create a credit card before setting up milestones.');
      return;
    }

    const defaultCard = initialCardId ? cardMap.get(initialCardId) : cards[0];
    const targetCard = defaultCard || cards[0];

    const today = new Date();
    const currentYear = today.getFullYear();
    const qEnd = new Date(currentYear, today.getMonth() + 3, 0).toISOString().split('T')[0];

    setEditingMilestone(null);
    setCardId(targetCard.id);
    setMilestoneName('Q4 Spend Milestone');
    setDescription('Spend ₹1 Lakh to unlock fee waiver or bonus reward points');
    setMilestoneType('Spending');
    setTargetAmountRupees('100000');
    setTargetCount('10');
    setStartDate(today.toISOString().split('T')[0]);
    setEndDate(qEnd);
    setRewardDescription('10,000 Bonus Points / ₹2,500 Gift Voucher');
    setNotes('');
    setFormModalVisible(true);
  };

  const handleOpenEdit = (m: Milestone) => {
    setEditingMilestone(m);
    setCardId(m.card_id);
    setMilestoneName(m.milestone_name);
    setDescription(m.description || '');
    setMilestoneType(m.milestone_type);
    setTargetAmountRupees(String(paiseToRupees(m.target_amount)));
    setTargetCount(String(m.target_transaction_count));
    setStartDate(m.start_date || '');
    setEndDate(m.end_date || '');
    setRewardDescription(m.reward_description || '');
    setNotes(m.notes || '');
    setFormModalVisible(true);
  };

  const handleSaveMilestone = async () => {
    if (!db) return;
    if (!cardId) {
      Alert.alert('Validation Error', 'Please select a Credit Card.');
      return;
    }
    if (!milestoneName.trim()) {
      Alert.alert('Validation Error', 'Milestone Name is required.');
      return;
    }

    const targetCard = cardMap.get(cardId);
    const personId = targetCard ? targetCard.person_id : '';

    try {
      if (editingMilestone) {
        await updateMilestone(db, {
          id: editingMilestone.id,
          card_id: cardId,
          person_id: personId,
          milestone_name: milestoneName.trim(),
          description: description.trim() || null,
          milestone_type: milestoneType,
          target_amount: milestoneType === 'Spending' ? rupeesToPaise(targetAmountRupees) : 0,
          target_transaction_count: milestoneType === 'TransactionCount' ? Number(targetCount) : 0,
          start_date: startDate.trim() || null,
          end_date: endDate.trim() || null,
          reward_description: rewardDescription.trim() || null,
          notes: notes.trim() || null,
        });
      } else {
        await createMilestone(db, {
          id: `milestone_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          card_id: cardId,
          person_id: personId,
          milestone_name: milestoneName.trim(),
          description: description.trim() || null,
          milestone_type: milestoneType,
          target_amount: milestoneType === 'Spending' ? rupeesToPaise(targetAmountRupees) : 0,
          target_transaction_count: milestoneType === 'TransactionCount' ? Number(targetCount) : 0,
          start_date: startDate.trim() || null,
          end_date: endDate.trim() || null,
          reward_description: rewardDescription.trim() || null,
          status: 'In Progress',
          notes: notes.trim() || null,
        });
      }

      await refreshData();
      setFormModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save milestone.');
    }
  };

  const handlePromptDelete = (m: Milestone) => {
    setMilestoneToDelete(m);
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!db || !milestoneToDelete) return;
    try {
      await deleteMilestone(db, milestoneToDelete.id);
      await refreshData();
      setDeleteModalVisible(false);
      setMilestoneToDelete(null);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to delete milestone.');
    }
  };

  // Filter progress items
  const filteredMilestones = milestoneProgressList.filter(mp => {
    if (filterCardId !== 'all' && mp.milestone.card_id !== filterCardId) return false;
    if (filterStatus === 'in_progress' && (mp.isCompleted || mp.isExpired)) return false;
    if (filterStatus === 'completed' && !mp.isCompleted) return false;
    if (filterStatus === 'expired' && !mp.isExpired) return false;
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Action Bar */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>
            Spending Milestones
          </Text>
          <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
            Track bonus tiers, fee waivers, and rewards
          </Text>
        </View>
        <Button
          title="+ Add Milestone"
          variant="primary"
          size="md"
          onPress={handleOpenAdd}
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

      {/* Filter Row 2: Status */}
      <View style={styles.filterRowSmall}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {[
            { id: 'all', label: 'All Status' },
            { id: 'in_progress', label: '⏳ In Progress' },
            { id: 'completed', label: '✓ Completed' },
            { id: 'expired', label: '⚠️ Expired' },
          ].map(st => (
            <TouchableOpacity
              key={st.id}
              style={[
                styles.statusChip,
                { backgroundColor: filterStatus === st.id ? colors.primaryLight : colors.surfaceCard }
              ]}
              onPress={() => setFilterStatus(st.id)}
            >
              <Text style={[styles.statusChipText, { color: filterStatus === st.id ? '#FFF' : colors.textMuted }]}>
                {st.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Milestones List */}
      <ScrollView contentContainerStyle={styles.listContent}>
        {filteredMilestones.length > 0 ? (
          filteredMilestones.map(mp => (
            <View key={mp.milestone.id} style={styles.milestoneWrapper}>
              <MilestoneCard
                progress={mp}
                onPress={() => handleOpenEdit(mp.milestone)}
              />
              <View style={styles.actionRowBottom}>
                <TouchableOpacity
                  onPress={() => handleOpenEdit(mp.milestone)}
                  style={[styles.smallBtn, { backgroundColor: colors.surfaceElevated }]}
                >
                  <Text style={{ fontSize: 12 }}>✏️ Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handlePromptDelete(mp.milestone)}
                  style={[styles.smallBtn, { backgroundColor: colors.dangerBg }]}
                >
                  <Text style={{ fontSize: 12, color: colors.danger }}>🗑️ Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={[styles.emptyContainer, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🎯</Text>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              No milestones found
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Add spending milestones (e.g. Spend ₹1 Lakh in 90 days for Taj voucher) to track progress automatically.
            </Text>
            <Button
              title="Add Milestone"
              variant="primary"
              size="md"
              onPress={handleOpenAdd}
              style={{ marginTop: 14 }}
            />
          </View>
        )}
      </ScrollView>

      {/* Add / Edit Milestone Modal */}
      <Modal
        visible={formModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFormModalVisible(false)}
      >
        <View style={[styles.modalWrapper, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {editingMilestone ? 'Edit Milestone' : 'New Spending Milestone'}
            </Text>
            <TouchableOpacity onPress={() => setFormModalVisible(false)}>
              <Text style={[styles.closeText, { color: colors.primaryLight }]}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll}>
            {/* Target Card */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Target Credit Card *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
              {cards.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.pickerChip,
                    { backgroundColor: cardId === c.id ? colors.primary : colors.surfaceElevated }
                  ]}
                  onPress={() => setCardId(c.id)}
                >
                  <Text style={[styles.pickerChipText, { color: cardId === c.id ? '#FFF' : colors.textPrimary }]}>
                    {c.card_nickname} ({c.bank_name})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Input
              label="Milestone Name"
              placeholder="e.g. Q1 Spend Milestone ₹1 Lakh"
              value={milestoneName}
              onChangeText={setMilestoneName}
              required
            />

            {/* Milestone Type */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Milestone Type</Text>
            <View style={styles.chipsRow}>
              {(['Spending', 'TransactionCount', 'Custom'] as MilestoneType[]).map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.networkChip,
                    { backgroundColor: milestoneType === type ? colors.primary : colors.surfaceElevated }
                  ]}
                  onPress={() => setMilestoneType(type)}
                >
                  <Text style={[styles.networkChipText, { color: milestoneType === type ? '#FFF' : colors.textPrimary }]}>
                    {type === 'Spending' ? 'Spend Target (₹)' : type === 'TransactionCount' ? 'Transaction Count' : 'Custom'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {milestoneType === 'Spending' && (
              <Input
                label="Target Spending Amount (₹)"
                placeholder="e.g. 100000"
                keyboardType="decimal-pad"
                value={targetAmountRupees}
                onChangeText={setTargetAmountRupees}
                required
              />
            )}

            {milestoneType === 'TransactionCount' && (
              <Input
                label="Target Number of Transactions"
                placeholder="e.g. 10"
                keyboardType="number-pad"
                value={targetCount}
                onChangeText={setTargetCount}
                required
              />
            )}

            <View style={styles.rowTwoInputs}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Start Date (Optional)"
                  placeholder="YYYY-MM-DD"
                  maxLength={10}
                  value={startDate}
                  onChangeText={setStartDate}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Deadline / End Date"
                  placeholder="YYYY-MM-DD"
                  maxLength={10}
                  value={endDate}
                  onChangeText={setEndDate}
                />
              </View>
            </View>

            <Input
              label="Reward Description (Optional)"
              placeholder="e.g. 10,000 Bonus Points, Lounge Pass, or Fee Waiver"
              value={rewardDescription}
              onChangeText={setRewardDescription}
            />

            <Input
              label="Description / Terms"
              placeholder="e.g. Excludes wallet loads and fuel transactions"
              multiline
              numberOfLines={2}
              value={description}
              onChangeText={setDescription}
            />

            <Button
              title={editingMilestone ? 'Update Milestone' : 'Create Milestone'}
              variant="primary"
              size="lg"
              onPress={handleSaveMilestone}
              style={{ marginTop: 12, marginBottom: 40 }}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmationModal
        visible={deleteModalVisible}
        title="Delete Milestone?"
        message="Are you sure you want to delete this spending milestone? This action cannot be undone."
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  screenSubtitle: {
    fontSize: 12,
    marginTop: 2,
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
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  milestoneWrapper: {
    marginBottom: 14,
  },
  actionRowBottom: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: -8,
    paddingHorizontal: 4,
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
  rowTwoInputs: {
    flexDirection: 'row',
    gap: 12,
  },
});
