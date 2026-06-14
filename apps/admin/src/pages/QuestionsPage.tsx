import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AdminQuestionDto, CreateQuestionRequest, ChoiceOptionDto } from '@mhm/contracts';
import { QuestionType, Category, TargetGender, TargetLanguage, Cadence } from '@mhm/shared';
import { adminApi, ApiRequestError } from '../lib/apiClient';
import {
  Button, Card, Badge, Modal, Input, Select, Textarea,
  Spinner, ErrorMsg, EmptyState, Table, Th, Td, SectionHeading,
} from '../components/ui';
import { questionTypeLabels, categoryLabels, cadenceLabels } from '../lib/labels';

// ─── Survey selector ──────────────────────────────────────────────────────────
interface SurveyOption {
  id: string;
  titleHe: string;
  cadence: Cadence;
}

// ─── Option editor for SINGLE_CHOICE ─────────────────────────────────────────
// Each option row carries a stable numeric _rowId so React keys stay stable
// across deletions (avoids controlled-input corruption when keying by index).
type OptionRow = ChoiceOptionDto & { _rowId: number };

function OptionsEditor({
  options,
  onChange,
}: {
  options: OptionRow[];
  onChange: (opts: OptionRow[]) => void;
}) {
  const nextId = useRef(options.reduce((max, o) => Math.max(max, o._rowId), 0) + 1);

  const addOption = () => {
    const id = nextId.current++;
    onChange([...options, { _rowId: id, key: `opt${options.length + 1}`, labelHe: '', labelEn: '' }]);
  };

  const removeOption = (rowId: number) => {
    onChange(options.filter((o) => o._rowId !== rowId));
  };

  const updateOption = (rowId: number, field: keyof ChoiceOptionDto, value: string) => {
    onChange(options.map((o) => (o._rowId === rowId ? { ...o, [field]: value } : o)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-brand-900">אפשרויות בחירה</label>
        <Button type="button" size="sm" variant="secondary" onClick={addOption}>
          + הוסף
        </Button>
      </div>
      {options.map((opt) => (
        <div key={opt._rowId} className="grid grid-cols-3 gap-2 items-end">
          <Input
            placeholder="מפתח"
            value={opt.key}
            onChange={(e) => updateOption(opt._rowId, 'key', e.target.value)}
          />
          <Input
            placeholder="עברית"
            value={opt.labelHe}
            onChange={(e) => updateOption(opt._rowId, 'labelHe', e.target.value)}
          />
          <div className="flex gap-2">
            <Input
              placeholder="English"
              value={opt.labelEn}
              onChange={(e) => updateOption(opt._rowId, 'labelEn', e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              size="sm"
              variant="danger"
              onClick={() => removeOption(opt._rowId)}
              className="flex-shrink-0"
            >
              ✕
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Image uploader ──────────────────────────────────────────────────────────
function ImageUploader({
  imageUrl,
  onChange,
}: {
  imageUrl: string;
  onChange: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleFile = async (file: File) => {
    setUploading(true);
    setUploadError('');
    try {
      const res = await adminApi.uploadImage(file);
      onChange(res.url);
    } catch (err) {
      setUploadError(err instanceof ApiRequestError ? err.message : 'שגיאה בהעלאה');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-brand-900">תמונה</label>
      <div className="flex gap-3 items-start">
        <div className="flex-1 space-y-2">
          <Input
            placeholder="URL תמונה (או העלה קובץ)"
            value={imageUrl}
            onChange={(e) => onChange(e.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={uploading}
            onClick={() => fileRef.current?.click()}
          >
            העלה קובץ
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          {uploadError && <ErrorMsg message={uploadError} />}
        </div>
        {imageUrl && (
          <div className="w-24 h-24 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0 bg-gray-50">
            <img src={imageUrl} alt="תצוגה מקדימה" className="w-full h-full object-cover" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create Question Modal ────────────────────────────────────────────────────
interface CreateQuestionModalProps {
  open: boolean;
  onClose: () => void;
  surveys: SurveyOption[];
  defaultSurveyId?: string;
}

type FormState = {
  surveyId: string;
  textHe: string;
  textEn: string;
  type: QuestionType;
  category: Category;
  scaleMin: string;
  scaleMax: string;
  options: OptionRow[];
  imageUrl: string;
  expiresAfterCycles: string;
  targetingAgeMin: string;
  targetingAgeMax: string;
  targetingGender: TargetGender | '';
  targetingRegions: string;
  targetingLanguage: TargetLanguage | '';
  targetingMinTrustScore: string;
};

const defaultForm = (surveyId = ''): FormState => ({
  surveyId,
  textHe: '',
  textEn: '',
  type: QuestionType.YES_NO,
  category: Category.GENERAL,
  scaleMin: '1',
  scaleMax: '10',
  options: [
    { _rowId: 1, key: 'opt1', labelHe: '', labelEn: '' },
    { _rowId: 2, key: 'opt2', labelHe: '', labelEn: '' },
  ],
  imageUrl: '',
  expiresAfterCycles: '',
  targetingAgeMin: '',
  targetingAgeMax: '',
  targetingGender: '',
  targetingRegions: '',
  targetingLanguage: '',
  targetingMinTrustScore: '',
});

function CreateQuestionModal({ open, onClose, surveys, defaultSurveyId }: CreateQuestionModalProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(() => defaultForm(defaultSurveyId));
  const [error, setError] = useState('');

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value })), []);

  const mutation = useMutation({
    mutationFn: (body: CreateQuestionRequest) => adminApi.createQuestion(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions'] });
      qc.invalidateQueries({ queryKey: ['surveys'] });
      setForm(defaultForm(defaultSurveyId));
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiRequestError ? err.message : 'שגיאה ביצירת שאלה');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // ── Client-side validation ────────────────────────────────────────────────
    if (form.type === QuestionType.SCALE) {
      const min = parseInt(form.scaleMin, 10);
      const max = parseInt(form.scaleMax, 10);
      if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
        setError('ערך מינימלי חייב להיות קטן מערך מקסימלי בסקאלה');
        return;
      }
    }

    if (form.type === QuestionType.SINGLE_CHOICE) {
      if (form.options.length < 2) {
        setError('נדרשות לפחות שתי אפשרויות בחירה');
        return;
      }
      const hasEmpty = form.options.some(
        (o) => !o.key.trim() || !o.labelHe.trim() || !o.labelEn.trim(),
      );
      if (hasEmpty) {
        setError('כל אפשרות חייבת לכלול מפתח, תווית בעברית ותווית באנגלית');
        return;
      }
    }

    if (form.targetingAgeMin && form.targetingAgeMax) {
      const ageMin = parseInt(form.targetingAgeMin, 10);
      const ageMax = parseInt(form.targetingAgeMax, 10);
      if (Number.isFinite(ageMin) && Number.isFinite(ageMax) && ageMin > ageMax) {
        setError('גיל מינימלי חייב להיות קטן או שווה לגיל מקסימלי');
        return;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const body: CreateQuestionRequest = {
      surveyId: form.surveyId,
      textHe: form.textHe,
      textEn: form.textEn,
      type: form.type,
      category: form.category,
    };

    if (form.type === QuestionType.SCALE) {
      body.scaleMin = parseInt(form.scaleMin, 10);
      body.scaleMax = parseInt(form.scaleMax, 10);
    }

    if (form.type === QuestionType.SINGLE_CHOICE) {
      // Strip internal _rowId before sending to the API.
      body.options = form.options.map(({ _rowId: _id, ...opt }) => opt);
    }

    if (form.type === QuestionType.TEXT_IMAGE && form.imageUrl) {
      body.imageUrl = form.imageUrl;
    }

    if (form.expiresAfterCycles) {
      body.expiresAfterCycles = parseInt(form.expiresAfterCycles, 10);
    }

    // Targeting
    const hasTargeting =
      form.targetingAgeMin ||
      form.targetingAgeMax ||
      form.targetingGender ||
      form.targetingRegions ||
      form.targetingLanguage ||
      form.targetingMinTrustScore;

    if (hasTargeting) {
      body.targeting = {};
      if (form.targetingAgeMin) body.targeting.ageMin = parseInt(form.targetingAgeMin, 10);
      if (form.targetingAgeMax) body.targeting.ageMax = parseInt(form.targetingAgeMax, 10);
      if (form.targetingGender) body.targeting.gender = form.targetingGender as TargetGender;
      if (form.targetingRegions) body.targeting.regions = form.targetingRegions.split(',').map((r) => r.trim()).filter(Boolean);
      if (form.targetingLanguage) body.targeting.language = form.targetingLanguage as TargetLanguage;
      if (form.targetingMinTrustScore) body.targeting.minTrustScore = parseFloat(form.targetingMinTrustScore);
    }

    mutation.mutate(body);
  };

  return (
    <Modal open={open} onClose={onClose} title="שאלה חדשה" wide>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Survey */}
        <Select
          id="qSurvey"
          label="סקר"
          value={form.surveyId}
          onChange={(e) => set('surveyId', e.target.value)}
          required
        >
          <option value="">בחר סקר...</option>
          {surveys.map((s) => (
            <option key={s.id} value={s.id}>
              {s.titleHe} ({cadenceLabels[s.cadence]})
            </option>
          ))}
        </Select>

        {/* Type + Category */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            id="qType"
            label="סוג שאלה"
            value={form.type}
            onChange={(e) => set('type', e.target.value as QuestionType)}
          >
            {Object.values(QuestionType).map((t) => (
              <option key={t} value={t}>{questionTypeLabels[t]}</option>
            ))}
          </Select>
          <Select
            id="qCategory"
            label="קטגוריה"
            value={form.category}
            onChange={(e) => set('category', e.target.value as Category)}
          >
            {Object.values(Category).map((c) => (
              <option key={c} value={c}>{categoryLabels[c]}</option>
            ))}
          </Select>
        </div>

        {/* Texts */}
        <Textarea
          id="qTextHe"
          label="טקסט בעברית"
          value={form.textHe}
          onChange={(e) => set('textHe', e.target.value)}
          required
          rows={2}
          placeholder="טקסט השאלה בעברית"
        />
        <Textarea
          id="qTextEn"
          label="טקסט באנגלית"
          value={form.textEn}
          onChange={(e) => set('textEn', e.target.value)}
          required
          rows={2}
          placeholder="Question text in English"
        />

        {/* Scale */}
        {form.type === QuestionType.SCALE && (
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="scaleMin"
              label="ערך מינימלי"
              type="number"
              value={form.scaleMin}
              onChange={(e) => set('scaleMin', e.target.value)}
              required
            />
            <Input
              id="scaleMax"
              label="ערך מקסימלי"
              type="number"
              value={form.scaleMax}
              onChange={(e) => set('scaleMax', e.target.value)}
              required
            />
          </div>
        )}

        {/* Single choice options */}
        {form.type === QuestionType.SINGLE_CHOICE && (
          <OptionsEditor
            options={form.options}
            onChange={(opts) => set('options', opts)}
          />
        )}

        {/* Image (TEXT_IMAGE) */}
        {form.type === QuestionType.TEXT_IMAGE && (
          <ImageUploader
            imageUrl={form.imageUrl}
            onChange={(url) => set('imageUrl', url)}
          />
        )}

        {/* Expires */}
        <Input
          id="expires"
          label="פג תוקף אחרי N מחזורים (אופציונלי)"
          type="number"
          value={form.expiresAfterCycles}
          onChange={(e) => set('expiresAfterCycles', e.target.value)}
          placeholder="ריק = ללא פג תוקף"
          min={1}
        />

        {/* Targeting */}
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-4">
          <p className="text-sm font-semibold text-brand-900">טירגוט (אופציונלי)</p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="גיל מינימלי"
              type="number"
              value={form.targetingAgeMin}
              onChange={(e) => set('targetingAgeMin', e.target.value)}
              placeholder="כל גיל"
              min={0}
              max={120}
            />
            <Input
              label="גיל מקסימלי"
              type="number"
              value={form.targetingAgeMax}
              onChange={(e) => set('targetingAgeMax', e.target.value)}
              placeholder="כל גיל"
              min={0}
              max={120}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="מגדר"
              value={form.targetingGender}
              onChange={(e) => set('targetingGender', e.target.value as TargetGender | '')}
            >
              <option value="">ללא הגבלה</option>
              <option value={TargetGender.MALE}>זכר</option>
              <option value={TargetGender.FEMALE}>נקבה</option>
              <option value={TargetGender.ALL}>כולם</option>
            </Select>
            <Select
              label="שפה"
              value={form.targetingLanguage}
              onChange={(e) => set('targetingLanguage', e.target.value as TargetLanguage | '')}
            >
              <option value="">ללא הגבלה</option>
              <option value={TargetLanguage.HE}>עברית</option>
              <option value={TargetLanguage.EN}>English</option>
              <option value={TargetLanguage.ALL}>כולם</option>
            </Select>
          </div>
          <Input
            label="אזורים (מופרדים בפסיק)"
            value={form.targetingRegions}
            onChange={(e) => set('targetingRegions', e.target.value)}
            placeholder='למשל: "תל אביב, ירושלים"'
          />
          <Input
            label="ניקוד אמון מינימלי (0–1)"
            type="number"
            value={form.targetingMinTrustScore}
            onChange={(e) => set('targetingMinTrustScore', e.target.value)}
            placeholder="0.4"
            min={0}
            max={1}
            step={0.1}
          />
        </div>

        {error && <ErrorMsg message={error} />}

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={mutation.isPending} className="flex-1 justify-center">
            צור שאלה
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1 justify-center">
            ביטול
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Question row ─────────────────────────────────────────────────────────────
function QuestionRow({ q }: { q: AdminQuestionDto }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded((x) => !x)}>
        <Td>
          <span className="font-medium line-clamp-2">{q.textHe}</span>
        </Td>
        <Td>
          <Badge color="blue">{questionTypeLabels[q.type]}</Badge>
        </Td>
        <Td>
          <Badge color="gray">{categoryLabels[q.category]}</Badge>
        </Td>
        <Td>
          <Badge color={q.active ? 'green' : 'gray'}>{q.active ? 'פעיל' : 'לא פעיל'}</Badge>
        </Td>
        <Td>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </Td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="bg-blue-50/30 px-4 py-3 border-t border-blue-100 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-500">טקסט EN:</span>{' '}
                <span>{q.textEn}</span>
              </div>
              {q.type === QuestionType.SCALE && (
                <div>
                  <span className="text-gray-500">סקאלה:</span>{' '}
                  <span>{q.scaleMin} – {q.scaleMax}</span>
                </div>
              )}
              {q.expiresAfterCycles && (
                <div>
                  <span className="text-gray-500">פג תוקף אחרי:</span>{' '}
                  <span>{q.expiresAfterCycles} מחזורים</span>
                </div>
              )}
              {q.targeting && Object.keys(q.targeting).length > 0 && (
                <div className="col-span-2">
                  <span className="text-gray-500">טירגוט:</span>{' '}
                  <span className="font-mono text-xs bg-gray-100 rounded px-2 py-0.5">
                    {JSON.stringify(q.targeting)}
                  </span>
                </div>
              )}
              {q.imageUrl && (
                <div className="col-span-2">
                  <span className="text-gray-500">תמונה:</span>{' '}
                  <img src={q.imageUrl} alt="שאלה" className="inline-block w-20 h-20 object-cover rounded ml-2 mt-1" />
                </div>
              )}
              {q.options && q.options.length > 0 && (
                <div className="col-span-2">
                  <span className="text-gray-500">אפשרויות:</span>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    {q.options.map((opt) => (
                      <li key={opt.key}>
                        <span className="font-mono text-xs">{opt.key}</span>: {opt.labelHe} / {opt.labelEn}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Questions Page ──────────────────────────────────────────────────────
export function QuestionsPage() {
  const [selectedSurveyId, setSelectedSurveyId] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data: surveys } = useQuery({
    queryKey: ['surveys'],
    queryFn: adminApi.listSurveys,
  });

  const { data: questions, isLoading, error } = useQuery({
    queryKey: ['questions', selectedSurveyId],
    queryFn: () => adminApi.listQuestions(selectedSurveyId || undefined),
  });

  const surveyOptions: SurveyOption[] = (surveys ?? []).map((s) => ({
    id: s.id,
    titleHe: s.titleHe,
    cadence: s.cadence,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">שאלות</h1>
          <p className="text-sm text-gray-400 mt-0.5">ניהול שאלות הסקר</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ שאלה חדשה</Button>
      </div>

      {/* Filter */}
      <Card>
        <div className="flex items-center gap-4">
          <Select
            id="filterSurvey"
            label="סנן לפי סקר"
            value={selectedSurveyId}
            onChange={(e) => setSelectedSurveyId(e.target.value)}
            className="w-64"
          >
            <option value="">כל הסקרים</option>
            {surveyOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.titleHe}</option>
            ))}
          </Select>
          {selectedSurveyId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedSurveyId('')}
              className="mt-5"
            >
              נקה
            </Button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card className="p-0">
        <SectionHeading
          title={`שאלות${questions ? ` (${questions.length})` : ''}`}
          action={null}
        />
        {isLoading ? (
          <Spinner />
        ) : error ? (
          <ErrorMsg message="שגיאה בטעינת שאלות" />
        ) : !questions?.length ? (
          <EmptyState message="אין שאלות עדיין" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>טקסט</Th>
                <Th>סוג</Th>
                <Th>קטגוריה</Th>
                <Th>מצב</Th>
                <Th>{' '}</Th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <QuestionRow key={q.id} q={q} />
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <CreateQuestionModal
        key={showCreate ? 'create-open' : selectedSurveyId}
        open={showCreate}
        onClose={() => setShowCreate(false)}
        surveys={surveyOptions}
        defaultSurveyId={selectedSurveyId}
      />
    </div>
  );
}

