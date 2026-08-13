import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Award,
  BadgeCheck,
  CalendarDays,
  Clock3,
  Download,
  FileCheck2,
  GraduationCap,
  Image as ImageIcon,
  Loader2,
  LockKeyhole,
  QrCode,
  RefreshCcw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { ENDPOINTS } from '../lib/config';
import { Navbar } from '../components/Navbar';
import { PageFooter } from '../components/PageFooter';
import { useLanguage } from '../i18n/LanguageContext';
import { decodeQrFile, downloadOrShareRemoteFile, isNativeApp, scanQrWithNativeCamera } from '../lib/mobile';

interface Accreditation {
  organization_name?: string;
  certification_name?: string;
  certification_code?: string;
  credit_value?: number | string;
  credit_unit?: string;
  badge_url?: string;
  logo_url?: string;
  verification_url?: string;
  valid_from?: string;
  expires_at?: string;
  status?: string;
}

interface CertificateDetails {
  id?: string;
  student_name?: string;
  course_title?: string;
  course_level?: string;
  course_category?: string;
  issuer_name?: string;
  issuer_type?: string;
  issued_at?: string;
  expires_at?: string;
  duration_minutes?: number;
  verification_url?: string;
  pdf_url?: string;
  course_version?: string;
  pdf_mime_type?: string;
  pdf_sha256?: string;
  template_version?: number;
}

interface VerifyResponse {
  valid: boolean;
  status?: 'valid' | 'expired' | 'revoked' | 'not_found' | 'invalid_request' | 'error' | string;
  message?: string;
  certificate?: CertificateDetails;
  accreditations?: Accreditation[];
  revocation_reason?: string | null;
  revoked_at?: string | null;

  // Compatibilité avec l'ancienne réponse de l'Edge Function.
  omnia_certificate_id?: string;
  student_name?: string;
  course_title?: string;
  course_level?: string;
  course_category?: string;
  creator_name?: string;
  establishment_name?: string;
  issued_at?: string;
  cpd_hours?: number;
}

type ResultStatus = 'valid' | 'expired' | 'revoked' | 'not_found' | 'error';

function normalizeResponse(data: VerifyResponse): VerifyResponse {
  if (data.certificate) return data;
  return {
    ...data,
    certificate: {
      id: data.omnia_certificate_id,
      student_name: data.student_name,
      course_title: data.course_title,
      course_level: data.course_level,
      course_category: data.course_category,
      issuer_name: data.establishment_name || data.creator_name || 'Omnia Global Academy',
      issued_at: data.issued_at,
      duration_minutes: data.cpd_hours ? Math.round(data.cpd_hours * 60) : undefined,
    },
    accreditations: data.accreditations ?? [],
  };
}

function formatDate(value?: string | null, locale = 'fr-FR') {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value?: string | null, locale = 'fr-FR') {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDuration(minutes?: number) {
  if (!minutes || minutes <= 0) return 'Non renseignée';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  if (!rest) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

function extractCertificateId(raw: string) {
  const text = raw.trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    const parts = url.pathname.split('/').filter(Boolean);
    const verifyIndex = parts.findIndex(part => part === 'verify');
    return decodeURIComponent(parts[verifyIndex + 1] || parts[parts.length - 1] || '').toUpperCase();
  } catch {
    return text.toUpperCase();
  }
}

function StatusIcon({ status }: { status: ResultStatus }) {
  const common = 'w-10 h-10';
  if (status === 'valid') return <ShieldCheck className={`${common} text-green-700`} />;
  if (status === 'expired') return <AlertTriangle className={`${common} text-amber-700`} />;
  if (status === 'revoked') return <XCircle className={`${common} text-red-700`} />;
  return <AlertTriangle className={`${common} text-red-700`} />;
}

export default function VerifyCertificate() {
  const { locale } = useLanguage();
  const { certificateId } = useParams<{ certificateId: string }>();
  const navigate = useNavigate();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState(certificateId ?? '');
  const [activeTab, setActiveTab] = useState<'id' | 'qr'>('id');
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [verifiedAt, setVerifiedAt] = useState<Date | null>(null);
  const nativeApp = isNativeApp();

  const verify = useCallback(async (rawId?: string) => {
    const id = extractCertificateId(rawId ?? input);
    if (!id) return;
    setInput(id);
    setLoading(true);
    setSearched(false);
    try {
      const response = await fetch(`${ENDPOINTS.certificateVerify}?id=${encodeURIComponent(id)}`);
      const data = normalizeResponse(await response.json());
      setResult(data);
      setVerifiedAt(new Date());
      if (window.location.pathname !== `/verify/${encodeURIComponent(id)}`) {
        navigate(`/verify/${encodeURIComponent(id)}`, { replace: true });
      }
    } catch {
      setResult({ valid: false, status: 'error', message: 'Le service de vérification est momentanément indisponible.' });
      setVerifiedAt(new Date());
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, [input, navigate]);

  useEffect(() => {
    if (certificateId) void verify(certificateId);
    // La route ne doit déclencher la vérification qu'à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certificateId]);

  function showScanError(error: unknown) {
    setResult({
      valid: false,
      status: 'error',
      message: error instanceof Error ? error.message : 'Impossible de lire ce QR code.',
    });
    setSearched(true);
    setVerifiedAt(new Date());
  }

  async function scanQrFromFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setScanLoading(true);
    try {
      await verify(await decodeQrFile(file));
    } catch (error) {
      showScanError(error);
    } finally {
      setScanLoading(false);
    }
  }

  async function scanQrCode() {
    if (!nativeApp) {
      cameraInputRef.current?.click();
      return;
    }
    setScanLoading(true);
    try {
      const value = await scanQrWithNativeCamera();
      if (value) await verify(value);
    } catch (error) {
      showScanError(error);
    } finally {
      setScanLoading(false);
    }
  }

  async function downloadCertificatePdf() {
    if (!certificate?.pdf_url || downloadLoading) return;
    setDownloadLoading(true);
    try {
      await downloadOrShareRemoteFile(certificate.pdf_url, {
        fileName: `certificat-${certificate.id || input || 'omnia'}.pdf`,
        mimeType: certificate.pdf_mime_type || 'application/pdf',
        title: 'Certificat Omnia Global Academy',
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Téléchargement du certificat impossible.');
    } finally {
      setDownloadLoading(false);
    }
  }

  const status: ResultStatus = useMemo(() => {
    if (!result) return 'not_found';
    if (result.status === 'revoked' || result.status === 'revoque') return 'revoked';
    if (result.status === 'expired') return 'expired';
    if (result.valid || result.status === 'valid') return 'valid';
    if (result.status === 'not_found') return 'not_found';
    return 'error';
  }, [result]);

  const certificate = result?.certificate;
  const accreditations = (result?.accreditations ?? []).filter(item => !item.status || ['validated', 'valid', 'active', 'valide'].includes(item.status.toLowerCase()));

  const statusTheme = {
    valid: { title: 'CERTIFICAT VALIDE', subtitle: 'Ce certificat est authentique et valide.', bg: '#EEF8F0', border: '#2E8B57', text: '#1F7A46', badge: 'ACTIF' },
    expired: { title: 'CERTIFICAT EXPIRÉ', subtitle: 'Ce certificat a dépassé sa date de validité.', bg: '#FFF8E7', border: '#C58B13', text: '#9B6A0A', badge: 'EXPIRÉ' },
    revoked: { title: 'CERTIFICAT RÉVOQUÉ', subtitle: 'Ce certificat a été invalidé par l’organisme émetteur.', bg: '#FFF1F1', border: '#C43C3C', text: '#A32424', badge: 'RÉVOQUÉ' },
    not_found: { title: 'CERTIFICAT INTROUVABLE', subtitle: 'Aucun certificat ne correspond à cet identifiant.', bg: '#FFF1F1', border: '#C43C3C', text: '#A32424', badge: 'INTROUVABLE' },
    error: { title: 'VÉRIFICATION IMPOSSIBLE', subtitle: result?.message || 'Une erreur est survenue pendant la vérification.', bg: '#FFF8E7', border: '#C58B13', text: '#9B6A0A', badge: 'ERREUR' },
  }[status];

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-slate-900">
      <Navbar />

      <main className="pt-20">
        <section className="relative overflow-hidden border-b border-[#123B68] bg-[#002050] text-white">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute -right-24 -top-28 h-[420px] w-[420px] rounded-full bg-[#1F66B3]/25 blur-3xl" />
            <div className="absolute -bottom-52 left-[38%] h-[420px] w-[420px] rounded-full bg-[#BF8813]/15 blur-3xl" />
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,.16) 0 1px, transparent 1.5px)', backgroundSize: '28px 28px', maskImage: 'linear-gradient(90deg, transparent, black 42%, black)' }} />
          </div>
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-16">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#E9BC58]">Authenticité & confiance</p>
              <h1 className="mt-4 max-w-2xl text-4xl font-black leading-[1.05] tracking-[-0.045em] sm:text-5xl lg:text-[3.5rem]">
                Vérifier un <span className="text-[#E9BC58]">certificat Omnia</span>.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-blue-100/75 sm:text-lg">
                Entrez l’identifiant du certificat ou importez son QR code pour confirmer son authenticité directement auprès d’Omnia Global Academy.
              </p>
              <div className="mt-7 flex flex-wrap gap-2 text-xs font-bold text-white/65">
                <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5">Vérification publique</span>
                <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5">QR code local</span>
                <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5">Données sécurisées</span>
              </div>
            </div>

            <div className="relative mx-auto h-64 w-full max-w-md motion-reduce:transform-none" aria-hidden="true" style={{ perspective: '1200px' }}>
              <div className="absolute bottom-5 left-[12%] h-10 w-[76%] rounded-[50%] bg-black/30 blur-xl" />
              <div className="absolute right-8 top-4 h-52 w-44 rounded-[24px] border border-white/25 bg-white shadow-[0_34px_70px_rgba(0,0,0,0.28)]" style={{ transform: 'rotateY(-10deg) rotateX(4deg) translateZ(36px)' }}>
                <div className="absolute inset-x-5 top-7 h-2 rounded-full bg-[#002050]/80" />
                <div className="absolute left-5 right-12 top-14 h-2 rounded-full bg-slate-200" />
                <div className="absolute left-5 right-8 top-20 h-2 rounded-full bg-slate-100" />
                <div className="absolute bottom-6 right-5 flex h-16 w-16 items-center justify-center rounded-full border-[5px] border-[#BF8813] bg-[#FFF9E9] shadow-lg">
                  <Award className="h-8 w-8 text-[#002050]" />
                </div>
              </div>
              <div className="absolute left-5 top-16 flex h-32 w-32 items-center justify-center rounded-full border-[8px] border-[#E9BC58] bg-[#063A76] text-white shadow-[0_24px_55px_rgba(0,0,0,0.32)]" style={{ transform: 'translateZ(72px)' }}>
                <QrCode className="h-16 w-16" />
              </div>
              <div className="absolute left-[126px] top-[168px] h-20 w-5 -rotate-45 rounded-full bg-[#E9BC58] shadow-lg" style={{ transform: 'translateZ(48px)' }} />
            </div>
          </div>
        </section>

        <section className="relative z-10 mx-auto -mt-7 max-w-6xl px-5 pb-12 lg:px-6">
          <div className="rounded-[24px] border border-[#DCE5F0] bg-white p-5 shadow-[0_24px_60px_rgba(0,32,80,0.12)] sm:p-7">
            <div className="flex border-b border-slate-200">
              <button onClick={() => setActiveTab('id')} className={`relative px-5 pb-4 text-sm font-semibold ${activeTab === 'id' ? 'text-[#8A610D]' : 'text-slate-600'}`}>
                PAR IDENTIFIANT
                {activeTab === 'id' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#BF8813]" />}
              </button>
              <button onClick={() => setActiveTab('qr')} className={`relative px-5 pb-4 text-sm font-semibold ${activeTab === 'qr' ? 'text-[#8A610D]' : 'text-slate-600'}`}>
                PAR QR CODE
                {activeTab === 'qr' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#BF8813]" />}
              </button>
            </div>

            {activeTab === 'id' ? (
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <FileCheck2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A98B4D]" />
                  <input
                    value={input}
                    onChange={event => setInput(event.target.value.toUpperCase())}
                    onKeyDown={event => event.key === 'Enter' && void verify()}
                    placeholder="Exemple : OMN-2026-000123"
                    className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-4 text-sm uppercase tracking-wide text-[#002050] outline-none transition focus:border-[#BF8813] focus:ring-2 focus:ring-[#BF8813]/15"
                  />
                </div>
                <button
                  onClick={() => void verify()}
                  disabled={loading || !input.trim()}
                  className="inline-flex h-12 min-w-40 items-center justify-center gap-2 rounded-lg bg-[#BF8813] px-6 text-sm font-bold text-white transition hover:bg-[#A9750F] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  VÉRIFIER
                </button>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed border-[#C8D7E8] bg-[#F7FAFD] px-6 py-8 text-center">
                <QrCode className="mx-auto h-10 w-10 text-[#BF8813]" />
                <p className="mt-3 text-sm font-semibold text-[#002050]">Importer une photo du QR code</p>
                <p className="mt-1 text-xs text-slate-500">La lecture reste locale sur votre appareil. Aucune image du QR code n’est envoyée.</p>
                <button
                  onClick={() => void scanQrCode()}
                  disabled={scanLoading}
                  className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg border border-[#BF8813] px-5 text-sm font-semibold text-[#8A610D] hover:bg-[#FFF8E8] disabled:opacity-60"
                >
                  {scanLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : nativeApp ? <QrCode className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                  {nativeApp ? 'Scanner avec la caméra' : 'Choisir une image'}
                </button>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={scanQrFromFile} className="hidden" />
              </div>
            )}
            <p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-[#BF8813]" /> L’identifiant figure sur le certificat et dans son QR code.</p>
          </div>

          {searched && result && (
            <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-[0_22px_50px_rgba(0,32,80,0.10)]" style={{ borderColor: statusTheme.border }}>
              <div className="grid lg:grid-cols-[0.82fr_1.18fr]">
                <div className="flex items-center gap-5 border-b p-7 lg:border-b-0 lg:border-r" style={{ backgroundColor: statusTheme.bg, borderColor: `${statusTheme.border}30` }}>
                  <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full bg-white/80 shadow-sm">
                    <StatusIcon status={status} />
                  </div>
                  <div>
                    <p className="text-xl font-bold" style={{ color: statusTheme.text }}>{statusTheme.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{statusTheme.subtitle}</p>
                    <span className="mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: `${statusTheme.border}18`, color: statusTheme.text }}>{statusTheme.badge}</span>
                  </div>
                </div>

                {certificate ? (
                  <div className="grid gap-x-8 gap-y-5 p-7 sm:grid-cols-2">
                    <Detail label="Titulaire" value={certificate.student_name || '—'} />
                    <Detail label="Identifiant" value={certificate.id || input || '—'} mono />
                    <Detail label="Formation" value={certificate.course_title || '—'} />
                    <Detail label="Date d’émission" value={formatDate(certificate.issued_at, locale)} />
                    <Detail label="Émetteur" value={certificate.issuer_name || 'Omnia Global Academy'} />
                    <Detail label="Statut" value={status === 'valid' ? 'Valide' : status === 'expired' ? 'Expiré' : 'Révoqué'} accent={statusTheme.text} />
                    {certificate.pdf_sha256 && <Detail label="Empreinte PDF" value={certificate.pdf_sha256.slice(0, 20) + '…'} mono />}
                    {certificate.pdf_url && status === 'valid' && <div className="sm:col-span-2"><button type="button" onClick={() => void downloadCertificatePdf()} disabled={downloadLoading} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#002050' }}>{downloadLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {nativeApp ? 'Enregistrer ou partager le PDF' : 'Télécharger le certificat PDF'}</button></div>}
                    {result.revocation_reason && <div className="sm:col-span-2"><Detail label="Motif de révocation" value={result.revocation_reason} /></div>}
                  </div>
                ) : (
                  <div className="flex items-center p-7 text-sm leading-6 text-slate-600">{result.message || statusTheme.subtitle}</div>
                )}
              </div>

              {certificate && (
                <div className="grid border-t border-slate-200 bg-[#F7FAFD] sm:grid-cols-3">
                  <Metric icon={Clock3} label="Durée de la formation" value={formatDuration(certificate.duration_minutes)} />
                  <Metric icon={GraduationCap} label="Type de certification" value={accreditations[0]?.certification_name || 'Certification Omnia'} />
                  <Metric icon={CalendarDays} label="Vérifié le" value={verifiedAt ? formatDateTime(verifiedAt.toISOString(), locale) : '—'} />
                </div>
              )}

              {certificate && accreditations.length > 0 && (
                <div className="border-t border-slate-200 p-7">
                  <h2 className="text-base font-bold text-[#002050]">Organismes et reconnaissances associés</h2>
                  <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {accreditations.map((item, index) => (
                      <div key={`${item.organization_name}-${index}`} className="rounded-xl border border-[#DCE5F0] bg-[#F8FAFD] p-4">
                        <div className="flex items-start gap-3">
                          {item.badge_url || item.logo_url ? (
                            <img src={item.badge_url || item.logo_url} alt={item.organization_name || 'Organisme certificateur'} className="h-12 w-12 rounded-lg object-contain" />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#FFF4D8]"><BadgeCheck className="h-6 w-6 text-[#BF8813]" /></div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[#002050]">{item.organization_name || 'Organisme certificateur'}</p>
                            <p className="mt-1 text-xs text-slate-600">{item.certification_name || 'Certification associée'}</p>
                            {item.certification_code && <p className="mt-2 text-[11px] font-medium text-slate-500">Code : {item.certification_code}</p>}
                            {(item.credit_value || item.credit_unit) && <p className="mt-1 text-[11px] font-semibold text-[#8A610D]">{item.credit_value ?? ''} {item.credit_unit ?? ''}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {searched && (
            <div className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
              <button onClick={() => { setInput(''); setResult(null); setSearched(false); navigate('/verify', { replace: true }); }} className="inline-flex items-center gap-2 text-sm font-semibold text-[#002050] hover:text-[#BF8813]">
                <RefreshCcw className="h-4 w-4" /> Vérifier un autre certificat
              </button>
              <Link to="/accueil" className="text-sm font-semibold text-[#8A610D] hover:text-[#002050]">Retour à Omnia Global Academy</Link>
            </div>
          )}

          <div className="mx-auto mt-7 flex max-w-2xl items-start gap-3 rounded-xl border border-[#DCE5F0] bg-[#F3F7FC] px-5 py-4">
            <LockKeyhole className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#BF8813]" />
            <p className="text-xs leading-5 text-slate-600">Ce service de vérification est fourni par Omnia Global Academy. Les informations affichées proviennent de notre base de données sécurisée.</p>
          </div>
        </section>
      </main>

      <PageFooter />
    </div>
  );
}

function Detail({ label, value, mono = false, accent }: { label: string; value: string; mono?: boolean; accent?: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${mono ? 'font-mono text-xs' : ''}`} style={{ color: accent || '#172033' }}>{value}</p>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D9C17F] bg-white"><Icon className="h-5 w-5 text-[#BF8813]" /></div>
      <div>
        <p className="text-[11px] text-slate-500">{label}</p>
        <p className="mt-0.5 text-xs font-semibold text-[#002050]">{value}</p>
      </div>
    </div>
  );
}
