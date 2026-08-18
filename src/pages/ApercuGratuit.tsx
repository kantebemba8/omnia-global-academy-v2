import { getSessionToken } from '../lib/session';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, ChevronRight, Lock, ShieldCheck } from 'lucide-react';
import { BlockRenderer } from '../components/BlockRenderer';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-unified`;

type PreviewBlock = {
  id: string;
  block_type: string;
  position: number;
  title?: string;
  content_json: Record<string, unknown>;
  settings_json?: Record<string, unknown>;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  file_mime?: string;
};

type PreviewPayload = {
  success: boolean;
  preview_enabled: boolean;
  privileged?: boolean;
  course: {
    id: string;
    title: string;
    short_description?: string;
    cover_image_url?: string;
    category?: string;
    level?: string;
    sale_mode?: 'free' | 'paid';
    price_xof?: number;
    desired_price_amount?: number;
    sale_currency?: string;
    current_version?: string;
  };
  introduction: null | {
    id: string;
    title: string;
    blocks: PreviewBlock[];
  };
  first_lesson: null | {
    id: string;
    title: string;
    blocks: PreviewBlock[];
  };
  program: Array<{
    id: string;
    title: string;
    objective?: string;
    lessons: Array<{ id: string; title: string; locked: boolean }>;
  }>;
  error?: string;
};

export function ApercuGratuit() {
  const { id: courseId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<PreviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!courseId) return;
    const sessionToken = getSessionToken() || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'public_course_preview', course_id: courseId }),
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error || 'Aperçu indisponible');
        setData(payload);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Aperçu indisponible'))
      .finally(() => setLoading(false));
  }, [courseId]);

  const totalLessons = useMemo(
    () => data?.program.reduce((total, module) => total + module.lessons.length, 0) || 0,
    [data],
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8F9FA' }}><div className="w-9 h-9 rounded-full border-2 animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} /></div>;
  }

  if (!data || error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-5" style={{ background: '#F8F9FA', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <p className="font-semibold" style={{ color: '#002050' }}>Aperçu indisponible</p>
        <p className="text-sm text-center" style={{ color: '#6B7280' }}>{error || 'Cette formation ne propose pas encore d’aperçu gratuit.'}</p>
        <button onClick={() => navigate(`/cours/${courseId}`)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#002050' }}>Retour à la formation</button>
      </div>
    );
  }

  const { course, introduction, first_lesson: firstLesson, program } = data;
  const priceLabel = course.sale_mode === 'free'
    ? 'Gratuit'
    : `${Number(course.price_xof ?? course.desired_price_amount ?? 0).toLocaleString('fr-FR')} ${course.sale_currency || 'XOF'}`;

  return (
    <div className="min-h-screen pb-28" style={{ background: '#F8F9FA', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header className="sticky top-0 z-30 border-b" style={{ background: '#FFFFFF', borderColor: '#E4E7EC' }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(`/cours/${courseId}`)} className="w-9 h-9 rounded-lg border flex items-center justify-center" style={{ borderColor: '#E4E7EC' }} aria-label="Retour">
            <ArrowLeft size={17} style={{ color: '#002050' }} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: '#002050' }}>{course.title}</p>
            <p className="text-xs" style={{ color: '#6B7280' }}>Aperçu gratuit : introduction et première leçon</p>
          </div>
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: '#FFFBEB', color: '#92400E' }}>APERÇU</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <section className="space-y-5">
          <div className="rounded-2xl overflow-hidden border bg-white" style={{ borderColor: '#E4E7EC' }}>
            {course.cover_image_url && <img src={course.cover_image_url} alt="Couverture de la formation" className="w-full aspect-video object-cover" />}
            <div className="p-5">
              <div className="flex flex-wrap gap-2 mb-3">
                {course.category && <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>{course.category}</span>}
                {course.level && <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#F3F4F6', color: '#374151' }}>{course.level}</span>}
                {course.current_version && <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#F0FDF4', color: '#166534' }}>Version {course.current_version}</span>}
              </div>
              <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>{course.title}</h1>
              {course.short_description && <p className="text-sm mt-2 leading-relaxed" style={{ color: '#6B7280' }}>{course.short_description}</p>}
            </div>
          </div>

          {data.preview_enabled && introduction ? (
            <>
              <article className="rounded-2xl border bg-white p-5 md:p-7" style={{ borderColor: '#E4E7EC' }}>
                <div className="flex items-center gap-2 mb-5"><BookOpen size={18} style={{ color: '#BF8813' }} /><h2 className="font-bold" style={{ color: '#002050' }}>{introduction.title || 'Introduction'}</h2></div>
                <div className="space-y-2">
                  {introduction.blocks.map((block) => <BlockRenderer key={block.id} block={block as any} />)}
                </div>
              </article>
              {firstLesson && (
                <article className="rounded-2xl border bg-white p-5 md:p-7" style={{ borderColor: '#E4E7EC' }}>
                  <div className="mb-5">
                    <p className="text-xs font-semibold uppercase tracking-[.12em]" style={{ color: '#1E7A52' }}>Première leçon offerte</p>
                    <h2 className="mt-1 font-bold" style={{ color: '#002050' }}>{firstLesson.title}</h2>
                    <p className="mt-1 text-xs" style={{ color: '#6B7280' }}>Les entraînements, évaluations, notes et progression officielle restent verrouillés jusqu’à l’inscription ou l’achat.</p>
                  </div>
                  <div className="space-y-2">
                    {firstLesson.blocks.map((block) => <BlockRenderer key={block.id} block={block as any} />)}
                  </div>
                </article>
              )}
            </>
          ) : (
            <div className="rounded-2xl border bg-white p-10 text-center" style={{ borderColor: '#E4E7EC' }}>
              <Lock size={28} className="mx-auto mb-3" style={{ color: '#9CA3AF' }} />
              <p className="font-semibold" style={{ color: '#002050' }}>Aucun aperçu gratuit</p>
              <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Le contenu est accessible après inscription ou achat.</p>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border bg-white p-5 sticky top-20" style={{ borderColor: '#E4E7EC' }}>
            <div className="flex items-center gap-2 mb-4"><ShieldCheck size={17} style={{ color: '#1E7A52' }} /><p className="text-sm font-semibold" style={{ color: '#002050' }}>Ce que vous apprendrez ensuite</p></div>
            <p className="text-xs mb-4" style={{ color: '#6B7280' }}>{program.length} module{program.length > 1 ? 's' : ''} · {totalLessons} leçon{totalLessons > 1 ? 's' : ''}</p>
            <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
              {program.map((module, index) => (
                <div key={module.id} className="rounded-xl border p-3" style={{ borderColor: '#E4E7EC' }}>
                  <div className="flex items-start gap-2"><Lock size={13} className="mt-0.5 flex-shrink-0" style={{ color: '#9CA3AF' }} /><div><p className="text-xs font-semibold" style={{ color: '#002050' }}>Module {index + 1} — {module.title}</p>{module.objective && <p className="text-xs mt-1" style={{ color: '#6B7280' }}>{module.objective}</p>}</div></div>
                  {module.lessons.length > 0 && (
                    <div className="mt-3 space-y-2 pl-5">
                      {module.lessons.map((lesson, lessonIndex) => (
                        <div key={lesson.id} className="flex items-start gap-2 text-[11px]" style={{ color: lesson.locked ? '#9CA3AF' : '#1E7A52' }}>
                          {lesson.locked ? <Lock size={11} className="mt-0.5 shrink-0" /> : <BookOpen size={11} className="mt-0.5 shrink-0" />}
                          <span><strong>{lessonIndex + 1}.</strong> {lesson.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t" style={{ background: '#002050', borderColor: 'rgba(255,255,255,.1)' }}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-white truncate">Vous avez terminé l’aperçu gratuit</p><p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,.65)' }}>Débloquez les modules, leçons, évaluations, conclusion et examen final.</p></div>
          <button onClick={() => navigate(`/cours/${courseId}`)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white flex-shrink-0" style={{ background: '#BF8813' }}>{course.sale_mode === 'free' ? "S'inscrire" : `Acheter · ${priceLabel}`}<ChevronRight size={15} /></button>
        </div>
      </div>
    </div>
  );
}
