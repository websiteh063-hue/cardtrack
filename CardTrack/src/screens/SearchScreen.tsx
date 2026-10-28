// src/screens/SearchScreen.tsx - Global Offline Search & Financial Dossier

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  BackHandler,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { Person, CreditCard } from '../types';
import { executeGlobalSearch, getPersonDetailedOverview, PersonDetailedOverview } from '../services/search';
import { formatINR } from '../services/calculations';
import { Input } from '../components/common/Input';
import { CreditCardView } from '../components/CreditCardView';
import { MilestoneCard } from '../components/MilestoneCard';
import { TransactionRow } from '../components/TransactionRow';

interface SearchScreenProps {
  onClose: () => void;
  onNavigateToCard: (cardId: string) => void;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  onClose,
  onNavigateToCard,
}) => {
  const { colors } = useTheme();
  const { db } = useApp();

  const [query, setQuery] = useState('');
  const [matchedPeople, setMatchedPeople] = useState<Person[]>([]);
  const [matchedCards, setMatchedCards] = useState<(CreditCard & { personName: string })[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Selected Person Dossier
  const [dossier, setDossier] = useState<PersonDetailedOverview | null>(null);

  // BackHandler for SearchScreen
  useEffect(() => {
    const onBackPress = () => {
      if (dossier) {
        setDossier(null);
        return true;
      }
      onClose();
      return true;
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSub.remove();
  }, [dossier, onClose]);
  const [dossierModalVisible, setDossierModalVisible] = useState(false);

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (!db || !text.trim()) {
      setMatchedPeople([]);
      setMatchedCards([]);
      setHasSearched(false);
      return;
    }

    setHasSearched(true);
    const result = await executeGlobalSearch(db, text);
    setMatchedPeople(result.matchedPeople);
    setMatchedCards(result.matchedCards);
  };

  const handleOpenPersonDossier = async (personId: string) => {
    if (!db) return;
    const overview = await getPersonDetailedOverview(db, personId);
    if (overview) {
      setDossier(overview);
      setDossierModalVisible(true);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Input
            label=""
            placeholder="Search person, nickname, bank, last 4..."
            value={query}
            onChangeText={handleSearch}
            autoFocus
            containerStyle={{ marginBottom: 0 }}
          />
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={[styles.closeBtnText, { color: colors.primaryLight }]}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {hasSearched ? (
          <>
            {/* Matched People Section */}
            {matchedPeople.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  People Profiles ({matchedPeople.length})
                </Text>
                {matchedPeople.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => handleOpenPersonDossier(p.id)}
                    style={[styles.resultCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
                  >
                    <View style={styles.resultRow}>
                      <View>
                        <Text style={[styles.resultTitle, { color: colors.textPrimary }]}>
                          {p.full_name}
                        </Text>
                        <Text style={[styles.resultSub, { color: colors.textSecondary }]}>
                          {p.phone ? `📞 ${p.phone} ` : ''}
                          {p.email ? `✉️ ${p.email}` : ''}
                        </Text>
                      </View>
                      <Text style={[styles.viewDossierText, { color: colors.primaryLight }]}>
                        View Overview →
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Matched Cards Section */}
            {matchedCards.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Credit Cards ({matchedCards.length})
                </Text>
                {matchedCards.map(c => (
                  <View key={c.id} style={{ marginBottom: 14 }}>
                    <CreditCardView
                      card={c}
                      onPress={() => {
                        onClose();
                        onNavigateToCard(c.id);
                      }}
                    />
                    <Text style={[styles.cardSubText, { color: colors.textSecondary }]}>
                      Belongs to: {c.personName}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {matchedPeople.length === 0 && matchedCards.length === 0 && (
              <View style={[styles.emptyBox, { backgroundColor: colors.surfaceElevated }]}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🔍</Text>
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  No results found for "{query}"
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Try searching by full or partial name, bank name (e.g. HDFC, SBI), card nickname, or last 4 digits.
                </Text>
              </View>
            )}
          </>
        ) : (
          <View style={[styles.initialBox, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>⚡</Text>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              Global Offline Financial Search
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Instantly find profiles, cards by issuer or last 4 digits, transactions, and milestone goals.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Comprehensive Person Overview Modal */}
      <Modal
        visible={dossierModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDossierModalVisible(false)}
      >
        {dossier && (
          <View style={[styles.dossierContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.dossierHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.dossierTitle, { color: colors.textPrimary }]}>
                  {dossier.person.full_name}
                </Text>
                <Text style={[styles.dossierSubtitle, { color: colors.textSecondary }]}>
                  Comprehensive Financial Dossier
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDossierModalVisible(false)}>
                <Text style={[styles.closeBtnText, { color: colors.primaryLight }]}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.dossierContent}>
              {/* Profile Details */}
              <View style={[styles.dossierBox, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
                <Text style={[styles.boxTitle, { color: colors.textPrimary }]}>Profile Details</Text>
                <Text style={[styles.boxItem, { color: colors.textSecondary }]}>
                  • Phone: {dossier.person.phone || 'Not provided'}
                </Text>
                <Text style={[styles.boxItem, { color: colors.textSecondary }]}>
                  • Email: {dossier.person.email || 'Not provided'}
                </Text>
                <Text style={[styles.boxItem, { color: colors.textSecondary }]}>
                  • Member Since: {dossier.person.created_at ? dossier.person.created_at.split('T')[0] : 'N/A'}
                </Text>
                {dossier.person.notes ? (
                  <Text style={[styles.boxItem, { color: colors.textMuted }]}>
                    • Notes: {dossier.person.notes}
                  </Text>
                ) : null}
              </View>

              {/* Financial Metrics */}
              <View style={[styles.metricsGrid, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
                <View style={styles.gridCol}>
                  <Text style={[styles.gridLabel, { color: colors.textMuted }]}>TOTAL PURCHASES</Text>
                  <Text style={[styles.gridVal, { color: colors.textPrimary }]}>
                    {formatINR(dossier.totalRecordedPurchases)}
                  </Text>
                </View>

                <View style={styles.gridCol}>
                  <Text style={[styles.gridLabel, { color: colors.textMuted }]}>QUALIFYING SPEND</Text>
                  <Text style={[styles.gridVal, { color: colors.success }]}>
                    {formatINR(dossier.totalQualifyingSpending)}
                  </Text>
                </View>

                <View style={styles.gridCol}>
                  <Text style={[styles.gridLabel, { color: colors.textMuted }]}>REMAINING MILESTONES</Text>
                  <Text style={[styles.gridVal, { color: colors.warning }]}>
                    {formatINR(dossier.remainingMilestoneRequirements)}
                  </Text>
                </View>

                <View style={styles.gridCol}>
                  <Text style={[styles.gridLabel, { color: colors.textMuted }]}>MILESTONE GOALS</Text>
                  <Text style={[styles.gridVal, { color: colors.textPrimary }]}>
                    {dossier.completedMilestonesCount} Done / {dossier.pendingMilestonesCount} Pending
                  </Text>
                </View>
              </View>

              {/* Associated Cards */}
              <View style={styles.dossierSection}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Associated Credit Cards ({dossier.totalCardsCount})
                </Text>
                {dossier.cards.map(c => (
                  <CreditCardView
                    key={c.id}
                    card={c}
                    onPress={() => {
                      setDossierModalVisible(false);
                      onClose();
                      onNavigateToCard(c.id);
                    }}
                  />
                ))}
              </View>

              {/* Milestones */}
              <View style={styles.dossierSection}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Milestone Progress ({dossier.totalMilestonesCount})
                </Text>
                {dossier.milestones.map(mp => (
                  <MilestoneCard key={mp.milestone.id} progress={mp} />
                ))}
              </View>

              {/* Recent Transactions */}
              <View style={styles.dossierSection}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Recent Transactions ({dossier.recentTransactions.length})
                </Text>
                {dossier.recentTransactions.map(tx => (
                  <TransactionRow
                    key={tx.id}
                    transaction={tx}
                    cardNickname={tx.cardNickname}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  closeBtn: {
    paddingLeft: 12,
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  resultCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  resultSub: {
    fontSize: 12,
    fontWeight: '500',
  },
  viewDossierText: {
    fontSize: 13,
    fontWeight: '700',
  },
  cardSubText: {
    fontSize: 12,
    marginTop: -8,
    marginLeft: 4,
    fontWeight: '600',
  },
  emptyBox: {
    padding: 30,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  initialBox: {
    padding: 30,
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
  dossierContainer: {
    flex: 1,
  },
  dossierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
  },
  dossierTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  dossierSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  dossierContent: {
    padding: 18,
  },
  dossierBox: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  boxTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  boxItem: {
    fontSize: 13,
    marginBottom: 4,
    lineHeight: 18,
  },
  metricsGrid: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridCol: {
    width: '47%',
  },
  gridLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  gridVal: {
    fontSize: 15,
    fontWeight: '800',
  },
  dossierSection: {
    marginBottom: 24,
  },
});
