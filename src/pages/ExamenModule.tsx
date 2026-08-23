import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AssessmentEngine } from '../components/AssessmentEngine';

export function ExamenModule() {
  const { id: courseId = '', moduleId = '', lessonId = '' } = useParams<{ id:string; moduleId?:string; lessonId?:string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitted, setSubmitted] = useState(false);
  const previewMode = new URLSearchParams(window.location.search).get('preview');
  const preview = previewMode === 'admin' || previewMode === 'learner';
  const suffix = preview ? `?preview=${previewMode}` : '';
  const isLessonAssessment = Boolean(lessonId);
  const returnLessonId = String((location.state as { returnLessonId?: string } | null)?.returnLessonId || lessonId || '');
  const returnToCourse = () => navigate(returnLessonId ? `/cours/${courseId}/apprendre/${returnLessonId}${suffix}` : `/cours/${courseId}/apprendre${suffix}`);
  const pageTitle = isLessonAssessment ? 'Évaluation de la leçon' : 'Évaluation du module';

  return <div className="min-h-screen bg-white" style={{fontFamily:'Inter,system-ui,sans-serif'}}>
    <header className="flex items-center gap-4 px-6 py-4" style={{background:'#002050'}}>
      <button type="button" onClick={returnToCourse} aria-label="Retour à la formation"><ArrowLeft size={18} color="white"/></button>
      <div><p className="text-white text-sm font-semibold">{pageTitle}</p></div>
    </header>
    <main className="max-w-3xl mx-auto px-5 py-8">
      <AssessmentEngine
        courseId={courseId}
        lessonId={isLessonAssessment ? lessonId : undefined}
        moduleId={!isLessonAssessment ? moduleId : undefined}
        scope={isLessonAssessment ? 'lesson' : 'module'}
        preview={preview}
        onSubmitted={()=>setSubmitted(true)}
        onPassed={()=>setSubmitted(true)}
      />
      {submitted && !preview ? <button type="button" onClick={returnToCourse} className="mt-5 rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{background:'#002050'}}>
        {isLessonAssessment ? 'Retour à la leçon' : 'Retour à la synthèse du module'}
      </button> : null}
    </main>
  </div>;
}
