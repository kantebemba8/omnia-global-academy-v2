import { useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle, Download, ExternalLink, Eye, KeyRound, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LearnerFormationsLayout } from '../../components/formations/FormationsRoleLayout';
import { isLearnerPreviewMode, withLearnerPreview } from '../../lib/learnerPreview';
import {
  BadgeAward,
  CredentialVerification,
  credentialAssetUrl,
  credentialStatusLabel,
  credentialsRequest,
  visibilityLabel,
} from '../../lib/credentialsApi';
import { downloadOrShareRemoteFile, isNativeApp } from '../../lib/mobile';

const BLUE = '#002050';
const GOLD = '#BF8813';

export default function DashboardBadges() {
  const [badges, setBadges] = useState<BadgeAward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [saving, setSaving] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const previewMode = isLearnerPreviewMode();
  const nativeApp = isNativeApp();

  async function exportBadgeJwt(badge: BadgeAward) {
    try {
      await downloadOrShareRemoteFile(credentialAssetUrl(badge.verification_code, 'jwt'), {
        fileName: `badge-${badge.verification_code}.jwt`,
        mimeType: 'application/vc+jwt',
        title: `Badge ${badge.template?.name || badge.credential_uuid}`,
      });
      setNotice(nativeApp ? 'Badge prêt à enregistrer ou partager.' : 'Badge téléchargé.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Export du badge impossible.');
    }
  }

  async function load() {
    setLoading(true);
    if (previewMode) { setBadges([]); setError(''); setLoading(false); return; }
    setError('');
    try {
      const response = await credentialsRequest<{ success: true; badges: BadgeAward[] }>('learner_badges');
      setBadges(response.badges);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return badges.filter(badge =>
      (filter === 'all' || badge.status === filter)
      && (!q || [badge.template?.name, badge.template?.category?.name, badge.template?.level?.name]
        .filter(Boolean).join(' ').toLowerCase().includes(q)),
    );
  }, [badges, filter, query]);

  async function updateVisibility(awardId: string, visibility: BadgeAward['visibility']) {
    setSaving(awardId);
    setError('');
    try {
      await credentialsRequest('learner_update_visibility', { award_id: awardId, visibility });
      setBadges(current => current.map(badge => badge.id === awardId ? { ...badge, visibility } : badge));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Modification impossible.');
    } finally {
      setSaving(null);
    }
  }

  async function verifyBadge(awardId: string) {
    setVerifying(awardId);
    setError('');
    setNotice('');
    try {
      const response = await credentialsRequest<{ success: true; verification: CredentialVerification }>('learner_verify_badge', { award_id: awardId });
      setBadges(current => current.map(badge => badge.id === awardId
        ? { ...badge, verification_result: response.verification, last_verified_at: response.verification.checked_at }
        : badge));
      setNotice(response.verification.overall_valid
        ? 'La signature Open Badges 3.0 est valide.'
        : response.verification.error_code === 'CREDENTIAL_NOT_SIGNED'
          ? 'Ce badge n’est pas encore signé cryptographiquement.'
          : `Vérification échouée : ${response.verification.error_code || 'erreur inconnue'}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Vérification impossible.');
    } finally {
      setVerifying(null);
    }
  }

  return (
    <LearnerFormationsLayout>
      <div className="mx-auto max-w-7xl px-4 py-7 md:px-6">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[.16em]" style={{ color: GOLD }}>Omnia Badges</span>
            <h1 className="mt-1 text-2xl font-semibold" style={{ color: BLUE }}>Mes badges vérifiés</h1>
            <p className="mt-2 text-sm text-slate-500">Réalisations, compétences et contributions reconnues par Omnia.</p>
          </div>
          <div className="flex gap-2">
            <Link to={withLearnerPreview('/dashboard/learning-record')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold" style={{ color: BLUE }}>
              <ShieldCheck size={16} /> Learning Record
            </Link>
            <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}>
              <RefreshCw size={16} /> Actualiser
            </button>
          </div>
        </header>

        {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {notice && <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{notice}</div>}

        <div className="mt-6 flex flex-wrap gap-3">
          <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <Search size={16} className="text-slate-400" />
            <input value={query} onChange={event => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Rechercher un badge…" />
          </label>
          <select value={filter} onChange={event => setFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="all">Tous les statuts</option>
            <option value="awarded">Actifs</option>
            <option value="expired">Expirés</option>
            <option value="revoked">Révoqués</option>
          </select>
        </div>

        {loading ? (
          <div className="py-24 text-center text-sm text-slate-500">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-12 text-center">
            <Award className="mx-auto h-12 w-12 text-slate-200" />
            <p className="mt-4 text-slate-500">Aucun badge trouvé.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map(badge => {
              const signed = badge.standards_status === 'ob3_signed' && badge.credential_jwt_available;
              const verified = badge.verification_result?.overall_valid;
              return (
                <article key={badge.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="p-5" style={{ background: 'linear-gradient(135deg,#002050,#003579)' }}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[.12em]" style={{ color: GOLD }}>{badge.template?.category?.name || 'Badge Omnia'}</p>
                        <h2 className="mt-2 text-lg font-semibold text-white">{badge.template?.name || 'Badge'}</h2>
                        <p className="mt-1 text-sm text-white/65">{badge.template?.level?.name || 'Sans niveau'}</p>
                      </div>
                      {badge.template?.image_url ? (
                        <img src={badge.template.image_url} alt="" className="h-16 w-16 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/10"><Award size={30} color={GOLD} /></div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 p-5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-500">Statut</span>
                      <span className={badge.status === 'awarded' ? 'font-semibold text-green-700' : badge.status === 'revoked' ? 'font-semibold text-red-700' : 'font-semibold text-amber-700'}>
                        {credentialStatusLabel(badge.status)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-500">Signature</span>
                      <span className={`inline-flex items-center gap-1.5 font-semibold ${signed ? 'text-blue-700' : 'text-amber-700'}`}>
                        {signed ? <KeyRound size={14} /> : <ShieldCheck size={14} />}
                        {signed ? 'Open Badges 3.0' : 'En attente'}
                      </span>
                    </div>
                    {verified && (
                      <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
                        <CheckCircle size={14} /> Signature contrôlée
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-500">Émis le</span>
                      <span>{new Date(badge.issued_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <label className="block text-sm">
                      <span className="mb-1.5 block text-slate-500">Visibilité</span>
                      <select disabled={saving === badge.id} value={badge.visibility} onChange={event => void updateVisibility(badge.id, event.target.value as BadgeAward['visibility'])} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        {Object.entries(visibilityLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>

                    <button type="button" onClick={() => void verifyBadge(badge.id)} disabled={verifying === badge.id} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold" style={{ color: BLUE }}>
                      <KeyRound size={15} /> {verifying === badge.id ? 'Vérification…' : 'Vérifier la signature'}
                    </button>

                    {badge.visibility === 'public' ? (
                      <div className="grid grid-cols-2 gap-2">
                        <Link to={`/credentials/badges/${badge.verification_code}`} target="_blank" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold" style={{ color: BLUE }}>
                          <ExternalLink size={15} /> Vérifier
                        </Link>
                        <button type="button" className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: BLUE }} onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/credentials/badges/${badge.verification_code}`)}>
                          <Eye size={15} /> Copier
                        </button>
                        {signed && (
                          <button type="button" onClick={() => void exportBadgeJwt(badge)} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold" style={{ color: BLUE }}>
                            <Download size={15} /> {nativeApp ? 'Enregistrer ou partager le VC-JWT' : 'Télécharger le VC-JWT'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">Rendez ce badge public pour activer son lien et ses exports publics.</p>
                    )}
                    <p className="font-mono text-[11px] text-slate-400">{badge.verification_code}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </LearnerFormationsLayout>
  );
}
