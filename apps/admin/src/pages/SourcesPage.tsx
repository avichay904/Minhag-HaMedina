import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SourceDto, CreateSourceRequest, UpdateSourceRequest, CreateSourceResponse } from '@mhm/contracts';
import { adminApi, ApiRequestError } from '../lib/apiClient';
import {
  Button, Card, Badge, Modal, Input, Checkbox,
  Spinner, ErrorMsg, EmptyState, Table, Th, Td, SectionHeading,
} from '../components/ui';
import { fmtDate } from '../lib/labels';

// ─── New API Key Banner ───────────────────────────────────────────────────────
function ApiKeyBanner({ apiKey, onDismiss }: { apiKey: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  const copyKey = async () => {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl bg-amber-50 border-2 border-amber-400 p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-amber-900 text-base">מפתח API חדש נוצר</h3>
          <p className="text-amber-700 text-sm mt-0.5">
            שמור את המפתח הזה עכשיו — הוא לא יוצג שוב.
          </p>
        </div>
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-amber-200 text-amber-800">
          פעם אחת בלבד!
        </span>
      </div>
      <div className="flex gap-3 items-center">
        <code className="flex-1 bg-white border border-amber-200 rounded-lg px-3 py-2.5 text-sm font-mono text-amber-900 break-all">
          {apiKey}
        </code>
        <Button
          size="sm"
          variant={copied ? 'secondary' : 'primary'}
          onClick={copyKey}
          className="flex-shrink-0"
        >
          {copied ? '✓ הועתק' : 'העתק'}
        </Button>
      </div>
      <Button size="sm" variant="ghost" onClick={onDismiss} className="text-amber-700">
        הבנתי, סגור
      </Button>
    </div>
  );
}

// ─── Create Source Modal ──────────────────────────────────────────────────────
interface CreateSourceModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (res: CreateSourceResponse) => void;
}

type CreateFormState = {
  name: string;
  trustScoreMin: string;
  trustScoreMax: string;
  canRegisterUsers: boolean;
  canReadResults: boolean;
  active: boolean;
  ownRespondentsOnly: boolean;
};

function CreateSourceModal({ open, onClose, onCreated }: CreateSourceModalProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CreateFormState>({
    name: '',
    trustScoreMin: '0.4',
    trustScoreMax: '1.0',
    canRegisterUsers: false,
    canReadResults: false,
    active: true,
    ownRespondentsOnly: true,
  });
  const [error, setError] = useState('');

  const set = <K extends keyof CreateFormState>(key: K, value: CreateFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const mutation = useMutation({
    mutationFn: (body: CreateSourceRequest) => adminApi.createSource(body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['sources'] });
      onCreated(res);
      setForm({
        name: '',
        trustScoreMin: '0.4',
        trustScoreMax: '1.0',
        canRegisterUsers: false,
        canReadResults: false,
        active: true,
        ownRespondentsOnly: true,
      });
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiRequestError ? err.message : 'שגיאה ביצירת מקור');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const body: CreateSourceRequest = {
      name: form.name,
      trustScoreMin: parseFloat(form.trustScoreMin),
      trustScoreMax: parseFloat(form.trustScoreMax),
      canRegisterUsers: form.canRegisterUsers,
      canReadResults: form.canReadResults,
      active: form.active,
    };
    if (form.canReadResults) {
      body.resultsScope = {
        ownRespondentsOnly: form.ownRespondentsOnly,
        categories: [],
      };
    }
    mutation.mutate(body);
  };

  return (
    <Modal open={open} onClose={onClose} title="מקור חדש">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="srcName"
          label="שם המקור"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          required
          placeholder="שם ייחודי לזיהוי המקור"
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="ניקוד אמון מינימלי"
            type="number"
            value={form.trustScoreMin}
            onChange={(e) => set('trustScoreMin', e.target.value)}
            min={0}
            max={1}
            step={0.1}
          />
          <Input
            label="ניקוד אמון מקסימלי"
            type="number"
            value={form.trustScoreMax}
            onChange={(e) => set('trustScoreMax', e.target.value)}
            min={0}
            max={1}
            step={0.1}
          />
        </div>
        <div className="space-y-2">
          <Checkbox
            id="canReg"
            label="יכול לרשום משתמשים"
            checked={form.canRegisterUsers}
            onChange={(v) => set('canRegisterUsers', v)}
          />
          <Checkbox
            id="canRead"
            label="יכול לקרוא תוצאות"
            checked={form.canReadResults}
            onChange={(v) => set('canReadResults', v)}
          />
          {form.canReadResults && (
            <div className="mr-6">
              <Checkbox
                id="ownOnly"
                label="תוצאות המשתתפים שלו בלבד"
                checked={form.ownRespondentsOnly}
                onChange={(v) => set('ownRespondentsOnly', v)}
              />
            </div>
          )}
          <Checkbox
            id="srcActive"
            label="פעיל"
            checked={form.active}
            onChange={(v) => set('active', v)}
          />
        </div>
        {error && <ErrorMsg message={error} />}
        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={mutation.isPending} className="flex-1 justify-center">
            צור מקור
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1 justify-center">
            ביטול
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit Source Modal ────────────────────────────────────────────────────────
interface EditSourceModalProps {
  source: SourceDto | null;
  onClose: () => void;
}

function EditSourceModal({ source, onClose }: EditSourceModalProps) {
  const qc = useQueryClient();
  const [name, setName] = useState(source?.name ?? '');
  const [active, setActive] = useState(source?.active ?? true);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (body: UpdateSourceRequest) => adminApi.updateSource(source!.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sources'] });
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiRequestError ? err.message : 'שגיאה בעדכון מקור');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    mutation.mutate({ name, active });
  };

  if (!source) return null;

  return (
    <Modal open={!!source} onClose={onClose} title={`עריכת מקור: ${source.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="editName"
          label="שם המקור"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Checkbox
          id="editActive"
          label="פעיל"
          checked={active}
          onChange={setActive}
        />
        {error && <ErrorMsg message={error} />}
        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={mutation.isPending} className="flex-1 justify-center">
            שמור
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1 justify-center">
            ביטול
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Main Sources Page ────────────────────────────────────────────────────────
export function SourcesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editSource, setEditSource] = useState<SourceDto | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  const { data: sources, isLoading, error } = useQuery({
    queryKey: ['sources'],
    queryFn: adminApi.listSources,
  });

  const handleCreated = (res: CreateSourceResponse) => {
    setNewApiKey(res.apiKey);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">מקורות</h1>
          <p className="text-sm text-gray-400 mt-0.5">רישום מקורות חיצוניים וניהול הרשאות</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ מקור חדש</Button>
      </div>

      {/* API Key banner */}
      {newApiKey && (
        <ApiKeyBanner apiKey={newApiKey} onDismiss={() => setNewApiKey(null)} />
      )}

      {/* Table */}
      <Card className="p-0">
        <SectionHeading title="מקורות רשומים" />
        {isLoading ? (
          <Spinner />
        ) : error ? (
          <ErrorMsg message="שגיאה בטעינת מקורות" />
        ) : !sources?.length ? (
          <EmptyState message="אין מקורות רשומים עדיין" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>שם</Th>
                <Th>ניקוד אמון</Th>
                <Th>הרשאות</Th>
                <Th>נוצר</Th>
                <Th>מצב</Th>
                <Th>פעולות</Th>
              </tr>
            </thead>
            <tbody>
              {sources.map((src) => (
                <tr key={src.id} className="hover:bg-gray-50">
                  <Td>
                    <span className="font-medium">{src.name}</span>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs">
                      {src.trustScoreMin} – {src.trustScoreMax}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex gap-1.5">
                      {src.canRegisterUsers && (
                        <Badge color="blue">רישום</Badge>
                      )}
                      {src.canReadResults && (
                        <Badge color="purple">תוצאות</Badge>
                      )}
                      {!src.canRegisterUsers && !src.canReadResults && (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </div>
                  </Td>
                  <Td>{fmtDate(src.createdAt)}</Td>
                  <Td>
                    <Badge color={src.active ? 'green' : 'gray'}>
                      {src.active ? 'פעיל' : 'לא פעיל'}
                    </Badge>
                  </Td>
                  <Td>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditSource(src)}
                    >
                      עריכה
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <CreateSourceModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
      />
      <EditSourceModal key={editSource?.id} source={editSource} onClose={() => setEditSource(null)} />
    </div>
  );
}
