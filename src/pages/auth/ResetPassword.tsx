import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { AuthLayout } from '../../components/AuthLayout';
import { authFetch } from '../../lib/authApi';

type ResetResponse = {
  success: boolean;
  message?: string;
};

const inputCls =
  'w-full px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#002050]/20 focus:border-[#002050] transition-colors';

function getStrength(pwd: string): { label: string; color: string; pct: string } {
  if (!pwd) return { label: '', color: '', pct: '0%' };
  const up = /[A-Z]/.test(pwd);
  const lo = /[a-z]/.test(pwd);
  const num = /\d/.test(pwd);
  const sp = /[!@#$%^&*(),.?":{}|<>_\-]/.test(pwd);
  const score = [up, lo, num, sp].filter(Boolean).length;
  if (pwd.length >= 8 && score >= 3) return { label: 'Fort', color: '#10B981', pct: '100%' };
  if (pwd.length >= 8 && score >= 2) return { label: 'Moyen', color: '#F59E0B', pct: '66%' };
  return { label: 'Faible', color: '#EF4444', pct: '33%' };
}

function PasswordStrength({ password }: { password: string }) {
  const s = getStrength(password);
  if (!password) return null;
  return (
    <div className="mt-2">
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#E5E7EB' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: s.pct, backgroundColor: s.color }}
        />
      </div>
      <p className="text-xs mt-1 font-medium" style={{ color: s.color }}>
        {s.label}
      </p>
    </div>
  );
}

export function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { reset_token?: string } | null;

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!state?.reset_token) {
    return (
      <AuthLayout title="Lien invalide">
        <p className="text-center text-sm mt-4" style={{ color: '#6B7280' }}>
          Ce lien est invalide ou a expiré.{' '}
          <a href="/mot-de-passe-oublie" className="font-semibold" style={{ color: '#BF8813' }}>
            Recommencer
          </a>
        </p>
      </AuthLayout>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas'); return; }
    if (password.length < 8) { setError('Minimum 8 caractères requis'); return; }
    setError('');
    setLoading(true);
    try {
      const data = await authFetch<ResetResponse>('auth-reset-password', {
        reset_token: state.reset_token,
        new_password: password,
      });
      if (!data.success) { setError(data.message || 'Une erreur est survenue'); return; }
      navigate('/connexion', {
        replace: true,
        state: { message: 'Mot de passe mis à jour avec succès' },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Nouveau mot de passe" subtitle="Choisissez un mot de passe sécurisé">
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nouveau mot de passe</label>
          <div className="relative">
            <input
              className={inputCls} type={showPwd ? 'text' : 'password'}
              autoComplete="new-password" required minLength={8}
              value={password} onChange={e => setPassword(e.target.value)}
            />
            <button type="button" className="absolute right-3 top-3.5 text-gray-400" onClick={() => setShowPwd(v => !v)}>
              {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <PasswordStrength password={password} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmer le mot de passe</label>
          <input
            className={inputCls} type={showPwd ? 'text' : 'password'}
            autoComplete="new-password" required
            value={confirm} onChange={e => setConfirm(e.target.value)}
          />
          {confirm && confirm !== password && (
            <p className="text-xs mt-1" style={{ color: '#EF4444' }}>Les mots de passe ne correspondent pas</p>
          )}
        </div>

        <button
          type="submit" disabled={loading}
          className="w-full py-3 rounded-lg font-semibold text-white transition-all mt-1"
          style={{ backgroundColor: loading ? '#9CA3AF' : '#002050' }}
        >
          {loading ? 'Mise à jour...' : 'Enregistrer'}
        </button>
      </form>
    </AuthLayout>
  );
}
