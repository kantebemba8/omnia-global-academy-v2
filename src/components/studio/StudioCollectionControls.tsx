import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { STUDIO_COLLECTIONS, editStudioCollection } from '../../lib/studioBlockCollections';

type Props = {
  blockType: string;
  content: Record<string, any>;
  locked: boolean;
  onChange: (content: Record<string, any>) => void;
};

/** Dedicated controls for nested items used by the existing 52 editor types. */
export default function StudioCollectionControls({ blockType, content, locked, onChange }: Props) {
  const [collectionError, setCollectionError] = useState('');
  const definitions = STUDIO_COLLECTIONS[blockType] || [];
  if (!definitions.length) return null;

  function update(key: string, action: 'add' | 'remove' | 'up' | 'down', index = 0) {
    try { setCollectionError(''); onChange(editStudioCollection(content || {}, blockType, key, action, index)); }
    catch (error) { setCollectionError(error instanceof Error ? error.message : 'Modification impossible'); }
  }

  return <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <summary className="cursor-pointer text-xs font-bold text-[#002050]">Organiser les éléments internes</summary>
    {collectionError && <p role="alert" className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{collectionError}</p>}
    <p className="mt-2 text-[11px] text-slate-600">Ajoutez, retirez ou déplacez les éléments sans perdre les données et réglages associés. Les champs se modifient dans le bloc central.</p>
    {definitions.map(def => {
      const items = Array.isArray(content?.[def.key]) ? content[def.key] as unknown[] : [];
      return <div key={def.key} className="mt-3 rounded-lg border border-slate-200 bg-white p-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-700">{def.label} ({items.length})</span>
          <button type="button" disabled={locked} aria-label={`Ajouter : ${def.label}`} onClick={() => update(def.key, 'add')} className="inline-flex items-center gap-1 rounded-md border border-[#BF8813] px-2 py-1 text-[11px] text-[#8A620E] disabled:opacity-40"><Plus size={12}/> Ajouter</button>
        </div>
        <ol className="mt-2 space-y-1">
          {items.map((item, index) => {
            const label = typeof item === 'string' ? item : Array.isArray(item) ? item.join(' · ') : item && typeof item === 'object' ? Object.values(item as Record<string, unknown>).find(v => typeof v === 'string' && v.trim()) || '' : '';
            return <li key={item && typeof item === 'object' && !Array.isArray(item) && 'id' in item && item.id ? String(item.id) : index} className="flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1">
              <span className="min-w-0 flex-1 truncate text-[11px] text-slate-600" title={String(label || '')}>{index + 1}. {String(label || 'Élément à compléter')}</span>
              <button type="button" disabled={locked || index === 0} aria-label={`Monter l'élément ${index + 1}`} title="Monter" onClick={() => update(def.key, 'up', index)} className="rounded p-1 hover:bg-white disabled:opacity-30"><ChevronUp size={13}/></button>
              <button type="button" disabled={locked || index >= items.length - 1} aria-label={`Descendre l'élément ${index + 1}`} title="Descendre" onClick={() => update(def.key, 'down', index)} className="rounded p-1 hover:bg-white disabled:opacity-30"><ChevronDown size={13}/></button>
              <button type="button" disabled={locked || items.length <= (def.minimum || 0)} aria-label={`Supprimer l'élément ${index + 1}`} title="Supprimer" onClick={() => update(def.key, 'remove', index)} className="rounded p-1 text-red-600 hover:bg-white disabled:opacity-30"><Trash2 size={13}/></button>
            </li>;
          })}
        </ol>
      </div>;
    })}
  </details>;
}
