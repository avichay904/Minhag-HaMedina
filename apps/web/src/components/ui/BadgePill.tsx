import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { BadgeType } from '@mhm/shared';

interface BadgePillProps {
  badge: BadgeType;
  size?: 'sm' | 'md';
  className?: string;
}

const badgeEmoji: Record<BadgeType, string> = {
  [BadgeType.STREAK]: '🔥',
  [BadgeType.FAST]: '⚡',
  [BadgeType.DIVERSE]: '🌈',
  [BadgeType.CHALLENGE]: '🎯',
  [BadgeType.CHALLENGE_OF_WEEK]: '🏅',
  [BadgeType.ALMOST]: '⏰',
};

export function BadgePill({ badge, size = 'md', className }: BadgePillProps) {
  const { t } = useTranslation();

  return (
    <span
      title={t(`badges.${badge}`)}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-brand-50 to-blue-50 border border-brand-100 font-medium text-brand-800',
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1',
        className,
      )}
    >
      <span>{badgeEmoji[badge]}</span>
      <span>{t(`badges.${badge}`)}</span>
    </span>
  );
}
