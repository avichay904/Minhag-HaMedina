import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../theme';
import type { BadgeType } from '@mhm/shared';
import type { StringKey } from '../lib/i18n';

const BADGE_EMOJI: Record<BadgeType, string> = {
  STREAK: '🔥',
  FAST: '⚡',
  DIVERSE: '🌈',
  CHALLENGE: '🏆',
  CHALLENGE_OF_WEEK: '⭐',
  ALMOST: '🎯',
};

interface BadgeRowProps {
  badges: BadgeType[];
  t: (key: StringKey) => string;
  emptyText?: string;
}

export function BadgeRow({ badges, t, emptyText }: BadgeRowProps): React.ReactElement {
  if (badges.length === 0) {
    return (
      <Text style={styles.empty}>{emptyText ?? t('noBadges')}</Text>
    );
  }

  return (
    <View style={styles.row}>
      {badges.map((badge) => (
        <View key={badge} style={styles.badge}>
          <Text style={styles.emoji}>{BADGE_EMOJI[badge] ?? '🏅'}</Text>
          <Text style={styles.label}>{t(badge as StringKey)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badge: {
    backgroundColor: colors.brandPale,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  emoji: {
    fontSize: typography.sizeMd,
  },
  label: {
    fontSize: typography.sizeSm,
    color: colors.brandDeep,
    fontWeight: typography.weightMedium,
  },
  empty: {
    color: colors.textSecondary,
    fontSize: typography.sizeSm,
    fontStyle: 'italic',
  },
});
