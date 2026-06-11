import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAuth } from './useAuth';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

export function WelcomeScreen() {
  const { t } = useTranslation();
  const { loginSocial, loginAnonymous } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState<'google' | 'apple' | 'guest' | null>(null);

  async function handleSocial(provider: 'GOOGLE' | 'APPLE') {
    const key = provider === 'GOOGLE' ? 'google' : 'apple';
    setLoading(key);
    try {
      // dev-mode token: "dev:<randomId>:<name>@dev.local"
      const id = Math.random().toString(36).slice(2, 10);
      const name = provider === 'GOOGLE' ? 'GoogleUser' : 'AppleUser';
      const devToken = `dev:${id}:${name}@dev.local`;
      await loginSocial(provider, devToken);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('errors.generic');
      showToast(msg, 'error');
    } finally {
      setLoading(null);
    }
  }

  async function handleGuest() {
    setLoading('guest');
    try {
      await loginAnonymous();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('errors.generic');
      showToast(msg, 'error');
    } finally {
      setLoading(null);
    }
  }

  const anyLoading = loading !== null;

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 py-12">
      {/* Brand hero */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="text-center mb-10"
      >
        <div className="text-6xl mb-4" aria-hidden="true">🗺️</div>
        <h1 className="text-4xl font-extrabold text-brand-900 mb-2">{t('app.name')}</h1>
        <p className="text-lg text-brand-500">{t('app.tagline')}</p>
      </motion.div>

      {/* Auth card */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl shadow-brand-900/15 p-8 flex flex-col gap-4"
      >
        <div className="text-center">
          <h2 className="text-2xl font-bold text-brand-900">{t('auth.welcome_title')}</h2>
          <p className="text-sm text-brand-400 mt-1">{t('auth.welcome_subtitle')}</p>
        </div>

        {/* Guest */}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={loading === 'guest'}
          disabled={anyLoading}
          onClick={handleGuest}
        >
          👤 {t('auth.continue_guest')}
        </Button>

        <div className="relative flex items-center gap-3">
          <div className="flex-1 h-px bg-brand-100" />
          <span className="text-xs text-brand-400 font-medium">{t('auth.or')}</span>
          <div className="flex-1 h-px bg-brand-100" />
        </div>

        {/* Google */}
        <Button
          variant="secondary"
          size="md"
          fullWidth
          loading={loading === 'google'}
          disabled={anyLoading}
          onClick={() => handleSocial('GOOGLE')}
        >
          <span aria-hidden="true">🔵</span> {t('auth.sign_google')}
        </Button>

        {/* Apple */}
        <Button
          variant="secondary"
          size="md"
          fullWidth
          loading={loading === 'apple'}
          disabled={anyLoading}
          onClick={() => handleSocial('APPLE')}
        >
          <span aria-hidden="true">🍎</span> {t('auth.sign_apple')}
        </Button>

        <p className="text-xs text-center text-brand-300 mt-2 leading-relaxed">
          {t('auth.trust_note')}
        </p>
      </motion.div>
    </div>
  );
}
