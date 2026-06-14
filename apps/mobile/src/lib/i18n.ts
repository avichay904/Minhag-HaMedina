import { createContext, useContext, useState } from 'react';

export type Lang = 'he' | 'en';

export const strings = {
  he: {
    // Welcome
    welcomeTitle: 'מנהג המדינה',
    welcomeSubtitle: 'פלטפורמת סקרי דעת קהל',
    continueAsGuest: 'המשך כאורח',
    loginWithGoogle: 'כניסה עם גוגל (פיתוח)',
    loggingIn: 'מתחבר...',

    // Tabs
    survey: 'סקר',
    leaderboard: 'דירוג',
    profile: 'פרופיל',

    // Survey
    loading: 'טוען...',
    noSurveys: 'אין סקרים פעילים כרגע',
    skip: 'דלג',
    next: 'הבא',
    surveyComplete: 'כל הכבוד!',
    surveyCompleteSubtitle: 'סיימת את כל השאלות',
    pointsEarned: 'נקודות שנצברו',
    questionsAnswered: 'שאלות שענית',
    newBadges: 'תגים חדשים',
    backToSurveys: 'חזור לסקרים',
    yes: 'כן',
    no: 'לא',

    // Profile
    rank: 'דרגה',
    points: 'נקודות',
    trustScore: 'ציון אמינות',
    surveysCompleted: 'סקרים שהושלמו',
    badges: 'תגים',
    logout: 'התנתק',
    noBadges: 'אין תגים עדיין',
    nextRank: 'דרגה הבאה',
    surveysToNext: 'סקרים לדרגה הבאה',

    // Leaderboard
    leaderboardTitle: 'לוח המובילים',
    position: 'מקום',
    displayName: 'שם',
    noData: 'אין נתונים',

    // Ranks
    GUEST: 'אורח',
    BEGINNER: 'מתחיל',
    CONTRIBUTOR: 'תורם',
    VETERAN: 'ותיק',
    AMBASSADOR: 'שגריר',

    // Badges
    STREAK: 'רצף',
    FAST: 'מהיר',
    DIVERSE: 'מגוון',
    CHALLENGE: 'אתגר',
    CHALLENGE_OF_WEEK: 'אתגר השבוע',
    ALMOST: 'כמעט',

    // Categories
    SOCIETY_POLITICS: 'חברה ופוליטיקה',
    CONSUMER: 'צרכנות',
    HEALTH_LIFESTYLE: 'בריאות ואורח חיים',
    TECHNOLOGY: 'טכנולוגיה',
    PERSONAL_FINANCE: 'כלכלה אישית',
    GENERAL: 'כללי',

    // Community stats
    answeredToday: 'ענו היום',
    topPercentToday: 'אתה בין',
    topPercentTodaySuffix: '% שענו היום',

    // Errors
    errorGeneric: 'שגיאה. נסה שנית.',
    retry: 'נסה שנית',
  },
  en: {
    // Welcome
    welcomeTitle: 'Minhag HaMedina',
    welcomeSubtitle: 'Public Opinion Survey Platform',
    continueAsGuest: 'Continue as Guest',
    loginWithGoogle: 'Sign in with Google (Dev)',
    loggingIn: 'Signing in...',

    // Tabs
    survey: 'Survey',
    leaderboard: 'Leaderboard',
    profile: 'Profile',

    // Survey
    loading: 'Loading...',
    noSurveys: 'No active surveys right now',
    skip: 'Skip',
    next: 'Next',
    surveyComplete: 'Well done!',
    surveyCompleteSubtitle: 'You answered all questions',
    pointsEarned: 'Points earned',
    questionsAnswered: 'Questions answered',
    newBadges: 'New badges',
    backToSurveys: 'Back to surveys',
    yes: 'Yes',
    no: 'No',

    // Profile
    rank: 'Rank',
    points: 'Points',
    trustScore: 'Trust Score',
    surveysCompleted: 'Surveys Completed',
    badges: 'Badges',
    logout: 'Logout',
    noBadges: 'No badges yet',
    nextRank: 'Next Rank',
    surveysToNext: 'Surveys to next rank',

    // Leaderboard
    leaderboardTitle: 'Leaderboard',
    position: 'Pos',
    displayName: 'Name',
    noData: 'No data',

    // Ranks
    GUEST: 'Guest',
    BEGINNER: 'Beginner',
    CONTRIBUTOR: 'Contributor',
    VETERAN: 'Veteran',
    AMBASSADOR: 'Ambassador',

    // Badges
    STREAK: 'Streak',
    FAST: 'Fast',
    DIVERSE: 'Diverse',
    CHALLENGE: 'Challenge',
    CHALLENGE_OF_WEEK: 'Week Challenge',
    ALMOST: 'Almost',

    // Categories
    SOCIETY_POLITICS: 'Society & Politics',
    CONSUMER: 'Consumer',
    HEALTH_LIFESTYLE: 'Health & Lifestyle',
    TECHNOLOGY: 'Technology',
    PERSONAL_FINANCE: 'Personal Finance',
    GENERAL: 'General',

    // Community stats
    answeredToday: 'answered today',
    topPercentToday: "You're in the top",
    topPercentTodaySuffix: '% who answered today',

    // Errors
    errorGeneric: 'Error. Please try again.',
    retry: 'Retry',
  },
} as const;

export type StringKey = keyof typeof strings.he;

let _lang: Lang = 'he';

export function t(key: StringKey, lang?: Lang): string {
  const l = lang ?? _lang;
  return strings[l][key] ?? strings.he[key] ?? key;
}

export function setGlobalLang(lang: Lang): void {
  _lang = lang;
}

export function getGlobalLang(): Lang {
  return _lang;
}

// React context for language
import React from 'react';

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: StringKey) => string;
}

export const I18nContext = createContext<I18nContextValue>({
  lang: 'he',
  setLang: () => {},
  t: (key) => strings[_lang][key] ?? strings.he[key] ?? key,
});

export function I18nProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [lang, setLangState] = useState<Lang>('he');

  const setLang = (l: Lang) => {
    setLangState(l);
    setGlobalLang(l);
  };

  const tFn = (key: StringKey) => strings[lang][key] ?? strings.he[key] ?? key;

  return React.createElement(
    I18nContext.Provider,
    { value: { lang, setLang, t: tFn } },
    children,
  );
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
