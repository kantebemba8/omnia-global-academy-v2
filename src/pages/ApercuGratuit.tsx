import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Lock, PlayCircle, Volume2, FileText, ChevronRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ENDPOINTS } from '../lib/config';

interface PreviewLesson {
  id: string; title: string; content_type: 'video' | 'audio' | 'text';
  video_url?: string; audio_url?: string; text_content?: string; lesson_summary?: string;
}

interface CoursePreview {
  id: string; title: string; is_free: boolean; price: number;
  free_preview_lesson: PreviewLesson | null;
}

export function ApercuGratuit() {
  const { id: courseId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState<CoursePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) return;
    const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    fetch(`${ENDPOINTS.courseDetail}?course_id=${courseId}`, { headers: { Authorization: `Bearer ${ANON_KEY}` } })
      .then(r => r.json())
      .then(d => { if (d.error) { setError(d.message ?? 'Erreur'); return; } setCourse(d); })
      .catch(() => setError('Erreur réseau.'))
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
    </div>
  );

  if (error || !course) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-sm" style={{ color: '#6B7280' }}>{error ?? 'Formation introuvable.'}</p>
      <Link to="/catalogue" className="text-sm font-medium" style={{ color: '#002050' }}>← Retour au catalogue</Link>
    </div>
  );

  const lesson = course.free_preview_lesson;

  return (
    <div className="min-h-screen pb-28" style={{ fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#F8F9FA' }}>
      <header className="sticky top-0 z-20 flex items-center gap-3 px-5 py-3" style={{ backgroundColor: '#002050' }}>
        <button onClick={() => navigate(`/cours/${courseId}`)} className="hover:opacity-70 transition-opacity">
          <ArrowLeft size={18} style={{ color: 'rgba(255,255,255,0.70)' }} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-white truncate">{course.title}</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Aperçu gratuit</p>
        </div>
        <span className="text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0" style={{ backgroundColor: '#BF8813', color: '#FFFFFF' }}>APERÇU</span>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {lesson ? (
          <>
            <div className="flex items-center gap-2">
              {lesson.content_type === 'video' && <PlayCircle size={18} style={{ color: '#002050' }} />}
              {lesson.content_type === 'audio' && <Volume2 size={18} style={{ color: '#002050' }} />}
              {lesson.content_type === 'text' && <FileText size={18} style={{ color: '#002050' }} />}
              <h1 className="font-bold text-lg" style={{ color: '#002050' }}>{lesson.title}</h1>
            </div>

            {lesson.content_type === 'video' && lesson.video_url && (
              <div className="rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9', backgroundColor: '#000' }}>
                <iframe src={lesson.video_url} className="w-full h-full" allowFullScreen allow="autoplay; fullscreen" title={lesson.title} />
              </div>
            )}
            {lesson.content_type === 'audio' && lesson.audio_url && (
              <div className="rounded-2xl p-6" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E4E7EC' }}>
                <audio controls className="w-full"><source src={lesson.audio_url} /></audio>
              </div>
            )}
            {lesson.content_type === 'text' && lesson.text_content && (
              <div className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E4E7EC' }}>
                {lesson.text_content.split('\n\n').map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed" style={{ color: '#374151' }}>{p}</p>
                ))}
              </div>
            )}

            {lesson.lesson_summary && (
              <div className="rounded-xl p-5" style={{ backgroundColor: '#F8F9FA', borderLeft: '4px solid #BF8813' }}>
                <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#BF8813' }}>Résumé de la leçon</p>
                <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{lesson.lesson_summary}</p>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Réservé aux inscrits</p>
              {[
                { label: 'Quiz de validation', desc: '5 questions pour valider la leçon' },
                { label: 'Leçon suivante', desc: 'Toutes les leçons du cours' },
                { label: 'Assistant IA', desc: 'Questions pendant le cours' },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-4 flex items-center gap-3 opacity-50"
                  style={{ border: '1.5px dashed #D1D5DB', backgroundColor: '#FAFAFA' }}>
                  <Lock size={15} style={{ color: '#9CA3AF' }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#374151' }}>{item.label}</p>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E4E7EC' }}>
            <p className="font-semibold mb-2" style={{ color: '#002050' }}>Aucun aperçu disponible</p>
            <p className="text-sm" style={{ color: '#9CA3AF' }}>Le créateur n'a pas encore ajouté d'aperçu pour ce cours.</p>
          </div>
        )}
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-4" style={{ backgroundColor: '#002050', borderTop: '1px solid rgba(255,255,255,0.10)' }}>
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-white truncate">{course.title}</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.60)' }}>
              {course.is_free ? 'Gratuit' : `${course.price.toLocaleString('fr-FR')} FCFA`}
            </p>
          </div>
          {user ? (
            <button onClick={() => navigate(`/cours/${courseId}`)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-85 flex-shrink-0"
              style={{ backgroundColor: '#BF8813', color: '#FFFFFF' }}>
              {course.is_free ? "S'inscrire gratuitement" : 'Accéder au cours'}<ChevronRight size={14} />
            </button>
          ) : (
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => navigate('/connexion')} className="px-4 py-2.5 rounded-xl font-semibold text-sm hover:opacity-80"
                style={{ border: '1.5px solid rgba(255,255,255,0.40)', color: '#FFFFFF' }}>Se connecter</button>
              <button onClick={() => navigate('/inscription')} className="px-4 py-2.5 rounded-xl font-bold text-sm hover:opacity-85"
                style={{ backgroundColor: '#BF8813', color: '#FFFFFF' }}>S'inscrire</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
