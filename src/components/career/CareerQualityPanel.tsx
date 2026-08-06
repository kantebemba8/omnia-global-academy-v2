import { AlertTriangle, CheckCircle2, Info, ShieldCheck, XCircle } from 'lucide-react';
import type { CareerQualityIssue, CareerQualityReport } from '../../lib/careerBuilderV2';

type Props = {
  report: CareerQualityReport | null;
  started: boolean;
  onCreateAtsVersion?: () => void;
};

export default function CareerQualityPanel({ report, started, onCreateAtsVersion }: Props) {
  if (!started || !report) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
          <ShieldCheck className="h-3.5 w-3.5" /> Qualité et ATS
        </div>
        <h3 className="mt-4 text-lg font-semibold text-[#002050]">Diagnostic en attente</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Le contenu fourni comme exemple n’est pas évalué. Le diagnostic commencera automatiquement dès votre première modification du CV ou de la lettre.
        </p>
        <div className="mt-4 rounded-xl border border-[#bf8813]/25 bg-[#fff8e8] px-4 py-3 text-sm text-slate-700">
          Aucun score n’est attribué par défaut. Les résultats refléteront uniquement le document que vous aurez réellement personnalisé.
        </div>
      </div>
    );
  }

  const scores = [
    ['Contenu', report.content],
    ['ATS', report.ats],
    ['Poste', report.target],
    ['Lisibilité', report.visual],
    ['Preuves', report.evidence],
  ] as const;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div><div className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700"><ShieldCheck className="h-3.5 w-3.5" /> Qualité et ATS</div><h3 className="mt-3 text-lg font-semibold text-[#002050]">Diagnostic professionnel</h3></div>
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-[#bf8813] text-xl font-black text-[#002050]">{report.overall}</div>
      </div>
      <p className="mt-2 text-sm leading-5 text-slate-600">Le score distingue le contenu, la compatibilité ATS, la pertinence, le design et les preuves.</p>
      {onCreateAtsVersion && <button type="button" onClick={onCreateAtsVersion} className="mt-3 w-full rounded-xl border border-[#002050]/20 bg-[#002050]/5 px-3 py-2.5 text-sm font-semibold text-[#002050] hover:bg-[#002050]/10">Créer une copie ATS stricte</button>}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {scores.map(([label, score]) => <div key={label} className="rounded-xl border border-slate-200 p-3"><div className="flex justify-between text-xs font-semibold text-slate-600"><span>{label}</span><span>{score}/100</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-[#002050]" style={{ width: `${score}%` }} /></div></div>)}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
        <Metric label="Mots" value={report.metrics.wordCount} />
        <Metric label="Résultats chiffrés" value={report.metrics.quantifiedAchievements} />
        <Metric label="Verbes d’action" value={report.metrics.actionVerbBullets} />
        <Metric label="Preuves liées" value={report.metrics.evidenceSelected} />
      </div>

      {report.keywordMatches.length > 0 && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <div className="text-sm font-semibold text-[#002050]">Correspondance avec l’offre</div>
          <div className="mt-2 flex flex-wrap gap-2">{report.keywordMatches.map(item => <span key={item.keyword} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${item.status === 'proved' ? 'bg-green-100 text-green-800' : item.status === 'declared' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-700'}`}>{item.keyword} · {item.status === 'proved' ? 'prouvé' : item.status === 'declared' ? 'déclaré' : 'absent'}</span>)}</div>
        </div>
      )}

      <div className="mt-4 border-t border-slate-200 pt-4">
        <div className="text-sm font-semibold text-[#002050]">Recommandations</div>
        <div className="mt-3 space-y-2">{report.issues.map(item => <Issue key={item.id} item={item} />)}</div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-slate-50 p-3"><div className="text-lg font-black text-[#002050]">{value}</div><div className="mt-1 text-slate-500">{label}</div></div>;
}

function Issue({ item }: { item: CareerQualityIssue }) {
  const config = item.severity === 'critical'
    ? { Icon: XCircle, cls: 'border-red-200 bg-red-50 text-red-800' }
    : item.severity === 'warning'
      ? { Icon: AlertTriangle, cls: 'border-amber-200 bg-amber-50 text-amber-900' }
      : item.severity === 'success'
        ? { Icon: CheckCircle2, cls: 'border-green-200 bg-green-50 text-green-800' }
        : { Icon: Info, cls: 'border-blue-200 bg-blue-50 text-blue-900' };
  return <div className={`flex gap-3 rounded-xl border p-3 ${config.cls}`}><config.Icon className="mt-0.5 h-4 w-4 shrink-0" /><div><div className="text-xs font-bold">{item.title}</div><div className="mt-1 text-xs leading-5 opacity-90">{item.detail}</div></div></div>;
}
