import { clsx } from 'clsx';
import { motion } from 'framer-motion';

interface ScaleInputProps {
  min: number;
  max: number;
  value?: number | null;
  onSelect: (value: number) => void;
  disabled?: boolean;
}

export function ScaleInput({ min, max, value, onSelect, disabled }: ScaleInputProps) {
  const range = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  // Color gradient: low = red, mid = amber, high = green
  function colorForIndex(idx: number, total: number) {
    const ratio = total <= 1 ? 0.5 : idx / (total - 1);
    if (ratio < 0.33) return 'from-red-400 to-red-500';
    if (ratio < 0.67) return 'from-amber-400 to-amber-500';
    return 'from-green-400 to-green-500';
  }

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {range.map((n, idx) => {
        const selected = value === n;
        const gradient = colorForIndex(idx, range.length);
        return (
          <motion.button
            key={n}
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.08 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            disabled={disabled}
            onClick={() => onSelect(n)}
            aria-pressed={selected}
            className={clsx(
              'w-12 h-12 rounded-xl font-bold text-base transition-all duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              selected
                ? clsx('bg-gradient-to-br text-white shadow-lg ring-2 ring-offset-1 ring-brand-400', gradient)
                : 'bg-white border-2 border-brand-100 text-brand-700 hover:border-brand-300',
            )}
          >
            {n}
          </motion.button>
        );
      })}
    </div>
  );
}
