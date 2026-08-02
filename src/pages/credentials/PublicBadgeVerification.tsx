import { useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle, Download, ExternalLink, KeyRound, QrCode, ShieldCheck, XCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import {
  BadgeAward,
  CredentialVerification,
  credentialAssetUrl,
  credentialStatusLabel,
  credentialsRequest,
} from '../../lib/credentialsApi';
import { downloadOrShareRemoteFile, isNativeApp } from '../../lib/mobile';

const BLUE = '#002050';
const GOLD = '#BF8813';

type PublicBadgeResponse = {
  success: true;
  badge: BadgeAward;
  verification: CredentialVerification;
};

export default function PublicBadgeVerification() {
  const { credentialId = '' } = useParams();
  const [badge, setBadge] = useState<BadgeAward | null>(null);
  const [verification, setVerification] = useState<CredentialVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const nativeApp = isNativeApp();

  async function exportAsset(format: 'jwt' | 'json' | 'qr') {
    if (!badge) return;
    try {
      const extension = format === 'json' ? 'jsonld' : format;
      const mimeType = format === 'json' ? 'application/ld+json' : format === 'qr' ? 'image/png' : 'application/vc+jwt';
      await downloadOrShareRemoteFile(credentialAssetUrl(badge.verification_code, format), {
        fileName: `badge-${badge.verification_code}.${extension}`,
        mimeType,
        title: `Badge ${badge.title}`,
      });
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : 'Export du badge impossible.');
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    credentialsRequest<PublicBadgeResponse>('public_verify_badge', { identifier: credentialId })
      .then(response => {
        if (cancelled) return;
        setBadge(response.badge);
        setVerification(response.verification);
      })
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Badge introuvable.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [credentialId]);

  const active = badge?.status === 'awarded' && (!badge.expires_at || new Date(badge.expires_at) >= new Date());
  const cryptographicallyValid = verification?.overall_valid === true;
  const verificationLabel = useMemo(() => {
    if (!verification) return 'Vérification indisponible';
    if (verification.overall_valid) return 'Signature Open Badges 3.0 valide';
    if (verification.error_code === 'CREDENTIAL_NOT_SIGNED') return 'Badge interne non signé';
    return 'Vérification cryptographique échouée';
  }, [verification]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <Link to="/" className="text-sm font-semibold" style={{ color: BLUE }}>← Omnia Global Academy</Link>

        {loading && <div className="py-24 text-center text-sm text-slate-500">Vérification du credential…</div>}
        {error && <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>}

        {badge && (
          <article className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="p-7 text-white" style={{ background: 'linear-gradient(135deg,#002050,#003579)' }}>
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[.16em]" style={{ color: GOLD }}>
                    {badge.template?.category?.name || 'Badge Omnia'}
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold">{badge.template?.name || 'Badge Omnia'}</h1>
                  <p className="mt-3 leading-7 text-white/70">{badge.template?.description}</p>
                </div>
                {badge.template?.image_url ? (
                  <img src={badge.template.image_url} alt="" className="h-28 w-28 rounded-2xl object-cover" />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-white/10">
                    <Award size={50} color={GOLD} />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6 p-7">
              <div className={`flex items-start gap-3 rounded-2xl border p-4 ${active ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
                {active ? <CheckCircle size={24} className="mt-0.5 shrink-0" /> : <XCircle size={24} className="mt-0.5 shrink-0" />}
                <div>
                  <p className="font-semibold">{active ? 'Badge actif dans le registre Omnia' : `Badge ${credentialStatusLabel(badge.status).toLowerCase()}`}</p>
                  <p className="mt-1 text-sm opacity-80">Le statut en ligne tient compte des révocations et de l’expiration.</p>
                </div>
              </div>

              <div className={`flex items-start gap-3 rounded-2xl border p-4 ${cryptographicallyValid ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                <KeyRound size={24} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">{verificationLabel}</p>
                  <p className="mt-1 text-sm opacity-80">
                    {cryptographicallyValid
                      ? `Signature ${badge.signature_alg || 'RS256'} contrôlée le ${new Date(verification?.checked_at || Date.now()).toLocaleString('fr-FR')}.`
                      : verification?.error_code === 'CREDENTIAL_NOT_SIGNED'
                        ? 'Le badge existe dans Omnia, mais la signature VC-JWT n’a pas encore été activée.'
                        : `Code de contrôle : ${verification?.error_code || 'VERIFICATION_UNAVAILABLE'}`}
                  </p>
                </div>
              </div>

              <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Info label="Bénéficiaire" value={badge.recipient?.full_name || 'Utilisateur Omnia'} />
                <Info label="Émetteur" value={badge.issuer?.name || 'Omnia Global Academy'} />
                <Info label="Émis le" value={new Date(badge.issued_at).toLocaleDateString('fr-FR')} />
                <Info label="Expiration" value={badge.expires_at ? new Date(badge.expires_at).toLocaleDateString('fr-FR') : 'Aucune'} />
                <Info label="Niveau" value={badge.template?.level?.name || 'Non défini'} />
                <Info label="Code" value={badge.verification_code} mono />
              </dl>

              <section className="rounded-2xl border border-slate-200 p-5">
                <h2 className="font-semibold" style={{ color: BLUE }}>Critères d’obtention</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{badge.template?.criteria_narrative}</p>
              </section>

              {badge.evidence && badge.evidence.length > 0 && (
                <section className="rounded-2xl border border-slate-200 p-5">
                  <h2 className="font-semibold" style={{ color: BLUE }}>Preuves publiques</h2>
                  <div className="mt-4 space-y-4">
                    {badge.evidence.map((evidence, index) => (
                      <div key={evidence.id || index} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                        <p className="text-sm font-semibold text-slate-800">{evidence.title}</p>
                        {evidence.description && <p className="mt-1 text-sm text-slate-500">{evidence.description}</p>}
                        {evidence.url && (
                          <a href={evidence.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: GOLD }}>
                            <ExternalLink size={14} /> Consulter la preuve
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="rounded-2xl border border-slate-200 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold" style={{ color: BLUE }}>Exporter et partager</h2>
                    <p className="mt-1 text-sm text-slate-500">Formats portables du badge et QR code de vérification.</p>
                  </div>
                  <img src={credentialAssetUrl(badge.verification_code, 'qr')} alt="QR code de vérification" className="h-28 w-28 rounded-xl border border-slate-200 bg-white p-2" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {badge.credential_jwt_available && (
                    <button type="button" onClick={() => void exportAsset('jwt')} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: BLUE }}>
                      <Download size={16} /> {nativeApp ? 'Enregistrer VC-JWT' : 'Télécharger VC-JWT'}
                    </button>
                  )}
                  <button type="button" onClick={() => void exportAsset('json')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold" style={{ color: BLUE }}>
                    <Download size={16} /> {nativeApp ? 'Enregistrer JSON-LD' : 'Télécharger JSON-LD'}
                  </button>
                  <button type="button" onClick={() => void exportAsset('qr')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold" style={{ color: BLUE }}>
                    <QrCode size={16} /> {nativeApp ? 'Enregistrer le QR code' : 'Ouvrir le QR code'}
                  </button>
                </div>
              </section>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <ShieldCheck className="mr-2 inline" size={18} />
                Omnia est développé pour Open Badges 3.0. La mention « certifié 1EdTech » ne sera utilisée qu’après une certification officielle.
              </div>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`mt-1 break-words text-sm font-semibold ${mono ? 'font-mono' : ''}`} style={{ color: BLUE }}>{value}</dd>
    </div>
  );
}
