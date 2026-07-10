import { OmniaCareerShell } from '../../components/career/OmniaCareerShell';
import { CVBuilderEditor } from '../../components/career/CVBuilderEditor';
import { useSearchParams } from 'react-router-dom';

export default function CareerStudioEditor() {
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') || 'cv';

  return (
    <OmniaCareerShell activeSection="cv">
      <div className="h-full">
        {type === 'cv' && <CVBuilderEditor />}
        {type === 'lm' && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-base font-semibold" style={{ color: '#002050' }}>
                Éditeur de lettres de motivation
              </p>
              <p className="mt-1 text-sm" style={{ color: '#64748B' }}>
                Cette fonctionnalité sera disponible à l'étape suivante.
              </p>
            </div>
          </div>
        )}
      </div>
    </OmniaCareerShell>
  );
}
