import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AssessmentEngine } from '../components/AssessmentEngine';

export function ExamenModule() {
  const { id: courseId = '', moduleId = '' } = useParams<{ id:string; moduleId:string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitted, setSubmitted] = useState(false);
  const previewMode = new URLSearchParams(window.location.search).get('preview');
  const preview = previewMode === 'admin' || previewMode === 'learner';
  const suffix = preview ? `?preview=${previewMode}` : '';
  const returnLessonId = String((location.state as { returnLessonId?: string } | null)?.returnLessonId || '');
  const returnToSummary = () => navigate(returnLessonId ? `/cours/${courseId}/apprendre/${returnLessonId}${suffix}` : `/cours/${courseId}/apprendre${suffix}`);
  return <div className="min-h-screen bg-white" style={{fontFamily:'Inter,system-ui,sans-serif'}}>
    <header className="flex items-center gap-4 px-6 py-4" style={{background:'#002050'}}><button onClick={returnToSummary}><ArrowLeft size={18} color="white"/></button><div><p className="text-white text-sm font-semibold">Évaluation du module</p></div></header>
    <main className="max-w-3xl mx-auto px-5 py-8"><AssessmentEngine courseId={courseId} moduleId={moduleId} scope="module" preview={preview} onSubmitted={()=>setSubmitted(true)} onPassed={()=>setSubmitted(true)}/>{submitted && !preview ? <button type="button" onClick={returnToSummary} className="mt-5 rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{background:'#002050'}}>Retour à la synthèse du module</button> : null}</main>
  </div>;
}
