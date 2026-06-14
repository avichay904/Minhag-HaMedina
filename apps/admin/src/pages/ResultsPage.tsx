import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ResultSummaryDto } from '@mhm/contracts';
import { QuestionType, DisplayMode } from '@mhm/shared';
import { adminApi } from '../lib/apiClient';
import {
  Card, Badge, Select, Spinner, ErrorMsg, EmptyState, SectionHeading,
} from '../components/ui';
import { questionTypeLabels, cycleStateLabels } from '../lib/labels';

// ─── Result card ──────────────────────────────────────────────────────────────
function ResultCard({ q }: { q: ResultSummaryDto }) {
  const skipRate = (q.skipRate * 100).toFixed(1);

  return (
    <Card className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-semibold text-brand-900 leading-snug">{q.textHe}</p>
          <p className="text-xs text-gray-400 mt-0.5">{q.textEn}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Badge color="blue">{questionTypeLabels[q.questionType]}</Badge>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 text-sm text-gray-600">
        <div><span className="font-medium text-brand-900">{q.totalResponses}</span> תגובות</div>
        <div><span className="font-medium text-brand-900">{q.skippedCount}</span> דילוגים</div>
        <div>שיעור דילוג: <span className="font-medium text-brand-900">{skipRate}%</span></div>
      </div>

      {/* Numeric results */}
      {(q.questionType === QuestionType.YES_NO || q.questionType === QuestionType.SCALE) && (
        <div className="grid grid-cols-2 gap-4">
          {(q.displayMode === DisplayMode.RAW || q.displayMode === DisplayMode.BOTH) && q.raw && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-blue-600 font-semibold mb-2">גולמי (Raw)</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">ממוצע:</span>
                  <span className="font-bold text-blue-900">
                    {q.raw.rawAverage !== null ? q.raw.rawAverage.toFixed(4) : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">סכום:</span>
                  <span className="font-medium">{q.raw.rawTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ספירה:</span>
                  <span className="font-medium">{q.raw.rawCount}</span>
                </div>
              </div>
            </div>
          )}
          {(q.displayMode === DisplayMode.WEIGHTED || q.displayMode === DisplayMode.BOTH) && q.weighted && (
            <div className="bg-purple-50 rounded-lg p-3">
              <p className="text-xs text-purple-600 font-semibold mb-2">משוקלל (Weighted)</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">תוצאה:</span>
                  <span className="font-bold text-purple-900">
                    {q.weighted.weightedResult !== null ? q.weighted.weightedResult.toFixed(4) : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">סכום שקלול:</span>
                  <span className="font-medium">{q.weighted.weightedTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">משקל:</span>
                  <span className="font-medium">{q.weighted.weightedCount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Distribution */}
      {q.distribution && q.distribution.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500">התפלגות</p>
          {q.distribution.map((entry) => {
            const total = q.distribution!.reduce((sum, e) => sum + e.rawCount, 0);
            const pct = total > 0 ? (entry.rawCount / total) * 100 : 0;
            return (
              <div key={entry.key} className="space-y-1">
                <div className="flex justify-between text-xs text-gray-600">
                  <span className="font-medium">{entry.key}</span>
                  <span>{entry.rawCount} ({pct.toFixed(1)}%) · שקלול: {entry.weightedCount.toFixed(2)}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Main Results Page ────────────────────────────────────────────────────────
export function ResultsPage() {
  const [selectedSurveyId, setSelectedSurveyId] = useState('');

  const { data: surveys } = useQuery({
    queryKey: ['surveys'],
    queryFn: adminApi.listSurveys,
  });

  const { data: results, isLoading, error } = useQuery({
    queryKey: ['results', selectedSurveyId],
    queryFn: () => adminApi.getResults(selectedSurveyId),
    enabled: !!selectedSurveyId,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-900">תוצאות</h1>
        <p className="text-sm text-gray-400 mt-0.5">תוצאות גולמיות ומשוקללות לפי שאלה</p>
      </div>

      {/* Survey picker */}
      <Card>
        <Select
          id="resultsSurvey"
          label="בחר סקר"
          value={selectedSurveyId}
          onChange={(e) => setSelectedSurveyId(e.target.value)}
          className="w-80"
        >
          <option value="">בחר סקר לצפייה בתוצאות...</option>
          {(surveys ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.titleHe}</option>
          ))}
        </Select>
      </Card>

      {/* Results */}
      {selectedSurveyId && (
        <>
          {isLoading ? (
            <Spinner />
          ) : error ? (
            <ErrorMsg message="שגיאה בטעינת תוצאות. ייתכן שאין מחזור מפורסם." />
          ) : !results ? null : (
            <div className="space-y-4">
              {/* Summary */}
              <Card>
                <div className="grid grid-cols-3 gap-6 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs mb-1">מצב מחזור</p>
                    <Badge color="purple">{cycleStateLabels[results.state]}</Badge>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs mb-1">משתתפים</p>
                    <p className="text-2xl font-bold text-brand-900">{results.totalRespondents}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs mb-1">מצב תצוגה</p>
                    <Badge color="blue">{results.displayMode}</Badge>
                  </div>
                </div>
              </Card>

              {/* Questions */}
              <SectionHeading title={`שאלות (${results.questions.length})`} />
              {results.questions.length === 0 ? (
                <EmptyState message="אין תוצאות לשאלות" />
              ) : (
                <div className="space-y-4">
                  {results.questions.map((q) => (
                    <ResultCard key={q.questionId} q={q} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!selectedSurveyId && (
        <EmptyState message="בחר סקר למעלה לצפייה בתוצאות" />
      )}
    </div>
  );
}
