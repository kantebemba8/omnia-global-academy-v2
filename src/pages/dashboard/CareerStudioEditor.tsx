import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Download,
  Edit3,
  Eye,
  FileText,
  GraduationCap,
  Languages,
  Loader2,
  Mail,
  Palette,
  Plus,
  Save,
  Settings,
  Sparkles,
  Star,
  Trash2,
  User,
} from 'lucide-react';
import { CvPreview, type DesignOptions, type DocData } from '../../components/career/CvTemplates';
import { LmPreview, type LmData, type LmDesign } from '../../components/career/LmTemplates';
import {
  CAREER_PALETTES,
  CareerDocType,
  CareerDocumentFull,
  CareerTemplateMeta,
  DEFAULT_COLORS,
  createDefaultData,
  createDefaultDesign,
  getDefaultDocTitle,
  getDefaultTemplateKey,
  getTemplateMeta,
  calculateBasicScore,
} from '../../lib/careerStudioData';
import { getCareerDocument, listCareerDocuments, prepareCareerPdfExport, saveCareerDocument } from '../../lib/careerStudioApi';
import { printCareerElementAsPdf } from '../../lib/careerPdfExport';

const BLUE = '#002050';
const GOLD = '#bf8813';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type CvSectionKey = 'profile' | 'summary' | 'skills' | 'experiences' | 'education' | 'certifications' | 'languages' | 'projects' | 'interests';
type LmSectionKey = 'sender' | 'recipient' | 'letter' | 'variables';

const CV_SECTIONS: Array<{ key: CvSectionKey; label: string; subtitle: string; icon: any }> = [
  { key: 'profile', label: 'Profil', subtitle: 'Informations personnelles', icon: User },
  { key: 'summary', label: 'Résumé', subtitle: 'Accroche professionnelle', icon: FileText },
  { key: 'skills', label: 'Compétences', subtitle: 'Compétences clés', icon: Star },
  { key: 'experiences', label: 'Expériences', subtitle: 'Parcours professionnel', icon: Briefcase },
  { key: 'education', label: 'Formation', subtitle: 'Diplômes et formations', icon: GraduationCap },
  { key: 'certifications', label: 'Certifications', subtitle: 'Certifications obtenues', icon: Award },
  { key: 'languages', label: 'Langues', subtitle: 'Langues parlées', icon: Languages },
  { key: 'projects', label: 'Projets', subtitle: 'Portfolio et réalisations', icon: Settings },
  { key: 'interests', label: 'Centres d’intérêt', subtitle: 'Vos passions', icon: Star },
];

const LM_SECTIONS: Array<{ key: LmSectionKey; label: string; subtitle: string; icon: any }> = [
  { key: 'sender', label: 'Expéditeur', subtitle: 'Vos coordonnées', icon: User },
  { key: 'recipient', label: 'Destinataire', subtitle: 'Entreprise et recruteur', icon: Briefcase },
  { key: 'letter', label: 'Corps de la lettre', subtitle: 'Contenu principal', icon: Mail },
  { key: 'variables', label: 'Ciblage', subtitle: 'Poste, ton et mots-clés', icon: Sparkles },
];

function uid(prefix = 'item') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function cardClass(extra = '') {
  return `rounded-2xl border border-slate-200 bg-white shadow-sm ${extra}`;
}

function inputClass(extra = '') {
  return `w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#002050] focus:ring-4 focus:ring-[#002050]/10 ${extra}`;
}

function labelClass() {
  return 'mb-1.5 block text-xs font-semibold text-slate-600';
}

function getCvData(document: CareerDocumentFull): DocData {
  return document.doc_data as DocData;
}

function getLmData(document: CareerDocumentFull): LmData {
  return document.doc_data as LmData;
}

function getCvDesign(document: CareerDocumentFull): DesignOptions {
  return document.design_options as DesignOptions;
}

function getLmDesign(document: CareerDocumentFull): LmDesign {
  return document.design_options as LmDesign;
}

function PreviewFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex h-[760px] w-full justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-5 shadow-inner">
      <div style={{ transform: 'scale(0.62)', transformOrigin: 'top center' }}>{children}</div>
    </div>
  );
}

export default function CareerStudioEditor() {
  const navigate = useNavigate();
  const { docId } = useParams<{ docId: string }>();
  const [searchParams] = useSearchParams();
  const docType = (searchParams.get('type') === 'lm' ? 'lm' : 'cv') as CareerDocType;
  const requestedTemplate = searchParams.get('template') || getDefaultTemplateKey(docType);

  const [document, setDocument] = useState<CareerDocumentFull | null>(null);
  const [templates, setTemplates] = useState<CareerTemplateMeta[]>([]);
  const [tokens, setTokens] = useState(0);
  const [remoteMode, setRemoteMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [activeCvSection, setActiveCvSection] = useState<CvSectionKey>('profile');
  const [activeLmSection, setActiveLmSection] = useState<LmSectionKey>('letter');
  const [toast, setToast] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const printRef = useRef<HTMLDivElement | null>(null);

  const score = useMemo(() => {
    if (!document) return 0;
    return calculateBasicScore(document.doc_type, document.doc_data);
  }, [document]);

  const selectedTemplate = useMemo(() => {
    if (!document) return getTemplateMeta(docType, requestedTemplate);
    return getTemplateMeta(document.doc_type, document.template_key);
  }, [document, docType, requestedTemplate]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listCareerDocuments(docType);
      setTemplates(list.templates);
      setTokens(list.tokens);
      setRemoteMode(list.remote);
      const loaded = await getCareerDocument(docType, docId, requestedTemplate);
      setRemoteMode(loaded.remote);
      setDocument(loaded.document);
    } finally {
      setLoading(false);
    }
  }, [docId, docType, requestedTemplate]);

  useEffect(() => {
    load();
  }, [load]);

  const updateDocument = useCallback((updater: (current: CareerDocumentFull) => CareerDocumentFull) => {
    setDocument(prev => {
      if (!prev) return prev;
      const next = updater(prev);
      return {
        ...next,
        ats_score: calculateBasicScore(next.doc_type, next.doc_data),
        updated_at: new Date().toISOString(),
      };
    });
    setSaveState('idle');
  }, []);

  const saveNow = useCallback(async () => {
    if (!document) return;
    setSaveState('saving');
    try {
      const saved = await saveCareerDocument(document);
      setDocument(saved.document);
      setRemoteMode(saved.remote);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }, [document]);

  useEffect(() => {
    if (!document || loading) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveNow();
    }, 900);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [document?.doc_data, document?.design_options, document?.template_key, document?.title]);

  function updateCv(mutator: (data: DocData) => DocData) {
    updateDocument(doc => ({ ...doc, doc_data: mutator(getCvData(doc)) }));
  }

  function updateLm(mutator: (data: LmData) => LmData) {
    updateDocument(doc => ({ ...doc, doc_data: mutator(getLmData(doc)) }));
  }

  function updateDesignColors(colors: typeof DEFAULT_COLORS) {
    updateDocument(doc => ({
      ...doc,
      design_options: {
        ...doc.design_options,
        colors,
      } as DesignOptions | LmDesign,
    }));
  }

  function changeTemplate(templateKey: string) {
    const meta = getTemplateMeta(docType, templateKey);
    updateDocument(doc => ({
      ...doc,
      template_key: templateKey,
      design_options: {
        ...doc.design_options,
        colors: meta.default_colors || DEFAULT_COLORS,
      } as DesignOptions | LmDesign,
    }));
  }

  function resetDemoData() {
    updateDocument(doc => ({
      ...doc,
      doc_data: createDefaultData(doc.doc_type),
      design_options: createDefaultDesign(doc.doc_type),
      template_key: getDefaultTemplateKey(doc.doc_type),
      title: getDefaultDocTitle(doc.doc_type),
    }));
  }

  async function manualSave() {
    await saveNow();
    showToast('Document sauvegardé');
  }

  async function handlePdfDownload() {
    if (!document) return;
    if (exportingPdf) return;

    if (document.doc_type === 'cv' && remoteMode && tokens <= 0) {
      showToast('Jeton insuffisant : le téléchargement PDF du CV nécessite 1 jeton.');
      return;
    }

    setExportingPdf(true);
    try {
      await saveNow();
      const result = await prepareCareerPdfExport(document);
      if (typeof result.tokens_remaining === 'number') {
        setTokens(result.tokens_remaining);
      }

      printCareerElementAsPdf(printRef.current, {
        title: document.title || (document.doc_type === 'cv' ? 'CV Omnia Career' : 'Lettre Omnia Career'),
        docType: document.doc_type,
        tokensConsumed: result.tokens_consumed,
      });

      const message = document.doc_type === 'cv'
        ? result.remote
          ? `PDF prêt. ${result.tokens_consumed} jeton consommé. Solde : ${result.tokens_remaining ?? tokens}.`
          : 'PDF prêt en mode test local : aucun jeton consommé.'
        : 'PDF de la lettre prêt. Les lettres ne consomment pas de jeton pour cette étape.';
      showToast(message);
    } catch (err) {
      const e = err as Error & { code?: string; status?: number };
      if (e.code === 'INSUFFICIENT_TOKENS' || e.status === 402) {
        showToast(e.message || 'Jetons insuffisants pour télécharger ce CV.');
      } else {
        showToast(e.message || 'Impossible de préparer le PDF.');
      }
    } finally {
      setExportingPdf(false);
    }
  }

  if (loading || !document) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="h-8 w-8 animate-spin text-[#002050]" />
      </div>
    );
  }

  const isCv = document.doc_type === 'cv';
  const cvData = isCv ? getCvData(document) : null;
  const lmData = !isCv ? getLmData(document) : null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      {toast && (
        <div className="fixed right-5 top-5 z-50 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-[#002050] shadow-lg">
          {toast}
        </div>
      )}

      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex h-[76px] items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard/career-studio')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" /> Mes documents
            </button>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                Omnia Career <ChevronRight className="h-3 w-3" /> {isCv ? 'CV Builder' : 'Lettres de motivation'}
              </div>
              <input
                value={document.title}
                onChange={e => updateDocument(doc => ({ ...doc, title: e.target.value }))}
                className="mt-1 w-[420px] border-0 bg-transparent text-2xl font-semibold text-[#002050] outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 md:flex">
              {saveState === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#bf8813]" />}
              {saveState === 'saved' && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
              {saveState === 'saving' ? 'Enregistrement...' : saveState === 'saved' ? 'Enregistré automatiquement' : remoteMode ? 'Connecté Supabase' : 'Mode local sécurisé'}
            </div>
            <div className="rounded-full bg-[#bf8813]/10 px-3 py-2 text-xs font-bold text-[#bf8813]">{tokens} jeton(s)</div>
            <button onClick={manualSave} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#002050] hover:bg-slate-50">
              <Save className="h-4 w-4" /> Enregistrer
            </button>
            <button onClick={handlePdfDownload} disabled={exportingPdf} className="inline-flex items-center gap-2 rounded-xl bg-[#002050] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              <Download className="h-4 w-4" /> {exportingPdf ? 'Préparation...' : 'Télécharger PDF'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-76px)] grid-cols-[300px_minmax(520px,1fr)_340px] gap-5 p-5">
        <aside className={cardClass('h-[calc(100vh-116px)] overflow-hidden p-4')}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#002050]">{isCv ? 'Sections du CV' : 'Structure de la lettre'}</h2>
              <p className="mt-1 text-xs text-slate-500">Cliquez sur une section pour modifier.</p>
            </div>
            <button onClick={resetDemoData} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Réinitialiser</button>
          </div>

          <div className="space-y-2">
            {(isCv ? CV_SECTIONS : LM_SECTIONS).map(section => {
              const Icon = section.icon;
              const active = isCv ? activeCvSection === section.key : activeLmSection === section.key;
              return (
                <button
                  key={section.key}
                  onClick={() => (isCv ? setActiveCvSection(section.key as CvSectionKey) : setActiveLmSection(section.key as LmSectionKey))}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${active ? 'border-[#002050] bg-[#002050]/5' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? 'bg-[#002050] text-white' : 'bg-slate-100 text-[#002050]'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[#002050]">{section.label}</div>
                    <div className="truncate text-xs text-slate-500">{section.subtitle}</div>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-[#bf8813]/30 bg-[#bf8813]/10 p-4">
            <div className="text-sm font-semibold text-[#002050]">Conseil Omnia</div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Sauvegarde automatique active. Les modèles CV et LM déjà définis sont disponibles dans le panneau droit.
            </p>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-[#002050]">{isCv ? 'CV Builder' : 'Éditeur de lettre'}</h1>
              <p className="mt-1 text-sm text-slate-500">Aperçu en direct avec sauvegarde automatique.</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
              <Eye className="h-4 w-4 text-[#002050]" /> Aperçu live
            </div>
          </div>

          <div className={cardClass('p-4')}>
            <PreviewFrame>
              <div ref={printRef} data-career-print-source="true">
                {isCv ? (
                  <CvPreview templateKey={document.template_key} data={cvData as DocData} design={getCvDesign(document)} />
                ) : (
                  <LmPreview templateKey={document.template_key} data={lmData as LmData} design={getLmDesign(document)} />
                )}
              </div>
            </PreviewFrame>
          </div>
        </main>

        <aside className="h-[calc(100vh-116px)] overflow-y-auto space-y-4 pr-1">
          <EditorPanel
            isCv={isCv}
            cvData={cvData}
            lmData={lmData}
            activeCvSection={activeCvSection}
            activeLmSection={activeLmSection}
            updateCv={updateCv}
            updateLm={updateLm}
            score={score}
          />

          <TemplatePanel templates={templates} selectedTemplate={selectedTemplate} selectedKey={document.template_key} onSelect={changeTemplate} />

          <ColorPanel colors={(document.design_options as DesignOptions | LmDesign).colors} onChange={updateDesignColors} />

          <div className={cardClass('p-4')}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#002050]">Score d’optimisation</h3>
              <span className="text-2xl font-bold text-green-600">{score}/100</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-green-600" style={{ width: `${Math.max(8, score)}%` }} />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Score local basé sur les sections complétées. Le téléchargement PDF est maintenant activé avec consommation de jeton pour les CV.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function EditorPanel({
  isCv,
  cvData,
  lmData,
  activeCvSection,
  activeLmSection,
  updateCv,
  updateLm,
  score,
}: {
  isCv: boolean;
  cvData: DocData | null;
  lmData: LmData | null;
  activeCvSection: CvSectionKey;
  activeLmSection: LmSectionKey;
  updateCv: (mutator: (data: DocData) => DocData) => void;
  updateLm: (mutator: (data: LmData) => LmData) => void;
  score: number;
}) {
  if (isCv && cvData) {
    return (
      <div className={cardClass('p-4')}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#002050]">Modifier la section</h3>
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700">{score}%</span>
        </div>
        <CvSectionEditor active={activeCvSection} data={cvData} update={updateCv} />
      </div>
    );
  }

  if (!isCv && lmData) {
    return (
      <div className={cardClass('p-4')}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#002050]">Modifier la lettre</h3>
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700">{score}%</span>
        </div>
        <LmSectionEditor active={activeLmSection} data={lmData} update={updateLm} />
      </div>
    );
  }

  return null;
}

function CvSectionEditor({ active, data, update }: { active: CvSectionKey; data: DocData; update: (mutator: (data: DocData) => DocData) => void }) {
  if (active === 'profile') {
    return (
      <div className="space-y-3">
        <Field label="Nom complet" value={data.name} onChange={v => update(d => ({ ...d, name: v }))} />
        <Field label="Titre professionnel" value={data.title} onChange={v => update(d => ({ ...d, title: v }))} />
        <Field label="Email" value={data.contact.email} onChange={v => update(d => ({ ...d, contact: { ...d.contact, email: v } }))} />
        <Field label="Téléphone" value={data.contact.phone} onChange={v => update(d => ({ ...d, contact: { ...d.contact, phone: v } }))} />
        <Field label="Ville / Pays" value={data.contact.location} onChange={v => update(d => ({ ...d, contact: { ...d.contact, location: v } }))} />
        <Field label="LinkedIn" value={data.contact.linkedin || ''} onChange={v => update(d => ({ ...d, contact: { ...d.contact, linkedin: v } }))} />
      </div>
    );
  }

  if (active === 'summary') {
    return <TextArea label="Résumé professionnel" value={data.summary} rows={8} onChange={v => update(d => ({ ...d, summary: v }))} />;
  }

  if (active === 'skills') {
    return (
      <ListEditor
        title="Compétences"
        addLabel="Ajouter une compétence"
        items={data.skills}
        render={(item, remove) => (
          <div className="flex items-center gap-2">
            <input className={inputClass('flex-1')} value={item.name} onChange={e => update(d => ({ ...d, skills: d.skills.map(s => s.id === item.id ? { ...s, name: e.target.value } : s) }))} />
            <input type="range" min={0} max={100} value={item.level} className="w-20" style={{ accentColor: BLUE }} onChange={e => update(d => ({ ...d, skills: d.skills.map(s => s.id === item.id ? { ...s, level: Number(e.target.value) } : s) }))} />
            <span className="w-8 text-right text-xs text-slate-500">{item.level}%</span>
            {remove}
          </div>
        )}
        onAdd={() => update(d => ({ ...d, skills: [...d.skills, { id: uid('sk'), name: 'Nouvelle compétence', level: 70 }] }))}
        onRemove={id => update(d => ({ ...d, skills: d.skills.filter(s => s.id !== id) }))}
      />
    );
  }

  if (active === 'experiences') {
    return (
      <ListEditor
        title="Expériences"
        addLabel="Ajouter une expérience"
        items={data.experiences}
        render={(item, remove) => (
          <div className="space-y-2 rounded-xl border border-slate-200 p-3">
            <div className="flex justify-end">{remove}</div>
            <Field label="Poste" value={item.position} onChange={v => update(d => ({ ...d, experiences: d.experiences.map(x => x.id === item.id ? { ...x, position: v } : x) }))} />
            <Field label="Entreprise" value={item.company} onChange={v => update(d => ({ ...d, experiences: d.experiences.map(x => x.id === item.id ? { ...x, company: v } : x) }))} />
            <Field label="Lieu" value={item.location || ''} onChange={v => update(d => ({ ...d, experiences: d.experiences.map(x => x.id === item.id ? { ...x, location: v } : x) }))} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Début" value={item.start_date} onChange={v => update(d => ({ ...d, experiences: d.experiences.map(x => x.id === item.id ? { ...x, start_date: v } : x) }))} />
              <Field label="Fin" value={item.end_date || ''} onChange={v => update(d => ({ ...d, experiences: d.experiences.map(x => x.id === item.id ? { ...x, end_date: v } : x) }))} />
            </div>
            <TextArea label="Description" rows={4} value={item.description} onChange={v => update(d => ({ ...d, experiences: d.experiences.map(x => x.id === item.id ? { ...x, description: v } : x) }))} />
          </div>
        )}
        onAdd={() => update(d => ({ ...d, experiences: [...d.experiences, { id: uid('exp'), position: 'Nouveau poste', company: 'Entreprise', start_date: '2025-01', current: false, description: '' }] }))}
        onRemove={id => update(d => ({ ...d, experiences: d.experiences.filter(x => x.id !== id) }))}
      />
    );
  }

  if (active === 'education') {
    return <SimpleRows title="Formation" items={data.education} fields={[['degree', 'Diplôme'], ['school', 'École'], ['year', 'Année']]} onAdd={() => update(d => ({ ...d, education: [...d.education, { id: uid('edu'), degree: 'Nouveau diplôme', school: 'École', year: '2025' }] }))} onRemove={id => update(d => ({ ...d, education: d.education.filter(x => x.id !== id) }))} onChange={(id, field, value) => update(d => ({ ...d, education: d.education.map(x => x.id === id ? { ...x, [field]: value } : x) }))} />;
  }

  if (active === 'certifications') {
    return <SimpleRows title="Certifications" items={data.certifications_external} fields={[['name', 'Certification'], ['issuer', 'Organisme'], ['year', 'Année']]} onAdd={() => update(d => ({ ...d, certifications_external: [...d.certifications_external, { id: uid('cert'), name: 'Nouvelle certification', issuer: 'Organisme', year: '2025' }] }))} onRemove={id => update(d => ({ ...d, certifications_external: d.certifications_external.filter(x => x.id !== id) }))} onChange={(id, field, value) => update(d => ({ ...d, certifications_external: d.certifications_external.map(x => x.id === id ? { ...x, [field]: value } : x) }))} />;
  }

  if (active === 'languages') {
    return <SimpleRows title="Langues" items={data.languages} fields={[['name', 'Langue'], ['level', 'Niveau']]} onAdd={() => update(d => ({ ...d, languages: [...d.languages, { id: uid('lang'), name: 'Anglais', level: 'Intermédiaire' }] }))} onRemove={id => update(d => ({ ...d, languages: d.languages.filter(x => x.id !== id) }))} onChange={(id, field, value) => update(d => ({ ...d, languages: d.languages.map(x => x.id === id ? { ...x, [field]: value } : x) }))} />;
  }

  if (active === 'projects') {
    return <SimpleRows title="Projets" items={data.projects} fields={[['name', 'Nom'], ['description', 'Description'], ['technologies', 'Technologies']]} onAdd={() => update(d => ({ ...d, projects: [...d.projects, { id: uid('proj'), name: 'Nouveau projet', description: '', technologies: '' }] }))} onRemove={id => update(d => ({ ...d, projects: d.projects.filter(x => x.id !== id) }))} onChange={(id, field, value) => update(d => ({ ...d, projects: d.projects.map(x => x.id === id ? { ...x, [field]: value } : x) }))} />;
  }

  return <TextArea label="Centres d’intérêt" rows={5} value={(data.interests || []).join(', ')} onChange={v => update(d => ({ ...d, interests: v.split(',').map(x => x.trim()).filter(Boolean) }))} />;
}

function LmSectionEditor({ active, data, update }: { active: LmSectionKey; data: LmData; update: (mutator: (data: LmData) => LmData) => void }) {
  if (active === 'sender') {
    return (
      <div className="space-y-3">
        <Field label="Nom complet" value={data.sender.name} onChange={v => update(d => ({ ...d, sender: { ...d.sender, name: v }, signature: v }))} />
        <Field label="Adresse" value={data.sender.address} onChange={v => update(d => ({ ...d, sender: { ...d.sender, address: v } }))} />
        <Field label="Téléphone" value={data.sender.phone} onChange={v => update(d => ({ ...d, sender: { ...d.sender, phone: v } }))} />
        <Field label="Email" value={data.sender.email} onChange={v => update(d => ({ ...d, sender: { ...d.sender, email: v } }))} />
        <Field label="Ville" value={data.sender.city} onChange={v => update(d => ({ ...d, sender: { ...d.sender, city: v } }))} />
        <Field label="Date" value={data.sender.date} onChange={v => update(d => ({ ...d, sender: { ...d.sender, date: v } }))} />
      </div>
    );
  }

  if (active === 'recipient') {
    return (
      <div className="space-y-3">
        <Field label="Nom du recruteur" value={data.recipient.name} onChange={v => update(d => ({ ...d, recipient: { ...d.recipient, name: v } }))} />
        <Field label="Entreprise" value={data.recipient.company} onChange={v => update(d => ({ ...d, recipient: { ...d.recipient, company: v } }))} />
        <TextArea label="Adresse de l’entreprise" value={data.recipient.address} rows={3} onChange={v => update(d => ({ ...d, recipient: { ...d.recipient, address: v } }))} />
      </div>
    );
  }

  if (active === 'variables') {
    return (
      <div className="space-y-3">
        <Field label="Objet" value={data.subject} onChange={v => update(d => ({ ...d, subject: v }))} />
        <Field label="Formule d’appel" value={data.salutation} onChange={v => update(d => ({ ...d, salutation: v }))} />
        <Field label="Signature" value={data.signature} onChange={v => update(d => ({ ...d, signature: v }))} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <TextArea label="Introduction" value={data.intro} rows={4} onChange={v => update(d => ({ ...d, intro: v }))} />
      <TextArea label="Motivation" value={data.motivation} rows={4} onChange={v => update(d => ({ ...d, motivation: v }))} />
      <TextArea label="Compétences clés" value={data.skills_paragraph} rows={4} onChange={v => update(d => ({ ...d, skills_paragraph: v }))} />
      <TextArea label="Lien avec l’entreprise" value={data.company_link} rows={4} onChange={v => update(d => ({ ...d, company_link: v }))} />
      <TextArea label="Disponibilité" value={data.availability} rows={3} onChange={v => update(d => ({ ...d, availability: v }))} />
      <TextArea label="Conclusion" value={data.closing} rows={4} onChange={v => update(d => ({ ...d, closing: v }))} />
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className={labelClass()}>{label}</span>
      <input className={inputClass()} value={value || ''} onChange={e => onChange(e.target.value)} />
    </label>
  );
}

function TextArea({ label, value, rows, onChange }: { label: string; value: string; rows: number; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className={labelClass()}>{label}</span>
      <textarea className={inputClass('resize-y')} rows={rows} value={value || ''} onChange={e => onChange(e.target.value)} />
    </label>
  );
}

function ListEditor<T extends { id: string }>({ title, addLabel, items, render, onAdd, onRemove }: { title: string; addLabel: string; items: T[]; render: (item: T, remove: React.ReactNode) => React.ReactNode; onAdd: () => void; onRemove: (id: string) => void }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[#002050]">{title}</h4>
        <button onClick={onAdd} className="inline-flex items-center gap-1 rounded-lg bg-[#002050] px-3 py-1.5 text-xs font-semibold text-white">
          <Plus className="h-3 w-3" /> {addLabel}
        </button>
      </div>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id}>{render(item, <button onClick={() => onRemove(item.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>)}</div>
        ))}
      </div>
    </div>
  );
}

function SimpleRows<T extends { id: string }>({ title, items, fields, onAdd, onRemove, onChange }: { title: string; items: T[]; fields: Array<[keyof T & string, string]>; onAdd: () => void; onRemove: (id: string) => void; onChange: (id: string, field: keyof T & string, value: string) => void }) {
  return (
    <ListEditor
      title={title}
      addLabel="Ajouter"
      items={items}
      onAdd={onAdd}
      onRemove={onRemove}
      render={(item, remove) => (
        <div className="space-y-2 rounded-xl border border-slate-200 p-3">
          <div className="flex justify-end">{remove}</div>
          {fields.map(([field, label]) => (
            <Field key={field} label={label} value={String((item as any)[field] || '')} onChange={v => onChange(item.id, field, v)} />
          ))}
        </div>
      )}
    />
  );
}

function TemplatePanel({ templates, selectedTemplate, selectedKey, onSelect }: { templates: CareerTemplateMeta[]; selectedTemplate: CareerTemplateMeta; selectedKey: string; onSelect: (key: string) => void }) {
  const visible = templates.length ? templates : [selectedTemplate];
  return (
    <div className={cardClass('p-4')}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#002050]">Modèles</h3>
        <span className="text-xs font-semibold text-slate-500">{visible.length} disponibles</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {visible.slice(0, 8).map(template => {
          const active = template.template_key === selectedKey;
          return (
            <button key={template.template_key} onClick={() => onSelect(template.template_key)} className={`rounded-xl border p-3 text-left transition ${active ? 'border-[#002050] bg-[#002050]/5' : 'border-slate-200 hover:bg-slate-50'}`}>
              <div className="mb-2 flex h-16 items-center justify-center rounded-lg bg-slate-100">
                <FileText className="h-6 w-6 text-[#002050]" />
              </div>
              <div className="text-xs font-semibold text-[#002050]">{template.name_fr}</div>
              <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{template.description_fr}</div>
              <div className="mt-2 flex items-center gap-1">
                {template.is_ats_compatible && <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700">ATS</span>}
                {!template.is_free && <span className="rounded-full bg-[#bf8813]/10 px-2 py-0.5 text-[10px] font-bold text-[#bf8813]">Premium</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ColorPanel({ colors, onChange }: { colors: typeof DEFAULT_COLORS; onChange: (colors: typeof DEFAULT_COLORS) => void }) {
  return (
    <div className={cardClass('p-4')}>
      <div className="mb-3 flex items-center gap-2">
        <Palette className="h-5 w-5 text-[#002050]" />
        <h3 className="text-lg font-semibold text-[#002050]">Couleurs</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {CAREER_PALETTES.map(palette => {
          const active = colors.primary === palette.colors.primary && colors.accent === palette.colors.accent;
          return (
            <button key={palette.key} onClick={() => onChange(palette.colors)} className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${active ? 'border-[#002050]' : 'border-slate-200'}`} title={palette.name}>
              <span className="h-7 w-7 rounded-full" style={{ background: `linear-gradient(135deg, ${palette.colors.primary} 50%, ${palette.colors.accent} 50%)` }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
