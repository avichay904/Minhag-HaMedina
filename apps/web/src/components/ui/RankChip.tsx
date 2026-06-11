import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { Rank } from '@mhm/shared';

interface RankChipProps {
  rank: Rank;
  size?: 'sm' | 'md';
  className?: string;
}

const rankStyles: Record<Rank, { bg: string; text: string; emoji: string }> = {
  [Rank.GUEST]: { bg: 'bg-gray-100', text: 'text-gray-600', emoji: '👤' },
  [Rank.BEGINNER]: { bg: 'bg-blue-100', text: 'text-blue-700', emoji: '🌱' },
  [Rank.CONTRIBUTOR]: { bg: 'bg-brand-100', text: 'text-brand-700', emoji: '⭐' },
  [Rank.VETERAN]: { bg: 'bg-purple-100', text: 'text-purple-700', emoji: '🏆' },
  [Rank.AMBASSADOR]: { bg: 'bg-amber-100', text: 'text-amber-700', emoji: '👑' },
};

export function RankChip({ rank, size = 'md', className }: RankChipProps) {
  const { t } = useTranslation();
  const style = rankStyles[rank];

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-semibold',
        style.bg,
        style.text,
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1',
        className,
      )}
    >
      <span aria-hidden="true">{style.emoji}</span>
      {t(`ranks.${rank}`)}
    </span>
  );
}
