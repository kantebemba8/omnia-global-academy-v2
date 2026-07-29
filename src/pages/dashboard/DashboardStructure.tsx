import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import {
  QrCode, Building2, CheckCircle, XCircle, Clock,
  AlertCircle, Search, Users, ChevronRight, Gift, RefreshCw
} from 'lucide-react';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/structure-manage`;

const MEMBERSHIP_STATUS: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending:  { label: 'En attente de validation', color: '#92400E', bg: '#FEF3C7', icon: Clock },
  approved: { label: 'Rattachement accepté',     color: '#065F46', bg: '#D1FAE5', icon: CheckCircle },
  rejected: { label: 'Demande refusée',          color: '#991B1B', bg: '#FEE2E2', icon: XCircle },
  removed:  { label: 'Retiré',                   color: '#374151', bg: '#F3F4F6', icon: AlertCircle },
};

const DISPLAY_NAMES: Record<string, string> = {
  ministere: 'Espace Ministère', etablissement: 'Espace Établissement',
  universite: 'Espace Université', ecole: 'Espace École',
  centre_formation: 'Espace Centre de formation', entreprise: 'Espace Entreprise',
  ong: 'Espace ONG', association: 'Espace Association',
  institution_publique: 'Espace Institution publique',
  organisation_internationale: 'Espace Organisation internationale',
  cabinet_formation: 'Espace Cabinet de formation', autre: 'Espace Structure professionnelle',
};

interface Membership {
  id: string;
  status: string;
  requested_at: string;
  approved_at?: string;
  structure: {
    id: string;
    name: string;
    structure_type: string;
    logo_url?: string;
    professional_email?: string;
  };
}

export function DashboardStructure() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [codeInput, setCodeInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [codeResult, setCodeResult] = useState<{ success: boolean; message: string; structure_name?: string; display_name?: string; requires_validation?: boolean } | null>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  async function loadMemberships() {
    setLoading(true);
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({ action: 'my_memberships' }),
      });
      const data = await res.json().catch(() => ({}));
      setMemberships(res.ok && Array.isArray(data.memberships) ? data.memberships : []);
    } catch { setMemberships([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadMemberships(); }, []);

  async function handleUseCode() {
    const code = codeInput.trim().toUpperCase();
    if (!code) { showToast('Entrez un code structure'); return; }
    setSubmitting(true);
    setCodeResult(null);

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({
          action: 'use_code',
          code_value: code,
          pin: pinInput || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        const structureName = data.structure?.name || data.structure_name;
        const structureType = data.structure?.structure_type || '';
        setCodeResult({
          success: true,
          message: data.message || 'Votre rattachement a été enregistré.',
          structure_name: structureName,
          display_name: data.display_name || DISPLAY_NAMES[structureType] || 'Structure',
          requires_validation: data.status === 'pending' || Boolean(data.requires_validation),
        });
        setCodeInput('');
        setPinInput('');
        setShowPin(false);
        await loadMemberships();
      } else {
        const errorMessages: Record<string, string> = {
          INVALID_CODE: 'Ce code structure est invalide.',
          CODE_NOT_ACTIVE: 'Ce code structure n’est pas actif.',
          CODE_EXPIRED: 'Ce code structure a expiré.',
          CODE_QUOTA_REACHED: 'Ce code a atteint son nombre maximum d’utilisations.',
          INVALID_PIN: 'Le PIN saisi est incorrect.',
          ALREADY_LINKED: 'Votre compte est déjà rattaché à ce code.',
          AUTH_REQUIRED: 'Vous devez être connecté(e) pour utiliser un code.',
          SESSION_INVALID: 'Votre session a expiré. Veuillez vous reconnecter.',
        };
        setCodeResult({
          success: false,
          message: errorMessages[data.error] ?? data.message ?? 'Une erreur est survenue.',
        });
      }
    } catch {
      setCodeResult({ success: false, message: 'Connexion au service impossible. Réessayez.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardLayout role="apprenant">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border"
            style={{ background: 'white', borderColor: '#E4E7EC', color: '#002050' }}>{toast}</div>
        )}

        {/* Header */}
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#002050' }}>Ma Structure</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
            Rejoignez une structure en saisissant un code fourni par votre organisation
          </p>
        </div>

        {/* Bloc saisie code */}
        <div className="bg-white rounded-2xl border p-6 space-y-4" style={{ borderColor: '#E4E7EC' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: '#EEF2FF' }}>
              <QrCode size={20} style={{ color: '#002050' }} />
            </div>
            <div>
              <h2 className="font-bold" style={{ color: '#002050' }}>Utiliser un code structure</h2>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>
                Ce code vous est fourni par votre école, entreprise ou organisation
              </p>
            </div>
          </div>

          {/* Champ code */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#374151' }}>
              Code structure
            </label>
            <div className="flex gap-2">
              <input
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono uppercase tracking-widest focus:outline-none focus:border-[#002050] transition-colors"
                placeholder="ex : ECOL-ABC123-2026"
                value={codeInput}
                onChange={e => {
                  setCodeInput(e.target.value.toUpperCase());
                  setCodeResult(null);
                  // Détecter si un PIN est probablement requis (logique simple)
                  setShowPin(false);
                }}
                onKeyDown={e => e.key === 'Enter' && handleUseCode()}
                maxLength={30}
              />
            </div>
          </div>

          {/* PIN optionnel */}
          <div>
            <button
              onClick={() => setShowPin(v => !v)}
              className="text-xs font-semibold flex items-center gap-1"
              style={{ color: '#BF8813' }}>
              {showPin ? '− Masquer le PIN' : '+ Ce code nécessite un PIN ?'}
            </button>
            {showPin && (
              <div className="mt-2">
                <input
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#002050]"
                  type="password"
                  placeholder="PIN du code structure"
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value)}
                  maxLength={20}
                />
              </div>
            )}
          </div>

          {/* Résultat */}
          {codeResult && (
            <div className={`flex items-start gap-3 p-4 rounded-xl`}
              style={{
                background: codeResult.success ? '#D1FAE5' : '#FEE2E2',
                border: `1px solid ${codeResult.success ? '#A7F3D0' : '#FECACA'}`,
              }}>
              {codeResult.success
                ? <CheckCircle size={18} style={{ color: '#065F46', flexShrink: 0, marginTop: 1 }} />
                : <XCircle size={18} style={{ color: '#DC2626', flexShrink: 0, marginTop: 1 }} />}
              <div>
                {codeResult.success && codeResult.structure_name && (
                  <p className="font-bold text-sm mb-0.5" style={{ color: '#065F46' }}>
                    {codeResult.display_name ?? 'Structure'} — {codeResult.structure_name}
                  </p>
                )}
                <p className="text-sm" style={{ color: codeResult.success ? '#065F46' : '#991B1B' }}>
                  {codeResult.message}
                </p>
                {codeResult.success && codeResult.requires_validation && (
                  <p className="text-xs mt-1" style={{ color: '#065F46', opacity: 0.8 }}>
                    Le responsable de la structure doit valider votre demande.
                  </p>
                )}
              </div>
            </div>
          )}

          <button
            onClick={handleUseCode}
            disabled={submitting || !codeInput.trim()}
            className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all"
            style={{ background: submitting || !codeInput.trim() ? '#9CA3AF' : '#002050' }}>
            {submitting ? 'Vérification en cours...' : 'Utiliser ce code'}
          </button>

          {/* Info */}
          <div className="flex items-start gap-2 p-3 rounded-xl text-xs"
            style={{ background: '#F8F9FA', color: '#6B7280' }}>
            <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <p>
              Un code structure ne donne pas automatiquement des avantages.
              Il permet uniquement de vous rattacher à une organisation.
              Les avantages éventuels sont accordés après validation par le responsable et le Super Admin.
            </p>
          </div>
        </div>

        {/* Mes rattachements */}
        <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold" style={{ color: '#002050' }}>Mes rattachements</h2>
            <button onClick={loadMemberships} className="p-1.5 rounded-lg hover:bg-gray-100">
              <RefreshCw size={14} style={{ color: '#9CA3AF' }} />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
            </div>
          ) : memberships.length === 0 ? (
            <div className="text-center py-8">
              <Building2 size={36} className="mx-auto mb-3 opacity-10" style={{ color: '#002050' }} />
              <p className="font-semibold text-sm" style={{ color: '#374151' }}>
                Aucun rattachement
              </p>
              <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
                Utilisez un code structure pour rejoindre une organisation
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {memberships.map((m: any) => {
                const sc = MEMBERSHIP_STATUS[m.status] ?? MEMBERSHIP_STATUS.pending;
                const Icon = sc.icon;
                const structType = m.structure?.structure_type ?? '';
                const displayName = DISPLAY_NAMES[structType] ?? 'Structure';

                return (
                  <div key={m.id} className="flex items-center gap-4 p-4 rounded-xl border"
                    style={{ borderColor: '#E4E7EC', background: '#F8F9FA' }}>
                    {/* Logo ou icône */}
                    {m.structure?.logo_url ? (
                      <img src={m.structure.logo_url} alt=""
                        className="w-12 h-12 rounded-xl object-contain border flex-shrink-0"
                        style={{ borderColor: '#E4E7EC', background: 'white' }} />
                    ) : (
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: '#EEF2FF' }}>
                        <Building2 size={22} style={{ color: '#002050' }} />
                      </div>
                    )}

                    {/* Infos */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm truncate" style={{ color: '#002050' }}>
                          {m.structure?.name ?? 'Structure'}
                        </p>
                        <span className="text-xs px-1.5 py-0.5 rounded-full"
                          style={{ background: '#EEF2FF', color: '#002050' }}>
                          {displayName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: sc.bg, color: sc.color }}>
                          <Icon size={10} /> {sc.label}
                        </span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
                        Demande le {new Date(m.requested_at).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: 'long', year: 'numeric'
                        })}
                        {m.approved_at && ` · Accepté le ${new Date(m.approved_at).toLocaleDateString('fr-FR')}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Info bas de page */}
        <div className="flex items-start gap-2 p-4 rounded-2xl text-sm"
          style={{ background: '#EEF2FF', color: '#002050' }}>
          <Gift size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p className="font-semibold">Avantages disponibles</p>
            <p className="text-xs mt-0.5" style={{ color: '#374151' }}>
              Si votre structure a des avantages actifs validés par Omnia, ils apparaîtront
              automatiquement dans votre espace lors de votre inscription à une formation concernée.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
