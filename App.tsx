// App.tsx - CardTrack Main Application Entry & Navigation Shell

import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Modal,
  ActivityIndicator,
  BackHandler,
  ToastAndroid,
  Platform,
} from 'react-native';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AppProvider, useApp } from './src/context/AppContext';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { PeopleScreen } from './src/screens/PeopleScreen';
import { CardsScreen } from './src/screens/CardsScreen';
import { TransactionsScreen } from './src/screens/TransactionsScreen';
import { MilestonesScreen } from './src/screens/MilestonesScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { Button } from './src/components/common/Button';

type ActiveTab = 'dashboard' | 'people' | 'cards' | 'transactions' | 'milestones' | 'settings';

function MainAppShell() {
  const { colors, isDark } = useTheme();
  const { isAppLocked, unlockApp, isLoading } = useApp();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [targetCardIdForTx, setTargetCardIdForTx] = useState<string | undefined>();
  const [targetPersonIdForTx, setTargetPersonIdForTx] = useState<string | undefined>();
  const lastBackPressRef = useRef<number>(0);

  // Android Hardware Back Button Handler
  useEffect(() => {
    const onHardwareBackPress = () => {
      // 1. Close global search modal if open
      if (searchModalVisible) {
        setSearchModalVisible(false);
        return true;
      }

      // 2. If not on Dashboard tab, navigate to Dashboard first
      if (activeTab !== 'dashboard') {
        setActiveTab('dashboard');
        return true;
      }

      // 3. If on Dashboard, double tap within 2 seconds to exit app
      const now = Date.now();
      if (lastBackPressRef.current && now - lastBackPressRef.current < 2000) {
        BackHandler.exitApp();
        return true;
      }

      lastBackPressRef.current = now;
      if (Platform.OS === 'android') {
        ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      }
      return true;
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', onHardwareBackPress);
    return () => backSub.remove();
  }, [searchModalVisible, activeTab]);

  // If app is loading SQLite database
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textPrimary }]}>
          Initializing Secure Local Database...
        </Text>
      </View>
    );
  }

  // If app is locked by Biometrics / PIN
  if (isAppLocked) {
    return (
      <SafeAreaView style={[styles.lockContainer, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.lockContent}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🔒</Text>
          <Text style={[styles.lockTitle, { color: colors.textPrimary }]}>
            CardTrack Locked
          </Text>
          <Text style={[styles.lockSubtitle, { color: colors.textSecondary }]}>
            Biometric or Device PIN authentication required to access your financial records.
          </Text>
          <Button
            title="Unlock CardTrack"
            variant="primary"
            size="lg"
            onPress={unlockApp}
            style={{ width: '100%', maxWidth: 280, marginTop: 24 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardScreen
            onNavigate={(tab) => setActiveTab(tab as ActiveTab)}
            onOpenGlobalSearch={() => setSearchModalVisible(true)}
            onQuickAction={(action) => {
              if (action === 'add_transaction') setActiveTab('transactions');
              else if (action === 'add_card') setActiveTab('cards');
              else if (action === 'add_milestone') setActiveTab('milestones');
              else if (action === 'add_person') setActiveTab('people');
            }}
          />
        );
      case 'people':
        return (
          <PeopleScreen
            onNavigateToCard={(cardId) => {
              setActiveTab('cards');
            }}
            onNavigateToTransactions={(personId) => {
              setTargetPersonIdForTx(personId);
              setActiveTab('transactions');
            }}
          />
        );
      case 'cards':
        return (
          <CardsScreen
            onNavigateToTransactions={(cardId) => {
              setTargetCardIdForTx(cardId);
              setActiveTab('transactions');
            }}
          />
        );
      case 'transactions':
        return (
          <TransactionsScreen
            initialCardId={targetCardIdForTx}
            initialPersonId={targetPersonIdForTx}
          />
        );
      case 'milestones':
        return <MilestonesScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return null;
    }
  };

  const navItems: { key: ActiveTab; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'Home', icon: '🏠' },
    { key: 'people', label: 'People', icon: '👥' },
    { key: 'cards', label: 'Cards', icon: '💳' },
    { key: 'transactions', label: 'Spends', icon: '🧾' },
    { key: 'milestones', label: 'Goals', icon: '🎯' },
    { key: 'settings', label: 'Data', icon: '⚙️' },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Top Header */}
      <View style={[styles.appHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={styles.brandRow}>
          <Text style={{ fontSize: 22, marginRight: 6 }}>💳</Text>
          <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>CardTrack</Text>
          <View style={[styles.offlineBadge, { backgroundColor: colors.successBg }]}>
            <Text style={[styles.offlineText, { color: colors.success }]}>Offline</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setSearchModalVisible(true)}
          style={[styles.headerIconBtn, { backgroundColor: colors.surfaceElevated }]}
        >
          <Text style={{ fontSize: 16 }}>🔍</Text>
        </TouchableOpacity>
      </View>

      {/* Active Screen View */}
      <View style={styles.screenContainer}>
        {renderActiveScreen()}
      </View>

      {/* Modern Bottom Navigation Bar */}
      <View style={[styles.bottomNavBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {navItems.map((item) => {
          const isActive = activeTab === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.7}
              onPress={() => {
                setActiveTab(item.key);
                if (item.key !== 'transactions') {
                  setTargetCardIdForTx(undefined);
                  setTargetPersonIdForTx(undefined);
                }
              }}
              style={styles.navItem}
            >
              <Text style={[styles.navIcon, isActive && styles.navIconActive]}>
                {item.icon}
              </Text>
              <Text
                style={[
                  styles.navLabel,
                  { color: isActive ? colors.primaryLight : colors.textMuted },
                  isActive && styles.navLabelActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Global Search Modal */}
      <Modal
        visible={searchModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setSearchModalVisible(false)}
      >
        <SearchScreen
          onClose={() => setSearchModalVisible(false)}
          onNavigateToCard={(cardId) => {
            setSearchModalVisible(false);
            setActiveTab('cards');
          }}
        />
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <MainAppShell />
      </AppProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 14,
  },
  lockContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockContent: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    padding: 24,
  },
  lockTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  lockSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  offlineBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  offlineText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenContainer: {
    flex: 1,
  },
  bottomNavBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  navItem: {
    alignItems: 'center',
    paddingVertical: 2,
    minWidth: 48,
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  navIconActive: {
    transform: [{ scale: 1.15 }],
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  navLabelActive: {
    fontWeight: '800',
  },
});
