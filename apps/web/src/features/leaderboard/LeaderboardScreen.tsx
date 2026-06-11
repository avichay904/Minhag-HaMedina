import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { api } from '../../lib/apiClient';
import { useAuth } from '../auth/useAuth';
import { FullPageSpinner } from '../../components/ui/Spinner';
import { RankChip } from '../../components/ui/RankChip';
import { BadgePill } from '../../components/ui/BadgePill';
import { Card } from '../../components/ui/Card';
import type { LeaderboardEntry } from '@mhm/contracts';
import { clsx } from 'clsx';

function PositionBadge({ position }: { position: number }) {
  const medals: Record<number, { bg: string; text: string; emoji: string }> = {
    1: { bg: 'bg-amber-400', text: 'text-white', emoji: '🥇' },
    2: { bg: 'bg-gray-300', text: 'text-gray-700', emoji: '🥈' },
    3: { bg: 'bg-orange-300', text: 'text-white', emoji: '🥉' },
  };
  const medal = medals[position];
  if (medal) {
    return (
      <span
        className={clsx(
          'inline-flex items-center justify-center w-9 h-9 rounded-full font-bold text-base',
          medal.bg,
          medal.text,
        )}
      >
        {medal.emoji}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand-50 text-brand-600 font-bold text-sm">
      {position}
    </span>
  );
}

function LeaderboardRow({
  entry,
  isCurrentUser,
  index,
}: {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
  index: number;
}) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 200 }}
      className={clsx(
        'flex items-center gap-3 p-3 rounded-2xl transition-colors',
        isCurrentUser
          ? 'bg-gradient-to-r from-brand-50 to-blue-50 border-2 border-brand-200'
          : 'bg-white hover:bg-brand-50',
      )}
    >
      <PositionBadge position={entry.position} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-brand-900 truncate">{entry.displayName}</span>
          {isCurrentUser && (
            <span className="text-xs bg-brand-600 text-white rounded-full px-2 py-0.5">
              {t('leaderboard.you')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <RankChip rank={entry.rank} size="sm" />
          {entry.badges.slice(0, 2).map((b) => (
            <BadgePill key={b} badge={b} size="sm" />
          ))}
        </div>
      </div>

      <div className="text-end shrink-0">
        <p className="font-extrabold text-brand-600 text-lg">{entry.points.toLocaleString()}</p>
        <p className="text-xs text-brand-400">{entry.surveysCompleted} {t('leaderboard.surveys')}</p>
      </div>
    </motion.div>
  );
}

export function LeaderboardScreen() {
  const { t } = useTranslation();
  const { token, profile } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api.leaderboard(),
    enabled: !!token,
  });

  if (isLoading) return <FullPageSpinner label={t('leaderboard.loading')} />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-8 text-center">
        <span className="text-5xl">😵</span>
        <p className="text-brand-500">{t('errors.generic')}</p>
      </div>
    );
  }

  const entries = data ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 py-6 flex flex-col gap-4"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-brand-900">{t('leaderboard.title')}</h1>
        {entries.length > 0 && (
          <span className="text-xs text-brand-400">
            {t('leaderboard.top_note', { count: entries.length })}
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
          <span className="text-5xl">🏆</span>
          <p className="text-brand-400">{t('leaderboard.empty')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry, idx) => (
            <LeaderboardRow
              key={entry.position}
              entry={entry}
              isCurrentUser={profile?.displayName === entry.displayName}
              index={idx}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
