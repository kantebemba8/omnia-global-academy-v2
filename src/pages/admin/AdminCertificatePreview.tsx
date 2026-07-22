import { useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { Eye, RefreshCw } from 'lucide-react';

export default function AdminCertificatePreview() {
  const [template, setModèle] = useState<'A' | 'B' | 'C'>('A');
  const [cpd, setCpd] = useState(false);
  const [studentName, setStudentName] = useState('Amadou Coulibaly');
  const [courseTitle, setCourseTitle] = useState('Data Science & Intelligence Artificielle');
  const [level, setLevel] = useState('Avancé');
  const [category, setCategory] = useState('Data & IA');
  const [cpdhours, setCpdhours] = useState('40');
  const [profName, setProfName] = useState('Dr. Oumar Traoré');
  const [schoolName, setSchoolName] = useState('Institut Supérieur de Technologie');
  const [directorName, setDirectorName] = useState('Moussa Koné');

  const certId = 'CERT-2026-4A7B2C9F1E';
  const today = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const qrSvg = `<svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="56" height="56">
    <rect width="56" height="56" fill="white"/>
    <rect x="2" y="2" width="16" height="16" fill="#002050"/>
    <rect x="4" y="4" width="12" height="12" fill="white"/>
    <rect x="6" y="6" width="8" height="8" fill="#002050"/>
    <rect x="38" y="2" width="16" height="16" fill="#002050"/>
    <rect x="40" y="4" width="12" height="12" fill="white"/>
    <rect x="42" y="6" width="8" height="8" fill="#002050"/>
    <rect x="2" y="38" width="16" height="16" fill="#002050"/>
    <rect x="4" y="40" width="12" height="12" fill="white"/>
    <rect x="6" y="42" width="8" height="8" fill="#002050"/>
    <rect x="20" y="2" width="4" height="2" fill="#002050"/>
    <rect x="26" y="4" width="4" height="2" fill="#002050"/>
    <rect x="32" y="2" width="4" height="2" fill="#002050"/>
    <rect x="20" y="20" width="16" height="2" fill="#002050"/>
    <rect x="20" y="24" width="2" height="8" fill="#002050"/>
    <rect x="24" y="22" width="4" height="4" fill="#002050"/>
    <rect x="30" y="22" width="6" height="2" fill="#002050"/>
    <rect x="20" y="36" width="4" height="2" fill="#002050"/>
    <rect x="26" y="36" width="2" height="6" fill="#002050"/>
    <rect x="30" y="38" width="4" height="2" fill="#002050"/>
    <rect x="36" y="36" width="4" height="4" fill="#002050"/>
  </svg>`;

  function CertPreview() {
    const headerLeft = template === 'B'
      ? (
        <div className="flex items-center gap-3">
          <div style={{ fontWeight: 900, fontSize: 18, color: '#002050', letterSpacing: '0.1em' }}>OMNIA</div>
          <div style={{ width: 1, height: 32, background: 'rgba(0,32,80,0.2)' }} />
          <div style={{ width: 36, height: 36, background: '#002050', borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 7, fontWeight: 900, color: '#BF8813', textAlign: 'center' }}>
            ÉCOLE
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#002050' }}>{schoolName}</div>
            <div style={{ fontSize: 9, color: '#6B7280' }}>Établissement partenaire</div>
          </div>
        </div>
      )
      : (
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#002050', letterSpacing: '0.1em' }}>OMNIA</div>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#BF8813', letterSpacing: '0.22em' }}>GLOBAL ACADEMY</div>
        </div>
      );

    const headerRight = cpd
      ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
          border: '2px solid #BF8813', borderRadius: 20, background: 'rgba(191,136,19,0.05)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#BF8813" strokeWidth="2"/>
            <path d="M8 12l3 3 5-5" stroke="#BF8813" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#BF8813', letterSpacing: '0.1em' }}>
            CPD CERTIFIED · {cpdhours}h
          </span>
        </div>
      )
      : template === 'A'
      ? <div style={{ fontSize: 11, color: '#6B7280' }}>{profName}</div>
      : null;

    const footerLeft = template === 'B'
      ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 120, height: 1, background: '#002050' }} />
          <div style={{ fontSize: 9, fontWeight: 700, color: '#002050' }}>{directorName}</div>
          <div style={{ fontSize: 8, color: '#6B7280' }}>{schoolName}</div>
        </div>
      )
      : template === 'C'
      ? <div style={{ width: 140 }} />
      : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 120, height: 1, background: '#002050' }} />
          <div style={{ fontSize: 9, fontWeight: 700, color: '#002050' }}>{profName}</div>
          <div style={{ fontSize: 8, color: '#6B7280' }}>Formateur</div>
        </div>
      );

    const platformMention = template === 'C'
      ? <div style={{ fontSize: 11, color: '#6B7280', fontStyle: 'italic', textAlign: 'center' }}>
          Formation certifiée par Omnia Global Academy
        </div>
      : null;

    return (
      <div style={{
        width: '100%', aspectRatio: '1122/794', background: '#fff',
        position: 'relative', borderRadius: 6, overflow: 'hidden',
        fontFamily: 'Inter, sans-serif', color: '#002050',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
      }}>
        {/* Borders */}
        <div style={{ position: 'absolute', inset: 12, border: '3px solid #002050', borderRadius: 6, pointerEvents: 'none', zIndex: 10 }} />
        <div style={{ position: 'absolute', inset: 18, border: '1px solid rgba(0,32,80,0.2)', borderRadius: 4, pointerEvents: 'none', zIndex: 10 }} />

        {/* Content */}
        <div style={{
          position: 'absolute', inset: 40,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 60px'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: template === 'C' ? 'center' : 'space-between',
            width: '100%', borderBottom: '2px solid #002050', paddingBottom: 14
          }}>
            {headerLeft}
            {headerRight}
          </div>

          {/* Title */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#BF8813',
              letterSpacing: '0.28em', textTransform: 'uppercase',
              borderBottom: '1px solid #BF8813', paddingBottom: 6, display: 'inline-block' }}>
              Certificat de réussite
            </div>
            <div style={{ margin: '10px 0 6px', fontSize: 11, color: '#6B7280' }}>
              Ce certificat est décerné à
            </div>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#002050', lineHeight: 1.1 }}>
              {studentName}
            </div>
          </div>

          {/* Completion */}
          <div style={{ fontSize: 13, color: '#374151', textAlign: 'center', lineHeight: 1.6, maxWidth: 600 }}>
            pour avoir complété avec succès la formation<br/>
            <span style={{ fontWeight: 700, color: '#002050', fontSize: 16 }}>{courseTitle}</span>
          </div>

          {platformMention}

          {/* Badges */}
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 8, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Niveau</span>
              <span style={{ fontSize: 11, fontWeight: 700 }}>{level}</span>
            </div>
            <div style={{ width: 1, height: 32, background: '#E4E7EC' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 8, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Catégorie</span>
              <span style={{ fontSize: 11, fontWeight: 700 }}>{category}</span>
            </div>
            {cpd && (
              <>
                <div style={{ width: 1, height: 32, background: '#E4E7EC' }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <span style={{ fontSize: 8, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Durée CPD</span>
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{cpdhours}h</span>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex',
            justifyContent: template === 'C' ? 'center' : 'space-between',
            gap: template === 'C' ? 80 : 0,
            alignItems: 'flex-end', width: '100%',
            paddingTop: 12, borderTop: '1px solid #E4E7EC'
          }}>
            {footerLeft}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <div style={{ fontSize: 7, fontFamily: 'monospace', color: '#9CA3AF', letterSpacing: '0.08em' }}>
                {certId}
              </div>
              <div style={{ fontSize: 7, color: '#6B7280' }}>Vérifier l'authenticité</div>
              <div style={{ fontSize: 8, color: '#9CA3AF' }}>{today}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 120, height: 1, background: '#002050' }} />
              <div style={{ fontSize: 9, fontWeight: 700, color: '#002050' }}>Administration</div>
              <div style={{ fontSize: 8, color: '#6B7280' }}>Omnia Global Academy</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>Aperçu & tests des certificats</h1>
          <p className="text-sm mt-1 text-amber-700">Mode aperçu — toutes les données affichées ici sont fictives et aucun certificat réel n’est créé.</p>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Contrôles */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border p-5 space-y-4"
              style={{ borderColor: '#E4E7EC' }}>
              <h2 className="font-semibold text-sm" style={{ color: '#002050' }}>
                Modèle
              </h2>
              {(['A', 'B', 'C'] as const).map(t => (
                <label key={t} className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="template" value={t}
                    checked={template === t} onChange={() => setModèle(t)}
                    style={{ accentColor: '#002050' }} />
                  <div>
                    <span className="text-sm font-medium" style={{ color: '#002050' }}>
                      Modèle {t}
                    </span>
                    <span className="text-xs ml-2" style={{ color: '#6B7280' }}>
                      {t === 'A' ? '— Professeur' : t === 'B' ? '— Structure' : '— Plateforme'}
                    </span>
                  </div>
                </label>
              ))}

              <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: '#E4E7EC' }}>
                <input type="checkbox" id="cpd" checked={cpd}
                  onChange={e => setCpd(e.target.checked)}
                  style={{ accentColor: '#BF8813' }} />
                <label htmlFor="cpd" className="text-sm cursor-pointer"
                  style={{ color: '#002050' }}>
                  Badges / accréditations validés
                </label>
              </div>
            </div>

            <div className="bg-white rounded-xl border p-5 space-y-3"
              style={{ borderColor: '#E4E7EC' }}>
              <h2 className="font-semibold text-sm" style={{ color: '#002050' }}>
                Contenu
              </h2>
              {[
                { label: 'Étudiant', value: studentName, set: setStudentName },
                { label: 'Formation', value: courseTitle, set: setCourseTitle },
                { label: 'Niveau', value: level, set: setLevel },
                { label: 'Catégorie', value: category, set: setCategory },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>
                    {f.label}
                  </label>
                  <input type="text" value={f.value}
                    onChange={e => f.set(e.target.value)}
                    className="w-full px-2.5 py-2 border rounded-lg text-xs"
                    style={{ borderColor: '#E4E7EC' }} />
                </div>
              ))}
              {cpd && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>
                    Heures CPD
                  </label>
                  <input type="number" value={cpdhours}
                    onChange={e => setCpdhours(e.target.value)}
                    className="w-full px-2.5 py-2 border rounded-lg text-xs"
                    style={{ borderColor: '#E4E7EC' }} />
                </div>
              )}
              {template === 'A' && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>
                    Nom du professeur
                  </label>
                  <input type="text" value={profName}
                    onChange={e => setProfName(e.target.value)}
                    className="w-full px-2.5 py-2 border rounded-lg text-xs"
                    style={{ borderColor: '#E4E7EC' }} />
                </div>
              )}
              {template === 'B' && (
                <>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>
                      Structure
                    </label>
                    <input type="text" value={schoolName}
                      onChange={e => setSchoolName(e.target.value)}
                      className="w-full px-2.5 py-2 border rounded-lg text-xs"
                      style={{ borderColor: '#E4E7EC' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>
                      Directeur
                    </label>
                    <input type="text" value={directorName}
                      onChange={e => setDirectorName(e.target.value)}
                      className="w-full px-2.5 py-2 border rounded-lg text-xs"
                      style={{ borderColor: '#E4E7EC' }} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Aperçu */}
          <div className="col-span-2">
            <div className="bg-white rounded-xl border p-4" style={{ borderColor: '#E4E7EC' }}>
              <div className="flex items-center gap-2 mb-4">
                <Eye size={16} style={{ color: '#002050' }} />
                <span className="font-semibold text-sm" style={{ color: '#002050' }}>
                  Aperçu — Modèle {template}
                  {cpd ? ' + CPD' : ''}
                </span>
              </div>
              <CertPreview />
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
