import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Screen } from '../components/Screen';
import { YesNoButtons } from '../components/YesNoButtons';
import { ScaleDots } from '../components/ScaleDots';
import { ChoiceList } from '../components/ChoiceList';
import { ProgressBar } from '../components/ProgressBar';
import { Button } from '../components/Button';
import { BadgeRow } from '../components/BadgeRow';
import { colors, spacing, typography, radii, shadow } from '../theme';
import {
  fetchActiveSurveys,
  fetchSurveyQuestions,
  submitResponse,
  skipQuestion,
  fetchCommunityStats,
} from '../lib/api';
import { useI18n } from '../lib/i18n';
import { QuestionType } from '@mhm/shared';
import type { QuestionDto, SubmitResponseResponse } from '../lib/api';
import type { BadgeType } from '@mhm/shared';

type AnswerState =
  | { type: 'idle' }
  | { type: 'submitting' }
  | { type: 'done'; result: SubmitResponseResponse };

export function SurveyScreen(): React.ReactElement {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();

  const [surveyIdx] = useState(0);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [answerState, setAnswerState] = useState<AnswerState>({ type: 'idle' });
  const [surveyDone, setSurveyDone] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [allNewBadges, setAllNewBadges] = useState<BadgeType[]>([]);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [percentileToday, setPercentileToday] = useState<number | null>(null);

  const surveysQuery = useQuery({
    queryKey: ['activeSurveys'],
    queryFn: fetchActiveSurveys,
  });

  const surveys = surveysQuery.data ?? [];
  const activeSurvey = surveys[surveyIdx];

  const questionsQuery = useQuery({
    queryKey: ['questions', activeSurvey?.id],
    queryFn: () => fetchSurveyQuestions(activeSurvey!.id),
    enabled: !!activeSurvey,
  });

  const communityStatsQuery = useQuery({
    queryKey: ['communityStats'],
    queryFn: fetchCommunityStats,
    enabled: surveyDone,
  });

  const questions: QuestionDto[] = questionsQuery.data ?? [];
  const currentQuestion = questions[questionIdx];

  const submitMutation = useMutation({
    mutationFn: submitResponse,
    onSuccess: (result) => {
      setTotalPoints((p) => p + result.pointsEarned);
      const newB = result.newBadges as BadgeType[];
      setAllNewBadges((prev) => {
        const merged = [...prev];
        for (const b of newB) {
          if (!merged.includes(b)) merged.push(b);
        }
        return merged;
      });
      if (result.percentileToday != null) {
        setPercentileToday(result.percentileToday);
      }
      advanceQuestion();
    },
    onError: () => {
      setAnswerState({ type: 'idle' });
    },
  });

  const advanceQuestion = useCallback(() => {
    setAnswerState({ type: 'idle' });
    setStartTime(Date.now());
    if (questionIdx + 1 < questions.length) {
      setQuestionIdx((i) => i + 1);
    } else {
      setSurveyDone(true);
    }
  }, [questionIdx, questions.length]);

  const handleAnswer = (value: string | number) => {
    if (!currentQuestion || answerState.type === 'submitting') return;
    setAnswerState({ type: 'submitting' });
    submitMutation.mutate({
      questionId: currentQuestion.id,
      answerValue: value,
      answerTimeMs: Date.now() - startTime,
    });
  };

  const handleSkip = async () => {
    if (!currentQuestion || answerState.type === 'submitting') return;
    setAnswerState({ type: 'submitting' });
    try {
      await skipQuestion(currentQuestion.id);
    } catch {
      // skip errors are non-fatal
    }
    advanceQuestion();
  };

  const handleRestart = () => {
    setSurveyDone(false);
    setQuestionIdx(0);
    setTotalPoints(0);
    setAllNewBadges([]);
    setPercentileToday(null);
    setAnswerState({ type: 'idle' });
    setStartTime(Date.now());
    queryClient.invalidateQueries({ queryKey: ['activeSurveys'] });
    queryClient.invalidateQueries({ queryKey: ['questions'] });
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (surveysQuery.isLoading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brandMid} />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </Screen>
    );
  }

  if (surveysQuery.isError) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{t('errorGeneric')}</Text>
          <Button
            label={t('retry')}
            onPress={() => surveysQuery.refetch()}
            variant="secondary"
            size="md"
            style={styles.retryBtn}
          />
        </View>
      </Screen>
    );
  }

  // ── No surveys ─────────────────────────────────────────────────────────────
  if (!activeSurvey) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>🗳️</Text>
          <Text style={styles.emptyText}>{t('noSurveys')}</Text>
        </View>
      </Screen>
    );
  }

  // ── Survey complete ────────────────────────────────────────────────────────
  if (surveyDone) {
    const communityStats = communityStatsQuery.data;

    return (
      <Screen scrollable>
        <View style={styles.doneContainer}>
          <Text style={styles.doneEmoji}>🎉</Text>
          <Text style={styles.doneTitle}>{t('surveyComplete')}</Text>
          <Text style={styles.doneSubtitle}>{t('surveyCompleteSubtitle')}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{totalPoints}</Text>
              <Text style={styles.statLabel}>{t('pointsEarned')}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{questions.length}</Text>
              <Text style={styles.statLabel}>{t('questionsAnswered')}</Text>
            </View>
          </View>

          {communityStats != null && (
            <View style={[styles.statCard, styles.communityCard]}>
              <Text style={styles.communityNumber}>{communityStats.answeredToday}</Text>
              <Text style={styles.statLabel}>{t('answeredToday')}</Text>
              {percentileToday != null && (
                <Text style={styles.percentileText}>
                  {t('topPercentToday')} {percentileToday}{t('topPercentTodaySuffix')}
                </Text>
              )}
            </View>
          )}

          {allNewBadges.length > 0 && (
            <View style={styles.badgesSection}>
              <Text style={styles.badgesTitle}>{t('newBadges')}</Text>
              <BadgeRow badges={allNewBadges} t={t} />
            </View>
          )}

          <Button
            label={t('backToSurveys')}
            onPress={handleRestart}
            variant="primary"
            size="lg"
            style={styles.doneBtn}
          />
        </View>
      </Screen>
    );
  }

  // ── Questions loading ──────────────────────────────────────────────────────
  if (questionsQuery.isLoading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brandMid} />
        </View>
      </Screen>
    );
  }

  if (!currentQuestion) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{t('noSurveys')}</Text>
        </View>
      </Screen>
    );
  }

  const questionText = lang === 'he' ? currentQuestion.textHe : currentQuestion.textEn;
  const isSubmitting = answerState.type === 'submitting';
  const scaleMin = currentQuestion.scaleMin ?? 1;
  const scaleMax = currentQuestion.scaleMax ?? 5;

  // ── Question display ───────────────────────────────────────────────────────
  return (
    <View style={styles.questionOuter}>
      {/* Header */}
      <View style={styles.questionHeader}>
        <Text style={styles.headerTitle}>
          {lang === 'he' ? activeSurvey.titleHe : activeSurvey.titleEn}
        </Text>
        <ProgressBar current={questionIdx} total={questions.length} />
        <Text style={styles.progressLabel}>
          {questionIdx + 1} / {questions.length}
        </Text>
      </View>

      {/* Body */}
      <ScrollView
        style={styles.questionScroll}
        contentContainerStyle={styles.questionScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Image for TEXT_IMAGE */}
        {currentQuestion.type === QuestionType.TEXT_IMAGE && currentQuestion.imageUrl && (
          <Image
            source={{ uri: currentQuestion.imageUrl }}
            style={styles.questionImage}
            resizeMode="contain"
          />
        )}

        {/* Question text */}
        <View style={styles.questionCard}>
          <Text style={styles.questionText}>{questionText}</Text>
        </View>

        {/* Answer controls */}
        <View style={styles.answerArea}>
          {(currentQuestion.type === QuestionType.YES_NO ||
            currentQuestion.type === QuestionType.TEXT_IMAGE) && (
            <YesNoButtons
              labelYes={t('yes')}
              labelNo={t('no')}
              onYes={() => handleAnswer('yes')}
              onNo={() => handleAnswer('no')}
              disabled={isSubmitting}
            />
          )}

          {currentQuestion.type === QuestionType.SCALE && (
            <ScaleDots
              key={currentQuestion.id}
              min={scaleMin}
              max={scaleMax}
              onSelect={(v) => handleAnswer(v)}
              disabled={isSubmitting}
            />
          )}

          {currentQuestion.type === QuestionType.SINGLE_CHOICE &&
            currentQuestion.options &&
            currentQuestion.options.length > 0 && (
              <View>
                <ChoiceList
                  key={currentQuestion.id}
                  options={currentQuestion.options}
                  lang={lang}
                  onSelect={(key) => handleAnswer(key)}
                  disabled={isSubmitting}
                />
                {/* Submit button for single choice (auto-submit on tap in ChoiceList,
                    but we show a "Next" for explicit confirmation) */}
              </View>
            )}

          {isSubmitting && (
            <ActivityIndicator
              size="small"
              color={colors.brandMid}
              style={styles.submittingIndicator}
            />
          )}
        </View>
      </ScrollView>

      {/* Skip footer */}
      <View style={styles.footer}>
        <TouchableOpacity onPress={handleSkip} disabled={isSubmitting} style={styles.skipBtn}>
          <Text style={styles.skipText}>{t('skip')}</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  emptyEmoji: {
    fontSize: 56,
    marginBottom: spacing.md,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.sizeMd,
    textAlign: 'center',
  },

  // Question layout
  questionOuter: {
    flex: 1,
    backgroundColor: colors.background,
  },
  questionHeader: {
    backgroundColor: colors.brandDeep,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  headerTitle: {
    color: colors.textOnBrand,
    fontSize: typography.sizeSm,
    fontWeight: typography.weightMedium,
    textAlign: 'right',
    marginBottom: spacing.sm,
  },
  progressLabel: {
    color: colors.brandPale,
    fontSize: typography.sizeXs,
    textAlign: 'right',
    marginTop: 4,
  },
  questionScroll: {
    flex: 1,
  },
  questionScrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  questionImage: {
    width: '100%',
    height: 200,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceSecondary,
  },
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.md,
  },
  questionText: {
    fontSize: typography.sizeLg,
    fontWeight: typography.weightMedium,
    color: colors.textPrimary,
    textAlign: 'right',
    lineHeight: typography.sizeLg * 1.5,
  },
  answerArea: {
    gap: spacing.md,
  },
  submittingIndicator: {
    alignSelf: 'center',
    marginTop: spacing.sm,
  },

  // Footer
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    alignItems: 'center',
  },
  skipBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  skipText: {
    color: colors.textSecondary,
    fontSize: typography.sizeSm,
    fontWeight: typography.weightMedium,
  },

  // Done state
  doneContainer: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  doneEmoji: {
    fontSize: 72,
    marginBottom: spacing.md,
  },
  doneTitle: {
    fontSize: typography.sizeXxl,
    fontWeight: typography.weightBold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  doneSubtitle: {
    fontSize: typography.sizeMd,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadow.sm,
  },
  statNumber: {
    fontSize: typography.sizeXxl,
    fontWeight: typography.weightBold,
    color: colors.brandDeep,
  },
  statLabel: {
    fontSize: typography.sizeSm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  communityCard: {
    width: '100%',
    marginBottom: spacing.xl,
    marginTop: 0,
  },
  communityNumber: {
    fontSize: typography.sizeXxl,
    fontWeight: typography.weightBold,
    color: colors.brandMid,
  },
  percentileText: {
    fontSize: typography.sizeSm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  badgesSection: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadow.sm,
  },
  badgesTitle: {
    fontSize: typography.sizeMd,
    fontWeight: typography.weightSemibold,
    color: colors.textPrimary,
    textAlign: 'right',
    marginBottom: spacing.md,
  },
  doneBtn: {
    width: '80%',
  },
});
