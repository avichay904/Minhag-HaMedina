import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { api, ApiRequestError } from '../../lib/apiClient';
import { useAuth } from '../auth/useAuth';
import { FullPageSpinner } from '../../components/ui/Spinner';
import { Card } from '../../components/ui/Card';
import { DisplayMode, QuestionType } from '@mhm/shared';
import type { ResultSummaryDto, SurveyDto } from '@mhm/contracts';
import { clsx } from 'clsx';

// ─── Survey selector ────────────────────────────────────────────────────────

function SurveySelector({
  surveys,
  selected,
  onSelect,
  lang,
}: {
  surveys: SurveyDto[];
  selected: string | null;
  onSelect: (id: string) => void;
  lang: 'he' | 'en';
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-brand-600">{t('results.select_survey')}</label>
      <div className="flex flex-col gap-2">
        {surveys.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={clsx(
              'w-full text-start px-4 py-3 rounded-xl border-2 font-medium transition-all text-sm',
              selected === s.id
                ? 'border-brand-500 bg-brand-50 text-brand-900'
                : 'border-brand-100 bg-white text-brand-700 hover:border-brand-300',
            )}
          >
            {lang === 'en' ? s.titleEn : s.titleHe}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Question result card ───────────────────────────────────────────────────

const COLORS = ['#2e75b6', '#1e5a96', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

function QuestionResultCard({ result, lang }: { result: ResultSummaryDto; lang: 'he' | 'en' }) {
  const { t } = useTranslation();
  const title = lang === 'en' ? result.textEn : result.textHe;

  const isYesNo = result.questionType === QuestionType.YES_NO;
  const isScale =
    result.questionType === QuestionType.SCALE;
  const hasDistribution = result.distribution && result.distribution.length > 0;

  // Build chart data
  const chartData = hasDistribution
    ? result.distribution!.map((d) => ({
        name: isYesNo
          ? d.key === 'true'
            ? t('results.yes_label')
            : t('results.no_label')
          : d.key,
        raw: d.rawCount,
        weighted: parseFloat(d.weightedCount.toFixed(2)),
      }))
    : [];

  const showMode = result.displayMode;

  // Weighted average (scale)
  const weightedAvg = result.weighted?.weightedResult;
  const rawAvg = result.raw?.rawAverage;

  return (
    <Card variant="default" padding="md" className="overflow-hidden">
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="font-bold text-brand-900 text-sm leading-snug flex-1">{title}</p>
        <span className="text-xs text-brand-400 shrink-0">
          {t('results.total_respondents', { count: result.totalResponses })}
        </span>
      </div>

      {result.skipRate > 0 && (
        <p className="text-xs text-brand-300 mb-2">
          {t('results.skip_rate', { pct: Math.round(result.skipRate * 100) })}
        </p>
      )}

      {/* Scale: show number prominently */}
      {isScale && (weightedAvg != null || rawAvg != null) && (
        <div className="flex gap-4 mb-3">
          {(showMode === DisplayMode.WEIGHTED || showMode === DisplayMode.BOTH) && weightedAvg != null && (
            <div className="text-center bg-brand-50 rounded-xl p-3 flex-1">
              <p className="text-3xl font-extrabold text-brand-700">{weightedAvg.toFixed(1)}</p>
              <p className="text-xs text-brand-400">{t('results.weighted')}</p>
            </div>
          )}
          {(showMode === DisplayMode.RAW || showMode === DisplayMode.BOTH) && rawAvg != null && (
            <div className="text-center bg-gray-50 rounded-xl p-3 flex-1">
              <p className="text-3xl font-extrabold text-gray-600">{rawAvg.toFixed(1)}</p>
              <p className="text-xs text-brand-400">{t('results.raw')}</p>
            </div>
          )}
        </div>
      )}

      {/* Bar chart for distribution */}
      {hasDistribution && chartData.length > 0 && (
        <div className="h-40 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5eaf0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#4a6785' }} />
              <YAxis tick={{ fontSize: 11, fill: '#4a6785' }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #d6e4f0',
                  fontSize: 12,
                }}
              />
              {(showMode === DisplayMode.WEIGHTED || showMode === DisplayMode.BOTH) && (
                <Bar dataKey="weighted" name={t('results.weighted')} radius={[4, 4, 0, 0]}>
                  {chartData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Bar>
              )}
              {showMode === DisplayMode.RAW && (
                <Bar dataKey="raw" name={t('results.raw')} radius={[4, 4, 0, 0]}>
                  {chartData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export function PublicResultsScreen() {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const lang = (i18n.language === 'en' ? 'en' : 'he') as 'he' | 'en';

  const initialSurvey = searchParams.get('survey');
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(initialSurvey);

  const { data: surveys, isLoading: surveysLoading } = useQuery({
    queryKey: ['activeSurveys'],
    queryFn: () => api.activeSurveys(),
    enabled: !!token,
  });

  const { data: results, isLoading: resultsLoading, error: resultsError } = useQuery({
    queryKey: ['publicResults', selectedSurveyId],
    queryFn: () => api.publicResults(selectedSurveyId!),
    enabled: !!selectedSurveyId && !!token,
    retry: false,
  });

  if (surveysLoading) return <FullPageSpinner label={t('results.loading')} />;

  const is403 =
    resultsError instanceof ApiRequestError && resultsError.statusCode === 403;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 py-6 flex flex-col gap-6"
    >
      <h1 className="text-2xl font-extrabold text-brand-900">{t('results.title')}</h1>

      {/* Survey selector */}
      {!surveys || surveys.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
          <span className="text-5xl">📋</span>
          <p className="text-brand-400">{t('results.no_surveys')}</p>
        </div>
      ) : (
        <SurveySelector
          surveys={surveys}
          selected={selectedSurveyId}
          onSelect={setSelectedSurveyId}
          lang={lang}
        />
      )}

      {/* Results */}
      {selectedSurveyId && (
        <>
          {resultsLoading && <FullPageSpinner label={t('results.loading')} />}

          {is403 && (
            <Card variant="default" padding="lg" className="text-center">
              <p className="text-3xl mb-3">🔒</p>
              <h2 className="text-lg font-bold text-brand-900 mb-1">{t('results.not_published')}</h2>
              <p className="text-sm text-brand-400">{t('results.not_published_sub')}</p>
            </Card>
          )}

          {resultsError && !is403 && (
            <Card variant="default" padding="md" className="text-center">
              <p className="text-brand-500">{t('errors.generic')}</p>
            </Card>
          )}

          {results && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col gap-4"
            >
              <p className="text-sm text-brand-400">
                {t('results.total_respondents', { count: results.totalRespondents })}
              </p>
              {results.questions.map((q) => (
                <QuestionResultCard key={q.questionId} result={q} lang={lang} />
              ))}
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}
