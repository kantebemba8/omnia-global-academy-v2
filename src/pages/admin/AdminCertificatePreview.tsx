import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import { Download, ExternalLink, Eye, Printer } from 'lucide-react';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type TemplateKey = 'A' | 'B' | 'C';
type DocumentKind = 'course_completion' | 'live_participation' | 'live_attendance' | 'live_completion';

type PreviewProps = {
  template: TemplateKey;
  documentKind: DocumentKind;
  cpd: boolean;
  studentName: string;
  courseTitle: string;
  level: string;
  category: string;
  cpdHours: string;
  professorName: string;
  schoolName: string;
  directorName: string;
};

const DOCUMENT_COPY: Record<DocumentKind, { label: string; intro: string; sentence: string; context: string }> = {
  course_completion: {
    label: 'Certificat de réussite',
    intro: 'Ce certificat est décerné à',
    sentence: 'pour avoir complété avec succès la formation',
    context: 'Formation OGA',
  },
  live_participation: {
    label: 'Attestation de participation',
    intro: 'Cette attestation est décernée à',
    sentence: 'pour sa participation à l’événement Omnia Live',
    context: 'Omnia Live',
  },
  live_attendance: {
    label: 'Attestation de présence',
    intro: 'Cette attestation est décernée à',
    sentence: 'pour avoir assisté à l’événement Omnia Live',
    context: 'Omnia Live',
  },
  live_completion: {
    label: 'Certificat de réussite',
    intro: 'Ce certificat est décerné à',
    sentence: 'pour avoir complété avec succès la formation en direct Omnia Live',
    context: 'Omnia Live',
  },
};

const QR_SVG = `<svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="56" height="56">
  <rect width="56" height="56" fill="white"/><rect x="2" y="2" width="16" height="16" fill="#002050"/>
  <rect x="4" y="4" width="12" height="12" fill="white"/><rect x="6" y="6" width="8" height="8" fill="#002050"/>
  <rect x="38" y="2" width="16" height="16" fill="#002050"/><rect x="40" y="4" width="12" height="12" fill="white"/>
  <rect x="42" y="6" width="8" height="8" fill="#002050"/><rect x="2" y="38" width="16" height="16" fill="#002050"/>
  <rect x="4" y="40" width="12" height="12" fill="white"/><rect x="6" y="42" width="8" height="8" fill="#002050"/>
  <rect x="20" y="2" width="4" height="2" fill="#002050"/><rect x="26" y="4" width="4" height="2" fill="#002050"/>
  <rect x="32" y="2" width="4" height="2" fill="#002050"/><rect x="20" y="20" width="16" height="2" fill="#002050"/>
  <rect x="20" y="24" width="2" height="8" fill="#002050"/><rect x="24" y="22" width="4" height="4" fill="#002050"/>
  <rect x="30" y="22" width="6" height="2" fill="#002050"/><rect x="20" y="36" width="4" height="2" fill="#002050"/>
  <rect x="26" y="36" width="2" height="6" fill="#002050"/><rect x="30" y="38" width="4" height="2" fill="#002050"/>
  <rect x="36" y="36" width="4" height="4" fill="#002050"/>
</svg>`;

function CertificateCanvas(props: PreviewProps) {
  const copy = DOCUMENT_COPY[props.documentKind];
  const isLive = props.documentKind.startsWith('live_');
  const certificateId = isLive ? 'LIVE-ATT-2026-4A7B2C9F' : 'CERT-2026-4A7B2C9F';
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const headerLeft = props.template === 'B' ? (
    <div className="flex items-center gap-3">
      <div style={{ fontWeight: 900, fontSize: 18, color: BLUE, letterSpacing: '0.1em' }}>OMNIA</div>
      <div style={{ width: 1, height: 32, background: 'rgba(0,32,80,0.2)' }} />
      <div style={{ width: 36, height: 36, background: BLUE, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 900, color: GOLD, textAlign: 'center' }}>ÉCOLE</div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: BLUE }}>{props.schoolName}</div>
        <div style={{ fontSize: 9, color: '#6B7280' }}>Établissement partenaire</div>
      </div>
    </div>
  ) : (
    <div>
      <div style={{ fontSize: 18, fontWeight: 900, color: BLUE, letterSpacing: '0.1em' }}>OMNIA</div>
      <div style={{ fontSize: 8, fontWeight: 700, color: GOLD, letterSpacing: '0.22em' }}>GLOBAL ACADEMY</div>
    </div>
  );

  const headerRight = props.cpd ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', border: `2px solid ${GOLD}`, borderRadius: 20, background: 'rgba(191,136,19,0.05)' }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: GOLD, letterSpacing: '0.1em' }}>CPD CERTIFIED · {props.cpdHours}h</span>
    </div>
  ) : isLive ? (
    <div style={{ padding: '5px 12px', border: `1px solid ${GOLD}`, borderRadius: 20, fontSize: 9, fontWeight: 800, color: GOLD, letterSpacing: '0.12em' }}>OMNIA LIVE</div>
  ) : props.template === 'A' ? (
    <div style={{ fontSize: 11, color: '#6B7280' }}>{props.professorName}</div>
  ) : null;

  const footerLeft = props.template === 'B' ? (
    <SignatureLine name={props.directorName} role={props.schoolName} />
  ) : props.template === 'C' ? (
    <div style={{ width: 140 }} />
  ) : (
    <SignatureLine name={props.professorName} role={isLive ? 'Organisateur / Formateur' : 'Formateur'} />
  );

  return (
    <div
      id="certificate-preview-canvas"
      style={{
        width: '100%', aspectRatio: '1122/794', background: '#fff', position: 'relative', borderRadius: 6,
        overflow: 'hidden', fontFamily: 'Inter, sans-serif', color: BLUE, boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
      }}
    >
      <div style={{ position: 'absolute', inset: 12, border: `3px solid ${BLUE}`, borderRadius: 6, pointerEvents: 'none', zIndex: 10 }} />
      <div style={{ position: 'absolute', inset: 18, border: '1px solid rgba(0,32,80,0.2)', borderRadius: 4, pointerEvents: 'none', zIndex: 10 }} />
      <div style={{ position: 'absolute', inset: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '20px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: props.template === 'C' ? 'center' : 'space-between', width: '100%', borderBottom: `2px solid ${BLUE}`, paddingBottom: 14 }}>
          {headerLeft}{headerRight}
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, letterSpacing: '0.28em', textTransform: 'uppercase', borderBottom: `1px solid ${GOLD}`, paddingBottom: 6, display: 'inline-block' }}>{copy.label}</div>
          <div style={{ margin: '10px 0 6px', fontSize: 11, color: '#6B7280' }}>{copy.intro}</div>
          <div style={{ fontSize: 34, fontWeight: 900, color: BLUE, lineHeight: 1.1 }}>{props.studentName}</div>
        </div>

        <div style={{ fontSize: 13, color: '#374151', textAlign: 'center', lineHeight: 1.6, maxWidth: 650 }}>
          {copy.sentence}<br />
          <span style={{ fontWeight: 700, color: BLUE, fontSize: 16 }}>{props.courseTitle}</span>
        </div>

        {props.template === 'C' && (
          <div style={{ fontSize: 11, color: '#6B7280', fontStyle: 'italic', textAlign: 'center' }}>
            {isLive ? 'Document officiel émis par Omnia Live — Omnia Global Academy' : 'Formation certifiée par Omnia Global Academy'}
          </div>
        )}

        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <Badge label={isLive ? 'Format' : 'Niveau'} value={props.level} />
          <div style={{ width: 1, height: 32, background: BORDER }} />
          <Badge label="Catégorie" value={props.category} />
          {props.cpd && <><div style={{ width: 1, height: 32, background: BORDER }} /><Badge label="Durée CPD" value={`${props.cpdHours}h`} /></>}
        </div>

        <div style={{ display: 'flex', justifyContent: props.template === 'C' ? 'center' : 'space-between', gap: props.template === 'C' ? 80 : 0, alignItems: 'flex-end', width: '100%', paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
          {footerLeft}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div dangerouslySetInnerHTML={{ __html: QR_SVG }} />
            <div style={{ fontSize: 7, fontFamily: 'monospace', color: '#9CA3AF', letterSpacing: '0.08em' }}>{certificateId}</div>
            <div style={{ fontSize: 7, color: '#6B7280' }}>Vérifier l’authenticité</div>
            <div style={{ fontSize: 8, color: '#9CA3AF' }}>{today}</div>
          </div>
          <SignatureLine name="Administration" role="Omnia Global Academy" />
        </div>
      </div>
    </div>
  );
}

function SignatureLine({ name, role }: { name: string; role: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 120, height: 1, background: BLUE }} />
      <div style={{ fontSize: 9, fontWeight: 700, color: BLUE }}>{name}</div>
      <div style={{ fontSize: 8, color: '#6B7280' }}>{role}</div>
    </div>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <span style={{ fontSize: 8, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function validDocumentKind(value: string | null): DocumentKind {
  return ['course_completion', 'live_participation', 'live_attendance', 'live_completion'].includes(String(value))
    ? value as DocumentKind
    : 'course_completion';
}

function validTemplate(value: string | null): TemplateKey {
  return ['A', 'B', 'C'].includes(String(value)) ? value as TemplateKey : 'A';
}

export default function AdminCertificatePreview() {
  const [params] = useSearchParams();
  const fullscreen = params.get('fullscreen') === '1';
  const [template, setTemplate] = useState<TemplateKey>(() => validTemplate(params.get('template')));
  const [documentKind, setDocumentKind] = useState<DocumentKind>(() => validDocumentKind(params.get('document')));
  const [cpd, setCpd] = useState(() => params.get('cpd') === '1');
  const [studentName, setStudentName] = useState(params.get('student') || 'Amadou Coulibaly');
  const [courseTitle, setCourseTitle] = useState(params.get('title') || 'Data Science & Intelligence Artificielle');
  const [level, setLevel] = useState(params.get('level') || 'Avancé');
  const [category, setCategory] = useState(params.get('category') || 'Data & IA');
  const [cpdHours, setCpdHours] = useState(params.get('hours') || '40');
  const [professorName, setProfessorName] = useState(params.get('professor') || 'Dr. Oumar Traoré');
  const [schoolName, setSchoolName] = useState(params.get('school') || 'Institut Supérieur de Technologie');
  const [directorName, setDirectorName] = useState(params.get('director') || 'Moussa Koné');

  const previewProps = useMemo<PreviewProps>(() => ({
    template, documentKind, cpd, studentName, courseTitle, level, category, cpdHours, professorName, schoolName, directorName,
  }), [template, documentKind, cpd, studentName, courseTitle, level, category, cpdHours, professorName, schoolName, directorName]);

  function fullscreenUrl() {
    const query = new URLSearchParams({
      fullscreen: '1', template, document: documentKind, cpd: cpd ? '1' : '0', student: studentName,
      title: courseTitle, level, category, hours: cpdHours, professor: professorName, school: schoolName, director: directorName,
    });
    return `/admin/certificate-preview?${query.toString()}`;
  }

  if (fullscreen) {
    return (
      <div className="min-h-screen bg-slate-100 p-4 md:p-8 print:bg-white print:p-0">
        <style>{`@page{size:A4 landscape;margin:0}.certificate-print-actions{display:flex}@media print{.certificate-print-actions{display:none!important}body{background:#fff}.certificate-print-wrap{width:297mm!important;height:210mm!important;padding:8mm!important;display:flex!important;align-items:center!important;justify-content:center!important}.certificate-print-wrap #certificate-preview-canvas{box-shadow:none!important;border-radius:0!important}}`}</style>
        <div className="certificate-print-actions mx-auto mb-4 flex max-w-[1122px] justify-end gap-2">
          <button onClick={() => window.close()} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}>Fermer</button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}><Printer size={15} /> Télécharger / imprimer PDF</button>
        </div>
        <div className="certificate-print-wrap mx-auto max-w-[1122px]"><CertificateCanvas {...previewProps} /></div>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5" style={{ borderColor: BORDER }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em]" style={{ color: GOLD }}>Certificats & attestations</p>
            <h1 className="mt-1 text-2xl font-bold" style={{ color: BLUE }}>Aperçu des certificats et attestations</h1>
            <p className="mt-1 text-sm text-gray-500">Les données affichées sont fictives et servent uniquement à contrôler les modèles avant émission.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => window.open(fullscreenUrl(), '_blank', 'noopener,noreferrer')} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}><ExternalLink size={15} /> Aperçu pleine page</button>
            <button onClick={() => { const win = window.open(fullscreenUrl(), '_blank'); window.setTimeout(() => win?.print(), 1200); }} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}><Download size={15} /> Télécharger / imprimer</button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4">
            <section className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}>
              <h2 className="text-sm font-semibold" style={{ color: BLUE }}>Type de document</h2>
              <div className="mt-4 space-y-3">
                {(Object.entries(DOCUMENT_COPY) as Array<[DocumentKind, typeof DOCUMENT_COPY[DocumentKind]]>).map(([key, copy]) => (
                  <label key={key} className="flex cursor-pointer items-start gap-3">
                    <input type="radio" checked={documentKind === key} onChange={() => setDocumentKind(key)} style={{ accentColor: BLUE }} />
                    <span><span className="block text-sm font-medium" style={{ color: BLUE }}>{copy.label}</span><span className="text-xs text-gray-500">{copy.context}</span></span>
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}>
              <h2 className="text-sm font-semibold" style={{ color: BLUE }}>Template validé</h2>
              <div className="mt-4 space-y-3">
                {(['A', 'B', 'C'] as const).map((item) => (
                  <label key={item} className="flex cursor-pointer items-center gap-3">
                    <input type="radio" checked={template === item} onChange={() => setTemplate(item)} style={{ accentColor: BLUE }} />
                    <span className="text-sm font-medium" style={{ color: BLUE }}>Template {item}<span className="ml-2 text-xs font-normal text-gray-500">{item === 'A' ? '— Professeur' : item === 'B' ? '— Établissement' : '— Plateforme'}</span></span>
                  </label>
                ))}
              </div>
              <label className="mt-4 flex cursor-pointer items-center gap-2 border-t pt-4" style={{ borderColor: BORDER }}>
                <input type="checkbox" checked={cpd} onChange={(event) => setCpd(event.target.checked)} style={{ accentColor: GOLD }} />
                <span className="text-sm" style={{ color: BLUE }}>Badge CPD</span>
              </label>
            </section>

            <section className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}>
              <h2 className="text-sm font-semibold" style={{ color: BLUE }}>Contenu fictif de l’aperçu</h2>
              <div className="mt-4 space-y-3">
                <TextField label="Participant / apprenant" value={studentName} setValue={setStudentName} />
                <TextField label={documentKind.startsWith('live_') ? 'Événement / formation Live' : 'Formation'} value={courseTitle} setValue={setCourseTitle} />
                <TextField label={documentKind.startsWith('live_') ? 'Format' : 'Niveau'} value={level} setValue={setLevel} />
                <TextField label="Catégorie" value={category} setValue={setCategory} />
                {cpd && <TextField label="Heures CPD" value={cpdHours} setValue={setCpdHours} type="number" />}
                {template === 'A' && <TextField label={documentKind.startsWith('live_') ? 'Organisateur / formateur' : 'Nom du professeur'} value={professorName} setValue={setProfessorName} />}
                {template === 'B' && <><TextField label="École / structure" value={schoolName} setValue={setSchoolName} /><TextField label="Responsable" value={directorName} setValue={setDirectorName} /></>}
              </div>
            </section>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2"><Eye size={16} style={{ color: BLUE }} /><span className="text-sm font-semibold" style={{ color: BLUE }}>Aperçu — {DOCUMENT_COPY[documentKind].label} · Template {template}{cpd ? ' + CPD' : ''}</span></div>
              </div>
              <CertificateCanvas {...previewProps} />
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function TextField({ label, value, setValue, type = 'text' }: { label: string; value: string; setValue: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-500">{label}</span>
      <input type={type} value={value} onChange={(event) => setValue(event.target.value)} className="w-full rounded-lg border px-2.5 py-2 text-xs" style={{ borderColor: BORDER }} />
    </label>
  );
}
