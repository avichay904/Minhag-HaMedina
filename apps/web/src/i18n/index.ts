import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import he from './locales/he.json';
import en from './locales/en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      he: { translation: he },
      en: { translation: en },
    },
    fallbackLng: 'he',
    defaultNS: 'translation',
    lng: 'he',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

// Set document dir/lang on language change
i18n.on('languageChanged', (lng: string) => {
  const isHe = lng === 'he';
  document.documentElement.lang = lng;
  document.documentElement.dir = isHe ? 'rtl' : 'ltr';
});

// Apply initial direction
const initialLang = i18n.language ?? 'he';
document.documentElement.lang = initialLang;
document.documentElement.dir = initialLang === 'he' ? 'rtl' : 'ltr';

export default i18n;
