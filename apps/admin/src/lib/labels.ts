import type { CycleState, Cadence, QuestionType, Category } from '@mhm/shared';

export const cadenceLabels: Record<Cadence, string> = {
  WEEKLY: 'שבועי',
  BIWEEKLY: 'דו-שבועי',
  MONTHLY: 'חודשי',
};

export const cycleStateLabels: Record<CycleState, string> = {
  OPEN: 'פתוח',
  CLOSED: 'סגור',
  APPROVED: 'מאושר',
  PUBLISHED: 'פורסם',
};

export const cycleStateColor: Record<CycleState, 'blue' | 'yellow' | 'purple' | 'green'> = {
  OPEN: 'blue',
  CLOSED: 'yellow',
  APPROVED: 'purple',
  PUBLISHED: 'green',
};

export const questionTypeLabels: Record<QuestionType, string> = {
  YES_NO: 'כן/לא',
  SCALE: 'סקאלה',
  SINGLE_CHOICE: 'בחירה יחידה',
  TEXT_IMAGE: 'טקסט+תמונה',
};

export const categoryLabels: Record<Category, string> = {
  SOCIETY_POLITICS: 'חברה ופוליטיקה',
  CONSUMER: 'צרכנות',
  HEALTH_LIFESTYLE: 'בריאות ואורח חיים',
  TECHNOLOGY: 'טכנולוגיה',
  PERSONAL_FINANCE: 'כלכלה אישית',
  GENERAL: 'כללי',
};

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('he-IL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}
