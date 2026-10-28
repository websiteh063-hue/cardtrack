// src/screens/DashboardScreen.tsx - Main Financial Dashboard

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { formatINR } from '../services/calculations';
import { MilestoneCard } from '../components/MilestoneCard';
import { TransactionRow } from '../components/TransactionRow';

interface DashboardScreenProps {
  onNavigate: (tab: string) => void;
  onOpenGlobalSearch: () => void;
  onQuickAction: (action: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onNavigate,
  onOpenGlobalSearch,
  onQuickAction,
}) => {
  const { colors } = useTheme();
  const { stats, milestoneProgressList, transactions, cards, people, refreshData, isLoading } = useApp();

  const cardMap = new Map(cards.map(c => [c.id, c.card_nickname]));
  const personMap = new Map(people.map(p => [p.id, p.full_name]));

  // Upcoming milestones (sorted by deadline)
  const upcomingMilestones = milestoneProgressList
    .filter(mp => !mp.isCompleted && mp.daysRemaining !== null && mp.daysRemaining >= 0)
    .sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999))
    .slice(0, 3);

  // Recent transactions
  const recentTransactions = transactions.slice(0, 5);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refreshData} tintColor={colors.primary} />
      }
    >
      {/* Search Header Bar */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onOpenGlobalSearch}
        style={[
          styles.searchBar,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={{ fontSize: 16 }}>🔍</Text>
        <Text style={[styles.searchPlaceholder, { color: colors.textMuted }]}>
          Search people, cards, banks, last 4 digits...
        </Text>
      </TouchableOpacity>

      {/* Main Spend Overview Banner */}
      <View
        style={[
          styles.mainBanner,
          {
            backgroundColor: colors.cardGradient1,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={styles.bannerSubtitle}>NET RECORDED SPENDING</Text>
        <Text style={styles.bannerAmount}>
          {formatINR(stats.totalSpendingAmount)}
        </Text>

        <View style={styles.bannerStatsRow}>
          <View style={styles.bannerStatCol}>
            <Text style={styles.bannerStatLabel}>TOTAL PURCHASES</Text>
            <Text style={styles.bannerStatVal}>
              {formatINR(stats.totalPurchasesAmount)}
            </Text>
          </View>
          <View style={styles.bannerDivider} />
          <View style={styles.bannerStatCol}>
            <Text style={styles.bannerStatLabel}>CARDS MANAGED</Text>
            <Text style={styles.bannerStatVal}>{stats.totalCards}</Text>
          </View>
          <View style={styles.bannerDivider} />
          <View style={styles.bannerStatCol}>
            <Text style={styles.bannerStatLabel}>PEOPLE</Text>
            <Text style={styles.bannerStatVal}>{stats.totalPeople}</Text>
          </View>
        </View>
      </View>

      {/* Quick Action Buttons */}
      <View style={styles.quickActionsContainer}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Quick Actions</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsScroll}>
          <TouchableOpacity
            style={[styles.actionChip, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
            onPress={() => onQuickAction('add_transaction')}
          >
            <Text style={styles.actionIcon}>➕</Text>
            <Text style={[styles.actionText, { color: colors.textPrimary }]}>Transaction</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionChip, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
            onPress={() => onQuickAction('add_card')}
          >
            <Text style={styles.actionIcon}>💳</Text>
            <Text style={[styles.actionText, { color: colors.textPrimary }]}>Card</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionChip, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
            onPress={() => onQuickAction('add_milestone')}
          >
            <Text style={styles.actionIcon}>🎯</Text>
            <Text style={[styles.actionText, { color: colors.textPrimary }]}>Milestone</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionChip, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
            onPress={() => onQuickAction('add_person')}
          >
            <Text style={styles.actionIcon}>👤</Text>
            <Text style={[styles.actionText, { color: colors.textPrimary }]}>Person</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionChip, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
            onPress={() => onNavigate('settings')}
          >
            <Text style={styles.actionIcon}>📊</Text>
            <Text style={[styles.actionText, { color: colors.textPrimary }]}>Excel & Backup</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Milestone Summary Cards */}
      <View style={styles.milestoneMetricsRow}>
        <View style={[styles.metricBox, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
          <Text style={[styles.metricBoxNum, { color: colors.primaryLight }]}>
            {stats.activeMilestonesCount}
          </Text>
          <Text style={[styles.metricBoxLabel, { color: colors.textSecondary }]}>Active Goals</Text>
        </View>

        <View style={[styles.metricBox, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
          <Text style={[styles.metricBoxNum, { color: colors.success }]}>
            {stats.completedMilestonesCount}
          </Text>
          <Text style={[styles.metricBoxLabel, { color: colors.textSecondary }]}>Completed</Text>
        </View>

        <View style={[styles.metricBox, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
          <Text style={[styles.metricBoxNum, { color: colors.warning }]}>
            {stats.pendingMilestonesCount}
          </Text>
          <Text style={[styles.metricBoxLabel, { color: colors.textSecondary }]}>Pending / Exp</Text>
        </View>
      </View>

      {/* Upcoming Milestones */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          Approaching Milestones
        </Text>
        <TouchableOpacity onPress={() => onNavigate('milestones')}>
          <Text style={[styles.seeAllText, { color: colors.primaryLight }]}>View All →</Text>
        </TouchableOpacity>
      </View>

      {upcomingMilestones.length > 0 ? (
        upcomingMilestones.map(mp => (
          <MilestoneCard
            key={mp.milestone.id}
            progress={mp}
            onPress={() => onNavigate('milestones')}
          />
        ))
      ) : (
        <View style={[styles.emptyBox, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={{ fontSize: 28, marginBottom: 6 }}>🎯</Text>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            No active milestones approaching deadline
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Add a spending milestone to track bonus points and fee waivers.
          </Text>
        </View>
      )}

      {/* Recent Transactions */}
      <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          Recent Activity
        </Text>
        <TouchableOpacity onPress={() => onNavigate('transactions')}>
          <Text style={[styles.seeAllText, { color: colors.primaryLight }]}>View All →</Text>
        </TouchableOpacity>
      </View>

      {recentTransactions.length > 0 ? (
        recentTransactions.map(tx => (
          <TransactionRow
            key={tx.id}
            transaction={tx}
            cardNickname={cardMap.get(tx.card_id)}
            personName={personMap.get(tx.person_id)}
            onPress={() => onNavigate('transactions')}
          />
        ))
      ) : (
        <View style={[styles.emptyBox, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={{ fontSize: 28, marginBottom: 6 }}>🧾</Text>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            No transactions recorded yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Tap "Transaction" above to enter your first purchase.
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 18,
    paddingBottom: 40,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    gap: 10,
  },
  searchPlaceholder: {
    fontSize: 14,
    fontWeight: '500',
  },
  mainBanner: {
    borderRadius: 20,
    padding: 22,
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  bannerSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  bannerAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
    marginBottom: 18,
  },
  bannerStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 14,
  },
  bannerStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  bannerDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  bannerStatLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  bannerStatVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  quickActionsContainer: {
    marginBottom: 20,
  },
  actionsScroll: {
    paddingVertical: 4,
    gap: 10,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  actionIcon: {
    fontSize: 14,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  milestoneMetricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },
  metricBox: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
  },
  metricBoxNum: {
    fontSize: 22,
    fontWeight: '800',
  },
  metricBoxLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyBox: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
