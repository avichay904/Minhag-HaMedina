import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ApiRequestError } from '../lib/apiClient';
import { Button, Input } from '../components/ui';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    setError('');
    try {
      await login(token.trim());
      navigate('/surveys', { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError && err.statusCode === 403) {
        setError('טוקן שגוי — גישה נדחתה');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('שגיאה בלתי ידועה');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 via-brand-600 to-brand-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo area */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-900 rounded-2xl mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-brand-900">ממשק ניהול</h1>
          <p className="text-gray-400 text-sm mt-1">מנהג המדינה</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            id="admin-token"
            label="טוקן מנהל (ADMIN_API_TOKEN)"
            type="password"
            placeholder="הדבק את הטוקן כאן..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
            className="font-mono text-xs"
          />

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button
            type="submit"
            loading={loading}
            disabled={!token.trim()}
            className="w-full justify-center py-3"
            size="lg"
          >
            כניסה
          </Button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          הטוקן מאומת מול שרת ה-API — 200 = תקין, 403 = שגוי
        </p>
      </div>
    </div>
  );
}
