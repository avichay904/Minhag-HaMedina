import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { RankChip } from '../components/RankChip';
import { BadgeRow } from '../components/BadgeRow';
import { ProgressBar } from '../components/ProgressBar';
import { colors, spacing, typography, radii, shadow } from '../theme';
import { fetchProfile } from '../lib/api';
import { useI18n, type StringKey, type Lang } from '../lib/i18n';

interface ProfileScreenProps {
  onLogout: () => void;
}

export function ProfileScreen({ onLogout }: ProfileScreenProps): React.ReactElement {
  const { t, lang, setLang } = useI18n();

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile,
  });

  if (profileQuery.isLoading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brandMid} />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </Screen>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{t('errorGeneric')}</Text>
          <Button
            label={t('retry')}
            onPress={() => profileQuery.refetch()}
            variant="secondary"
            size="md"
            style={styles.retryBtn}
          />
        </View>
      </Screen>
    );
  }

  const profile = profileQuery.data;
  const { rankProgress } = profile;

  // Approximate fill toward next rank based on surveys answered vs. remaining.
  const progressTotal =
    rankProgress.surveysToNext != null
      ? profile.surveysCompleted + rankProgress.surveysToNext
      : profile.surveysCompleted;

  return (
    <Screen scrollable padded={false}>
      {/* Header band */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile.displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{profile.displayName}</Text>
        <RankChip rank={profile.rank} label={t(profile.rank as StringKey)} />
      </View>

      <View style={styles.body}>
        {/* Stats grid */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{profile.points}</Text>
            <Text style={styles.statLabel}>{t('points')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{profile.trustScore.toFixed(1)}</Text>
            <Text style={styles.statLabel}>{t('trustScore')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{profile.surveysCompleted}</Text>
            <Text style={styles.statLabel}>{t('surveysCompleted')}</Text>
          </View>
        </View>

        {/* Rank progress */}
        {rankProgress.next && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>{t('nextRank')}</Text>
              <RankChip
                rank={rankProgress.next}
                label={t(rankProgress.next as StringKey)}
                size="sm"
              />
            </View>
            <ProgressBar current={profile.surveysCompleted} total={progressTotal} />
            {rankProgress.surveysToNext != null && (
              <Text style={styles.progressHint}>
                {rankProgress.surveysToNext} {t('surveysToNext')}
              </Text>
            )}
            {rankProgress.trustBlockedNext && (
              <Text style={styles.trustHint}>⚠️ {t('trustScore')}</Text>
            )}
          </View>
        )}

        {/* Badges */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('badges')}</Text>
          <View style={styles.badgesWrap}>
            <BadgeRow badges={profile.badges} t={t} />
          </View>
        </View>

        {/* Language toggle */}
        <View style={styles.card}>
          <View style={styles.langRow}>
            {(['he', 'en'] as Lang[]).map((l) => (
              <TouchableOpacity
                key={l}
                onPress={() => setLang(l)}
                style={[styles.langBtn, lang === l && styles.langBtnActive]}
                activeOpacity={0.75}
              >
                <Text style={[styles.langText, lang === l && styles.langTextActive]}>
                  {l === 'he' ? 'עברית' : 'English'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Logout */}
        <Button
          label={t('logout')}
          onPress={onLogout}
          variant="danger"
          size="lg"
          style={styles.logoutBtn}
        />
      </View>
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

  header: {
    backgroundColor: colors.brandDeep,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: radii.full,
    backgroundColor: colors.brandMid,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    color: colors.textOnBrand,
    fontSize: typography.sizeDisplay,
    fontWeight: typography.weightBold,
  },
  name: {
    color: colors.textOnBrand,
    fontSize: typography.sizeXl,
    fontWeight: typography.weightBold,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },

  body: {
    padding: spacing.md,
    gap: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...shadow.sm,
  },
  statNumber: {
    fontSize: typography.sizeXl,
    fontWeight: typography.weightBold,
    color: colors.brandDeep,
  },
  statLabel: {
    fontSize: typography.sizeXs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadow.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: typography.sizeMd,
    fontWeight: typography.weightSemibold,
    color: colors.textPrimary,
    textAlign: 'right',
    marginBottom: spacing.sm,
  },
  progressHint: {
    fontSize: typography.sizeSm,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: spacing.sm,
  },
  trustHint: {
    fontSize: typography.sizeXs,
    color: colors.warning,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  badgesWrap: {
    marginTop: spacing.xs,
  },

  langRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  langBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  langBtnActive: {
    backgroundColor: colors.brandPale,
    borderColor: colors.brandMid,
  },
  langText: {
    fontSize: typography.sizeMd,
    color: colors.textSecondary,
    fontWeight: typography.weightMedium,
  },
  langTextActive: {
    color: colors.brandMid,
    fontWeight: typography.weightSemibold,
  },

  logoutBtn: {
    marginTop: spacing.sm,
  },
});
