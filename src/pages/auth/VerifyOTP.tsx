import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/AuthLayout';
import { authFetch } from '../../lib/authApi';
import { saveSession, redirectByRoles } from '../../lib/session';

type State = {
  phone_number: string;
  purpose: 'inscription' | 'connexion' | 'reset_password';
  user_id?: string;
};

type VerifyResponse = {
  success: boolean;
  message?: string;
  retry_after?: number;
  session_token?: string;
  user?: {
    id: string;
    full_name: string;
    email: string;
    phone_number: string;
    roles: string[];
    force_password_change?: boolean;
  };
  needs_validation?: boolean;
  reset_token?: string;
};

export function VerifyOTP() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as State | null;

  const [otp, setOtp] = useState(Array<string>(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(59);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!state?.phone_number) {
      navigate('/connexion', { replace: true });
      return;
    }
    inputRefs.current[0]?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (digits.length === 6) {
      setOtp(digits.split(''));
      inputRefs.current[5]?.focus();
    }
    e.preventDefault();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) { setError('Entrez les 6 chiffres du code'); return; }
    setError('');
    setLoading(true);
    try {
      const data = await authFetch<VerifyResponse>('auth-verify-otp', {
        phone_number: state!.phone_number,
        otp_code: code,
        purpose: state!.purpose,
      });
      if (!data.success) {
        setError(data.message || 'Code incorrect');
        setOtp(Array(6).fill(''));
        inputRefs.current[0]?.focus();
        return;
      }
      if (data.session_token && data.user) {
        saveSession(data.session_token, data.user);
        if (data.user.force_password_change) {
          navigate('/changer-mot-de-passe', {
            state: { session_token: data.session_token, user: data.user },
          });
          return;
        }
        redirectByRoles(data.user.roles);
        return;
      }
      if (data.needs_validation) {
        navigate('/en-attente-validation', { replace: true });
        return;
      }
      if (data.reset_token) {
        navigate('/reinitialiser-mot-de-passe', { state: { reset_token: data.reset_token } });
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || resending) return;
    setCanResend(false);
    setCountdown(59);
    setError('');
    setResending(true);
    try {
      const data = await authFetch<{ success: boolean; message?: string; retry_after?: number }>(
        'auth-resend-otp',
        { phone_number: state!.phone_number, purpose: state!.purpose }
      );
      if (!data.success) {
        setError(data.message || 'Impossible de renvoyer le code');
        setCanResend(true);
        if (data.retry_after) setCountdown(data.retry_after);
      }
    } catch {
      setError('Impossible de renvoyer le code');
      setCanResend(true);
    } finally {
      setResending(false);
    }
  };

  const maskedPhone = state?.phone_number
    ? state.phone_number.replace(/(\+\d{1,4})(\d+)(\d{2})$/, '$1 •••• $3')
    : '';

  return (
    <AuthLayout
      title="Code de vérification"
      subtitle={`Code envoyé au ${maskedPhone}`}
    >
      <form onSubmit={handleSubmit} className="mt-4 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-center" onPaste={handlePaste}>
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              className="w-11 h-14 text-center text-xl font-bold border-2 rounded-xl transition-all focus:outline-none"
              style={{
                borderColor: digit ? '#002050' : '#E5E7EB',
                color: '#002050',
                backgroundColor: digit ? '#F0F4FF' : '#FFFFFF',
              }}
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg font-semibold text-white transition-all"
          style={{ backgroundColor: loading ? '#9CA3AF' : '#002050' }}
        >
          {loading ? 'Vérification...' : 'Confirmer le code'}
        </button>

        <div className="text-center text-sm" style={{ color: '#6B7280' }}>
          {canResend ? (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="font-semibold transition-colors"
              style={{ color: '#BF8813' }}
            >
              {resending ? 'Envoi...' : 'Renvoyer le code'}
            </button>
          ) : (
            <span>
              Renvoyer dans{' '}
              <span className="font-semibold tabular-nums" style={{ color: '#002050' }}>
                {countdown}s
              </span>
            </span>
          )}
        </div>
      </form>
    </AuthLayout>
  );
}
