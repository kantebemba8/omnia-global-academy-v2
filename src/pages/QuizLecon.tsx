import { useState } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { ENDPOINTS } from '../lib/config';

export interface QuizQuestion {
  id: string;
  question_text: string;
  options: string[];
}

interface QuizLeconProps {
  questions: QuizQuestion[];
  lessonId: string;
  courseId: string;
  sessionToken: string;
  onClose: () => void;
  onPassed: (score: number) => void;
}

export function QuizLecon({ questions, lessonId, courseId, sessionToken, onClose, onPassed }: QuizLeconProps) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ passed: boolean; score: number; correct_count: number; total: number; message?: string } | null>(null);

  const question = questions[currentQ];
  const selected = question ? answers[question.id] : undefined;
  const isLast = currentQ === questions.length - 1;
  const allAnswered = questions.every(q => answers[q.id]);

  const handleSubmit = async () => {
    if (!allAnswered) return;
    setSubmitting(true);
    try {
      const res = await fetch(ENDPOINTS.quizSubmit, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ lesson_id: lessonId, course_id: courseId, answers: Object.entries(answers).map(([question_id, selected_answer]) => ({ question_id, selected_answer })) }),
      });
      const data = await res.json();
      setResult(data);
      if (data.passed) onPassed(data.score);
    } catch {
      setResult({ passed: false, score: 0, correct_count: 0, total: questions.length, message: 'Erreur réseau. Réessayez.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.72)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #E4E7EC' }}>
          <div>
            <p className="font-bold text-sm" style={{ color: '#002050' }}>Quiz de la leçon</p>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{questions.length} questions · Seuil : 80%</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"><X size={17} style={{ color: '#6B7280' }} /></button>
        </div>

        {result ? (
          <div className="px-6 py-10 text-center">
            {result.passed ? (
              <>
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'rgba(30,122,82,0.12)' }}>
                  <Check size={40} style={{ color: '#1E7A52' }} />
                </div>
                <p className="font-bold text-xl mb-1" style={{ color: '#002050' }}>Quiz réussi !</p>
                <p className="text-2xl font-bold mb-1" style={{ color: '#1E7A52' }}>{result.score}%</p>
                <p className="text-sm mb-2" style={{ color: '#6B7280' }}>{result.correct_count}/{result.total} bonnes réponses</p>
                <p className="text-sm" style={{ color: '#6B7280' }}>Leçon validée. Lisez le résumé avant de continuer.</p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'rgba(220,38,38,0.10)' }}>
                  <AlertCircle size={40} style={{ color: '#DC2626' }} />
                </div>
                <p className="font-bold text-xl mb-1" style={{ color: '#002050' }}>Quiz non réussi</p>
                <p className="text-2xl font-bold mb-2" style={{ color: '#DC2626' }}>{result.score}%</p>
                <p className="text-sm mb-6" style={{ color: '#6B7280' }}>{result.message ?? 'Révisez le contenu et réessayez.'}</p>
                <button onClick={() => { setAnswers({}); setCurrentQ(0); setResult(null); onClose(); }}
                  className="px-6 py-3 rounded-xl font-semibold text-white" style={{ backgroundColor: '#002050' }}>Réessayer</button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="px-6 pt-5 pb-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold" style={{ color: '#6B7280' }}>Question {currentQ + 1} / {questions.length}</p>
                <div className="flex gap-1">
                  {questions.map((_, i) => (
                    <div key={i} className="rounded-full" style={{ width: 8, height: 8, backgroundColor: i === currentQ ? '#002050' : answers[questions[i]?.id] ? '#1E7A52' : '#E4E7EC' }} />
                  ))}
                </div>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 3, backgroundColor: '#E4E7EC' }}>
                <div className="h-full rounded-full" style={{ width: `${((currentQ + 1) / questions.length) * 100}%`, backgroundColor: '#002050' }} />
              </div>
            </div>
            <div className="px-6 py-3">
              <p className="font-bold leading-snug" style={{ color: '#002050', fontSize: '16px' }}>{question?.question_text}</p>
            </div>
            <div className="px-6 pb-4 space-y-2">
              {question?.options.map((opt, i) => {
                const isSel = selected === opt;
                return (
                  <button key={opt} onClick={() => setAnswers(p => ({ ...p, [question.id]: opt }))}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                    style={{ border: isSel ? '2px solid #002050' : '1.5px solid #E4E7EC', backgroundColor: isSel ? '#002050' : '#FFFFFF', color: isSel ? '#FFFFFF' : '#374151' }}>
                    <span className="font-bold text-xs w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: isSel ? 'rgba(255,255,255,0.20)' : '#F3F4F6', color: isSel ? '#FFF' : '#6B7280' }}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="text-sm">{opt}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setCurrentQ(q => Math.max(0, q - 1))} disabled={currentQ === 0}
                className="px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-30 hover:opacity-70"
                style={{ border: '1px solid #E4E7EC', color: '#374151' }}>← Préc.</button>
              {isLast ? (
                <button onClick={handleSubmit} disabled={!allAnswered || submitting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                  style={{ backgroundColor: '#BF8813' }}>{submitting ? 'Correction...' : 'Soumettre le quiz'}</button>
              ) : (
                <button onClick={() => setCurrentQ(q => q + 1)} disabled={!selected}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                  style={{ backgroundColor: '#002050' }}>Suivante →</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
