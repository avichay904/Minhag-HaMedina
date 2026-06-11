import { useTranslation } from 'react-i18next';

export type Dir = 'rtl' | 'ltr';

export function useDirection(): Dir {
  const { i18n } = useTranslation();
  return i18n.language === 'he' ? 'rtl' : 'ltr';
}
