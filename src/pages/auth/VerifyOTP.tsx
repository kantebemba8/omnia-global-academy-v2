import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/AuthLayout';
import { authFetch } from '../../lib/authApi';
import { redirectByRoles, saveSession } from '../../lib/session';

type State = {
  email: string;
  purpose: 'inscription' | 'connexion' | 'reset_password';
  user_id?: string;
  access_invitation?: boolean;
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

function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'•'.repeat(Math.max(3, Math.min(8, local.length - visible.length)))}@${domain}`;
}

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
    if (!state?.email) {
      navigate('/connexion', { replace: true });
      return;
    }
    inputRefs.current[0]?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return; }
    const timer = setTimeout(() => setCountdown(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handlePaste = (event: React.ClipboardEvent) => {
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (digits.length === 6) {
      setOtp(digits.split(''));
      inputRefs.current[5]?.focus();
    }
    event.preventDefault();
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) { setError('Entrez les 6 chiffres du code'); return; }
    setError('');
    setLoading(true);
    try {
      const data = await authFetch<VerifyResponse>('auth-verify-otp', {
        email: state!.email,
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
          navigate('/changer-mot-de-passe', { state: { session_token: data.session_token, user: data.user } });
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!canResend || resending) return;
    setCanResend(false);
    setCountdown(59);
    setError('');
    setResending(true);
    try {
      const data = await authFetch<{ success: boolean; message?: string; retry_after?: number }>('auth-resend-otp', {
        email: state!.email,
        purpose: state!.purpose,
      });
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
  }

  return (
    <AuthLayout title="Code de vérification" subtitle={`Code envoyé par e-mail à ${maskEmail(state?.email || '')}`}>
      <form onSubmit={handleSubmit} className="mt-4 space-y-6">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="flex justify-center gap-2" onPaste={handlePaste}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={element => { inputRefs.current[index] = element; }}
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              maxLength={1}
              value={digit}
              onChange={event => handleChange(index, event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
              }}
              className="h-14 w-11 rounded-xl border-2 text-center text-xl font-bold transition-all focus:outline-none"
              style={{ borderColor: digit ? '#002050' : '#E5E7EB', color: '#002050', backgroundColor: digit ? '#F0F4FF' : '#FFFFFF' }}
            />
          ))}
        </div>
        <button type="submit" disabled={loading} className="w-full rounded-lg py-3 font-semibold text-white" style={{ backgroundColor: loading ? '#9CA3AF' : '#002050' }}>
          {loading ? 'Vérification…' : 'Confirmer le code'}
        </button>
        <div className="text-center text-sm text-gray-500">
          {canResend ? (
            <button type="button" onClick={handleResend} disabled={resending} className="font-semibold" style={{ color: '#BF8813' }}>
              {resending ? 'Envoi…' : 'Renvoyer le code par e-mail'}
            </button>
          ) : (
            <span>Renvoyer dans <span className="font-semibold tabular-nums" style={{ color: '#002050' }}>{countdown}s</span></span>
          )}
        </div>
      </form>
    </AuthLayout>
  );
}
