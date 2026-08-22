import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AssessmentEngine } from '../components/AssessmentEngine';

export function ExamenModule() {
  const { id: courseId = '', moduleId = '' } = useParams<{ id:string; moduleId:string }>();
  const navigate = useNavigate();
  const previewMode = new URLSearchParams(window.location.search).get('preview');
  const preview = previewMode === 'admin' || previewMode === 'learner';
  const suffix = preview ? `?preview=${previewMode}` : '';
  return <div className="min-h-screen bg-white" style={{fontFamily:'Inter,system-ui,sans-serif'}}>
    <header className="flex items-center gap-4 px-6 py-4" style={{background:'#002050'}}><button onClick={()=>navigate(`/cours/${courseId}/apprendre${suffix}`)}><ArrowLeft size={18} color="white"/></button><div><p className="text-white text-sm font-semibold">Évaluation du module</p></div></header>
    <main className="max-w-3xl mx-auto px-5 py-8"><AssessmentEngine courseId={courseId} moduleId={moduleId} scope="module" preview={preview} onPassed={()=>setTimeout(()=>navigate(`/cours/${courseId}/apprendre${suffix}`),900)}/></main>
  </div>;
}
