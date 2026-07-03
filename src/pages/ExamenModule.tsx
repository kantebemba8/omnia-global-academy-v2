import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ENDPOINTS } from '../lib/config';

interface Question { id: string; question_text: string; options: string[]; }

export function ExamenModule() {
  const { id: courseId, moduleId } = useParams<{ id: string; moduleId: string }>();
  const navigate = useNavigate();
  const { user, sessionToken, loading: authLoading } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [moduleTitle, setModuleTitle] = useState('');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ passed: boolean; score: number; correct_count: number; final_validation_unlocked?: boolean; message?: string } | null>(null);
  const [attemptNum, setAttemptNum] = useState(1);

  useEffect(() => { if (!authLoading && !user) navigate('/connexion'); }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!sessionToken || !moduleId || !courseId) return;
    setLoading(true); setFetchError(null);
    fetch(`${ENDPOINTS.moduleExam}?module_id=${moduleId}&course_id=${courseId}`, { headers: { Authorization: `Bearer ${sessionToken}` } })
      .then(r => r.json())
      .then(d => { if (d.error) { setFetchError(d.message ?? d.error); return; } setQuestions(d.questions ?? []); })
      .catch(() => setFetchError('Erreur réseau.'))
      .finally(() => setLoading(false));
  }, [sessionToken, moduleId, courseId, attemptNum]);

  useEffect(() => {
    if (!sessionToken || !courseId) return;
    fetch(`${ENDPOINTS.courseProgress}?course_id=${courseId}`, { headers: { Authorization: `Bearer ${sessionToken}` } })
      .then(r => r.json()).then(d => { const m = d.modules?.find((m: { module_id: string; title: string }) => m.module_id === moduleId); if (m) setModuleTitle(m.title); });
  }, [sessionToken, courseId, moduleId]);

  const question = questions[currentQ];
  const selected = question ? answers[question.id] : undefined;
  const isLast = currentQ === questions.length - 1;
  const allAnswered = questions.length > 0 && questions.every(q => answers[q.id]);

  const handleSubmit = async () => {
    if (!allAnswered || !sessionToken) return;
    setSubmitting(true);
    try {
      const res = await fetch(ENDPOINTS.moduleExam, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ module_id: moduleId, course_id: courseId, answers: Object.entries(answers).map(([question_id, selected_answer]) => ({ question_id, selected_answer })) }),
      });
      setResult(await res.json());
    } catch { setResult({ passed: false, score: 0, correct_count: 0, message: 'Erreur réseau.' }); }
    finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#FFFFFF' }}>
      <header className="flex items-center gap-4 px-6 py-4 sticky top-0 z-10" style={{ backgroundColor: '#002050' }}>
        <button onClick={() => navigate(`/cours/${courseId}/apprendre`)} className="hover:opacity-70 transition-opacity">
          <ArrowLeft size={18} style={{ color: 'rgba(255,255,255,0.70)' }} />
        </button>
        <div>
          <p className="font-bold text-sm text-white">{moduleTitle ? `Examen — ${moduleTitle}` : 'Examen de fin de module'}</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.60)' }}>{questions.length} questions · Seuil : 70% · Tentative {attemptNum}</p>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-6 py-10">
        {fetchError && !result && (
          <div className="text-center py-12">
            <AlertCircle size={40} className="mx-auto mb-4" style={{ color: '#DC2626' }} />
            <p className="font-semibold mb-4" style={{ color: '#002050' }}>{fetchError}</p>
            <button onClick={() => navigate(`/cours/${courseId}/apprendre`)}
              className="px-5 py-2.5 rounded-xl font-medium text-sm hover:opacity-75"
              style={{ border: '1.5px solid #002050', color: '#002050' }}>Retour au cours</button>
          </div>
        )}

        {result && (
          <div className="text-center py-8">
            {result.passed ? (
              <>
                <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: 'rgba(30,122,82,0.12)' }}>
                  <Check size={48} style={{ color: '#1E7A52' }} />
                </div>
                <p className="font-bold text-2xl mb-1" style={{ color: '#002050' }}>Module validé !</p>
                <p className="text-3xl font-bold mb-2" style={{ color: '#1E7A52' }}>{result.score}%</p>
                <p className="text-sm mb-8" style={{ color: '#6B7280' }}>{result.correct_count}/{questions.length} bonnes réponses</p>
                <button onClick={() => navigate(result.final_validation_unlocked ? `/cours/${courseId}/validation-finale` : `/cours/${courseId}/apprendre`)}
                  className="px-8 py-3 rounded-xl font-bold text-white hover:opacity-85"
                  style={{ backgroundColor: result.final_validation_unlocked ? '#BF8813' : '#002050' }}>
                  {result.final_validation_unlocked ? 'Accéder à la validation finale →' : 'Continuer le cours →'}
                </button>
              </>
            ) : (
              <>
                <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: 'rgba(220,38,38,0.10)' }}>
                  <AlertCircle size={48} style={{ color: '#DC2626' }} />
                </div>
                <p className="font-bold text-2xl mb-1" style={{ color: '#002050' }}>Score insuffisant</p>
                <p className="text-3xl font-bold mb-2" style={{ color: '#DC2626' }}>{result.score}%</p>
                <p className="text-sm mb-6" style={{ color: '#6B7280' }}>Minimum 70% requis.</p>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => navigate(`/cours/${courseId}/apprendre`)}
                    className="px-5 py-2.5 rounded-xl font-medium text-sm hover:opacity-75"
                    style={{ border: '1.5px solid #002050', color: '#002050' }}>Retour aux leçons</button>
                  <button onClick={() => { setAnswers({}); setCurrentQ(0); setResult(null); setAttemptNum(n => n + 1); }}
                    className="px-5 py-2.5 rounded-xl font-bold text-sm text-white hover:opacity-85"
                    style={{ backgroundColor: '#002050' }}>Réessayer</button>
                </div>
              </>
            )}
          </div>
        )}

        {!fetchError && !result && questions.length > 0 && (
          <>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold" style={{ color: '#002050' }}>Question {currentQ + 1} / {questions.length}</p>
                <div className="flex gap-1">
                  {questions.map((_, i) => (
                    <div key={i} className="rounded-full" style={{ width: 8, height: 8, backgroundColor: i < currentQ ? '#1E7A52' : i === currentQ ? '#002050' : '#E4E7EC' }} />
                  ))}
                </div>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 4, backgroundColor: '#E4E7EC' }}>
                <div className="h-full rounded-full" style={{ width: `${((currentQ + 1) / questions.length) * 100}%`, backgroundColor: '#002050' }} />
              </div>
            </div>

            <p className="font-bold leading-snug mb-6" style={{ color: '#002050', fontSize: '19px' }}>{question.question_text}</p>

            <div className="space-y-3 mb-8">
              {question.options.map((opt, i) => {
                const isSel = answers[question.id] === opt;
                return (
                  <button key={opt} onClick={() => setAnswers(p => ({ ...p, [question.id]: opt }))}
                    className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-left transition-all"
                    style={{ border: isSel ? '2px solid #002050' : '1.5px solid #E4E7EC', backgroundColor: isSel ? '#002050' : '#FFFFFF', color: isSel ? '#FFFFFF' : '#374151' }}>
                    <span className="font-bold text-xs w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: isSel ? 'rgba(255,255,255,0.20)' : '#F3F4F6', color: isSel ? '#FFF' : '#6B7280' }}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="text-sm">{opt}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setCurrentQ(q => Math.max(0, q - 1))} disabled={currentQ === 0}
                className="px-4 py-3 rounded-xl font-medium text-sm disabled:opacity-30 hover:opacity-70"
                style={{ border: '1px solid #E4E7EC', color: '#374151' }}>← Précédente</button>
              {isLast ? (
                <button onClick={handleSubmit} disabled={!allAnswered || submitting}
                  className="flex-1 py-3 rounded-xl font-bold text-white disabled:opacity-40 hover:opacity-85"
                  style={{ backgroundColor: '#BF8813' }}>{submitting ? 'Correction...' : "Soumettre l'examen"}</button>
              ) : (
                <button onClick={() => setCurrentQ(q => q + 1)} disabled={!selected}
                  className="flex-1 py-3 rounded-xl font-semibold text-white disabled:opacity-40 hover:opacity-85"
                  style={{ backgroundColor: '#002050' }}>Suivante →</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
