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
import { getCareerDocument, listCareerDocuments, prepareCareerPdfExport, runCareerAiAction, saveCareerDocument } from '../../lib/careerStudioApi';
import { printCareerElementAsPdf } from '../../lib/careerPdfExport';

const BLUE = '#002050';
const GOLD = '#bf8813';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type AiSuggestionMode = 'cv_summary' | 'cv_experience' | 'cv_skills' | 'lm_full' | 'lm_section' | 'analysis';
type AiSuggestion = { title: string; text: string; mode: AiSuggestionMode; targetId?: string; tokensConsumed?: number; tokensRemaining?: number; remote?: boolean };

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

function PreviewFrame({ children, zoom = 0.62 }: { children: React.ReactNode; zoom?: number }) {
  return (
    <div className="mx-auto flex h-[760px] w-full justify-center overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-5 shadow-inner">
      <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>{children}</div>
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
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(0.62);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [offerText, setOfferText] = useState('');
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

  function updateDesignOptions(patch: Partial<DesignOptions & LmDesign>) {
    updateDocument(doc => ({
      ...doc,
      design_options: {
        ...doc.design_options,
        ...patch,
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


  function getActiveExperienceText() {
    if (!document || document.doc_type !== 'cv') return '';
    const data = getCvData(document);
    const first = data.experiences?.[0];
    return first ? `${first.position} - ${first.company}\n${first.description}` : data.summary;
  }

  async function requestAi(mode: AiSuggestionMode, action: Parameters<typeof runCareerAiAction>[0]['action']) {
    if (!document || aiLoading) return;
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const isCvDoc = document.doc_type === 'cv';
      const cv = isCvDoc ? getCvData(document) : null;
      const lm = !isCvDoc ? getLmData(document) : null;
      const textByMode =
        mode === 'cv_summary' ? (cv?.summary || '') :
        mode === 'cv_experience' ? getActiveExperienceText() :
        mode === 'cv_skills' ? `${cv?.title || ''}\n${cv?.summary || ''}\n${(cv?.experiences || []).map(e => e.description).join('\n')}` :
        mode === 'lm_full' ? `${lm?.subject || ''}\n${lm?.intro || ''}\n${lm?.motivation || ''}\n${lm?.skills_paragraph || ''}` :
        mode === 'lm_section' ? `${lm?.intro || ''}\n${lm?.motivation || ''}\n${lm?.skills_paragraph || ''}\n${lm?.company_link || ''}` :
        document.doc_type === 'cv' ? JSON.stringify(cv) : JSON.stringify(lm);

      const result = await runCareerAiAction({
        action,
        doc_type: document.doc_type,
        text: textByMode,
        doc_data: document.doc_data,
        offer_text: offerText,
        target_job: isCvDoc ? (cv?.title || document.target_job || '') : (lm?.subject || document.target_job || ''),
        application_type: document.application_type || document.doc_type,
        language: 'fr',
      });

      if (typeof result.tokens_remaining === 'number') setTokens(result.tokens_remaining);
      setAiSuggestion({
        title: getAiTitle(mode, action),
        text: result.result,
        mode,
        tokensConsumed: result.tokens_consumed,
        tokensRemaining: result.tokens_remaining,
        remote: result.remote,
      });
      showToast(result.remote ? 'Suggestion IA générée' : 'Suggestion locale générée');
    } catch (err) {
      showToast((err as Error).message || 'Impossible de générer la suggestion IA.');
    } finally {
      setAiLoading(false);
    }
  }

  function applyAiSuggestion() {
    if (!aiSuggestion || !document) return;

    if (document.doc_type === 'cv') {
      if (aiSuggestion.mode === 'cv_summary') {
        updateCv(d => ({ ...d, summary: cleanAiText(aiSuggestion.text) }));
      } else if (aiSuggestion.mode === 'cv_experience') {
        updateCv(d => ({
          ...d,
          experiences: d.experiences.map((exp, index) => index === 0 ? { ...exp, description: cleanAiText(aiSuggestion.text) } : exp),
        }));
      } else if (aiSuggestion.mode === 'cv_skills') {
        const skills = parseAiLines(aiSuggestion.text).slice(0, 12);
        updateCv(d => ({
          ...d,
          skills: skills.map((name, index) => ({ id: uid('skai'), name, level: Math.max(60, 92 - index * 3) })),
        }));
      }
    } else {
      if (aiSuggestion.mode === 'lm_full') {
        updateLm(d => mergeLetterText(d, aiSuggestion.text));
      } else if (aiSuggestion.mode === 'lm_section') {
        const paragraphs = splitParagraphs(aiSuggestion.text);
        updateLm(d => ({
          ...d,
          intro: paragraphs[0] || d.intro,
          motivation: paragraphs[1] || d.motivation,
          skills_paragraph: paragraphs[2] || d.skills_paragraph,
          company_link: paragraphs[3] || d.company_link,
          availability: paragraphs[4] || d.availability,
        }));
      }
    }

    setAiSuggestion(null);
    showToast('Suggestion appliquée au document');
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
              <ArrowLeft className="h-4 w-4" /> Retour Omnia Career
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
            <button onClick={resetDemoData} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Vider</button>
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
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setPreviewZoom(0.5)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">75%</button>
              <button type="button" onClick={() => setPreviewZoom(0.62)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">100%</button>
              <button type="button" onClick={() => setPreviewZoom(0.78)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">125%</button>
              <button type="button" onClick={() => setPreviewFullscreen(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#002050] px-3 py-2 text-xs font-semibold text-white hover:opacity-90">
                <Eye className="h-4 w-4" /> Aperçu plein écran
              </button>
            </div>
          </div>

          <div className={cardClass('p-4')}>
            <PreviewFrame zoom={previewZoom}>
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

          <AiAssistantPanel
            isCv={isCv}
            loading={aiLoading}
            suggestion={aiSuggestion}
            offerText={offerText}
            onOfferTextChange={setOfferText}
            onRequest={requestAi}
            onApply={applyAiSuggestion}
            onDismiss={() => setAiSuggestion(null)}
          />

          <TemplatePanel docType={document.doc_type} document={document} templates={templates} selectedTemplate={selectedTemplate} selectedKey={document.template_key} onSelect={changeTemplate} />

          <DesignPanel design={document.design_options as DesignOptions | LmDesign} onColorChange={updateDesignColors} onDesignChange={updateDesignOptions} isCv={isCv} />

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

      {previewFullscreen && (
        <div className="fixed inset-0 z-[90] bg-slate-950/80 p-6">
          <div className="mx-auto flex h-full max-w-6xl flex-col rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[#002050]">Aperçu plein écran</h2>
                <p className="text-sm text-slate-500">Vue A4 fidèle à votre PDF. Utilisez les réglages à droite pour modifier police, taille et couleurs.</p>
              </div>
              <button onClick={() => setPreviewFullscreen(false)} className="rounded-full p-2 hover:bg-slate-100">✕</button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-8">
              <div className="mx-auto flex w-full justify-center" style={{ transform: 'scale(1)', transformOrigin: 'top center' }}>
                <div ref={printRef} data-career-print-source="true">
                  {isCv ? (
                    <CvPreview templateKey={document.template_key} data={cvData as DocData} design={getCvDesign(document)} />
                  ) : (
                    <LmPreview templateKey={document.template_key} data={lmData as LmData} design={getLmDesign(document)} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function getAiTitle(mode: AiSuggestionMode, action: string) {
  if (mode === 'cv_summary') return 'Résumé professionnel amélioré';
  if (mode === 'cv_experience') return 'Expérience reformulée';
  if (mode === 'cv_skills') return 'Compétences suggérées';
  if (mode === 'lm_full') return 'Lettre de motivation générée';
  if (mode === 'lm_section') return 'Lettre améliorée';
  if (action === 'ats_score') return 'Analyse ATS détaillée';
  return 'Suggestion IA';
}

function cleanAiText(text: string) {
  return (text || '')
    .replace(/^```(?:json|text)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function splitParagraphs(text: string) {
  return cleanAiText(text)
    .split(/\n{2,}/)
    .map(p => p.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean);
}

function parseAiLines(text: string) {
  return cleanAiText(text)
    .split(/\n|,|;/)
    .map(line => line.replace(/^[-•\d.)\s]+/, '').trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.findIndex(x => x.toLowerCase() === item.toLowerCase()) === index);
}

function mergeLetterText(data: LmData, text: string): LmData {
  const paragraphs = splitParagraphs(text).filter(p => !/^madame|^monsieur|^objet\s*:/i.test(p));
  return {
    ...data,
    intro: paragraphs[0] || data.intro,
    motivation: paragraphs[1] || data.motivation,
    skills_paragraph: paragraphs[2] || data.skills_paragraph,
    company_link: paragraphs[3] || data.company_link,
    availability: paragraphs[4] || data.availability,
    closing: paragraphs[5] || data.closing,
  };
}

function AiAssistantPanel({
  isCv,
  loading,
  suggestion,
  offerText,
  onOfferTextChange,
  onRequest,
  onApply,
  onDismiss,
}: {
  isCv: boolean;
  loading: boolean;
  suggestion: AiSuggestion | null;
  offerText: string;
  onOfferTextChange: (value: string) => void;
  onRequest: (mode: AiSuggestionMode, action: Parameters<typeof runCareerAiAction>[0]['action']) => void;
  onApply: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className={cardClass('p-4')}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#bf8813]/10 px-3 py-1 text-xs font-bold text-[#bf8813]">
            <Sparkles className="h-3.5 w-3.5" /> IA Omnia Career
          </div>
          <h3 className="mt-3 text-lg font-semibold text-[#002050]">Assistant IA</h3>
          <p className="mt-1 text-sm leading-5 text-slate-600">Les suggestions sont proposées sans remplacer votre contenu. Vous décidez quand les appliquer.</p>
        </div>
      </div>

      {isCv ? (
        <div className="grid grid-cols-1 gap-2">
          <AiButton loading={loading} label="Améliorer le résumé" onClick={() => onRequest('cv_summary', 'improve_summary')} />
          <AiButton loading={loading} label="Reformuler l’expérience principale" onClick={() => onRequest('cv_experience', 'rewrite_experience')} />
          <AiButton loading={loading} label="Suggérer des compétences" onClick={() => onRequest('cv_skills', 'suggest_skills')} />
          <AiButton loading={loading} label="Analyser ATS" onClick={() => onRequest('analysis', 'ats_score')} subtle />
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className={labelClass()}>Offre d’emploi ou contexte ciblé</span>
            <textarea
              className={inputClass('min-h-[92px] resize-y')}
              placeholder="Collez ici une offre, le nom de l’entreprise, les missions ou les mots-clés à intégrer..."
              value={offerText}
              onChange={(e) => onOfferTextChange(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-1 gap-2">
            <AiButton loading={loading} label="Générer une lettre complète" onClick={() => onRequest('lm_full', 'generate_lm')} />
            <AiButton loading={loading} label="Adapter à l’offre" onClick={() => onRequest('lm_full', 'adapt_to_offer')} />
            <AiButton loading={loading} label="Rendre plus professionnel" onClick={() => onRequest('lm_section', 'make_professional')} subtle />
            <AiButton loading={loading} label="Corriger la langue" onClick={() => onRequest('lm_section', 'fix_grammar')} subtle />
          </div>
        </div>
      )}

      {suggestion && (
        <div className="mt-4 rounded-2xl border border-[#bf8813]/30 bg-[#bf8813]/10 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-[#002050]">{suggestion.title}</h4>
            <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-slate-600">
              {suggestion.remote ? 'IA' : 'Local'} · {suggestion.tokensConsumed || 0} jeton
            </span>
          </div>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs leading-5 text-slate-700">{suggestion.text}</pre>
          <div className="mt-3 flex items-center gap-2">
            {suggestion.mode !== 'analysis' && (
              <button type="button" onClick={onApply} className="rounded-xl bg-[#002050] px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
                Appliquer
              </button>
            )}
            <button type="button" onClick={onDismiss} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AiButton({ label, loading, onClick, subtle = false }: { label: string; loading: boolean; onClick: () => void; subtle?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={subtle
        ? 'inline-flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-[#002050] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
        : 'inline-flex items-center justify-between rounded-xl bg-[#002050] px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'}
    >
      <span>{label}</span>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
    </button>
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


function createCvTemplatePreviewData(data: DocData): DocData {
  const hasRealContent = Boolean(
    data?.name?.trim() ||
    data?.title?.trim() ||
    data?.summary?.trim() ||
    data?.contact?.email?.trim() ||
    (Array.isArray(data?.experiences) && data.experiences.length > 0) ||
    (Array.isArray(data?.skills) && data.skills.length > 0)
  );
  if (hasRealContent) return data;
  return {
    name: 'Votre Nom',
    title: 'Titre professionnel',
    objective: 'Objectif professionnel clair et ciblé.',
    summary: 'Résumé professionnel concis mettant en avant votre profil, vos compétences et votre valeur ajoutée.',
    contact: { email: 'email@exemple.com', phone: '+000 00 00 00', location: 'Ville, Pays', linkedin: 'linkedin.com/in/votre-profil', portfolio: '' },
    experiences: [
      { id: 'preview_exp_1', position: 'Poste occupé', company: 'Entreprise', location: 'Ville', start_date: '2024-01', end_date: '', current: true, description: 'Décrivez vos missions, résultats et responsabilités principales avec des éléments mesurables.' },
      { id: 'preview_exp_2', position: 'Expérience précédente', company: 'Organisation', location: 'Ville', start_date: '2022-01', end_date: '2023-12', current: false, description: 'Ajoutez une expérience pertinente pour renforcer votre candidature.' },
    ],
    education: [{ id: 'preview_edu_1', degree: 'Diplôme ou formation', school: 'Établissement', location: 'Ville', year: '2021 - 2024' }],
    omnia_formations: [],
    skills: [
      { id: 'preview_skill_1', name: 'Compétence 1', level: 90 },
      { id: 'preview_skill_2', name: 'Compétence 2', level: 80 },
      { id: 'preview_skill_3', name: 'Compétence 3', level: 70 },
      { id: 'preview_skill_4', name: 'Outil professionnel', level: 75 },
    ],
    languages: [
      { id: 'preview_lang_1', name: 'Français', level: 'Courant' },
      { id: 'preview_lang_2', name: 'Anglais', level: 'Intermédiaire' },
    ],
    certifications_external: [{ id: 'preview_cert_1', name: 'Certification professionnelle', issuer: 'Organisme', year: '2025' }],
    projects: [{ id: 'preview_proj_1', name: 'Projet clé', description: 'Projet ou réalisation pertinente.', technologies: 'Outils utilisés' }],
    interests: ['Intérêt 1', 'Intérêt 2'],
    references: '',
  };
}

function createLmTemplatePreviewData(data: LmData): LmData {
  const hasRealContent = Boolean(data?.sender?.name?.trim() || data?.sender?.email?.trim() || data?.recipient?.company?.trim() || data?.subject?.trim() || data?.intro?.trim() || data?.motivation?.trim());
  if (hasRealContent) return data;
  return {
    sender: { name: 'Votre Nom', address: 'Ville, Pays', phone: '+000 00 00 00', email: 'email@exemple.com', city: 'Ville', date: new Date().toISOString().slice(0, 10) },
    recipient: { name: 'Responsable du recrutement', company: 'Entreprise cible', address: 'Adresse de l’entreprise' },
    subject: 'Candidature au poste ciblé',
    salutation: 'Madame, Monsieur,',
    intro: 'Présentez votre candidature et expliquez votre intérêt pour le poste.',
    motivation: 'Mettez en avant votre parcours, vos expériences et les raisons de votre motivation.',
    skills_paragraph: 'Valorisez vos compétences principales en lien avec les besoins de l’entreprise.',
    company_link: 'Montrez que vous comprenez l’entreprise, son secteur et ses enjeux.',
    availability: 'Indiquez votre disponibilité pour un entretien.',
    closing: 'Formule de politesse professionnelle.',
    signature: 'Votre Nom',
  };
}

function TemplateMiniPreview({ docType, templateKey, document, scale = 0.22 }: { docType: CareerDocType; templateKey: string; document: CareerDocumentFull; scale?: number }) {
  const isCv = docType === 'cv';
  const previewData = isCv ? createCvTemplatePreviewData(getCvData(document)) : createLmTemplatePreviewData(getLmData(document));
  const previewDesign = isCv ? getCvDesign(document) : getLmDesign(document);

  return (
    <div className="relative flex h-[270px] items-start justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-2">
      <div className="pointer-events-none origin-top" style={{ transform: `scale(${scale})`, width: 794, minHeight: 1123 }}>
        {isCv ? <CvPreview templateKey={templateKey} data={previewData as DocData} design={previewDesign as DesignOptions} /> : <LmPreview templateKey={templateKey} data={previewData as LmData} design={previewDesign as LmDesign} />}
      </div>
    </div>
  );
}

function TemplatePanel({ docType, document, templates, selectedTemplate, selectedKey, onSelect }: { docType: CareerDocType; document: CareerDocumentFull; templates: CareerTemplateMeta[]; selectedTemplate: CareerTemplateMeta; selectedKey: string; onSelect: (key: string) => void }) {
  const visible = templates.length ? templates : [selectedTemplate];
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('all');
  const [pricing, setPricing] = useState<'all' | 'free' | 'premium'>('all');
  const categories = useMemo(() => Array.from(new Set(visible.map(t => t.category).filter(Boolean))), [visible]);
  const filtered = visible.filter(template => {
    const categoryOk = category === 'all' || template.category === category;
    const pricingOk = pricing === 'all' || (pricing === 'free' ? template.is_free : !template.is_free);
    return categoryOk && pricingOk;
  });
  const selected = visible.find(t => t.template_key === selectedKey) || selectedTemplate;

  return (
    <>
      <div className={cardClass('p-4')}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[#002050]">Modèles disponibles</h3>
            <p className="mt-1 text-xs text-slate-500">{docType === 'cv' ? '20 modèles CV professionnels' : `${visible.length} modèles de lettres`} — rendu réel du modèle.</p>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="rounded-xl bg-[#002050] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#002050]/90">Voir en grand</button>
        </div>

        <button type="button" onClick={() => setOpen(true)} className="mb-4 block w-full rounded-2xl border border-[#002050] bg-[#002050]/5 p-2 text-left transition hover:bg-[#002050]/10">
          <TemplateMiniPreview docType={docType} templateKey={selected.template_key} document={document} scale={0.19} />
          <div className="mt-3 flex items-center justify-between gap-2 px-1">
            <div>
              <div className="text-sm font-semibold text-[#002050]">{selected.name_fr}</div>
              <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{selected.description_fr}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {selected.is_ats_compatible && <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700">ATS</span>}
              {!selected.is_free && <span className="rounded-full bg-[#bf8813]/10 px-2 py-0.5 text-[10px] font-bold text-[#bf8813]">Premium</span>}
            </div>
          </div>
        </button>

        <div className="grid grid-cols-2 gap-2">
          {visible.slice(0, 4).map(template => {
            const active = template.template_key === selectedKey;
            return (
              <button key={template.template_key} type="button" onClick={() => onSelect(template.template_key)} className={`rounded-xl border p-2 text-left transition ${active ? 'border-[#002050] bg-[#002050]/5' : 'border-slate-200 hover:bg-slate-50'}`}>
                <TemplateMiniPreview docType={docType} templateKey={template.template_key} document={document} scale={0.105} />
                <div className="mt-2 truncate text-xs font-semibold text-[#002050]">{template.name_fr}</div>
              </button>
            );
          })}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[100] bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-2xl font-semibold text-[#002050]">{docType === 'cv' ? 'Choisir un modèle de CV' : 'Choisir un modèle de lettre de motivation'}</h2>
                <p className="mt-1 text-sm text-slate-500">Aperçu réel des modèles créés : pas d’icônes, pas de placeholders.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Fermer</button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-6 py-4">
              <button onClick={() => setCategory('all')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${category === 'all' ? 'bg-[#002050] text-white' : 'bg-slate-100 text-slate-700'}`}>Tous</button>
              {categories.map(cat => <button key={cat} onClick={() => setCategory(cat)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${category === cat ? 'bg-[#002050] text-white' : 'bg-slate-100 text-slate-700'}`}>{cat.replaceAll('_', ' ')}</button>)}
              <span className="mx-2 h-5 w-px bg-slate-200" />
              <button onClick={() => setPricing('all')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${pricing === 'all' ? 'bg-[#bf8813] text-white' : 'bg-[#bf8813]/10 text-[#bf8813]'}`}>Tous</button>
              <button onClick={() => setPricing('free')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${pricing === 'free' ? 'bg-[#bf8813] text-white' : 'bg-[#bf8813]/10 text-[#bf8813]'}`}>Gratuits</button>
              <button onClick={() => setPricing('premium')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${pricing === 'premium' ? 'bg-[#bf8813] text-white' : 'bg-[#bf8813]/10 text-[#bf8813]'}`}>Premium</button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                {filtered.map(template => {
                  const active = template.template_key === selectedKey;
                  return (
                    <button key={template.template_key} type="button" onClick={() => onSelect(template.template_key)} className={`group rounded-2xl border bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${active ? 'border-[#002050] ring-4 ring-[#002050]/10' : 'border-slate-200'}`}>
                      <TemplateMiniPreview docType={docType} templateKey={template.template_key} document={document} scale={0.22} />
                      <div className="mt-3 flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[#002050]">{template.display_order}. {template.name_fr}</div>
                          <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{template.description_fr}</div>
                        </div>
                        {active && <span className="rounded-full bg-[#002050] px-2 py-1 text-[10px] font-bold text-white">Actif</span>}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {template.is_ats_compatible && <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700">ATS</span>}
                        {template.is_free ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">Gratuit</span> : <span className="rounded-full bg-[#bf8813]/10 px-2 py-0.5 text-[10px] font-bold text-[#bf8813]">Premium</span>}
                        <span className="rounded-full bg-[#002050]/5 px-2 py-0.5 text-[10px] font-bold text-[#002050]">{template.category.replaceAll('_', ' ')}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4">
              <div className="text-sm text-slate-500">{filtered.length} modèle(s) affiché(s). Sélection actuelle : <span className="font-semibold text-[#002050]">{selected.name_fr}</span></div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl bg-[#002050] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#002050]/90">Utiliser ce modèle</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DesignPanel({ design, onColorChange, onDesignChange, isCv }: { design: DesignOptions | LmDesign; onColorChange: (colors: typeof DEFAULT_COLORS) => void; onDesignChange: (patch: Partial<DesignOptions & LmDesign>) => void; isCv: boolean }) {
  const colors = design.colors as typeof DEFAULT_COLORS;
  const customPalette = { ...colors };
  return (
    <div className={cardClass('p-4')}>
      <div className="mb-3 flex items-center gap-2">
        <Palette className="h-5 w-5 text-[#002050]" />
        <h3 className="text-lg font-semibold text-[#002050]">Design du document</h3>
      </div>

      <div className="mb-4">
        <div className="mb-2 text-xs font-semibold text-slate-600">Couleurs</div>
        <div className="flex flex-wrap gap-2">
          {CAREER_PALETTES.map(palette => {
            const active = colors.primary === palette.colors.primary && colors.accent === palette.colors.accent;
            return (
              <button key={palette.key} onClick={() => onColorChange(palette.colors)} className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${active ? 'border-[#002050]' : 'border-slate-200'}`} title={palette.name}>
                <span className="h-7 w-7 rounded-full" style={{ background: `linear-gradient(135deg, ${palette.colors.primary} 50%, ${palette.colors.accent} 50%)` }} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass()}>Couleur principale</span>
          <input type="color" value={colors.primary || '#002050'} onChange={(e) => onColorChange({ ...customPalette, primary: e.target.value })} className="h-10 w-full rounded-xl border border-slate-200 bg-white p-1" />
        </label>
        <label className="block">
          <span className={labelClass()}>Couleur secondaire</span>
          <input type="color" value={colors.accent || '#bf8813'} onChange={(e) => onColorChange({ ...customPalette, accent: e.target.value })} className="h-10 w-full rounded-xl border border-slate-200 bg-white p-1" />
        </label>
      </div>

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className={labelClass()}>Police</span>
          <select className={inputClass()} value={design.font || 'inter'} onChange={(e) => onDesignChange({ font: e.target.value as any })}>
            <option value="inter">Inter / Sans-serif</option>
            <option value="arial">Arial</option>
            <option value="georgia">Georgia</option>
            <option value="times">Times New Roman</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelClass()}>Taille texte</span>
            <input type="number" min={7} max={14} className={inputClass()} value={design.font_size_body || 10} onChange={(e) => onDesignChange({ font_size_body: Number(e.target.value) })} />
          </label>
          {isCv && (
            <label className="block">
              <span className={labelClass()}>Taille titre</span>
              <input type="number" min={9} max={20} className={inputClass()} value={(design as DesignOptions).font_size_title || 11} onChange={(e) => onDesignChange({ font_size_title: Number(e.target.value) })} />
            </label>
          )}
        </div>
        <label className="block">
          <span className={labelClass()}>Interligne</span>
          <input type="range" min={1.1} max={2} step={0.05} className="w-full" value={design.line_spacing || 1.5} onChange={(e) => onDesignChange({ line_spacing: Number(e.target.value) })} />
          <span className="text-xs text-slate-500">{design.line_spacing || 1.5}</span>
        </label>
      </div>
    </div>
  );
}
