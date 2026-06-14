import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface ProgressBarProps {
  value: number; // 0–100
  className?: string;
  label?: string;
  color?: 'brand' | 'green' | 'amber';
}

export function ProgressBar({ value, className, label, color = 'brand' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  const trackColor = {
    brand: 'bg-brand-100',
    green: 'bg-green-100',
    amber: 'bg-amber-100',
  }[color];

  const fillColor = {
    brand: 'from-brand-500 to-brand-600',
    green: 'from-green-400 to-green-600',
    amber: 'from-amber-400 to-amber-600',
  }[color];

  return (
    <div className={clsx('w-full', className)} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      {label && (
        <div className="flex justify-between mb-1 text-xs text-brand-400">
          <span>{label}</span>
          <span>{Math.round(clamped)}%</span>
        </div>
      )}
      <div className={clsx('h-2 rounded-full overflow-hidden', trackColor)}>
        <motion.div
          className={clsx('h-full rounded-full bg-gradient-to-r', fillColor)}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  );
}
