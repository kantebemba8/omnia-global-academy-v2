import { History, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CareerDocumentFull } from '../../lib/careerStudioData';
import { deleteCareerVersion, listCareerVersions, saveCareerVersion, type CareerVersionSnapshot } from '../../lib/careerBuilderV2';

export default function CareerVersionPanel({ document, onRestore }: { document: CareerDocumentFull; onRestore: (document: CareerDocumentFull) => void }) {
  const [versions, setVersions] = useState<CareerVersionSnapshot[]>([]);
  const [label, setLabel] = useState('');
  useEffect(() => { setVersions(listCareerVersions(document.id)); }, [document.id]);

  function createVersion() {
    setVersions(saveCareerVersion(document, label || `Version ${new Date().toLocaleString('fr-FR')}`));
    setLabel('');
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="inline-flex items-center gap-2 rounded-full bg-[#002050]/8 px-3 py-1 text-xs font-bold text-[#002050]"><History className="h-3.5 w-3.5" /> Versions</div>
      <h3 className="mt-3 text-lg font-semibold text-[#002050]">Historique contrôlé</h3>
      <p className="mt-1 text-sm leading-5 text-slate-600">Créez une version nommée avant une adaptation importante. Les quinze dernières versions sont conservées localement sur cet appareil.</p>
      <div className="mt-4 flex gap-2"><input value={label} onChange={event => setLabel(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#002050]" placeholder="Ex. Version Banque X" /><button type="button" onClick={createVersion} className="inline-flex items-center gap-2 rounded-xl bg-[#002050] px-3 py-2 text-xs font-semibold text-white"><Save className="h-4 w-4" />Créer</button></div>
      <div className="mt-4 space-y-2">
        {!versions.length && <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500">Aucune version enregistrée.</div>}
        {versions.map(version => <div key={version.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold text-[#002050]">{version.label}</div><div className="mt-1 text-xs text-slate-500">{new Date(version.created_at).toLocaleString('fr-FR')}</div></div><div className="flex gap-1"><button type="button" onClick={() => onRestore({ ...version.document, id: document.id, title: document.title })} className="rounded-lg border border-slate-200 p-2 text-[#002050]" title="Restaurer"><RotateCcw className="h-4 w-4" /></button><button type="button" onClick={() => setVersions(deleteCareerVersion(document.id, version.id))} className="rounded-lg border border-red-200 p-2 text-red-600" title="Supprimer"><Trash2 className="h-4 w-4" /></button></div></div></div>)}
      </div>
    </div>
  );
}
