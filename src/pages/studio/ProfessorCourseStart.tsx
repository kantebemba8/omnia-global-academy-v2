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
import { DashboardLayout } from '../../components/DashboardLayout';
import { StructureLayout } from '../../components/StructureLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-unified`;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';
const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
const IMPORT_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'zip', 'txt', 'md', 'csv'];

type CreatorContext = 'professeur' | 'structure' | 'admin';
type CreationMode = 'file' | 'assisted' | null;

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
  if (context === 'structure') return <StructureLayout>{children}</StructureLayout>;
  if (context === 'admin') return <DashboardLayout role="super_admin">{children}</DashboardLayout>;
  return <DashboardLayout role="professeur">{children}</DashboardLayout>;
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

  const [mode, setMode] = useState<CreationMode>(null);
  const [title, setTitle] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [allowAiStructuring, setAllowAiStructuring] = useState(false);
  const [serviceType, setServiceType] = useState<'without_certification' | 'with_certification'>('without_certification');
  const [instructions, setInstructions] = useState('');
  const [assistedFiles, setAssistedFiles] = useState<File[]>([]);
  const [loadingAssisted, setLoadingAssisted] = useState(false);
  const [error, setError] = useState('');

  function resetPanels(next: CreationMode) {
    setError('');
    setImportStatus('');
    setMode(next);
  }

  function validateImportFile(file: File) {
    const extension = fileExtension(file.name);
    if (!IMPORT_EXTENSIONS.includes(extension)) {
      throw new Error('Format non pris en charge. Utilisez PDF, DOCX, XLSX, ZIP, TXT, MD ou CSV.');
    }
    if (file.size <= 0) throw new Error('Le fichier sélectionné est vide.');
    if (file.size > MAX_IMPORT_BYTES) throw new Error('Le fichier dépasse la limite de 25 Mo.');
  }

  async function submitFileImport() {
    setError('');
    setImportStatus('');
    if (!importFile) return setError('Sélectionnez le fichier à convertir.');

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

      setImportStatus('Téléversement du fichier…');
      const upload = await fetch(prepared.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': importFile.type || 'application/octet-stream' },
        body: importFile,
      });
      if (!upload.ok) throw new Error('Le téléversement du fichier a échoué.');

      setImportStatus('Analyse et création du brouillon…');
      const converted = await call('convert_course_import', {
        creator_context: creatorContext,
        bucket_name: prepared.bucket,
        storage_path: prepared.path,
        original_name: importFile.name,
        file_size: importFile.size,
        file_mime: importFile.type || 'application/octet-stream',
        title: title.trim(),
        allow_ai: allowAiStructuring,
      });

      const courseId = converted.course?.id;
      if (!courseId) throw new Error('Le brouillon a été créé sans identifiant exploitable.');
      navigate(`${routes.studio}/${courseId}?source=file-import`, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible de convertir ce fichier.');
    } finally {
      setImporting(false);
      setImportStatus('');
    }
  }

  async function submitAssisted() {
    setError('');
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
        free_preview_mode: 'introduction',
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
          url: `${SUPABASE_URL}/storage/v1/object/public/course-resources/${path}`,
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
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: GOLD }}>Création de formation</p>
          <h1 className="mt-1 text-2xl font-semibold" style={{ color: BLUE }}>Comment souhaitez-vous créer votre formation ?</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-500">
            Le Studio manuel reste disponible comme depuis le début. Vous pouvez aussi convertir un fichier en brouillon modifiable, sans publication automatique.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
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
        </div>

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
              <span className="mt-1 text-xs text-gray-500">PDF, DOCX, XLSX, ZIP, TXT, MD ou CSV · 25 Mo maximum</span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.docx,.xlsx,.zip,.txt,.md,.csv"
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

            <label className="mt-4 flex items-start gap-3 rounded-xl border p-3" style={{ borderColor: BORDER }}>
              <input
                type="checkbox"
                checked={allowAiStructuring}
                onChange={(event) => setAllowAiStructuring(event.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span className="text-xs text-gray-600">
                <strong style={{ color: BLUE }}>Assistance IA facultative :</strong> autoriser l’envoi du texte extrait au service IA configuré par Omnia afin d’améliorer la proposition de modules et de questions. Sans cette autorisation, la structuration reste automatique et interne.
              </span>
            </label>

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Les anciens formats DOC et XLS doivent être enregistrés en DOCX ou XLSX. Les PDF scannés sans texte exploitable pourront être refusés. N’importez pas de données sensibles sans autorisation.
            </div>

            {importStatus && <p className="mt-4 text-sm font-medium" style={{ color: BLUE }}>{importStatus}</p>}
            {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              <button type="button" onClick={() => resetPanels(null)} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: BORDER, color: '#374151' }}>Annuler</button>
              <button
                type="button"
                onClick={submitFileImport}
                disabled={importing || !importFile}
                className="rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: GOLD }}
              >
                {importing ? 'Conversion en cours…' : 'Créer le brouillon'}
              </button>
            </div>
          </section>
        )}

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

        {mode === 'assisted' && (
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
