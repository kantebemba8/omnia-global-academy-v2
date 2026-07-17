import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, FileUp, HandHelping, PenLine, ShieldCheck } from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-unified`;
const SB = import.meta.env.VITE_SUPABASE_URL;
const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

function token() { return localStorage.getItem('omnia_session_token') || ''; }
async function call(action: string, body: Record<string, unknown> = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json().catch(() => ({ success: false, error: 'INVALID_RESPONSE' }));
  if (!res.ok || data.success === false) throw new Error(data.message || data.error || 'Une erreur est survenue');
  return data;
}

export default function ProfessorCourseStart() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'self' | 'assisted' | null>(null);
  const [title, setTitle] = useState('');
  const [serviceType, setServiceType] = useState<'without_certification' | 'with_certification'>('without_certification');
  const [instructions, setInstructions] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submitAssisted() {
    setError('');
    if (!title.trim()) return setError('Indiquez le titre provisoire de la formation.');
    if (serviceType === 'with_certification' && !instructions.trim()) return setError('Expliquez la certification externe souhaitée.');
    setLoading(true);
    try {
      const draftKey = crypto.randomUUID();
      const created = await call('create_course', {
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
      for (const file of files) {
        const ext = file.name.split('.').pop() || 'bin';
        const path = `${courseId}/assisted/${crypto.randomUUID()}.${ext}`;
        const signed = await call('prepare_upload', { course_id: courseId, bucket_name: 'course-resources', storage_path: path });
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
          url: `${SB}/storage/v1/object/public/course-resources/${path}`,
        });
      }
      await call('request_assisted_entry', {
        course_id: courseId,
        service_type: serviceType,
        instructions: serviceType === 'with_certification' ? instructions.trim() : '',
        documents: uploaded,
      });
      navigate('/professeur/courses');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d’envoyer la demande.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout role="professeur">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: GOLD }}>Création de formation</p>
          <h1 className="text-2xl font-semibold mt-1" style={{ color: BLUE }}>Comment souhaitez-vous créer votre formation ?</h1>
          <p className="text-sm text-gray-500 mt-2">Choisissez la méthode qui vous convient. Vous pourrez retrouver votre formation dans votre espace Professeur.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <button onClick={() => navigate('/professeur/studio/new')} className="text-left rounded-2xl border bg-white p-6 transition hover:shadow-md" style={{ borderColor: mode === 'self' ? BLUE : BORDER }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: '#EEF2FF' }}><PenLine size={21} color={BLUE} /></div>
            <h2 className="text-lg font-semibold" style={{ color: BLUE }}>Je crée moi-même</h2>
            <p className="text-sm text-gray-500 mt-2">Accédez au Studio complet : informations générales, introduction, modules, leçons, évaluations, conclusion et examen final.</p>
            <span className="inline-flex mt-4 text-sm font-semibold" style={{ color: GOLD }}>Ouvrir le Studio →</span>
          </button>

          <button onClick={() => setMode('assisted')} className="text-left rounded-2xl border bg-white p-6 transition hover:shadow-md" style={{ borderColor: mode === 'assisted' ? GOLD : BORDER }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: '#FFFBEB' }}><HandHelping size={21} color={GOLD} /></div>
            <h2 className="text-lg font-semibold" style={{ color: BLUE }}>Demander une saisie assistée par Omnia</h2>
            <p className="text-sm text-gray-500 mt-2">Envoyez vos documents. L’équipe Omnia structurera la formation dans le Studio, puis vous la retrouverez prête à contrôler.</p>
            <span className="inline-flex mt-4 text-sm font-semibold" style={{ color: GOLD }}>Préparer ma demande →</span>
          </button>
        </div>

        {mode === 'assisted' && (
          <div className="mt-6 rounded-2xl border bg-white p-6" style={{ borderColor: BORDER }}>
            <div className="flex items-center gap-2 mb-4"><ShieldCheck size={18} color={GOLD} /><h2 className="text-base font-semibold" style={{ color: BLUE }}>Demande de saisie assistée</h2></div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">Titre provisoire de la formation
                <input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: BORDER }} placeholder="Ex. Comptabilité pratique SYSCOHADA" />
              </label>
              <label className="text-sm font-medium text-gray-700">Type de demande
                <select value={serviceType} onChange={e => { setServiceType(e.target.value as any); if (e.target.value === 'without_certification') setInstructions(''); }} className="mt-1 w-full rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: BORDER }}>
                  <option value="without_certification">Sans certification externe</option>
                  <option value="with_certification">Avec certification externe</option>
                </select>
              </label>
            </div>

            <label className="mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-5 text-center" style={{ borderColor: '#CBD5E1', background: '#F8FAFC' }}>
              <FileUp size={22} color={BLUE} />
              <span className="mt-2 text-sm font-semibold" style={{ color: BLUE }}>Ajouter vos documents</span>
              <span className="text-xs text-gray-500 mt-1">PDF, Word, PowerPoint, Excel, ZIP ou images</span>
              <input type="file" multiple className="hidden" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,image/*" onChange={e => setFiles(Array.from(e.target.files || []))} />
            </label>
            {files.length > 0 && <p className="mt-2 text-xs text-gray-500">{files.map(f => f.name).join(', ')}</p>}

            {serviceType === 'with_certification' && (
              <label className="block mt-4 text-sm font-medium text-gray-700">Informations sur la certification externe
                <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={4} className="mt-1 w-full rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: BORDER }} placeholder="Indiquez l’organisme, le type de certification, les exigences et toute information utile." />
              </label>
            )}

            {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              <button onClick={() => setMode(null)} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: BORDER, color: '#374151' }}>Annuler</button>
              <button onClick={submitAssisted} disabled={loading} className="rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: GOLD }}>{loading ? 'Envoi en cours…' : serviceType === 'with_certification' ? 'Envoyer la demande' : 'Valider la demande'}</button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
