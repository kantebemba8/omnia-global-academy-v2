import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, AlertCircle, Trophy, Upload } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ENDPOINTS } from '../lib/config';

interface FinalQuestion { id: string; question_text: string; options: string[]; }
type PageStatus = 'loading' | 'qcm' | 'project' | 'submitted' | 'passed' | 'failed';

export function ValidationFinale() {
  const { id: courseId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, sessionToken, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<PageStatus>('loading');
  const [validationType, setValidationType] = useState<'qcm' | 'projet'>('qcm');
  const [questions, setQuestions] = useState<FinalQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attemptNum, setAttemptNum] = useState(1);

  useEffect(() => { if (!authLoading && !user) navigate('/connexion'); }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!sessionToken || !courseId) return;
    setStatus('loading');
    fetch(`${ENDPOINTS.finalSubmit}?course_id=${courseId}&mode=questions`, { headers: { Authorization: `Bearer ${sessionToken}` } })
      .then(r => r.json())
      .then(d => {
        if (d.error) { navigate(`/cours/${courseId}/apprendre`); return; }
        if (d.already_passed) { setScore(d.score ?? null); setStatus('passed'); return; }
        if (d.already_submitted) { setStatus('submitted'); return; }
        setValidationType(d.validation_type === 'projet' ? 'projet' : 'qcm');
        if (d.validation_type === 'projet') { setStatus('project'); return; }
        setQuestions(d.questions ?? []);
        setStatus('qcm');
      })
      .catch(() => navigate(`/cours/${courseId}/apprendre`));
  }, [sessionToken, courseId, navigate, attemptNum]);

  const question = questions[currentQ];
  const selected = question ? answers[question.id] : undefined;
  const isLast = currentQ === questions.length - 1;
  const allAnswered = questions.length > 0 && questions.every(q => answers[q.id]);

  const handleQcmSubmit = async () => {
    if (!allAnswered || !sessionToken) return;
    setSubmitting(true);
    try {
      const res = await fetch(ENDPOINTS.finalSubmit, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ course_id: courseId, type: 'qcm', answers: Object.entries(answers).map(([question_id, selected_answer]) => ({ question_id, selected_answer })) }),
      });
      const d = await res.json();
      if (d.error) { alert(d.message ?? d.error); return; }
      setScore(d.score); setCorrectCount(d.correct_count ?? null);
      setStatus(d.passed ? 'passed' : 'failed');
    } catch { alert('Erreur réseau.'); }
    finally { setSubmitting(false); }
  };

  const handleProjectSubmit = async () => {
    if (!selectedFile || !sessionToken) return;
    setSubmitting(true);
    try {
      const fakeUrl = `https://storage.omniaglobal.academy/projects/${courseId}/${user?.id}/${selectedFile.name}`;
      const res = await fetch(ENDPOINTS.finalSubmit, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ course_id: courseId, type: 'projet_soumettre', submission_url: fakeUrl }),
      });
      const d = await res.json();
      if (d.error) { alert(d.message ?? d.error); return; }
      setStatus('submitted');
    } catch { alert('Erreur réseau.'); }
    finally { setSubmitting(false); }
  };

  if (status === 'loading') return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#FFFFFF' }}>
      <style>{`@keyframes confettiFall { 0% { transform: translateY(-20px) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }`}</style>

      <header className="flex items-center gap-4 px-6 py-4 sticky top-0 z-10" style={{ backgroundColor: '#002050' }}>
        <button onClick={() => navigate(`/cours/${courseId}/apprendre`)} className="hover:opacity-70 transition-opacity">
          <ArrowLeft size={18} style={{ color: 'rgba(255,255,255,0.70)' }} />
        </button>
        <div>
          <p className="font-bold text-sm text-white">Validation finale</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {validationType === 'qcm' ? `${questions.length} questions · Seuil : 70% · Tentative ${attemptNum}` : 'Soumission de projet'}
          </p>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-6 py-10">

        {/* PASSED */}
        {status === 'passed' && (
          <div className="text-center py-8 relative">
            {[...Array(18)].map((_, i) => (
              <div key={i} style={{
                position: 'fixed', top: 0, left: `${(i * 5.5) % 100}%`, width: 8, height: 8,
                borderRadius: i % 2 === 0 ? '50%' : 2,
                backgroundColor: ['#BF8813', '#002050', '#1E7A52', '#F59E0B', '#3B82F6'][i % 5],
                animation: `confettiFall ${1.8 + (i % 5) * 0.3}s ease-in ${i * 0.08}s forwards`,
                zIndex: 50, pointerEvents: 'none',
              }} />
            ))}
            <div className="w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: 'rgba(191,136,19,0.12)' }}>
              <Trophy size={56} style={{ color: '#BF8813' }} />
            </div>
            <p className="font-bold text-2xl mb-1" style={{ color: '#002050' }}>Félicitations !</p>
            {score !== null && <p className="text-4xl font-bold mb-2" style={{ color: '#1E7A52' }}>{score}%</p>}
            {correctCount !== null && questions.length > 0 && <p className="text-sm mb-2" style={{ color: '#6B7280' }}>{correctCount}/{questions.length} bonnes réponses</p>}
            <p className="text-sm mb-8" style={{ color: '#6B7280' }}>Votre certificat est en cours de génération.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => navigate(`/cours/${courseId}`)}
                className="px-6 py-3 rounded-xl font-semibold text-sm hover:opacity-75"
                style={{ border: '1.5px solid #002050', color: '#002050' }}>Fiche de formation</button>
              <button onClick={() => navigate('/catalogue')}
                className="px-6 py-3 rounded-xl font-bold text-sm text-white hover:opacity-85"
                style={{ backgroundColor: '#BF8813' }}>Mon certificat →</button>
            </div>
          </div>
        )}

        {/* FAILED */}
        {status === 'failed' && (
          <div className="text-center py-8">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: 'rgba(220,38,38,0.10)' }}>
              <AlertCircle size={48} style={{ color: '#DC2626' }} />
            </div>
            <p className="font-bold text-2xl mb-1" style={{ color: '#002050' }}>Score insuffisant</p>
            {score !== null && <p className="text-3xl font-bold mb-2" style={{ color: '#DC2626' }}>{score}%</p>}
            <p className="text-sm mb-8" style={{ color: '#6B7280' }}>Minimum 70% requis. Révisez le cours et réessayez.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => navigate(`/cours/${courseId}/apprendre`)}
                className="px-5 py-2.5 rounded-xl font-medium text-sm hover:opacity-75"
                style={{ border: '1.5px solid #002050', color: '#002050' }}>Retour au cours</button>
              <button onClick={() => { setAnswers({}); setCurrentQ(0); setScore(null); setCorrectCount(null); setAttemptNum(n => n + 1); }}
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-white hover:opacity-85"
                style={{ backgroundColor: '#002050' }}>Réessayer</button>
            </div>
          </div>
        )}

        {/* SUBMITTED */}
        {status === 'submitted' && (
          <div className="text-center py-8">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: 'rgba(30,122,82,0.12)' }}>
              <Check size={48} style={{ color: '#1E7A52' }} />
            </div>
            <p className="font-bold text-2xl mb-1" style={{ color: '#002050' }}>Projet soumis !</p>
            <p className="text-sm mb-8 max-w-sm mx-auto" style={{ color: '#6B7280' }}>Le professeur évaluera votre projet sous 5 jours ouvrés.</p>
            <button onClick={() => navigate(`/cours/${courseId}/apprendre`)}
              className="px-6 py-3 rounded-xl font-bold text-sm text-white hover:opacity-85"
              style={{ backgroundColor: '#002050' }}>Retour au cours</button>
          </div>
        )}

        {/* PROJECT UPLOAD */}
        {status === 'project' && (
          <div>
            <h2 className="font-bold text-xl mb-2" style={{ color: '#002050' }}>Soumettre votre projet</h2>
            <p className="text-sm mb-6" style={{ color: '#6B7280' }}>Téléchargez votre projet final. Formats acceptés : PDF, ZIP, DOCX.</p>
            <label className="block rounded-2xl border-2 border-dashed cursor-pointer hover:border-blue-400 transition-colors mb-5"
              style={{ borderColor: selectedFile ? '#1E7A52' : '#D1D5DB', backgroundColor: selectedFile ? 'rgba(30,122,82,0.04)' : '#FAFAFA' }}>
              <input type="file" className="hidden" accept=".pdf,.zip,.docx,.doc" onChange={e => setSelectedFile(e.target.files?.[0] ?? null)} />
              <div className="flex flex-col items-center py-10 gap-3">
                <Upload size={32} style={{ color: selectedFile ? '#1E7A52' : '#9CA3AF' }} />
                {selectedFile
                  ? <><p className="font-semibold text-sm" style={{ color: '#1E7A52' }}>{selectedFile.name}</p>
                      <p className="text-xs" style={{ color: '#6B7280' }}>{(selectedFile.size / 1024).toFixed(0)} KB</p></>
                  : <><p className="font-semibold text-sm" style={{ color: '#374151' }}>Cliquez pour sélectionner</p>
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>PDF, ZIP, DOCX — max 50 MB</p></>
                }
              </div>
            </label>
            <button onClick={handleProjectSubmit} disabled={!selectedFile || submitting}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-40 hover:opacity-85"
              style={{ backgroundColor: '#BF8813' }}>{submitting ? 'Soumission...' : 'Soumettre le projet'}</button>
          </div>
        )}

        {/* QCM */}
        {status === 'qcm' && questions.length > 0 && (
          <>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold" style={{ color: '#002050' }}>Question {currentQ + 1} / {questions.length}</p>
                <div className="flex gap-1 flex-wrap justify-end max-w-[160px]">
                  {questions.map((_, i) => (
                    <div key={i} className="rounded-full" style={{ width: 7, height: 7, backgroundColor: i < currentQ ? '#1E7A52' : i === currentQ ? '#002050' : '#E4E7EC' }} />
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
                <button onClick={handleQcmSubmit} disabled={!allAnswered || submitting}
                  className="flex-1 py-3 rounded-xl font-bold text-white disabled:opacity-40 hover:opacity-85"
                  style={{ backgroundColor: '#BF8813' }}>{submitting ? 'Correction...' : 'Soumettre la validation'}</button>
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
