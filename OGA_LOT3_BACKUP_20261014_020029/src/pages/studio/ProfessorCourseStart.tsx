import { useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FileCheck2,
  FileUp,
  HandHelping,
  PenLine,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { ProfessorFormationsLayout, StructureFormationsLayout } from '../../components/formations/FormationsRoleLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { uploadCourseImportFile } from '../../lib/courseImportUpload';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-unified`;
const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';
const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
const IMPORT_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'pptx', 'zip', 'txt', 'md', 'csv'];

type CreatorContext = 'professeur' | 'structure' | 'admin';
type CreationMode = 'file' | 'assisted' | null;
type ImportMode = 'faithful' | 'structured' | 'enriched';
type ImportPreview = { job_id: string; blueprint: any; detected: { modules?: number; lessons?: number; suggested_questions?: number; language?: string; ai_used?: boolean; slides?: number; images?: number; tables?: number }; mode: ImportMode };

async function call(action: string, body: Record<string, unknown> = {}) {
  const response = await fetch(API, {
    method: 'POST',
    headers: edgeAuthHeaders(),
    body: JSON.stringify({ action, ...body }),
  });
  const data = await response.json().catch(() => ({ success: false, error: 'INVALID_RESPONSE' }));
  if (!response.ok || data.success === false) {
    throw new Error(data.message || data.error || 'Une erreur est survenue');
  }
  return data;
}

function fileExtension(name: string) {
  return name.split('.').pop()?.trim().toLowerCase() || '';
}

function CreationLayout({ context, children }: { context: CreatorContext; children: ReactNode }) {
  if (context === 'structure') return <StructureFormationsLayout>{children}</StructureFormationsLayout>;
  if (context === 'admin') return <AdminLayout headerTitle="Import de formation" headerSubtitle="Omnia Formations · Super-admin" contentClassName="bg-transparent">{children}</AdminLayout>;
  return <ProfessorFormationsLayout>{children}</ProfessorFormationsLayout>;
}

export default function ProfessorCourseStart() {
  const navigate = useNavigate();
  const location = useLocation();
  const creatorContext: CreatorContext = location.pathname.includes('/structure/')
    ? 'structure'
    : location.pathname.includes('/admin/')
      ? 'admin'
      : 'professeur';
  const routes = useMemo(() => {
    if (creatorContext === 'structure') {
      return {
        manual: '/structure/studio/new',
        studio: '/structure/studio',
        courses: '/structure/formations',
      };
    }
    if (creatorContext === 'admin') {
      return {
        manual: '/admin/studio/new',
        studio: '/admin/studio',
        courses: '/admin/studio-mes-formations',
      };
    }
    return {
      manual: '/professeur/studio/new',
      studio: '/professeur/studio',
      courses: '/professeur/courses',
    };
  }, [creatorContext]);

  const canRequestAssistance = creatorContext !== 'admin';
  const isAdminFileImport = creatorContext === 'admin' && location.pathname === '/admin/courses/import';

  const [mode, setMode] = useState<CreationMode>(() => isAdminFileImport ? 'file' : null);
  const [title, setTitle] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [importMode, setImportMode] = useState<ImportMode>('structured');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [serviceType, setServiceType] = useState<'without_certification' | 'with_certification'>('without_certification');
  const [instructions, setInstructions] = useState('');
  const [assistedFiles, setAssistedFiles] = useState<File[]>([]);
  const [loadingAssisted, setLoadingAssisted] = useState(false);
  const [error, setError] = useState('');

  function resetPanels(next: CreationMode) {
    setError('');
    setImportStatus('');
    setImportPreview(null);
    setMode(next);
  }

  function validateImportFile(file: File) {
    const extension = fileExtension(file.name);
    if (!IMPORT_EXTENSIONS.includes(extension)) {
      throw new Error('Format non pris en charge. Utilisez PDF, DOCX, XLSX, PPTX, ZIP, TXT, MD ou CSV.');
    }
    if (file.size <= 0) throw new Error('Le fichier sélectionné est vide.');
    if (file.size > MAX_IMPORT_BYTES) throw new Error('Le fichier dépasse la limite de 25 Mo.');
  }

  async function submitFileImport() {
    setError('');
    setImportStatus('');
    if (!importFile) return setError('Sélectionnez le fichier à analyser.');

    try {
      validateImportFile(importFile);
      setImporting(true);
      setImportStatus('Préparation sécurisée du fichier…');

      const prepared = await call('prepare_course_import_upload', {
        creator_context: creatorContext,
        original_name: importFile.name,
        file_size: importFile.size,
        file_mime: importFile.type || 'application/octet-stream',
      });

      setImportStatus('Téléversement sécurisé du fichier…');
      await uploadCourseImportFile({
        bucket: prepared.bucket,
        path: prepared.path,
        token: prepared.token,
        upload_mime: prepared.upload_mime,
      }, importFile);

      setImportStatus('Analyse du document et préparation de l’aperçu…');
      const analyzed = await call('analyze_course_import', {
        creator_context: creatorContext,
        target_type: 'course',
        bucket_name: prepared.bucket,
        storage_path: prepared.path,
        original_name: importFile.name,
        file_size: importFile.size,
        file_mime: importFile.type || 'application/octet-stream',
        title: title.trim(),
        mode: importMode,
        allow_ai: importMode !== 'faithful',
      });

      setImportPreview({
        job_id: analyzed.job_id,
        blueprint: analyzed.blueprint,
        detected: analyzed.detected || {},
        mode: analyzed.mode || importMode,
      });
      setImportStatus('Analyse terminée. Vérifiez la structure avant de créer le brouillon.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible d’analyser ce fichier.');
    } finally {
      setImporting(false);
    }
  }

  async function applyFileImport() {
    if (!importPreview) return;
    setError('');
    try {
      setImporting(true);
      setImportStatus('Création du brouillon à partir de la structure validée…');
      const applied = await call('apply_course_import', {
        job_id: importPreview.job_id,
        creator_context: creatorContext,
        blueprint: importPreview.blueprint,
      });
      const courseId = applied.course?.id || applied.course_id;
      if (!courseId) throw new Error('Le brouillon a été créé sans identifiant exploitable.');
      navigate(`${routes.studio}/${courseId}?source=file-import-v3`, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible de créer le brouillon depuis cet aperçu.');
    } finally {
      setImporting(false);
      setImportStatus('');
    }
  }

  async function submitAssisted() {
    setError('');
    if (!canRequestAssistance) {
      setMode(null);
      return setError('La saisie assistée n’est pas disponible pour l’Administration.');
    }
    if (!title.trim()) return setError('Indiquez le titre provisoire de la formation.');
    if (serviceType === 'with_certification' && !instructions.trim()) {
      return setError('Expliquez la certification externe souhaitée.');
    }

    setLoadingAssisted(true);
    try {
      const draftKey = crypto.randomUUID();
      const created = await call('create_course', {
        creator_context: creatorContext,
        client_draft_key: draftKey,
        title: title.trim(),
        short_description: 'Formation en saisie assistée par Omnia',
        long_description: '',
        language: 'fr',
        create_introduction: true,
        free_preview_mode: 'introduction_first_lesson',
        is_assisted: true,
      });
      const courseId = created.course.id;
      const uploaded: Array<Record<string, unknown>> = [];

      for (const file of assistedFiles) {
        const extension = fileExtension(file.name) || 'bin';
        const path = `${courseId}/assisted/${crypto.randomUUID()}.${extension}`;
        const signed = await call('prepare_upload', {
          course_id: courseId,
          bucket_name: 'course-resources',
          storage_path: path,
        });
        const upload = await fetch(signed.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!upload.ok) throw new Error(`Échec de l'envoi du fichier ${file.name}`);
        uploaded.push({
          name: file.name,
          size: file.size,
          mime: file.type,
          bucket_name: 'course-resources',
          storage_path: path,
        });
      }

      await call('request_assisted_entry', {
        course_id: courseId,
        service_type: serviceType,
        instructions: serviceType === 'with_certification' ? instructions.trim() : '',
        documents: uploaded,
      });
      navigate(routes.courses);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible d’envoyer la demande.');
    } finally {
      setLoadingAssisted(false);
    }
  }

  return (
    <CreationLayout context={creatorContext}>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: GOLD }}>
            {isAdminFileImport ? 'Import de formation OGA' : 'Création de formation'}
          </p>
          <h1 className="mt-1 text-2xl font-semibold" style={{ color: BLUE }}>
            {isAdminFileImport ? 'Créer une formation à partir d’un fichier' : 'Comment souhaitez-vous créer votre formation ?'}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-500">
            {isAdminFileImport
              ? 'Le fichier est converti en brouillon modifiable. La formation reste directement rattachée à Omnia Global Academy et doit être vérifiée dans le Studio avant publication.'
              : 'Le Studio manuel reste disponible comme depuis le début. Vous pouvez aussi convertir un fichier en brouillon modifiable, sans publication automatique.'}
          </p>
        </div>

        {!isAdminFileImport && <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => navigate(routes.manual)}
            className="text-left rounded-2xl border bg-white p-6 transition hover:shadow-md"
            style={{ borderColor: BORDER }}
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: '#EEF2FF' }}>
              <PenLine size={21} color={BLUE} />
            </div>
            <h2 className="text-lg font-semibold" style={{ color: BLUE }}>Créer manuellement</h2>
            <p className="mt-2 text-sm text-gray-500">
              Ouvrez le Studio complet et construisez vous-même les informations, modules, leçons, ressources et évaluations.
            </p>
            <span className="mt-4 inline-flex text-sm font-semibold" style={{ color: GOLD }}>Ouvrir le Studio →</span>
          </button>

          <button
            type="button"
            onClick={() => resetPanels('file')}
            className="text-left rounded-2xl border bg-white p-6 transition hover:shadow-md"
            style={{ borderColor: mode === 'file' ? GOLD : BORDER }}
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: '#FFFBEB' }}>
              <UploadCloud size={21} color={GOLD} />
            </div>
            <h2 className="text-lg font-semibold" style={{ color: BLUE }}>Créer à partir d’un fichier</h2>
            <p className="mt-2 text-sm text-gray-500">
              Importez un document. Omnia extrait le contenu et prépare une structure de formation que vous contrôlez ensuite dans le Studio.
            </p>
            <span className="mt-4 inline-flex text-sm font-semibold" style={{ color: GOLD }}>Importer et convertir →</span>
          </button>
        </div>}

        {mode === 'file' && (
          <section className="mt-6 rounded-2xl border bg-white p-6" style={{ borderColor: BORDER }}>
            <div className="mb-4 flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: '#EEF2FF' }}>
                <FileCheck2 size={18} color={BLUE} />
              </div>
              <div>
                <h2 className="text-base font-semibold" style={{ color: BLUE }}>Créer un brouillon depuis un fichier</h2>
                <p className="mt-1 text-sm text-gray-500">Le résultat reste un brouillon. Vérifiez et modifiez chaque partie avant toute soumission.</p>
              </div>
            </div>

            <label className="block text-sm font-medium text-gray-700">
              Titre souhaité <span className="font-normal text-gray-400">(facultatif)</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2.5 text-sm"
                style={{ borderColor: BORDER }}
                placeholder="À défaut, le nom du fichier sera utilisé"
                maxLength={500}
              />
            </label>

            <label className="mt-4 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-5 text-center" style={{ borderColor: '#CBD5E1', background: '#F8FAFC' }}>
              <FileUp size={24} color={BLUE} />
              <span className="mt-2 text-sm font-semibold" style={{ color: BLUE }}>Sélectionner le fichier à convertir</span>
              <span className="mt-1 text-xs text-gray-500">PDF, DOCX, XLSX, PPTX, ZIP, TXT, MD ou CSV · 25 Mo maximum</span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.docx,.xlsx,.pptx,.zip,.txt,.md,.csv"
                onChange={(event) => {
                  const selected = event.target.files?.[0] || null;
                  setError('');
                  setImportFile(selected);
                }}
              />
            </label>

            {importFile && (
              <div className="mt-3 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: BORDER, color: BLUE }}>
                <span className="font-semibold">{importFile.name}</span>
                <span className="ml-2 text-xs text-gray-500">{(importFile.size / 1024 / 1024).toFixed(2)} Mo</span>
              </div>
            )}

            <div className="mt-4">
              <p className="text-sm font-semibold" style={{ color: BLUE }}>Mode de transformation</p>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                {[
                  { value: 'faithful', title: 'Fidèle', text: 'Conserve le document aussi fidèlement que possible, sans enrichissement IA.' },
                  { value: 'structured', title: 'Structuré', text: 'Organise le contenu en modules, leçons et blocs sans ajouter de connaissances nouvelles.' },
                  { value: 'enriched', title: 'Enrichi', text: 'Structure et peut proposer objectifs, résumés, exemples, activités et évaluations à vérifier.' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => { setImportMode(option.value as ImportMode); setImportPreview(null); }}
                    className="rounded-xl border p-3 text-left"
                    style={{ borderColor: importMode === option.value ? GOLD : BORDER, background: importMode === option.value ? '#FFFBEB' : '#FFFFFF' }}
                  >
                    <span className="block text-sm font-semibold" style={{ color: BLUE }}>{option.title}</span>
                    <span className="mt-1 block text-xs text-gray-500">{option.text}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Les anciens formats DOC, PPT et XLS doivent être enregistrés en DOCX, PPTX ou XLSX. L’analyse prépare toujours un aperçu avant création. N’importez pas de données sensibles sans autorisation.
            </div>

            {importPreview && (
              <div className="mt-5 rounded-xl border p-4" style={{ borderColor: '#D7DEE8', background: '#F8FAFC' }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: BLUE }}>Aperçu de la structure détectée</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {importPreview.detected.modules || 0} module(s) · {importPreview.detected.lessons || 0} leçon(s) · {importPreview.detected.suggested_questions || 0} activité(s)/question(s) proposée(s){(importPreview.detected.slides || importPreview.detected.images || importPreview.detected.tables) ? ` · ${importPreview.detected.slides || 0} diapositive(s) · ${importPreview.detected.images || 0} image(s) · ${importPreview.detected.tables || 0} tableau(x)` : ''}
                    </p>
                  </div>
                  <button type="button" onClick={() => setImportPreview(null)} className="text-xs font-semibold" style={{ color: GOLD }}>Relancer l’analyse</button>
                </div>
                <div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">
                  {(importPreview.blueprint?.modules || []).map((module: any, moduleIndex: number) => (
                    <div key={`${moduleIndex}-${module.title || 'module'}`} className="rounded-lg border bg-white p-3" style={{ borderColor: BORDER }}>
                      <input
                        value={module.title || ''}
                        onChange={(event) => {
                          const blueprint = structuredClone(importPreview.blueprint);
                          blueprint.modules[moduleIndex].title = event.target.value;
                          setImportPreview({ ...importPreview, blueprint });
                        }}
                        className="w-full border-0 bg-transparent p-0 text-sm font-semibold outline-none"
                        style={{ color: BLUE }}
                        aria-label={`Titre du module ${moduleIndex + 1}`}
                      />
                      <div className="mt-2 space-y-1">
                        {(module.lessons || []).map((lesson: any, lessonIndex: number) => (
                          <input
                            key={`${lessonIndex}-${lesson.title || 'lesson'}`}
                            value={lesson.title || ''}
                            onChange={(event) => {
                              const blueprint = structuredClone(importPreview.blueprint);
                              blueprint.modules[moduleIndex].lessons[lessonIndex].title = event.target.value;
                              setImportPreview({ ...importPreview, blueprint });
                            }}
                            className="block w-full rounded-md border px-2 py-1.5 text-xs"
                            style={{ borderColor: BORDER }}
                            aria-label={`Titre de la leçon ${lessonIndex + 1}`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-gray-500">La Conclusion n’est jamais générée automatiquement. Vous la construirez manuellement avec les blocs dans le Studio.</p>
              </div>
            )}

            {importStatus && <p className="mt-4 text-sm font-medium" style={{ color: BLUE }}>{importStatus}</p>}
            {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              <button type="button" onClick={() => isAdminFileImport ? navigate(routes.courses) : resetPanels(null)} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: BORDER, color: '#374151' }}>
                {isAdminFileImport ? 'Retour à mes formations' : 'Annuler'}
              </button>
              <button
                type="button"
                onClick={importPreview ? applyFileImport : submitFileImport}
                disabled={importing || (!importPreview && !importFile)}
                className="rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: GOLD }}
              >
                {importing ? 'Traitement en cours…' : importPreview ? 'Créer le brouillon depuis cet aperçu' : 'Analyser le document'}
              </button>
            </div>
          </section>
        )}

        {canRequestAssistance && (
          <>
        <div className="mt-8 rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: '#F8FAFC' }}>
                <HandHelping size={19} color={GOLD} />
              </div>
              <div>
                <h2 className="text-base font-semibold" style={{ color: BLUE }}>Besoin que l’équipe Omnia réalise la saisie ?</h2>
                <p className="mt-1 text-sm text-gray-500">Le service de saisie assistée reste distinct de la conversion automatique d’un fichier.</p>
              </div>
            </div>
            <button type="button" onClick={() => resetPanels('assisted')} className="rounded-lg border px-4 py-2 text-sm font-semibold" style={{ borderColor: GOLD, color: GOLD }}>
              Préparer une demande
            </button>
          </div>
        </div>
          </>
        )}

        {canRequestAssistance && mode === 'assisted' && (
          <section className="mt-4 rounded-2xl border bg-white p-6" style={{ borderColor: BORDER }}>
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck size={18} color={GOLD} />
              <h2 className="text-base font-semibold" style={{ color: BLUE }}>Demande de saisie assistée</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">
                Titre provisoire de la formation
                <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: BORDER }} placeholder="Ex. Comptabilité pratique SYSCOHADA" />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Type de demande
                <select
                  value={serviceType}
                  onChange={(event) => {
                    const next = event.target.value as 'without_certification' | 'with_certification';
                    setServiceType(next);
                    if (next === 'without_certification') setInstructions('');
                  }}
                  className="mt-1 w-full rounded-lg border px-3 py-2.5 text-sm"
                  style={{ borderColor: BORDER }}
                >
                  <option value="without_certification">Sans certification externe</option>
                  <option value="with_certification">Avec certification externe</option>
                </select>
              </label>
            </div>

            <label className="mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-5 text-center" style={{ borderColor: '#CBD5E1', background: '#F8FAFC' }}>
              <FileUp size={22} color={BLUE} />
              <span className="mt-2 text-sm font-semibold" style={{ color: BLUE }}>Ajouter vos documents</span>
              <span className="mt-1 text-xs text-gray-500">PDF, Word, PowerPoint, Excel, ZIP ou images</span>
              <input type="file" multiple className="hidden" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,image/*" onChange={(event) => setAssistedFiles(Array.from(event.target.files || []))} />
            </label>
            {assistedFiles.length > 0 && <p className="mt-2 text-xs text-gray-500">{assistedFiles.map((file) => file.name).join(', ')}</p>}

            {serviceType === 'with_certification' && (
              <label className="mt-4 block text-sm font-medium text-gray-700">
                Informations sur la certification externe
                <textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={4} className="mt-1 w-full rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: BORDER }} placeholder="Indiquez l’organisme, le type de certification, les exigences et toute information utile." />
              </label>
            )}

            {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              <button type="button" onClick={() => resetPanels(null)} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: BORDER, color: '#374151' }}>Annuler</button>
              <button type="button" onClick={submitAssisted} disabled={loadingAssisted} className="rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: GOLD }}>
                {loadingAssisted ? 'Envoi en cours…' : 'Envoyer la demande'}
              </button>
            </div>
          </section>
        )}

        <div className="mt-5 flex items-center gap-2 text-xs text-gray-500">
          <Sparkles size={14} color={GOLD} />
          La conversion prépare une base de travail ; le créateur reste responsable de la vérification pédagogique et des droits sur le contenu importé.
        </div>
      </div>
    </CreationLayout>
  );
}
