import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../../lib/apiClient';
import { queryClient } from '../../lib/queryClient';
import { QuestionType, BadgeType } from '@mhm/shared';
import type { QuestionDto, SubmitResponseResponse } from '@mhm/contracts';
import { FullPageSpinner } from '../../components/ui/Spinner';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { BigChoiceButton } from '../../components/ui/BigChoiceButton';
import { ScaleInput } from '../../components/ui/ScaleInput';
import { ChoiceList } from '../../components/ui/ChoiceList';
import { CompletionCard } from '../../components/ui/CompletionCard';
import { RankChip } from '../../components/ui/RankChip';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../auth/useAuth';
import { WelcomeScreen } from '../auth/WelcomeScreen';

const pageVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
};

const pageTransition = {
  type: 'spring',
  stiffness: 260,
  damping: 28,
};

function CategoryLabel({ category }: { category: string }) {
  const { t } = useTranslation();
  const emoji: Record<string, string> = {
    SOCIETY_POLITICS: '🏛️',
    CONSUMER: '🛒',
    HEALTH_LIFESTYLE: '💚',
    TECHNOLOGY: '💻',
    PERSONAL_FINANCE: '💰',
    GENERAL: '📋',
  };
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-500 bg-brand-50 rounded-full px-3 py-1">
      <span>{emoji[category] ?? '📋'}</span>
      {t(`categories.${category}`)}
    </span>
  );
}

export function SurveyRunner() {
  const { t, i18n } = useTranslation();
  const { token, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const lang = (i18n.language === 'en' ? 'en' : 'he') as 'he' | 'en';

  // Completed accumulation
  const [answeredCount, setAnsweredCount] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [allNewBadges, setAllNewBadges] = useState<BadgeType[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [activeSurveyId, setActiveSurveyId] = useState<string | null>(null);
  const [lastPercentileToday, setLastPercentileToday] = useState<number | null>(null);

  // Per-question state
  const [queueIndex, setQueueIndex] = useState(0);
  const [queue, setQueue] = useState<QuestionDto[]>([]);
  const [direction, setDirection] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Answer timing
  const questionStartRef = useRef<number>(Date.now());

  // Fetch active surveys
  const { data: surveys, isLoading: surveysLoading, error: surveysError } = useQuery({
    queryKey: ['activeSurveys'],
    queryFn: () => api.activeSurveys(),
    enabled: !!token,
  });

  // Pick first survey and load its questions
  const firstSurvey = surveys?.[0];
  const { data: questionsData, isLoading: questionsLoading } = useQuery({
    queryKey: ['questions', firstSurvey?.id],
    queryFn: () => api.surveyQuestions(firstSurvey!.id),
    enabled: !!firstSurvey?.id,
  });

  // Also fetch answered so we can filter already-seen questions
  // session-stable: disable focus-refetch so window refocus can't reset the queue mid-survey
  const { data: answered } = useQuery({
    queryKey: ['answered'],
    queryFn: () => api.answered(),
    enabled: !!token,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  // Fetch community stats (public endpoint — no auth needed)
  const { data: communityStats } = useQuery({
    queryKey: ['communityStats'],
    queryFn: () => api.communityStats(),
    staleTime: 60_000,
  });

  // Build queue when data is ready
  useEffect(() => {
    if (!questionsData) return;
    const answeredIds = new Set((answered ?? []).map((a) => a.questionId));
    const remaining = questionsData.filter((q) => !answeredIds.has(q.id));
    setQueue(remaining);
    setQueueIndex(0);
    setActiveSurveyId(firstSurvey?.id ?? null);
    questionStartRef.current = Date.now();
  }, [questionsData, answered, firstSurvey?.id]);

  const currentQuestion = queue[queueIndex] ?? null;

  // Restart the answer timer on question change
  useEffect(() => {
    questionStartRef.current = Date.now();
  }, [queueIndex]);

  const advance = useCallback(() => {
    setDirection(1);
    if (queueIndex >= queue.length - 1) {
      setIsComplete(true);
      refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['answered'] });
    } else {
      setQueueIndex((i) => i + 1);
    }
  }, [queueIndex, queue.length, refreshProfile]);

  const submitMutation = useMutation({
    mutationFn: (vars: { questionId: string; answerValue: string | number; answerTimeMs: number }) =>
      api.submitResponse({
        questionId: vars.questionId,
        answerValue: vars.answerValue,
        answerTimeMs: vars.answerTimeMs,
      }),
    onSuccess: (data: SubmitResponseResponse) => {
      // NOTE: do NOT invalidate ['answered'] here — it would refetch and trigger the
      // queue-rebuild effect, resetting queueIndex mid-session. advance() refreshes it
      // at completion, and handleReset refreshes it on restart.
      setAnsweredCount((c) => c + 1);
      setTotalPoints((p) => p + data.pointsEarned);
      if (data.percentileToday != null) {
        setLastPercentileToday(data.percentileToday);
      }
      if (data.newBadges.length > 0) {
        setAllNewBadges((b) => [...b, ...data.newBadges]);
        data.newBadges.forEach((badge) => {
          showToast(t('completion.new_badge', { badge: t(`badges.${badge}`) }), 'success');
        });
      }
      if (data.pointsEarned > 0) {
        showToast(t('completion.points_earned', { points: data.pointsEarned }), 'info');
      }
      advance();
    },
    onError: () => {
      showToast(t('errors.generic'), 'error');
    },
  });

  const skipMutation = useMutation({
    mutationFn: (questionId: string) => api.skipResponse({ questionId }),
    onSuccess: () => {
      advance();
    },
    onError: () => {
      advance(); // advance anyway so user is not stuck
    },
  });

  const handleAnswer = useCallback(
    (value: string | number) => {
      if (!currentQuestion || submitting) return;
      const answerTimeMs = Date.now() - questionStartRef.current;
      setSubmitting(true);
      submitMutation.mutate(
        { questionId: currentQuestion.id, answerValue: value, answerTimeMs },
        { onSettled: () => setSubmitting(false) },
      );
    },
    [currentQuestion, submitting, submitMutation],
  );

  const handleSkip = useCallback(() => {
    if (!currentQuestion || submitting) return;
    setSubmitting(true);
    skipMutation.mutate(currentQuestion.id, {
      onSettled: () => setSubmitting(false),
    });
  }, [currentQuestion, submitting, skipMutation]);

  const handleReset = useCallback(() => {
    setIsComplete(false);
    setAnsweredCount(0);
    setTotalPoints(0);
    setAllNewBadges([]);
    setLastPercentileToday(null);
    setQueueIndex(0);
    queryClient.invalidateQueries({ queryKey: ['activeSurveys'] });
    queryClient.invalidateQueries({ queryKey: ['questions'] });
    queryClient.invalidateQueries({ queryKey: ['answered'] });
  }, []);

  // Not authenticated
  if (!token) return <WelcomeScreen />;

  // Loading
  if (surveysLoading || questionsLoading) {
    return <FullPageSpinner label={t('survey.loading')} />;
  }

  // Error
  if (surveysError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-8 text-center">
        <span className="text-5xl">😵</span>
        <p className="text-brand-500">{t('errors.network')}</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['activeSurveys'] })}>
          נסה שוב
        </Button>
      </div>
    );
  }

  // Completion — checked BEFORE the queue-empty guard so it always renders deterministically
  if (isComplete) {
    return (
      <div className="px-4 py-8">
        <Card variant="elevated" padding="none">
          <CompletionCard
            questionsAnswered={answeredCount}
            pointsEarned={totalPoints}
            newBadges={allNewBadges}
            surveyId={activeSurveyId ?? undefined}
            onReset={handleReset}
            answeredToday={communityStats?.answeredToday}
            percentileToday={lastPercentileToday}
          />
        </Card>
      </div>
    );
  }

  // No surveys / empty queue
  if (!surveys || surveys.length === 0 || queue.length === 0 || !currentQuestion) {
    if (answeredCount > 0) {
      return (
        <div className="px-4 py-8">
          <Card variant="elevated" padding="none">
            <CompletionCard
              questionsAnswered={answeredCount}
              pointsEarned={totalPoints}
              newBadges={allNewBadges}
              surveyId={activeSurveyId ?? undefined}
              onReset={handleReset}
              answeredToday={communityStats?.answeredToday}
              percentileToday={lastPercentileToday}
            />
          </Card>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-8 text-center">
        <span className="text-5xl">📭</span>
        <h2 className="text-xl font-bold text-brand-900">{t('survey.no_surveys')}</h2>
        <p className="text-brand-400">{t('survey.no_surveys_sub')}</p>
      </div>
    );
  }

  const progress = queue.length > 0 ? ((queueIndex) / queue.length) * 100 : 0;
  const questionText = lang === 'en' ? currentQuestion.textEn : currentQuestion.textHe;

  return (
    <div className="flex flex-col min-h-[calc(100vh-6rem)] px-4 py-4">
      {/* Progress + meta */}
      <div className="flex items-center justify-between mb-3">
        <CategoryLabel category={currentQuestion.category} />
        {profile && <RankChip rank={profile.rank} size="sm" />}
      </div>

      <ProgressBar
        value={progress}
        className="mb-1"
      />
      <p className="text-xs text-brand-400 text-end mb-4">
        {t('survey.question_of', { current: queueIndex + 1, total: queue.length })}
      </p>

      {/* Question slide */}
      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentQuestion.id}
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={pageTransition}
            className="flex flex-col gap-6"
          >
            {/* Image (TEXT_IMAGE) */}
            {currentQuestion.imageUrl && (
              <div className="rounded-2xl overflow-hidden shadow-md">
                <img
                  src={currentQuestion.imageUrl}
                  alt={questionText}
                  className="w-full max-h-52 object-cover"
                />
              </div>
            )}

            {/* Question text */}
            <Card variant="elevated" padding="md">
              <h2 className="text-xl font-bold text-brand-900 leading-relaxed text-center">
                {questionText}
              </h2>
            </Card>

            {/* Answer controls */}
            <QuestionControl
              question={currentQuestion}
              lang={lang}
              onAnswer={handleAnswer}
              disabled={submitting}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Skip */}
      <div className="flex justify-center mt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkip}
          disabled={submitting}
        >
          {t('survey.skip')} →
        </Button>
      </div>
    </div>
  );
}

// ─── Question type renderers ─────────────────────────────────────────────────

interface QuestionControlProps {
  question: QuestionDto;
  lang: 'he' | 'en';
  onAnswer: (value: string | number) => void;
  disabled: boolean;
}

function QuestionControl({ question, lang, onAnswer, disabled }: QuestionControlProps) {
  const { t } = useTranslation();

  switch (question.type) {
    case QuestionType.YES_NO:
    case QuestionType.TEXT_IMAGE:
      if (question.type === QuestionType.TEXT_IMAGE && question.options && question.options.length > 0) {
        return (
          <ChoiceList
            options={question.options}
            onSelect={(v) => onAnswer(v)}
            disabled={disabled}
            lang={lang}
          />
        );
      }
      return (
        <div className="flex gap-3">
          <BigChoiceButton variant="yes" onClick={() => onAnswer('true')} disabled={disabled}>
            <span>✓</span> {t('survey.yes')}
          </BigChoiceButton>
          <BigChoiceButton variant="no" onClick={() => onAnswer('false')} disabled={disabled}>
            <span>✗</span> {t('survey.no')}
          </BigChoiceButton>
        </div>
      );

    case QuestionType.SCALE:
      return (
        <ScaleInput
          min={question.scaleMin ?? 1}
          max={question.scaleMax ?? 10}
          onSelect={(v) => onAnswer(v)}
          disabled={disabled}
        />
      );

    case QuestionType.SINGLE_CHOICE:
      return (
        <ChoiceList
          options={question.options ?? []}
          onSelect={(v) => onAnswer(v)}
          disabled={disabled}
          lang={lang}
        />
      );

    default:
      return null;
  }
}
