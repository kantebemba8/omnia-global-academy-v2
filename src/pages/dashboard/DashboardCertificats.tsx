import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { ENDPOINTS } from '../../lib/config';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { Award, Star, CheckCircle, X, Clock, ExternalLink, Share2, Linkedin, BadgeCheck, FileText } from 'lucide-react';

interface Certificate {
  id: string;
  omnia_certificate_id: string;
  course_id: string;
  course_title: string;
  course_level: string;
  course_category: string;
  cpd_accredited: boolean;
  cpd_hours: number;
  cpd_badge_url: string | null;
  cpd_pending: boolean;
  pdf_url: string | null;
  qr_svg: string | null;
  verification_url: string | null;
  issued_at: string;
  expires_at: string | null;
  status: string;
  validity_status: string | null;
}

interface FeedbackState {
  open: boolean; course_id: string; course_title: string;
  quality_score: number; would_recommend: boolean | null; suggestions: string;
  submitting: boolean; done: boolean; error: string;
}

function getApiBase() {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return url ? `${url}/functions/v1` : '/api';
}

function certificateState(cert: Certificate) {
  const status = String(cert.status || '').toLowerCase();
  const validity = String(cert.validity_status || '').toLowerCase();
  if (validity === 'revoked' || status === 'revoked' || status === 'revoque') {
    return { kind: 'revoked' as const, label: 'Certificat révoqué', color: '#DC2626' };
  }
  if (cert.expires_at && new Date(cert.expires_at).getTime() < Date.now()) {
    return { kind: 'expired' as const, label: 'Certificat expiré', color: '#BF8813' };
  }
  return { kind: 'valid' as const, label: 'Certificat valide', color: '#1E7A52' };
}

export function DashboardCertificats() {
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [fb, setFb] = useState<FeedbackState>({
    open: false, course_id: '', course_title: '', quality_score: 5,
    would_recommend: null, suggestions: '', submitting: false, done: false, error: '',
  });

  const bypassAuth = new URLSearchParams(window.location.search).get('preview') === 'true' &&
    (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; } })();

  const load = useCallback(async () => {
    if (bypassAuth) { setLoading(false); return; }
    const token = localStorage.getItem('omnia_session_token');
    if (!token) { setLoading(false); return; }

    try {
      const res = await fetch(ENDPOINTS.dashboardApprenant, { headers: edgeAuthHeaders() });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setCerts(Array.isArray(json.certificates) ? json.certificates : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function copyShareLink(certId: string) {
    const url = `${window.location.origin}/verify/${certId}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(certId);
    setTimeout(() => setCopied(null), 2500);
  }

  async function submitFeedback() {
    if (fb.would_recommend === null) { setFb(p => ({ ...p, error: 'Répondez à la question de recommandation.' })); return; }
    setFb(p => ({ ...p, submitting: true, error: '' }));
    try {
      const res = await fetch(`${getApiBase()}/feedback-submit`, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({ course_id: fb.course_id, quality_score: fb.quality_score, would_recommend: fb.would_recommend, suggestions: fb.suggestions }),
      });
      const json = await res.json();
      if (!res.ok) { setFb(p => ({ ...p, submitting: false, error: json.error === 'FEEDBACK_ALREADY_SUBMITTED' ? 'Avis déjà soumis.' : json.message || json.error })); return; }
      setFb(p => ({ ...p, submitting: false, done: true }));
    } catch { setFb(p => ({ ...p, submitting: false, error: 'Erreur réseau' })); }
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mes certificats</h1>
          <p className="text-gray-500 text-sm mt-1">{certs.length} certificat{certs.length !== 1 ? 's' : ''} obtenu{certs.length !== 1 ? 's' : ''}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : certs.length === 0 ? (
          <div className="bg-white rounded-xl p-12 border border-gray-100 text-center">
            <Award className="w-12 h-12 mx-auto mb-4 text-gray-200" />
            <p className="text-gray-500">Aucun certificat pour l'instant</p>
            <p className="text-gray-400 text-sm mt-1">Terminez une formation pour obtenir votre certificat.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {certs.map(cert => {
              const state = certificateState(cert);
              return (
              <div key={cert.id || cert.course_id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Certificate header */}
                <div className="p-5" style={{ background: 'linear-gradient(135deg, #002050, #003580)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Award className="w-4 h-4 flex-shrink-0" style={{ color: '#BF8813' }} />
                        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#BF8813' }}>Certificat</span>
                        {cert.cpd_accredited && (
                          <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: 'rgba(191,136,19,0.2)', color: '#BF8813' }}>
                            <BadgeCheck className="w-3 h-3" /> CPD
                          </span>
                        )}
                      </div>
                      <h3 className="text-white font-bold text-sm leading-snug">{cert.course_title}</h3>
                      {cert.omnia_certificate_id && (
                        <p className="text-white/40 text-xs font-mono mt-1">{cert.omnia_certificate_id}</p>
                      )}
                    </div>
                    {cert.qr_svg ? (
                      <div className="flex-shrink-0 bg-white rounded-lg p-1 [&_svg]:h-20 [&_svg]:w-20"
                        dangerouslySetInnerHTML={{ __html: cert.qr_svg }} />
                    ) : (
                      <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-white/10">
                        <Award className="h-8 w-8" style={{ color: '#BF8813' }} />
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-1.5">
                    {state.kind === 'valid' ? <CheckCircle className="w-3.5 h-3.5" style={{ color: state.color }} /> : <Clock className="w-3.5 h-3.5" style={{ color: state.color }} />}
                    <span className="text-xs text-white/70">
                      {state.label} · émis le {cert.issued_at ? new Date(cert.issued_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </span>
                  </div>
                </div>

                {/* CPD pending banner */}
                {cert.cpd_pending && (
                  <div className="px-4 py-2 flex items-center gap-2 border-b border-amber-100" style={{ backgroundColor: '#FFF7ED' }}>
                    <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#BF8813' }} />
                    <p className="text-xs" style={{ color: '#BF8813' }}>Badge CPD en attente de crédits</p>
                  </div>
                )}

                {/* Actions */}
                <div className="p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {cert.pdf_url && (
                      <a href={cert.pdf_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                        <FileText className="w-3.5 h-3.5" /> Télécharger PDF
                      </a>
                    )}
                    {cert.omnia_certificate_id && (
                      <Link to={`/verify/${cert.omnia_certificate_id}`}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" /> Vérifier en ligne
                      </Link>
                    )}
                    {cert.omnia_certificate_id && (
                      <button
                        onClick={() => copyShareLink(cert.omnia_certificate_id)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors"
                        style={copied === cert.omnia_certificate_id
                          ? { backgroundColor: '#F0FAF5', borderColor: '#1E7A52', color: '#1E7A52' }
                          : { borderColor: '#e5e7eb', color: '#374151' }}>
                        <Share2 className="w-3.5 h-3.5" />
                        {copied === cert.omnia_certificate_id ? 'Lien copié !' : 'Partager'}
                      </button>
                    )}
                    {cert.cpd_badge_url && (
                      <a href={cert.cpd_badge_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-90"
                        style={{ backgroundColor: '#0A66C2' }}>
                        <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                      </a>
                    )}
                  </div>

                  <button
                    onClick={() => setFb({ open: true, course_id: cert.course_id, course_title: cert.course_title, quality_score: 5, would_recommend: null, suggestions: '', submitting: false, done: false, error: '' })}
                    className="w-full text-xs font-medium flex items-center justify-center gap-1 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                    style={{ color: '#BF8813' }}>
                    <Star className="w-3.5 h-3.5" /> Laisser un avis
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Feedback Modal */}
      {fb.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Avis sur la formation</h2>
              <button onClick={() => setFb(p => ({ ...p, open: false }))} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            {fb.done ? (
              <div className="p-8 text-center">
                <CheckCircle className="w-12 h-12 mx-auto mb-3" style={{ color: '#1E7A52' }} />
                <p className="font-semibold text-gray-900">Merci pour votre avis !</p>
                <button onClick={() => setFb(p => ({ ...p, open: false }))} className="mt-4 text-sm font-medium px-4 py-2 rounded-lg text-white" style={{ backgroundColor: '#002050' }}>Fermer</button>
              </div>
            ) : (
              <div className="p-5 space-y-5">
                <p className="text-sm text-gray-600">Formation : <strong>{fb.course_title}</strong></p>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Qualité globale</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(s => (
                      <button key={s} onClick={() => setFb(p => ({ ...p, quality_score: s }))} className="transition-transform hover:scale-110">
                        <Star className="w-7 h-7" style={{ fill: s <= fb.quality_score ? '#BF8813' : 'none', color: s <= fb.quality_score ? '#BF8813' : '#d1d5db' }} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Recommanderiez-vous cette formation ?</label>
                  <div className="flex gap-3">
                    {([true, false] as const).map(v => (
                      <button key={String(v)} onClick={() => setFb(p => ({ ...p, would_recommend: v }))}
                        className="flex-1 py-2 rounded-lg border text-sm font-medium transition-all"
                        style={fb.would_recommend === v ? { backgroundColor: '#002050', color: 'white', borderColor: '#002050' } : { borderColor: '#e5e7eb', color: '#374151' }}>
                        {v ? 'Oui' : 'Non'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Suggestions (optionnel)</label>
                  <textarea rows={3} value={fb.suggestions} onChange={e => setFb(p => ({ ...p, suggestions: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-gray-400"
                    placeholder="Vos suggestions pour améliorer la formation..." />
                </div>
                {fb.error && <p className="text-red-600 text-sm">{fb.error}</p>}
                <button onClick={submitFeedback} disabled={fb.submitting}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                  style={{ backgroundColor: '#002050' }}>
                  {fb.submitting ? 'Envoi...' : 'Soumettre mon avis'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
