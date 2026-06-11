import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import type { ChoiceOptionDto } from '@mhm/contracts';

interface ChoiceListProps {
  options: ChoiceOptionDto[];
  value?: string | null;
  onSelect: (value: string) => void;
  disabled?: boolean;
  lang?: 'he' | 'en';
}

export function ChoiceList({ options, value, onSelect, disabled, lang = 'he' }: ChoiceListProps) {
  return (
    <div className="flex flex-col gap-3">
      {options.map((opt) => {
        const label = lang === 'he' ? opt.labelHe : opt.labelEn;
        const selected = value === opt.value;
        return (
          <motion.button
            key={opt.value}
            whileTap={{ scale: 0.98 }}
            disabled={disabled}
            onClick={() => onSelect(opt.value)}
            aria-pressed={selected}
            className={clsx(
              'w-full text-start px-5 py-4 rounded-2xl font-medium text-base transition-all duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              selected
                ? 'bg-gradient-to-r from-brand-500 to-brand-900 text-white shadow-md shadow-brand-500/25'
                : 'bg-white border-2 border-brand-100 text-brand-800 hover:border-brand-400 hover:bg-brand-50',
            )}
          >
            {label}
          </motion.button>
        );
      })}
    </div>
  );
}
