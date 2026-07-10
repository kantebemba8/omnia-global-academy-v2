import { Download, Eye, Star } from 'lucide-react';
import { CVColorSelector } from './CVColorSelector';
import { CVTemplateSelector } from './CVTemplateSelector';

interface Props {
  templateKey: string;
  themeColor: string;
  atsScore: number;
  isPrimary: boolean;
  onTemplateChange: (key: string) => void;
  onColorChange: (color: string) => void;
  onSetPrimary: () => void;
  onDownloadPDF: () => void;
  onPreview: () => void;
}

export function CVSettingsPanel({
  templateKey, themeColor, atsScore, isPrimary,
  onTemplateChange, onColorChange, onSetPrimary, onDownloadPDF, onPreview,
}: Props) {
  const scoreColor = atsScore >= 80 ? '#065F46' : atsScore >= 60 ? '#92400E' : '#991B1B';
  const scoreBg = atsScore >= 80 ? '#D1FAE5' : atsScore >= 60 ? '#FEF3C7' : '#FEE2E2';

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto">

      {/* Modèles */}
      <div className="rounded-2xl border bg-white p-4" style={{ borderColor: '#E5E7EB' }}>
        <h3 className="text-base font-semibold mb-3" style={{ color: '#002050' }}>
          Modèle
          <button type="button" className="ml-2 text-xs font-medium" style={{ color: '#bf8813' }}>
            Voir tous les modèles →
          </button>
        </h3>
        <CVTemplateSelector value={templateKey} themeColor={themeColor} onChange={onTemplateChange} />
      </div>

      {/* Couleurs */}
      <div className="rounded-2xl border bg-white p-4" style={{ borderColor: '#E5E7EB' }}>
        <h3 className="text-base font-semibold mb-3" style={{ color: '#002050' }}>Couleurs</h3>
        <CVColorSelector value={themeColor} onChange={onColorChange} />
      </div>

      {/* Score d'optimisation */}
      <div className="rounded-2xl border bg-white p-4" style={{ borderColor: '#E5E7EB' }}>
        <h3 className="text-base font-semibold mb-3" style={{ color: '#002050' }}>Score d'optimisation</h3>
        <div className="flex items-center gap-4">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-4"
            style={{ borderColor: scoreColor }}>
            <span className="text-lg font-bold" style={{ color: scoreColor }}>{atsScore}</span>
            <span className="text-[9px]" style={{ color: scoreColor }}>/100</span>
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold" style={{ color: scoreColor }}>
              {atsScore >= 80 ? 'Très bon' : atsScore >= 60 ? 'Bon' : 'À améliorer'}
            </div>
            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
              {atsScore >= 80
                ? 'Votre CV est bien optimisé !'
                : 'Complétez les sections pour améliorer votre score.'}
            </p>
          </div>
        </div>
        {/* Barre de progression */}
        <div className="mt-3 h-2 rounded-full" style={{ background: '#F3F4F6' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${atsScore}%`, background: scoreColor }} />
        </div>
      </div>

      {/* Conseils IA */}
      <div className="rounded-2xl border bg-white p-4" style={{ borderColor: '#E5E7EB' }}>
        <h3 className="text-base font-semibold mb-3" style={{ color: '#002050' }}>
          Conseils IA
          <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: '#FEF3C7', color: '#bf8813' }}>3 recommandations</span>
        </h3>
        <div className="space-y-3">
          {[
            { title: 'Quantifiez vos réalisations', desc: 'Ajoutez des chiffres pour démontrer l\'impact de vos expériences.' },
            { title: 'Complétez votre profil', desc: 'Ajoutez un résumé professionnel pour vous démarquer.' },
            { title: 'Ajoutez des certifications', desc: 'Les certifications Omnia augmentent votre score de 15 points.' },
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-2 rounded-xl p-3" style={{ background: '#F8FAFC' }}>
              <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: '#bf8813' }}>{i + 1}</div>
              <div>
                <p className="text-xs font-semibold" style={{ color: '#002050' }}>{tip.title}</p>
                <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{tip.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-2xl border bg-white p-4 space-y-2" style={{ borderColor: '#E5E7EB' }}>
        <h3 className="text-base font-semibold mb-3" style={{ color: '#002050' }}>Actions</h3>

        <button type="button" onClick={onPreview}
          className="flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition hover:bg-slate-50"
          style={{ borderColor: '#E5E7EB', color: '#374151' }}>
          <Eye size={15} /> Prévisualiser
        </button>

        {!isPrimary && (
          <button type="button" onClick={onSetPrimary}
            className="flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition hover:bg-slate-50"
            style={{ borderColor: '#bf8813', color: '#bf8813' }}>
            <Star size={15} /> Définir comme CV principal
          </button>
        )}
        {isPrimary && (
          <div className="flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium"
            style={{ background: '#FEF3C7', color: '#bf8813' }}>
            <Star size={15} fill="#bf8813" /> CV principal
          </div>
        )}

        <button type="button" onClick={onDownloadPDF}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: '#002050' }}>
          <Download size={15} /> Télécharger PDF
        </button>
      </div>
    </div>
  );
}
