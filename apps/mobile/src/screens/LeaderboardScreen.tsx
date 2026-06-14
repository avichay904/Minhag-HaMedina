import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, FlatList } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { RankChip } from '../components/RankChip';
import { colors, spacing, typography, radii, shadow } from '../theme';
import { fetchLeaderboard } from '../lib/api';
import { useI18n, type StringKey } from '../lib/i18n';
import type { LeaderboardEntry } from '../lib/api';

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function LeaderboardScreen(): React.ReactElement {
  const { t } = useI18n();

  const lbQuery = useQuery({
    queryKey: ['leaderboard'],
    queryFn: fetchLeaderboard,
  });

  if (lbQuery.isLoading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brandMid} />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </Screen>
    );
  }

  if (lbQuery.isError) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{t('errorGeneric')}</Text>
          <Button
            label={t('retry')}
            onPress={() => lbQuery.refetch()}
            variant="secondary"
            size="md"
            style={styles.retryBtn}
          />
        </View>
      </Screen>
    );
  }

  const entries = lbQuery.data ?? [];

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text style={styles.title}>🏆 {t('leaderboardTitle')}</Text>
      </View>

      {entries.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{t('noData')}</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => `${item.position}-${item.displayName}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }: { item: LeaderboardEntry }) => {
            const medal = MEDALS[item.position];
            return (
              <View style={[styles.row, item.position <= 3 && styles.rowTop]}>
                <View style={styles.posCol}>
                  {medal ? (
                    <Text style={styles.medal}>{medal}</Text>
                  ) : (
                    <Text style={styles.posNum}>{item.position}</Text>
                  )}
                </View>
                <View style={styles.nameCol}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                  <RankChip rank={item.rank} label={t(item.rank as StringKey)} size="sm" />
                </View>
                <View style={styles.pointsCol}>
                  <Text style={styles.points}>{item.points}</Text>
                  <Text style={styles.pointsLabel}>{t('points')}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: typography.sizeMd,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.sizeMd,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryBtn: {
    marginTop: spacing.md,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.sizeMd,
    textAlign: 'center',
  },

  header: {
    backgroundColor: colors.brandDeep,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  title: {
    color: colors.textOnBrand,
    fontSize: typography.sizeXl,
    fontWeight: typography.weightBold,
  },

  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadow.sm,
  },
  rowTop: {
    borderWidth: 1,
    borderColor: colors.brandPale,
  },
  posCol: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medal: {
    fontSize: typography.sizeXl,
  },
  posNum: {
    fontSize: typography.sizeLg,
    fontWeight: typography.weightBold,
    color: colors.textSecondary,
  },
  nameCol: {
    flex: 1,
    paddingHorizontal: spacing.md,
    gap: 4,
    alignItems: 'flex-end',
  },
  name: {
    fontSize: typography.sizeMd,
    fontWeight: typography.weightSemibold,
    color: colors.textPrimary,
    textAlign: 'right',
  },
  pointsCol: {
    alignItems: 'center',
    minWidth: 56,
  },
  points: {
    fontSize: typography.sizeLg,
    fontWeight: typography.weightBold,
    color: colors.brandMid,
  },
  pointsLabel: {
    fontSize: typography.sizeXs,
    color: colors.textSecondary,
  },
});
