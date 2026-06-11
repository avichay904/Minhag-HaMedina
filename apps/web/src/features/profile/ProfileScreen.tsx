import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { api, ApiRequestError } from '../../lib/apiClient';
import { useAuth } from '../auth/useAuth';
import { WelcomeScreen } from '../auth/WelcomeScreen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { RankChip } from '../../components/ui/RankChip';
import { BadgePill } from '../../components/ui/BadgePill';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { FullPageSpinner } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import { Category, Gender, Language, ALL_CATEGORIES } from '@mhm/shared';

export function ProfileScreen() {
  const { t } = useTranslation();
  const { token, profile, isLoading, refreshProfile, logout } = useAuth();
  const { showToast } = useToast();

  const [nickname, setNickname] = useState('');
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState<Language>('HE');
  const [preferredCategories, setPreferredCategories] = useState<Category[]>([]);
  const [gender, setGender] = useState<Gender | ''>('');
  const [birthYear, setBirthYear] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync form from profile
  useEffect(() => {
    if (!profile) return;
    setNickname(profile.nickname ?? '');
    setShowLeaderboard(profile.showInLeaderboard);
    setPreferredLanguage(profile.preferredLanguage as Language);
    setPreferredCategories(profile.preferredCategories as Category[]);
    setGender((profile.demographics?.gender as Gender | undefined) ?? '');
    setBirthYear(profile.demographics?.birthYear?.toString() ?? '');
  }, [profile]);

  if (!token) return <WelcomeScreen />;
  if (isLoading || !profile) return <FullPageSpinner label={t('profile.loading')} />;

  function validateNickname(v: string): boolean {
    if (!v) return true; // empty = clear nickname
    const valid = /^[A-Za-z0-9_]{3,20}$/.test(v);
    if (!valid) {
      setNicknameError(t('profile.nickname_rules'));
      return false;
    }
    setNicknameError(null);
    return true;
  }

  async function handleSave() {
    if (!validateNickname(nickname)) return;
    setSaving(true);
    try {
      await api.updateProfile({
        nickname: nickname || null,
        showInLeaderboard: showLeaderboard,
        preferredLanguage: preferredLanguage as Language,
        preferredCategories: preferredCategories as Category[],
        demographics: {
          gender: gender || undefined,
          birthYear: birthYear ? parseInt(birthYear, 10) : undefined,
        },
      });
      await refreshProfile();
      showToast(t('profile.saved'), 'success');
    } catch (err) {
      if (err instanceof ApiRequestError && err.statusCode === 409) {
        setNicknameError(t('profile.nickname_taken'));
      } else {
        showToast(t('profile.save_error'), 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  function toggleCategory(cat: Category) {
    setPreferredCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }

  const rankProgress = profile.rankProgress;
  const progressToNext = rankProgress.next
    ? rankProgress.surveysToNext != null && rankProgress.surveysToNext > 0
      ? Math.max(
          0,
          100 - (rankProgress.surveysToNext / (rankProgress.surveysToNext + profile.surveysCompleted)) * 100,
        )
      : 100
    : 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 py-6 flex flex-col gap-6"
    >
      <h1 className="text-2xl font-extrabold text-brand-900">{t('profile.title')}</h1>

      {/* Stats card */}
      <Card variant="elevated" padding="lg">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-2xl font-extrabold text-brand-900">{profile.displayName}</p>
            <RankChip rank={profile.rank} className="mt-1" />
          </div>
          <div className="text-end">
            <p className="text-3xl font-extrabold text-brand-600">{profile.points.toLocaleString()}</p>
            <p className="text-xs text-brand-400">{t('profile.points')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-brand-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-brand-700">{profile.surveysCompleted}</p>
            <p className="text-xs text-brand-400">{t('profile.surveys_completed')}</p>
          </div>
          <div className="bg-brand-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-brand-700">
              {Math.round(profile.trustScore * 100)}%
            </p>
            <p className="text-xs text-brand-400">{t('profile.trust_score')}</p>
          </div>
        </div>

        {/* Rank progress */}
        {rankProgress.next ? (
          <div>
            <div className="flex justify-between text-xs text-brand-400 mb-1">
              <span>{t('profile.rank')}: {t(`ranks.${rankProgress.current}`)}</span>
              <span>{t(`ranks.${rankProgress.next}`)}</span>
            </div>
            <ProgressBar value={progressToNext} color="brand" />
            {rankProgress.trustBlockedNext && (
              <p className="text-xs text-amber-600 mt-1">{t('profile.trust_blocked')}</p>
            )}
            {!rankProgress.trustBlockedNext && rankProgress.surveysToNext != null && (
              <p className="text-xs text-brand-400 mt-1">
                {t('profile.rank_progress', { surveys: rankProgress.surveysToNext })}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-amber-600 font-semibold">{t('profile.max_rank')}</p>
        )}
      </Card>

      {/* Badges */}
      <Card variant="default" padding="md">
        <h2 className="font-bold text-brand-900 mb-3">{t('profile.badges')}</h2>
        {profile.badges.length === 0 ? (
          <p className="text-sm text-brand-400">{t('profile.no_badges')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {profile.badges.map((b) => (
              <BadgePill key={b} badge={b} />
            ))}
          </div>
        )}
      </Card>

      {/* Nickname */}
      <Card variant="default" padding="md">
        <h2 className="font-bold text-brand-900 mb-3">{t('profile.nickname')}</h2>
        <div className="flex flex-col gap-1.5">
          <input
            type="text"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              if (nicknameError) validateNickname(e.target.value);
            }}
            placeholder={t('profile.nickname_placeholder')}
            maxLength={20}
            className="w-full border-2 border-brand-100 rounded-xl px-4 py-2.5 text-brand-900 placeholder-brand-300 focus:outline-none focus:border-brand-400 transition-colors"
          />
          {nicknameError && (
            <p className="text-xs text-red-500">{nicknameError}</p>
          )}
          <p className="text-xs text-brand-400">{t('profile.nickname_once_month')}</p>
        </div>
      </Card>

      {/* Preferences */}
      <Card variant="default" padding="md">
        <h2 className="font-bold text-brand-900 mb-4">{t('profile.language')}</h2>
        <div className="flex gap-2">
          {(['HE', 'EN'] as Language[]).map((l) => (
            <button
              key={l}
              onClick={() => setPreferredLanguage(l)}
              className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-all ${
                preferredLanguage === l
                  ? 'bg-brand-600 text-white'
                  : 'bg-brand-50 text-brand-600 hover:bg-brand-100'
              }`}
            >
              {t(`language.${l}`)}
            </button>
          ))}
        </div>
      </Card>

      {/* Categories */}
      <Card variant="default" padding="md">
        <h2 className="font-bold text-brand-900 mb-3">{t('profile.categories')}</h2>
        <div className="flex flex-wrap gap-2">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat as Category)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                preferredCategories.includes(cat as Category)
                  ? 'bg-brand-600 text-white'
                  : 'bg-brand-50 text-brand-600 hover:bg-brand-100'
              }`}
            >
              {t(`categories.${cat}`)}
            </button>
          ))}
        </div>
      </Card>

      {/* Demographics */}
      <Card variant="default" padding="md">
        <h2 className="font-bold text-brand-900 mb-4">{t('profile.demographics')}</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-sm font-medium text-brand-600 mb-1 block">{t('profile.gender')}</label>
            <div className="flex gap-2">
              {(['MALE', 'FEMALE', 'OTHER'] as Gender[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                    gender === g
                      ? 'bg-brand-600 text-white'
                      : 'bg-brand-50 text-brand-600 hover:bg-brand-100'
                  }`}
                >
                  {t(`gender.${g}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-brand-600 mb-1 block">{t('profile.birth_year')}</label>
            <input
              type="number"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              placeholder="1990"
              min={1920}
              max={new Date().getFullYear()}
              className="w-full border-2 border-brand-100 rounded-xl px-4 py-2.5 text-brand-900 placeholder-brand-300 focus:outline-none focus:border-brand-400 transition-colors"
            />
          </div>
        </div>
      </Card>

      {/* Leaderboard toggle */}
      <Card variant="default" padding="md">
        <label className="flex items-center justify-between cursor-pointer gap-4">
          <span className="text-sm font-medium text-brand-800">{t('profile.show_leaderboard')}</span>
          <button
            role="switch"
            aria-checked={showLeaderboard}
            onClick={() => setShowLeaderboard((v) => !v)}
            className={`relative inline-flex h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              showLeaderboard ? 'bg-brand-600' : 'bg-brand-200'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 bg-white rounded-full shadow transition-all duration-200 ${
                showLeaderboard ? 'start-[22px]' : 'start-0.5'
              }`}
            />
          </button>
        </label>
      </Card>

      {/* Save + logout */}
      <div className="flex flex-col gap-3">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={saving}
          onClick={handleSave}
        >
          {t('profile.save')}
        </Button>
        <Button variant="ghost" size="sm" fullWidth onClick={logout}>
          התנתק
        </Button>
      </div>
    </motion.div>
  );
}
