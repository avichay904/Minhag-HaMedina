import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

interface LanguageToggleProps {
  className?: string;
}

export function LanguageToggle({ className }: LanguageToggleProps) {
  const { i18n } = useTranslation();
  const isHe = i18n.language === 'he';

  const toggleLanguage = () => {
    i18n.changeLanguage(isHe ? 'en' : 'he');
  };

  return (
    <button
      onClick={toggleLanguage}
      aria-label={isHe ? 'Switch to English' : 'עבור לעברית'}
      className={clsx(
        'relative inline-flex items-center h-8 w-16 rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        isHe ? 'bg-brand-600' : 'bg-brand-400',
        className,
      )}
    >
      <motion.span
        layout
        className="absolute w-6 h-6 bg-white rounded-full shadow-sm flex items-center justify-center text-xs font-bold text-brand-800"
        style={{ [isHe ? 'right' : 'left']: '4px' }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        {isHe ? 'ע' : 'E'}
      </motion.span>
    </button>
  );
}
