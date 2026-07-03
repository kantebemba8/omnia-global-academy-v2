import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { PageFooter } from '../components/PageFooter';
import { ENDPOINTS } from '../lib/config';
import { CheckCircle, XCircle, AlertTriangle, Search, Shield, Award, BadgeCheck, ExternalLink, Loader2 } from 'lucide-react';

interface CertResult {
  valid: boolean;
  status?: string;
  message?: string;
  omnia_certificate_id?: string;
  student_name?: string;
  course_title?: string;
  course_level?: string;
  course_category?: string;
  cpd_hours?: number;
  cpd_accredited?: boolean;
  cpd_provider_code?: string;
  cpd_badge_url?: string;
  template_type?: string;
  creator_name?: string;
  establishment_name?: string;
  issued_at?: string;
  pdf_url?: string;
  revocation_reason?: string;
  revoked_at?: string;
}

function qrSvg(text: string): string {
  const size = 96, cell = 8, cells = Math.floor(size / cell);
  let seed = text.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  let rects = '';
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      if (seed % 3 === 0) rects += `<rect x="${c * cell}" y="${r * cell}" width="${cell}" height="${cell}" fill="#002050"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="border-radius:4px">${rects}</svg>`;
}

export default function VerifyCertificate() {
  const { certificateId } = useParams<{ certificateId: string }>();
  const navigate = useNavigate();

  const [input, setInput] = useState(certificateId ?? '');
  const [result, setResult] = useState<CertResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (certificateId) verify(certificateId);
  }, []);

  async function verify(id?: string) {
    const certId = (id ?? input).trim().toUpperCase();
    if (!certId) return;
    setLoading(true);
    setSearched(false);
    try {
      const res = await fetch(`${ENDPOINTS.certificateVerify}?id=${encodeURIComponent(certId)}`);
      const d: CertResult = await res.json();
      setResult(d);
    } catch {
      setResult({ valid: false, status: 'error', message: 'Erreur de connexion. Veuillez réessayer.' });
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  const appUrl = window.location.origin;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-12 w-full">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: '#002050' }}>
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#002050' }}>Vérification de certificat</h1>
          <p className="text-gray-500 max-w-md mx-auto">Vérifiez l'authenticité d'un certificat Omnia Global Academy en saisissant son identifiant unique.</p>
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Identifiant du certificat</label>
          <div className="flex gap-3">
            <input
              value={input}
              onChange={e => setInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && verify()}
              placeholder="Ex: CERT-2026-A3KP9X2MQT"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono uppercase focus:outline-none focus:border-gray-400 tracking-widest"
            />
            <button
              onClick={() => verify()}
              disabled={loading || !input.trim()}
              className="px-6 py-3 rounded-xl text-white font-semibold text-sm flex items-center gap-2 disabled:opacity-60 transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#002050' }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Vérifier
            </button>
          </div>
        </div>

        {/* Result */}
        {searched && result && (
          <>
            {result.valid && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '2px solid #1E7A52' }}>
                {/* Green header */}
                <div className="p-6" style={{ background: 'linear-gradient(135deg, #1E7A52, #2d9d6b)' }}>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                      <CheckCircle className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-xl">Certificat Authentique</p>
                      <p className="text-white/70 text-sm">Vérifié dans la base de données Omnia Global Academy</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Gold divider */}
                  <div className="h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, #BF8813, rgba(191,136,19,0.2))' }} />

                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1">
                      <p className="text-2xl font-bold mb-1" style={{ color: '#002050' }}>{result.student_name}</p>
                      <p className="text-lg font-semibold text-gray-700 mb-3">{result.course_title}</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">{result.course_level}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">{result.course_category}</span>
                        {result.cpd_accredited && result.cpd_hours && (
                          <span className="text-xs px-3 py-1 rounded-full flex items-center gap-1 font-medium" style={{ backgroundColor: '#FEF9EE', color: '#BF8813', border: '1px solid #BF8813' }}>
                            <BadgeCheck className="w-3.5 h-3.5" /> CPD {result.cpd_hours}h
                          </span>
                        )}
                      </div>
                    </div>

                    {/* QR visual */}
                    <div className="flex-shrink-0 bg-white border border-gray-100 rounded-xl p-2 shadow-sm">
                      <div dangerouslySetInnerHTML={{ __html: qrSvg(result.omnia_certificate_id ?? '') }} />
                      <p className="text-xs text-center text-gray-400 mt-1 font-mono">{result.omnia_certificate_id}</p>
                    </div>
                  </div>

                  {/* Detail table */}
                  <div className="bg-gray-50 rounded-xl overflow-hidden">
                    {[
                      ['Date de délivrance', result.issued_at ? new Date(result.issued_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'],
                      ['Identifiant certificat', result.omnia_certificate_id ?? '—'],
                      ['Type', result.template_type === 'B' ? 'Établissement' : 'Professeur indépendant'],
                      result.template_type === 'A' ? ['Formateur', result.creator_name ?? '—'] : ['École', result.establishment_name ?? '—'],
                      result.cpd_accredited ? ['Accréditation', `CPD Certified (${result.cpd_provider_code ?? 'Omnia-CPD'})`] : null,
                    ].filter(Boolean).map(([label, value], i) => (
                      <div key={i} className={`flex gap-4 px-4 py-3 text-sm ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                        <span className="text-gray-500 w-44 flex-shrink-0">{label}</span>
                        <span className={`font-medium text-gray-800 ${label === 'Identifiant certificat' ? 'font-mono text-xs' : ''}`}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* CPD badge */}
                  {result.cpd_accredited && (
                    <div className="rounded-xl p-4 flex items-start gap-3" style={{ backgroundColor: '#FFF9E6', border: '1px solid #BF8813' }}>
                      <BadgeCheck className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#BF8813' }} />
                      <div>
                        <p className="font-semibold text-sm" style={{ color: '#BF8813' }}>Formation accréditée CPD</p>
                        <p className="text-xs text-amber-700 mt-0.5">Reconnue internationalement dans +40 pays</p>
                      </div>
                    </div>
                  )}

                  {/* PDF link */}
                  {result.pdf_url && (
                    <a href={result.pdf_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity" style={{ color: '#002050' }}>
                      <ExternalLink className="w-4 h-4" /> Voir le certificat original
                    </a>
                  )}
                </div>
              </div>
            )}

            {!result.valid && result.status === 'revoque' && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '2px solid #DC2626' }}>
                <div className="p-6 bg-red-50 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <XCircle className="w-9 h-9 text-red-600" />
                  </div>
                  <div>
                    <p className="font-bold text-xl text-red-700">Certificat Révoqué</p>
                    <p className="text-red-600 text-sm mt-0.5">Ce certificat a été invalidé par l'administration.</p>
                  </div>
                </div>
                {result.revocation_reason && (
                  <div className="px-6 py-4">
                    <p className="text-sm text-gray-600"><strong>Raison :</strong> {result.revocation_reason}</p>
                    {result.revoked_at && <p className="text-xs text-gray-400 mt-1">Le {new Date(result.revoked_at).toLocaleDateString('fr-FR')}</p>}
                  </div>
                )}
              </div>
            )}

            {!result.valid && result.status !== 'revoque' && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '2px solid #DC2626' }}>
                <div className="p-6 bg-red-50 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-9 h-9 text-red-600" />
                  </div>
                  <div>
                    <p className="font-bold text-xl text-red-700">Ce certificat n'est pas authentique.</p>
                    <p className="text-red-600 text-sm mt-1">Aucun certificat portant cet identifiant n'a été trouvé dans notre base de données.</p>
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-red-100">
                  <a href="mailto:contact@omniaglobalacademy.com" className="text-sm text-red-600 font-medium hover:underline">
                    Signaler une fraude →
                  </a>
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer contact */}
        <div className="mt-10 text-center">
          <p className="text-sm text-gray-500">Vous avez un doute sur un certificat ?</p>
          <a href="mailto:contact@omniaglobalacademy.com" className="text-sm font-medium mt-1 inline-block" style={{ color: '#002050' }}>
            contact@omniaglobalacademy.com
          </a>
        </div>
      </main>
      <PageFooter />
    </div>
  );
}
