import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, PlayCircle, Volume2 } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { PageFooter } from '../components/PageFooter';
import { useAuth } from '../hooks/useAuth';
import { ENDPOINTS } from '../lib/config';

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

interface FreeLesson {
  id: string;
  title: string;
  content_text: string | null;
  video_url: string | null;
  audio_url: string | null;
  lesson_summary: string | null;
}

interface CourseInfo {
  title: string;
  is_free: boolean;
  price_xof: number;
}

export function AperçuGratuit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [lesson, setLesson] = useState<FreeLesson | null>(null);
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`${ENDPOINTS.courseDetail}?id=${id}`, { headers: { Authorization: `Bearer ${ANON_KEY}` } })
      .then(r => r.json())
      .then(d => {
        if (!d.course) { setNotFound(true); return; }
        setCourse({ title: d.course.title, is_free: d.course.is_free, price_xof: d.course.price_xof });
        setLesson(d.free_preview_lesson ?? null);
        if (!d.free_preview_lesson) setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <Navbar />
        <div className="pt-24 max-w-3xl mx-auto px-6 animate-pulse space-y-4">
          <div className="h-4 rounded w-40" style={{ backgroundColor: '#F0F0F0' }} />
          <div className="h-7 rounded w-3/4" style={{ backgroundColor: '#F0F0F0' }} />
          <div style={{ aspectRatio: '16/9', backgroundColor: '#F0F0F0', borderRadius: '12px' }} />
        </div>
      </div>
    );
  }

  if (notFound || !lesson) {
    return (
      <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}><Navbar />
        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
          <p className="font-bold text-lg mb-4" style={{ color: '#002050' }}>Aperçu non disponible.</p>
          <button onClick={() => navigate(`/cours/${id}`)} className="px-6 py-3 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: '#002050' }}>
            ← Retour à la formation
          </button>
        </div>
        <PageFooter />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#FFFFFF', paddingBottom: '80px' }}>
      <Navbar />

      <main className="pt-20 max-w-3xl mx-auto px-6 pb-12">
        {/* Back link */}
        <button
          onClick={() => navigate(`/cours/${id}`)}
          className="flex items-center gap-2 text-sm mb-5 transition-opacity hover:opacity-70"
          style={{ color: '#6B7280' }}
        >
          <ArrowLeft size={15} /> Retour à la formation
        </button>

        {/* Header */}
        <div className="mb-6">
          {course?.title && <p className="text-sm font-semibold mb-1" style={{ color: '#002050' }}>{course.title}</p>}
          <h1 className="font-bold mb-3" style={{ color: '#111827', fontSize: 'clamp(18px,3vw,26px)' }}>{lesson.title}</h1>
          <span className="inline-block text-xs font-bold px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(30,122,82,0.12)', color: '#1E7A52' }}>
            APERÇU GRATUIT
          </span>
        </div>

        {/* Video */}
        {lesson.video_url && (
          <div className="mb-6 rounded-xl overflow-hidden" style={{ aspectRatio: '16/9', backgroundColor: '#000' }}>
            <iframe
              src={lesson.video_url}
              title={lesson.title}
              className="w-full h-full"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
        )}

        {/* Audio */}
        {lesson.audio_url && !lesson.video_url && (
          <div className="mb-6 p-4 rounded-xl flex items-center gap-4" style={{ backgroundColor: '#F8F9FA', border: '1px solid #E4E7EC' }}>
            <Volume2 size={24} style={{ color: '#BF8813', flexShrink: 0 }} />
            <audio controls className="flex-1" style={{ width: '100%' }}>
              <source src={lesson.audio_url} />
            </audio>
          </div>
        )}

        {/* No media fallback */}
        {!lesson.video_url && !lesson.audio_url && (
          <div className="mb-6 rounded-xl flex items-center justify-center" style={{ aspectRatio: '16/9', backgroundColor: '#F8F9FA', border: '1px solid #E4E7EC' }}>
            <div className="text-center">
              <PlayCircle size={48} style={{ color: '#BF8813', margin: '0 auto 8px' }} />
              <p className="text-sm" style={{ color: '#9CA3AF' }}>Contenu disponible après inscription</p>
            </div>
          </div>
        )}

        {/* Text content */}
        {lesson.content_text && (
          <div className="mb-6 prose max-w-none" style={{ color: '#374151', fontSize: '15px', lineHeight: 1.75 }}>
            {lesson.content_text.split('\n').filter(Boolean).map((para, i) => (
              <p key={i} className="mb-4">{para}</p>
            ))}
          </div>
        )}

        {/* Summary */}
        {lesson.lesson_summary && (
          <div className="mb-8 p-5 rounded-xl" style={{ backgroundColor: '#F8F9FA', borderLeft: '4px solid #BF8813' }}>
            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#BF8813' }}>Résumé de la leçon</p>
            <p className="text-sm" style={{ color: '#374151', lineHeight: 1.7 }}>{lesson.lesson_summary}</p>
          </div>
        )}

        {/* Locked elements */}
        <div className="space-y-3">
          {[
            { icon: '📝', label: 'Quiz de la leçon' },
            { icon: '▶️', label: 'Leçon suivante' },
            { icon: '🤖', label: 'Assistant IA du cours' },
          ].map(({ icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-3 p-4 rounded-xl opacity-50"
              style={{ border: '1px dashed #D1D5DB', backgroundColor: '#FAFAFA' }}
            >
              <span className="text-lg">{icon}</span>
              <span className="flex-1 text-sm font-medium" style={{ color: '#9CA3AF' }}>{label}</span>
              <Lock size={16} style={{ color: '#D1D5DB' }} />
            </div>
          ))}
        </div>
      </main>

      {/* Sticky bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3" style={{ backgroundColor: '#002050', boxShadow: '0 -4px 20px rgba(0,0,0,0.20)' }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-white font-medium">Vous aimez cette formation ?</p>
          <div className="flex items-center gap-2 flex-shrink-0">
            {user ? (
              <button
                onClick={() => navigate(course?.is_free ? `/cours/${id}` : `/paiement/${id}`)}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-85"
                style={{ backgroundColor: '#BF8813' }}
              >
                {course?.is_free ? "S'inscrire gratuitement" : `Acheter — ${course?.price_xof?.toLocaleString()} XOF`}
              </button>
            ) : (
              <>
                <button onClick={() => navigate('/connexion')} className="px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-80" style={{ border: '1.5px solid rgba(255,255,255,0.4)' }}>
                  Se connecter
                </button>
                <button onClick={() => navigate('/inscription')} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-85" style={{ backgroundColor: '#BF8813' }}>
                  S'inscrire pour tout voir
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <PageFooter />
    </div>
  );
}
