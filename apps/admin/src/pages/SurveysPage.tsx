import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AdminSurveyDto, AdminCycleRow, CreateSurveyRequest } from '@mhm/contracts';
import { Cadence, CycleState } from '@mhm/shared';
import { adminApi, ApiRequestError } from '../lib/apiClient';
import {
  Button, Card, Badge, Modal, Input, Select,
  Spinner, ErrorMsg, EmptyState, Table, Th, Td, SectionHeading,
} from '../components/ui';
import { cadenceLabels, cycleStateLabels, cycleStateColor, fmtDate } from '../lib/labels';

// ─── Create Survey Modal ─────────────────────────────────────────────────────
interface CreateSurveyModalProps {
  open: boolean;
  onClose: () => void;
}

function CreateSurveyModal({ open, onClose }: CreateSurveyModalProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CreateSurveyRequest>({
    titleHe: '',
    titleEn: '',
    cadence: Cadence.WEEKLY,
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: CreateSurveyRequest) => adminApi.createSurvey(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['surveys'] });
      setForm({ titleHe: '', titleEn: '', cadence: Cadence.WEEKLY });
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiRequestError ? err.message : 'שגיאה ביצירת סקר');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    mutation.mutate(form);
  };

  return (
    <Modal open={open} onClose={onClose} title="יצירת סקר חדש">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="titleHe"
          label="כותרת בעברית"
          value={form.titleHe}
          onChange={(e) => setForm((f) => ({ ...f, titleHe: e.target.value }))}
          required
          placeholder="כותרת הסקר בעברית"
        />
        <Input
          id="titleEn"
          label="כותרת באנגלית"
          value={form.titleEn}
          onChange={(e) => setForm((f) => ({ ...f, titleEn: e.target.value }))}
          required
          placeholder="Survey title in English"
        />
        <Select
          id="cadence"
          label="תדירות"
          value={form.cadence}
          onChange={(e) => setForm((f) => ({ ...f, cadence: e.target.value as Cadence }))}
        >
          {Object.values(Cadence).map((c) => (
            <option key={c} value={c}>{cadenceLabels[c]}</option>
          ))}
        </Select>
        {error && <ErrorMsg message={error} />}
        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={mutation.isPending} className="flex-1 justify-center">
            צור סקר
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1 justify-center">
            ביטול
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Survey Detail Modal ──────────────────────────────────────────────────────
interface SurveyDetailModalProps {
  survey: AdminSurveyDto | null;
  onClose: () => void;
}

function SurveyDetailModal({ survey, onClose }: SurveyDetailModalProps) {
  const qc = useQueryClient();
  const [actionError, setActionError] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const { data: cycles, isLoading } = useQuery({
    queryKey: ['cycles', survey?.id],
    queryFn: () => adminApi.listSurveyCycles(survey!.id),
    enabled: !!survey,
  });

  const runAction = async (label: string, fn: () => Promise<unknown>) => {
    setLoadingAction(label);
    setActionError('');
    try {
      await fn();
      qc.invalidateQueries({ queryKey: ['surveys'] });
      qc.invalidateQueries({ queryKey: ['cycles', survey?.id] });
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : 'שגיאה בפעולה');
    } finally {
      setLoadingAction(null);
    }
  };

  const getNextActions = (cycle: AdminCycleRow) => {
    const actions: { label: string; fn: () => Promise<unknown>; variant?: 'primary' | 'secondary' | 'danger' }[] = [];
    if (cycle.state === CycleState.OPEN) {
      actions.push({ label: 'סגור מחזור', fn: () => adminApi.closeCycle(cycle.id), variant: 'secondary' });
    }
    if (cycle.state === CycleState.CLOSED) {
      actions.push({ label: 'אשר מחזור', fn: () => adminApi.approveCycle(cycle.id) });
    }
    if (cycle.state === CycleState.APPROVED) {
      actions.push({ label: 'פרסם', fn: () => adminApi.publishCycle(cycle.id) });
    }
    return actions;
  };

  if (!survey) return null;

  return (
    <Modal open={!!survey} onClose={onClose} title={`סקר: ${survey.titleHe}`} wide>
      <div className="space-y-6">
        {/* Survey info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">כותרת EN:</span>{' '}
            <span className="font-medium">{survey.titleEn}</span>
          </div>
          <div>
            <span className="text-gray-500">תדירות:</span>{' '}
            <span className="font-medium">{cadenceLabels[survey.cadence]}</span>
          </div>
          <div>
            <span className="text-gray-500">מספר שאלות:</span>{' '}
            <span className="font-medium">{survey.questionCount}</span>
          </div>
          <div>
            <span className="text-gray-500">פעיל:</span>{' '}
            <Badge color={survey.active ? 'green' : 'gray'}>{survey.active ? 'כן' : 'לא'}</Badge>
          </div>
        </div>

        {/* Open new cycle */}
        <div className="border-t pt-4">
          <Button
            onClick={() => runAction('open', () => adminApi.openCycle(survey.id))}
            loading={loadingAction === 'open'}
            disabled={!!loadingAction || !!(cycles ?? []).some((c) => c.state === CycleState.OPEN)}
            size="sm"
          >
            פתח מחזור חדש
          </Button>
        </div>

        {actionError && <ErrorMsg message={actionError} />}

        {/* Cycles */}
        <div>
          <SectionHeading title="מחזורים" />
          {isLoading ? (
            <Spinner />
          ) : !cycles?.length ? (
            <EmptyState message="אין מחזורים עדיין" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>מצב</Th>
                  <Th>נפתח</Th>
                  <Th>נסגר</Th>
                  <Th>פורסם</Th>
                  <Th>פעולות</Th>
                </tr>
              </thead>
              <tbody>
                {cycles.map((cycle) => (
                  <tr key={cycle.id} className="hover:bg-gray-50">
                    <Td>{cycle.sequence}</Td>
                    <Td>
                      <Badge color={cycleStateColor[cycle.state]}>
                        {cycleStateLabels[cycle.state]}
                      </Badge>
                    </Td>
                    <Td>{fmtDate(cycle.openedAt)}</Td>
                    <Td>{fmtDate(cycle.closedAt)}</Td>
                    <Td>{fmtDate(cycle.publishedAt)}</Td>
                    <Td>
                      <div className="flex gap-2">
                        {getNextActions(cycle).map((action) => (
                          <Button
                            key={action.label}
                            size="sm"
                            variant={action.variant ?? 'primary'}
                            loading={loadingAction === action.label}
                            disabled={!!loadingAction}
                            onClick={() => runAction(action.label, action.fn)}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Surveys Page ────────────────────────────────────────────────────────
export function SurveysPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<AdminSurveyDto | null>(null);

  const { data: surveys, isLoading, error } = useQuery({
    queryKey: ['surveys'],
    queryFn: adminApi.listSurveys,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">סקרים</h1>
          <p className="text-sm text-gray-400 mt-0.5">ניהול סקרים ומחזורים</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ סקר חדש</Button>
      </div>

      <Card className="p-0">
        {isLoading ? (
          <Spinner />
        ) : error ? (
          <ErrorMsg message="שגיאה בטעינת סקרים" />
        ) : !surveys?.length ? (
          <EmptyState message="אין סקרים עדיין" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>כותרת</Th>
                <Th>תדירות</Th>
                <Th>שאלות</Th>
                <Th>מחזור פעיל</Th>
                <Th>מצב</Th>
                <Th>פעולות</Th>
              </tr>
            </thead>
            <tbody>
              {surveys.map((survey) => {
                const activeCycle = survey.cycles.find(
                  (c) => c.state === CycleState.OPEN || c.state === CycleState.CLOSED,
                );
                return (
                  <tr key={survey.id} className="hover:bg-gray-50">
                    <Td>
                      <div className="font-medium">{survey.titleHe}</div>
                      <div className="text-xs text-gray-400">{survey.titleEn}</div>
                    </Td>
                    <Td>{cadenceLabels[survey.cadence]}</Td>
                    <Td>{survey.questionCount}</Td>
                    <Td>
                      {activeCycle ? (
                        <Badge color={cycleStateColor[activeCycle.state]}>
                          {cycleStateLabels[activeCycle.state]}
                        </Badge>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </Td>
                    <Td>
                      <Badge color={survey.active ? 'green' : 'gray'}>
                        {survey.active ? 'פעיל' : 'לא פעיל'}
                      </Badge>
                    </Td>
                    <Td>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelected(survey)}
                      >
                        פרטים ←
                      </Button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <CreateSurveyModal open={showCreate} onClose={() => setShowCreate(false)} />
      <SurveyDetailModal survey={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
