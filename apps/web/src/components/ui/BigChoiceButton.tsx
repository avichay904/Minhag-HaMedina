import { ButtonHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

interface BigChoiceButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: 'yes' | 'no' | 'neutral';
  children: ReactNode;
}

const variantStyles = {
  yes: 'bg-gradient-to-br from-green-400 to-emerald-600 text-white shadow-lg shadow-green-500/30 hover:from-green-500 hover:to-emerald-700',
  no: 'bg-gradient-to-br from-red-400 to-rose-600 text-white shadow-lg shadow-red-500/30 hover:from-red-500 hover:to-rose-700',
  neutral:
    'bg-gradient-to-br from-brand-500 to-brand-900 text-white shadow-lg shadow-brand-500/30 hover:brightness-110',
};

export function BigChoiceButton({ variant, children, className, disabled, ...props }: BigChoiceButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      disabled={disabled}
      className={clsx(
        'flex-1 flex items-center justify-center gap-2 rounded-2xl py-5 px-4 text-xl font-bold',
        'transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-500',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        className,
      )}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </motion.button>
  );
}
