import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { I18nProvider, useI18n } from './src/lib/i18n';
import { getToken, clearToken } from './src/lib/api';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { SurveyScreen } from './src/screens/SurveyScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { colors, spacing, typography } from './src/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

type Tab = 'survey' | 'leaderboard' | 'profile';

const TABS: { key: Tab; icon: string }[] = [
  { key: 'survey', icon: '🗳️' },
  { key: 'leaderboard', icon: '🏆' },
  { key: 'profile', icon: '👤' },
];

function MainTabs({ onLogout }: { onLogout: () => void }): React.ReactElement {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('survey');

  return (
    <View style={styles.appContainer}>
      <View style={styles.screenArea}>
        {tab === 'survey' && <SurveyScreen />}
        {tab === 'leaderboard' && <LeaderboardScreen />}
        {tab === 'profile' && <ProfileScreen onLogout={onLogout} />}
      </View>

      <View style={styles.tabBar}>
        {TABS.map(({ key, icon }) => {
          const active = tab === key;
          return (
            <TouchableOpacity
              key={key}
              style={styles.tabItem}
              onPress={() => setTab(key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{icon}</Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t(key)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function Root(): React.ReactElement {
  const { t } = useI18n();
  const queryClientInstance = useQueryClient();
  // null = still checking storage, false = logged out, true = logged in
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    getToken()
      .then((token) => {
        if (mounted) setAuthed(!!token);
      })
      .catch(() => {
        if (mounted) setAuthed(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = async () => {
    await clearToken();
    queryClientInstance.clear();
    setAuthed(false);
  };

  if (authed === null) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.brandMid} />
        <Text style={styles.splashText}>{t('loading')}</Text>
      </View>
    );
  }

  if (!authed) {
    return <WelcomeScreen onLogin={() => setAuthed(true)} />;
  }

  return <MainTabs onLogout={handleLogout} />;
}

export default function App(): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <StatusBar style="light" />
        <Root />
      </I18nProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenArea: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabIcon: {
    fontSize: 22,
    opacity: 0.45,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: typography.sizeXs,
    color: colors.textSecondary,
    fontWeight: typography.weightMedium,
  },
  tabLabelActive: {
    color: colors.brandMid,
    fontWeight: typography.weightSemibold,
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  splashText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: typography.sizeMd,
  },
});
