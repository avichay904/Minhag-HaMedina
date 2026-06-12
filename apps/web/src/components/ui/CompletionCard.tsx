import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { BadgePill } from './BadgePill';
import { BadgeType } from '@mhm/shared';
import { useNavigate } from 'react-router-dom';

interface CompletionCardProps {
  questionsAnswered: number;
  pointsEarned: number;
  newBadges: BadgeType[];
  surveyId?: string;
  onReset: () => void;
  answeredToday?: number | null;
  percentileToday?: number | null;
}

const confettiVariants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.08, type: 'spring', stiffness: 200 },
  }),
};

const emojis = ['🎉', '⭐', '🌟', '✨', '🏆'];

export function CompletionCard({ questionsAnswered, pointsEarned, newBadges, surveyId, onReset, answeredToday, percentileToday }: CompletionCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 180, damping: 20 }}
      className="relative flex flex-col items-center text-center gap-6 p-8"
    >
      {/* Confetti emojis */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
        {emojis.map((e, i) => (
          <motion.span
            key={i}
            custom={i}
            variants={confettiVariants}
            initial="hidden"
            animate="visible"
            className="absolute text-3xl"
            style={{
              top: `${10 + i * 15}%`,
              left: `${5 + i * 20}%`,
              transform: `rotate(${i * 25}deg)`,
            }}
          >
            {e}
          </motion.span>
        ))}
      </div>

      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
        className="text-7xl"
        aria-hidden="true"
      >
        🏆
      </motion.div>

      <div>
        <h2 className="text-3xl font-extrabold text-brand-900 mb-2">{t('completion.title')}</h2>
        <p className="text-xl text-brand-600">
          {t('completion.subtitle', { count: questionsAnswered })}
        </p>
      </div>

      {pointsEarned > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-400 to-yellow-500 text-white px-6 py-2 rounded-full font-bold text-lg shadow-md"
        >
          <span>⭐</span>
          <span>{t('completion.points_earned', { points: pointsEarned })}</span>
        </motion.div>
      )}

      {newBadges.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-wrap justify-center gap-2"
        >
          {newBadges.map((b) => (
            <BadgePill key={b} badge={b} />
          ))}
        </motion.div>
      )}

      <p className="text-sm text-brand-400">
        {answeredToday != null
          ? t('completion.community', { count: answeredToday })
          : t('completion.community_loading')}
      </p>

      {typeof percentileToday === 'number' && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-sm font-medium text-brand-500"
        >
          {t('completion.percentile', { pct: percentileToday })}
        </motion.p>
      )}

      <div className="flex flex-col gap-3 w-full mt-2">
        {surveyId && (
          <Button
            variant="secondary"
            fullWidth
            onClick={() => navigate(`/results?survey=${surveyId}`)}
          >
            {t('completion.view_results')}
          </Button>
        )}
        <Button variant="primary" fullWidth onClick={onReset}>
          {t('completion.back_to_surveys')}
        </Button>
      </div>
    </motion.div>
  );
}
