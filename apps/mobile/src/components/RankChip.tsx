import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../theme';
import type { Rank } from '@mhm/shared';

const RANK_COLORS: Record<Rank, { bg: string; text: string }> = {
  GUEST: { bg: colors.surfaceSecondary, text: colors.textSecondary },
  BEGINNER: { bg: '#d1fae5', text: '#065f46' },
  CONTRIBUTOR: { bg: '#dbeafe', text: '#1e40af' },
  VETERAN: { bg: '#ede9fe', text: '#5b21b6' },
  AMBASSADOR: { bg: '#fef3c7', text: '#92400e' },
};

interface RankChipProps {
  rank: Rank;
  label: string;
  size?: 'sm' | 'md';
}

export function RankChip({ rank, label, size = 'md' }: RankChipProps): React.ReactElement {
  const c = RANK_COLORS[rank] ?? RANK_COLORS.GUEST;
  return (
    <View style={[styles.chip, { backgroundColor: c.bg }, size === 'sm' ? styles.sm : styles.md]}>
      <Text style={[styles.text, { color: c.text }, size === 'sm' ? styles.textSm : styles.textMd]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
  sm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  md: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  text: {
    fontWeight: typography.weightSemibold,
  },
  textSm: {
    fontSize: typography.sizeXs,
  },
  textMd: {
    fontSize: typography.sizeSm,
  },
});
