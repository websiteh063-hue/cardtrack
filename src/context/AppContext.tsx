// src/context/AppContext.tsx - Core State Management & Data Synchronization

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Person,
  CreditCard,
  Transaction,
  Milestone,
  DashboardStats,
  MilestoneProgress,
} from '../types';
import { getDatabase, IDatabase } from '../db/database';
import { getAllPeople } from '../db/peopleRepo';
import { getAllCards } from '../db/cardsRepo';
import { getAllTransactions } from '../db/transactionsRepo';
import { getAllMilestones } from '../db/milestonesRepo';
import { calculateDashboardStats, calculateMilestoneProgress } from '../services/calculations';
import { AuthService } from '../services/auth';

interface AppContextType {
  db: IDatabase | null;
  isLoading: boolean;
  people: Person[];
  cards: CreditCard[];
  transactions: Transaction[];
  milestones: Milestone[];
  stats: DashboardStats;
  milestoneProgressList: MilestoneProgress[];
  selectedPersonId: string | null;
  setSelectedPersonId: (id: string | null) => void;
  refreshData: () => Promise<void>;
  isAppLocked: boolean;
  unlockApp: () => Promise<boolean>;
  lockApp: () => void;
}

const defaultStats: DashboardStats = {
  totalPeople: 0,
  totalCards: 0,
  totalTransactions: 0,
  totalPurchasesAmount: 0,
  totalSpendingAmount: 0,
  activeMilestonesCount: 0,
  completedMilestonesCount: 0,
  pendingMilestonesCount: 0,
};

const AppContext = createContext<AppContextType>({
  db: null,
  isLoading: true,
  people: [],
  cards: [],
  transactions: [],
  milestones: [],
  stats: defaultStats,
  milestoneProgressList: [],
  selectedPersonId: null,
  setSelectedPersonId: () => {},
  refreshData: async () => {},
  isAppLocked: false,
  unlockApp: async () => true,
  lockApp: () => {},
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<IDatabase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [people, setPeople] = useState<Person[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [milestoneProgressList, setMilestoneProgressList] = useState<MilestoneProgress[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [isAppLocked, setIsAppLocked] = useState(false);

  // Initialize DB and load state
  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const database = await getDatabase();
        if (!mounted) return;
        setDb(database);

        const [p, c, t, m] = await Promise.all([
          getAllPeople(database),
          getAllCards(database),
          getAllTransactions(database),
          getAllMilestones(database),
        ]);

        if (!mounted) return;
        setPeople(p);
        setCards(c);
        setTransactions(t);
        setMilestones(m);

        // Calculate stats
        const computedStats = calculateDashboardStats(p, c, t, m);
        setStats(computedStats);

        // Calculate milestones
        const cMap = new Map(c.map(card => [card.id, card]));
        const pMap = new Map(p.map(person => [person.id, person.full_name]));
        const prog = m.map(item => {
          const card = cMap.get(item.card_id);
          const pName = pMap.get(item.person_id) || (card ? pMap.get(card.person_id) : undefined) || 'Unknown';
          return calculateMilestoneProgress(
            item,
            t,
            card ? card.card_nickname : 'Card',
            card ? card.bank_name : 'Bank',
            pName
          );
        });
        setMilestoneProgressList(prog);

        // Check app lock
        if (AuthService.isLockEnabled()) {
          setIsAppLocked(true);
        }
      } catch (err) {
        console.error('Failed to initialize CardTrack database:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  const refreshData = useCallback(async () => {
    if (!db) return;
    try {
      const [p, c, t, m] = await Promise.all([
        getAllPeople(db),
        getAllCards(db),
        getAllTransactions(db),
        getAllMilestones(db),
      ]);

      setPeople(p);
      setCards(c);
      setTransactions(t);
      setMilestones(m);

      const computedStats = calculateDashboardStats(p, c, t, m);
      setStats(computedStats);

      const cMap = new Map(c.map(card => [card.id, card]));
      const pMap = new Map(p.map(person => [person.id, person.full_name]));
      const prog = m.map(item => {
        const card = cMap.get(item.card_id);
        const pName = pMap.get(item.person_id) || (card ? pMap.get(card.person_id) : undefined) || 'Unknown';
        return calculateMilestoneProgress(
          item,
          t,
          card ? card.card_nickname : 'Card',
          card ? card.bank_name : 'Bank',
          pName
        );
      });
      setMilestoneProgressList(prog);
    } catch (err) {
      console.error('Error refreshing CardTrack data:', err);
    }
  }, [db]);

  const unlockApp = useCallback(async (): Promise<boolean> => {
    const success = await AuthService.authenticateUser('Unlock CardTrack');
    if (success) {
      setIsAppLocked(false);
      return true;
    }
    return false;
  }, []);

  const lockApp = useCallback(() => {
    setIsAppLocked(true);
  }, []);

  return (
    <AppContext.Provider
      value={{
        db,
        isLoading,
        people,
        cards,
        transactions,
        milestones,
        stats,
        milestoneProgressList,
        selectedPersonId,
        setSelectedPersonId,
        refreshData,
        isAppLocked,
        unlockApp,
        lockApp,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
