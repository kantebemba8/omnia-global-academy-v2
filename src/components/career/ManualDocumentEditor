import React, { RefObject, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, Bold, BringToFront, Copy, Image as ImageIcon,
  Italic, Layers, Lock, Minus, Move, Plus, Redo2, RotateCcw, SendToBack, Square,
  Trash2, Type, Underline, Undo2, Unlock, X, ZoomIn, ZoomOut
} from 'lucide-react';

export type ManualBlockType = 'text' | 'image' | 'shape' | 'line';
export type ManualTextAlign = 'left' | 'center' | 'right' | 'justify';

export interface ManualBlock {
  id: string;
  type: ManualBlockType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked?: boolean;
  content?: string;
  src?: string;
  style: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    fontStyle?: 'normal' | 'italic';
    textDecoration?: 'none' | 'underline';
    textAlign?: ManualTextAlign;
    color?: string;
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    lineHeight?: number;
    opacity?: number;
    padding?: number;
  };
}

export interface ManualLayout {
  version: 1;
  page: { width: 794; height: 1123; background: string };
  blocks: ManualBlock[];
}

interface Props {
  open: boolean;
  title: string;
  initialLayout: ManualLayout;
  onChange: (layout: ManualLayout) => void;
  onClose: () => void;
  onSave: () => void;
  printRef?: RefObject<HTMLDivElement | null>;
}

const FONTS = [
  'Arial', 'Calibri', 'Helvetica', 'Georgia', 'Times New Roman', 'Verdana', 'Tahoma',
  'Trebuchet MS', 'Garamond', 'Palatino Linotype', 'Courier New', 'Century Gothic',
  'Book Antiqua', 'Lucida Sans', 'Arial Narrow'
];

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const id = () => `block_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function normalize(layout: ManualLayout): ManualLayout {
  return {
    version: 1,
    page: { width: 794, height: 1123, background: layout?.page?.background || '#ffffff' },
    blocks: Array.isArray(layout?.blocks) ? layout.blocks : [],
  };
}

export default function ManualDocumentEditor({ open, title, initialLayout, onChange, onClose, onSave, printRef }: Props) {
  const [layout, setLayout] = useState<ManualLayout>(() => normalize(initialLayout));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.72);
  const [history, setHistory] = useState<ManualLayout[]>([]);
  const [future, setFuture] = useState<ManualLayout[]>([]);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const gesture = useRef<{ mode: 'drag' | 'resize'; id: string; startX: number; startY: number; original: ManualBlock } | null>(null);

  useEffect(() => {
    if (open) {
      setLayout(normalize(initialLayout));
      setHistory([]);
      setFuture([]);
      setSelectedId(null);
    }
  }, [open, initialLayout]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName || '');
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && selectedId) {
        event.preventDefault();
        duplicateBlock(selectedId);
      }
      if (!editing && (event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault();
        removeBlock(selectedId);
      }
      if (event.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const selected = useMemo(() => layout.blocks.find(b => b.id === selectedId) || null, [layout.blocks, selectedId]);

  function commit(next: ManualLayout, remember = true) {
    if (remember) {
      setHistory(h => [...h.slice(-39), clone(layout)]);
      setFuture([]);
    }
    setLayout(next);
    onChange(next);
  }

  function patchBlock(blockId: string, patch: Partial<ManualBlock>, remember = true) {
    const next = { ...layout, blocks: layout.blocks.map(b => b.id === blockId ? { ...b, ...patch } : b) };
    commit(next, remember);
  }

  function patchStyle(patch: Partial<ManualBlock['style']>) {
    if (!selected) return;
    patchBlock(selected.id, { style: { ...selected.style, ...patch } });
  }

  function addBlock(type: ManualBlockType) {
    const maxZ = Math.max(0, ...layout.blocks.map(b => b.zIndex));
    const block: ManualBlock = {
      id: id(), type, x: 90, y: 100 + layout.blocks.length * 12,
      width: type === 'line' ? 300 : type === 'image' ? 180 : 340,
      height: type === 'line' ? 4 : type === 'shape' ? 100 : type === 'image' ? 180 : 74,
      rotation: 0, zIndex: maxZ + 1,
      content: type === 'text' ? 'Double-cliquez pour modifier ce texte' : undefined,
      style: {
        fontFamily: 'Arial', fontSize: 18, fontWeight: 400, fontStyle: 'normal',
        textDecoration: 'none', textAlign: 'left', color: '#1f2937',
        backgroundColor: type === 'shape' ? '#e2e8f0' : 'transparent',
        borderColor: type === 'line' ? '#002050' : 'transparent', borderWidth: type === 'line' ? 3 : 0,
        borderRadius: type === 'shape' ? 8 : 0, lineHeight: 1.3, opacity: 1, padding: type === 'text' ? 4 : 0,
      }
    };
    commit({ ...layout, blocks: [...layout.blocks, block] });
    setSelectedId(block.id);
  }

  function addImage(file: File) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const maxZ = Math.max(0, ...layout.blocks.map(b => b.zIndex));
      const block: ManualBlock = {
        id: id(), type: 'image', x: 90, y: 110, width: 190, height: 190, rotation: 0, zIndex: maxZ + 1,
        src: String(reader.result), style: { opacity: 1, borderRadius: 0, borderWidth: 0, borderColor: 'transparent' }
      };
      commit({ ...layout, blocks: [...layout.blocks, block] });
      setSelectedId(block.id);
    };
    reader.readAsDataURL(file);
  }

  function removeBlock(blockId: string) {
    commit({ ...layout, blocks: layout.blocks.filter(b => b.id !== blockId) });
    setSelectedId(null);
  }

  function duplicateBlock(blockId: string) {
    const source = layout.blocks.find(b => b.id === blockId);
    if (!source) return;
    const copy = { ...clone(source), id: id(), x: source.x + 18, y: source.y + 18, zIndex: Math.max(...layout.blocks.map(b => b.zIndex), 0) + 1 };
    commit({ ...layout, blocks: [...layout.blocks, copy] });
    setSelectedId(copy.id);
  }

  function moveLayer(blockId: string, direction: 'front' | 'back') {
    const max = Math.max(...layout.blocks.map(b => b.zIndex), 0);
    const min = Math.min(...layout.blocks.map(b => b.zIndex), 0);
    patchBlock(blockId, { zIndex: direction === 'front' ? max + 1 : min - 1 });
  }

  function undo() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setFuture(f => [clone(layout), ...f].slice(0, 40));
    setHistory(h => h.slice(0, -1));
    setLayout(previous); onChange(previous);
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setHistory(h => [...h, clone(layout)].slice(-40));
    setFuture(f => f.slice(1));
    setLayout(next); onChange(next);
  }

  function beginGesture(event: React.PointerEvent, block: ManualBlock, mode: 'drag' | 'resize') {
    event.stopPropagation();
    if (block.locked) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setSelectedId(block.id);
    gesture.current = { mode, id: block.id, startX: event.clientX, startY: event.clientY, original: clone(block) };
    setHistory(h => [...h.slice(-39), clone(layout)]);
    setFuture([]);
  }

  function moveGesture(event: React.PointerEvent) {
    const g = gesture.current;
    if (!g) return;
    const dx = (event.clientX - g.startX) / zoom;
    const dy = (event.clientY - g.startY) / zoom;
    const nextBlock = g.mode === 'drag'
      ? { ...g.original, x: Math.max(0, Math.min(794 - g.original.width, g.original.x + dx)), y: Math.max(0, Math.min(1123 - g.original.height, g.original.y + dy)) }
      : { ...g.original, width: Math.max(30, Math.min(794 - g.original.x, g.original.width + dx)), height: Math.max(20, Math.min(1123 - g.original.y, g.original.height + dy)) };
    const next = { ...layout, blocks: layout.blocks.map(b => b.id === g.id ? nextBlock : b) };
    setLayout(next); onChange(next);
  }

  function endGesture() { gesture.current = null; }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-100">
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100" title="Fermer"><X className="h-5 w-5" /></button>
          <div><div className="text-sm font-semibold text-[#002050]">Éditeur manuel avancé</div><div className="max-w-[420px] truncate text-xs text-slate-500">{title}</div></div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={undo} disabled={!history.length} className="rounded-lg border p-2 disabled:opacity-30" title="Annuler"><Undo2 className="h-4 w-4" /></button>
          <button onClick={redo} disabled={!future.length} className="rounded-lg border p-2 disabled:opacity-30" title="Rétablir"><Redo2 className="h-4 w-4" /></button>
          <button onClick={() => { setLayout(normalize(initialLayout)); onChange(normalize(initialLayout)); }} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RotateCcw className="h-4 w-4" /> Réinitialiser</button>
          <button onClick={onSave} className="rounded-lg bg-[#002050] px-4 py-2 text-sm font-semibold text-white">Enregistrer</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-[#002050]">Ajouter</h3>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => addBlock('text')} className="flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-semibold hover:border-[#bf8813]"><Type className="h-5 w-5" /> Texte</button>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-3 text-xs font-semibold hover:border-[#bf8813]"><ImageIcon className="h-5 w-5" /> Image<input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && addImage(e.target.files[0])} /></label>
            <button onClick={() => addBlock('shape')} className="flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-semibold hover:border-[#bf8813]"><Square className="h-5 w-5" /> Forme</button>
            <button onClick={() => addBlock('line')} className="flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-semibold hover:border-[#bf8813]"><Minus className="h-5 w-5" /> Ligne</button>
          </div>

          <div className="mt-6 flex items-center justify-between"><h3 className="text-sm font-semibold text-[#002050]">Calques</h3><Layers className="h-4 w-4 text-slate-400" /></div>
          <div className="mt-2 space-y-1">
            {[...layout.blocks].sort((a,b) => b.zIndex-a.zIndex).map(block => (
              <button key={block.id} onClick={() => setSelectedId(block.id)} className={`flex w-full items-center gap-2 rounded-lg border px-2 py-2 text-left text-xs ${selectedId === block.id ? 'border-[#bf8813] bg-[#bf8813]/10' : 'border-transparent hover:bg-slate-50'}`}>
                {block.type === 'text' ? <Type className="h-3.5 w-3.5" /> : block.type === 'image' ? <ImageIcon className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                <span className="min-w-0 flex-1 truncate">{block.content || block.type}</span>
                {block.locked && <Lock className="h-3 w-3" />}
              </button>
            ))}
          </div>
        </aside>

        <main className="relative min-w-0 flex-1 overflow-auto bg-slate-200 p-8" onPointerMove={moveGesture} onPointerUp={endGesture}>
          <div className="mb-4 flex items-center justify-center gap-2">
            <button onClick={() => setZoom(z => Math.max(.35, z-.1))} className="rounded-lg bg-white p-2 shadow"><ZoomOut className="h-4 w-4" /></button>
            <span className="w-16 text-center text-xs font-semibold">{Math.round(zoom*100)}%</span>
            <button onClick={() => setZoom(z => Math.min(1.4, z+.1))} className="rounded-lg bg-white p-2 shadow"><ZoomIn className="h-4 w-4" /></button>
          </div>
          <div className="mx-auto" style={{ width: 794*zoom, height: 1123*zoom }}>
            <div
              ref={node => { canvasRef.current = node; if (printRef && typeof printRef !== 'function') (printRef as React.MutableRefObject<HTMLDivElement | null>).current = node; }}
              onPointerDown={() => setSelectedId(null)}
              className="relative origin-top-left overflow-hidden bg-white shadow-2xl"
              style={{ width: 794, height: 1123, transform: `scale(${zoom})`, transformOrigin: 'top left', background: layout.page.background }}
            >
              {layout.blocks.map(block => {
                const isSelected = selectedId === block.id;
                return (
                  <div key={block.id} onPointerDown={e => beginGesture(e, block, 'drag')} className="absolute select-none" style={{ left:block.x, top:block.y, width:block.width, height:block.height, zIndex:block.zIndex, transform:`rotate(${block.rotation}deg)`, opacity:block.style.opacity ?? 1, cursor:block.locked?'default':'move', outline:isSelected?'2px solid #bf8813':'none', outlineOffset:2 }}>
                    {block.type === 'text' && (
                      <div
                        contentEditable={!block.locked}
                        suppressContentEditableWarning
                        onPointerDown={e => { e.stopPropagation(); setSelectedId(block.id); }}
                        onBlur={e => patchBlock(block.id, { content: e.currentTarget.innerHTML }, false)}
                        dangerouslySetInnerHTML={{ __html: block.content || '' }}
                        style={{ width:'100%', height:'100%', overflow:'hidden', fontFamily:block.style.fontFamily, fontSize:block.style.fontSize, fontWeight:block.style.fontWeight, fontStyle:block.style.fontStyle, textDecoration:block.style.textDecoration, textAlign:block.style.textAlign as any, color:block.style.color, background:block.style.backgroundColor, lineHeight:block.style.lineHeight, padding:block.style.padding, whiteSpace:'pre-wrap', wordBreak:'break-word', outline:'none' }}
                      />
                    )}
                    {block.type === 'image' && <img src={block.src} alt="" draggable={false} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:block.style.borderRadius, border:`${block.style.borderWidth||0}px solid ${block.style.borderColor||'transparent'}` }} />}
                    {block.type === 'shape' && <div style={{ width:'100%', height:'100%', background:block.style.backgroundColor, borderRadius:block.style.borderRadius, border:`${block.style.borderWidth||0}px solid ${block.style.borderColor||'transparent'}` }} />}
                    {block.type === 'line' && <div style={{ width:'100%', marginTop:block.height/2, borderTop:`${block.style.borderWidth||3}px solid ${block.style.borderColor||'#002050'}` }} />}
                    {isSelected && !block.locked && <button onPointerDown={e => beginGesture(e, block, 'resize')} className="absolute -bottom-2 -right-2 h-4 w-4 rounded-full border-2 border-white bg-[#bf8813] shadow" title="Redimensionner" />}
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        <aside className="w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4">
          {!selected ? <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">Sélectionnez un élément pour le modifier.</div> : (
            <div className="space-y-4">
              <div className="flex items-center justify-between"><h3 className="font-semibold text-[#002050]">Propriétés</h3><button onClick={() => patchBlock(selected.id,{locked:!selected.locked})} className="rounded-lg border p-2">{selected.locked?<Unlock className="h-4 w-4"/>:<Lock className="h-4 w-4"/>}</button></div>
              {selected.type === 'text' && <>
                <label className="block text-xs font-semibold text-slate-600">Police<select value={selected.style.fontFamily} onChange={e=>patchStyle({fontFamily:e.target.value})} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm">{FONTS.map(f=><option key={f}>{f}</option>)}</select></label>
                <div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold text-slate-600">Taille<input type="number" min={6} max={120} value={selected.style.fontSize} onChange={e=>patchStyle({fontSize:Number(e.target.value)})} className="mt-1 w-full rounded-lg border px-2 py-2" /></label><label className="text-xs font-semibold text-slate-600">Interligne<input type="number" min={0.8} max={3} step={0.1} value={selected.style.lineHeight} onChange={e=>patchStyle({lineHeight:Number(e.target.value)})} className="mt-1 w-full rounded-lg border px-2 py-2" /></label></div>
                <div className="flex gap-2">
                  <button onClick={()=>patchStyle({fontWeight:selected.style.fontWeight===700?400:700})} className={`rounded-lg border p-2 ${selected.style.fontWeight===700?'bg-slate-200':''}`}><Bold className="h-4 w-4"/></button>
                  <button onClick={()=>patchStyle({fontStyle:selected.style.fontStyle==='italic'?'normal':'italic'})} className={`rounded-lg border p-2 ${selected.style.fontStyle==='italic'?'bg-slate-200':''}`}><Italic className="h-4 w-4"/></button>
                  <button onClick={()=>patchStyle({textDecoration:selected.style.textDecoration==='underline'?'none':'underline'})} className={`rounded-lg border p-2 ${selected.style.textDecoration==='underline'?'bg-slate-200':''}`}><Underline className="h-4 w-4"/></button>
                  <button onClick={()=>patchStyle({textAlign:'left'})} className="rounded-lg border p-2"><AlignLeft className="h-4 w-4"/></button>
                  <button onClick={()=>patchStyle({textAlign:'center'})} className="rounded-lg border p-2"><AlignCenter className="h-4 w-4"/></button>
                  <button onClick={()=>patchStyle({textAlign:'right'})} className="rounded-lg border p-2"><AlignRight className="h-4 w-4"/></button>
                </div>
                <label className="block text-xs font-semibold text-slate-600">Couleur du texte<input type="color" value={selected.style.color || '#1f2937'} onChange={e=>patchStyle({color:e.target.value})} className="mt-1 h-10 w-full rounded border"/></label>
              </>}
              {(selected.type==='shape'||selected.type==='text') && <label className="block text-xs font-semibold text-slate-600">Arrière-plan<input type="color" value={selected.style.backgroundColor==='transparent'?'#ffffff':selected.style.backgroundColor || '#ffffff'} onChange={e=>patchStyle({backgroundColor:e.target.value})} className="mt-1 h-10 w-full rounded border"/></label>}
              <div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold">X<input type="number" value={Math.round(selected.x)} onChange={e=>patchBlock(selected.id,{x:Number(e.target.value)})} className="mt-1 w-full rounded-lg border px-2 py-2"/></label><label className="text-xs font-semibold">Y<input type="number" value={Math.round(selected.y)} onChange={e=>patchBlock(selected.id,{y:Number(e.target.value)})} className="mt-1 w-full rounded-lg border px-2 py-2"/></label><label className="text-xs font-semibold">Largeur<input type="number" value={Math.round(selected.width)} onChange={e=>patchBlock(selected.id,{width:Number(e.target.value)})} className="mt-1 w-full rounded-lg border px-2 py-2"/></label><label className="text-xs font-semibold">Hauteur<input type="number" value={Math.round(selected.height)} onChange={e=>patchBlock(selected.id,{height:Number(e.target.value)})} className="mt-1 w-full rounded-lg border px-2 py-2"/></label></div>
              <label className="block text-xs font-semibold">Rotation<input type="range" min={-180} max={180} value={selected.rotation} onChange={e=>patchBlock(selected.id,{rotation:Number(e.target.value)})} className="mt-1 w-full"/></label>
              <label className="block text-xs font-semibold">Opacité<input type="range" min={0.1} max={1} step={0.05} value={selected.style.opacity ?? 1} onChange={e=>patchStyle({opacity:Number(e.target.value)})} className="mt-1 w-full"/></label>
              <div className="grid grid-cols-2 gap-2"><button onClick={()=>duplicateBlock(selected.id)} className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm"><Copy className="h-4 w-4"/>Dupliquer</button><button onClick={()=>removeBlock(selected.id)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600"><Trash2 className="h-4 w-4"/>Supprimer</button><button onClick={()=>moveLayer(selected.id,'front')} className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs"><BringToFront className="h-4 w-4"/>Devant</button><button onClick={()=>moveLayer(selected.id,'back')} className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs"><SendToBack className="h-4 w-4"/>Derrière</button></div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export function ManualDocumentCanvas({ layout, className = '' }: { layout: ManualLayout; className?: string }) {
  const safe = normalize(layout);
  return (
    <div className={`relative overflow-hidden bg-white ${className}`} style={{ width: 794, height: 1123, background: safe.page.background }}>
      {safe.blocks.map(block => (
        <div key={block.id} className="absolute" style={{ left:block.x, top:block.y, width:block.width, height:block.height, zIndex:block.zIndex, transform:`rotate(${block.rotation}deg)`, opacity:block.style.opacity ?? 1 }}>
          {block.type === 'text' && <div dangerouslySetInnerHTML={{__html:block.content || ''}} style={{ width:'100%', height:'100%', overflow:'hidden', whiteSpace:'pre-wrap', wordBreak:'break-word', fontFamily:block.style.fontFamily, fontSize:block.style.fontSize, fontWeight:block.style.fontWeight, fontStyle:block.style.fontStyle, textDecoration:block.style.textDecoration, textAlign:block.style.textAlign as any, color:block.style.color, background:block.style.backgroundColor, lineHeight:block.style.lineHeight, padding:block.style.padding }} />}
          {block.type === 'image' && <img src={block.src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:block.style.borderRadius, border:`${block.style.borderWidth||0}px solid ${block.style.borderColor||'transparent'}` }} />}
          {block.type === 'shape' && <div style={{ width:'100%', height:'100%', background:block.style.backgroundColor, borderRadius:block.style.borderRadius, border:`${block.style.borderWidth||0}px solid ${block.style.borderColor||'transparent'}` }} />}
          {block.type === 'line' && <div style={{ width:'100%', marginTop:block.height/2, borderTop:`${block.style.borderWidth||3}px solid ${block.style.borderColor||'#002050'}` }} />}
        </div>
      ))}
    </div>
  );
}
