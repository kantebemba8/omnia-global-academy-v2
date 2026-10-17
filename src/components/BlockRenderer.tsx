import { Component, useState, type ReactNode } from 'react';
import {
  Star, Info, AlertTriangle, Lightbulb, BookOpen, CheckCircle,
  Download, Play, FileText, Table, Layers, ChevronDown, ChevronUp,
  RotateCcw, Check, X, WifiOff, Mic, Square
} from 'lucide-react';
import { ScormPlayer } from './ScormPlayer';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { canonicalizeBlockContent } from '../lib/courseBuilderV3';
import { applyPedagogicalLocalization, localizePedagogicalString } from '../lib/pedagogicalLocalization';

interface Block {
  id: string;
  block_type: string;
  position: number;
  interaction_mode?: 'content' | 'training' | 'assessment';
  training_passing_score?: number;
  training_is_graded?: boolean;
  linked_block_ids?: string[];
  title?: string;
  content_json: Record<string, any>;
  settings_json?: Record<string, any>;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  file_mime?: string;
}

type TrainingServerResult = { score?: number | null; passed?: boolean; feedback?: string; graded?: boolean; grading_mode?: string };
type TrainingResultHandler = (blockId: string, score: number, answer: any, passed: boolean) => void | TrainingServerResult | Promise<void | TrainingServerResult>;
type TrainingLocalResultHandler = (score: number, answer: any, passed: boolean) => void | TrainingServerResult | Promise<void | TrainingServerResult>;

interface BlockRendererProps {
  block: Block;
  onQuizAnswer?: (blockId: string, answer: any, correct: boolean) => void;
  onTrainingResult?: TrainingResultHandler;
  onFileTrainingSubmit?: (blockId: string, file: File, answer?: Record<string, any>) => Promise<boolean>;
  learnerState?: Record<string, any>;
  onStateChange?: (blockId: string, state: Record<string, any>, completed: boolean) => void;
  isOnline?: boolean;
  pedagogicalCurrency?: string | null;
  pedagogicalLocale?: string;
}

// ─── Utilitaire taille fichier ─────────────────────────────────
function fmtSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

function escapeHtml(value: string) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// V4: sanitize stored rich HTML before injecting it into the learner view.
// Whitelist matches the Builder editor; no scripts, handlers, inline styles or unsafe URLs.
function safeCourseHtml(value: string): string {
  if (typeof document === 'undefined') return escapeHtml(value);
  const parsed = new DOMParser().parseFromString(value, 'text/html');
  const allowed = new Set(['p','div','br','strong','b','em','i','u','ul','ol','li','a','blockquote','span','h1','h2','h3','h4','h5','h6','table','thead','tbody','tr','th','td','s','strike','code','pre','hr','img']);
  const clean = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || '');
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (['script','style','iframe','object','embed','svg','math','form','input','button','textarea','template'].includes(tag)) return null;
    const output = document.createElement(allowed.has(tag) ? tag : 'span');
    if (tag === 'a') {
      const href = (el.getAttribute('href') || '').trim();
      if (/^https?:\/\/[^\s<>'"]+$/i.test(href)) {
        (output as HTMLAnchorElement).href = href;
        (output as HTMLAnchorElement).rel = 'noopener noreferrer';
        (output as HTMLAnchorElement).target = '_blank';
      }
    }
    if (tag === 'img') {
      const src = (el.getAttribute('src') || '').trim();
      if (!/^https:\/\/[^\s<>'"]+$/i.test(src)) return null;
      (output as HTMLImageElement).src = src;
      (output as HTMLImageElement).alt = el.getAttribute('alt') || '';
      (output as HTMLImageElement).loading = 'lazy';
    }
    if (tag === 'td' || tag === 'th') {
      for (const name of ['colspan', 'rowspan']) {
        const value = Number(el.getAttribute(name));
        if (Number.isInteger(value) && value >= 1 && value <= 20) output.setAttribute(name, String(value));
      }
    }
    for (const child of Array.from(el.childNodes)) {
      const result = clean(child);
      if (result) output.appendChild(result);
    }
    return output;
  };
  const root = document.createElement('div');
  for (const child of Array.from(parsed.body.childNodes)) {
    const result = clean(child);
    if (result) root.appendChild(result);
  }
  return root.innerHTML;
}

function richHtml(value: any) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/<\/?(?:p|div|strong|b|em|i|u|ul|ol|li|a|br|span|blockquote|table|thead|tbody|tr|th|td|h1|h2|h3|pre|code|s|strike|hr|img)\b/i.test(raw)) return safeCourseHtml(raw);
  return raw
    .split(/\n{2,}/)
    .map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function RichContent({ value, className = '' }: { value: any; className?: string }) {
  const html = richHtml(value);
  if (!html) return null;
  return <div className={`prose prose-sm max-w-none leading-relaxed [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:bg-slate-50 [&_th]:p-2 [&_td]:border [&_td]:p-2 ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}



// B3: Only web URLs and root-relative paths can be opened by learner resource links.
// Reject javascript:, data:, file: and scheme-relative URLs (except signed HTTPS links).
function safeExternalResourceUrl(value: unknown, allowContactLinks = false): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || /[\u0000-\u001f]/.test(raw)) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  if (raw.startsWith('#') && /^#[a-z0-9_-]+$/i.test(raw)) return raw;
  if (allowContactLinks && /^mailto:[^\s<>]+@[^\s<>]+$/i.test(raw)) return raw;
  if (allowContactLinks && /^tel:[+0-9() .-]+$/i.test(raw)) return raw;
  return null;
}

function resourceDisplayTitle(block: Block, fallback: string) {
  const c = block.content_json || {};
  const explicit = String(c.title || block.title || '').trim();
  const technical = String(block.file_name || '').trim();
  if (!explicit) return fallback;
  if (technical && explicit.toLowerCase() === technical.toLowerCase()) return fallback;
  if (/\.(pdf|docx?|xlsx?|pptx?|zip|csv)$/i.test(explicit)) return fallback;
  return explicit;
}

function ResourceUnavailable({ block, label }: { block: Block; label: string }) {
  return (
    <div className="my-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <WifiOff size={18} className="mt-0.5 shrink-0 text-amber-700" />
      <div>
        <p className="text-sm font-semibold text-amber-900">{label} indisponible</p>
        <p className="mt-1 text-xs text-amber-700">{'La ressource n’a pas d’URL exploitable. Vérifiez son téléversement dans le Builder.'}</p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// BLOCK RENDERER PRINCIPAL
// ══════════════════════════════════════════════════════════════
export function BlockRenderer({ block, onQuizAnswer, onTrainingResult, onFileTrainingSubmit, learnerState, onStateChange, isOnline = true, pedagogicalCurrency = null, pedagogicalLocale = 'fr-FR' }: BlockRendererProps) {
  const rawContent = canonicalizeBlockContent(block.block_type, block.content_json);
  const c = applyPedagogicalLocalization(rawContent, block.settings_json, pedagogicalCurrency, pedagogicalLocale);
  const localizedBlockTitle = localizePedagogicalString(block.title || '', block.settings_json, pedagogicalCurrency, pedagogicalLocale);
  block = localizedBlockTitle && localizedBlockTitle !== block.title ? { ...block, title: localizedBlockTitle } : block;
  const graded = block.training_is_graded !== false;
  const trainingThreshold = Number(block.training_passing_score ?? 80);
  const onlineOnlyTypes = new Set(['video', 'audio', 'pdf', 'word', 'download', 'excel', 'scorm', 'embed']);
  if (!isOnline && onlineOnlyTypes.has(block.block_type)) {
    return (
      <div className="my-4 flex items-start gap-3 rounded-xl border p-4" style={{ borderColor: '#BF8813', backgroundColor: '#FFFBEB' }}>
        <WifiOff size={18} className="mt-0.5 shrink-0" style={{ color: '#BF8813' }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: '#002050' }}>{block.title || 'Ressource disponible en ligne'}</p>
          <p className="mt-1 text-xs" style={{ color: '#6B7280' }}>Reconnectez-vous pour ouvrir cette ressource. Le texte conservé dans la leçon reste accessible.</p>
        </div>
      </div>
    );
  }

  switch (block.block_type) {

    // ── STRUCTURE ──────────────────────────────────────────────
    case 'heading':
      return c.html ? (
        <div className="text-2xl font-bold mt-6 mb-3 leading-tight" style={{ color: '#002050' }} dangerouslySetInnerHTML={{ __html: safeCourseHtml(String(c.html || '')) }} />
      ) : (
        <h2 className="text-2xl font-bold mt-6 mb-3 leading-tight" style={{ color: '#002050' }}>{c.text || ''}</h2>
      );

    case 'subheading':
      return c.html ? (
        <div className="text-lg font-semibold mt-5 mb-2" style={{ color: '#374151' }} dangerouslySetInnerHTML={{ __html: safeCourseHtml(String(c.html || '')) }} />
      ) : (
        <h3 className="text-lg font-semibold mt-5 mb-2" style={{ color: '#374151' }}>{c.text || ''}</h3>
      );

    case 'text':
      return (
        <div className="prose prose-sm max-w-none my-3 text-gray-700 leading-relaxed [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:bg-slate-50 [&_th]:p-2 [&_td]:border [&_td]:p-2"
          style={{ lineHeight: 1.65 }}
          dangerouslySetInnerHTML={{ __html: richHtml(c.html || c.text || '') }}
        />
      );

    case 'separator':
      return (
        <div className="my-6">
          {c.style === 'space' ? <div className="h-6" /> :
           c.style === 'title' ? <div className="text-xs font-bold uppercase tracking-widest text-gray-400 text-center my-4">{c.title || '—'}</div> :
           <hr style={{ borderColor: '#E4E7EC', borderStyle: c.style === 'dashed' ? 'dashed' : 'solid' }} />}
        </div>
      );

    case 'callout':
      const calloutColors: Record<string, { bg: string; border: string; icon: typeof Info; color: string }> = {
        info:       { bg: '#EFF6FF', border: '#BFDBFE', icon: Info,          color: '#1D4ED8' },
        warning:    { bg: '#FEF3C7', border: '#FDE68A', icon: AlertTriangle,  color: '#D97706' },
        error:      { bg: '#FEE2E2', border: '#FECACA', icon: AlertTriangle,  color: '#DC2626' },
        success:    { bg: '#D1FAE5', border: '#6EE7B7', icon: CheckCircle,    color: '#065F46' },
        conseil:    { bg: '#F5F3FF', border: '#DDD6FE', icon: Lightbulb,      color: '#7C3AED' },
        definition: { bg: '#F0F9FF', border: '#BAE6FD', icon: BookOpen,       color: '#0369A1' },
      };
      const ct = calloutColors[c.type || 'info'] || calloutColors.info;
      const CIcon = ct.icon;
      return (
        <div className="flex gap-3 p-4 rounded-xl my-4" style={{ background: ct.bg, border: `1px solid ${ct.border}` }}>
          <CIcon size={18} style={{ color: ct.color, flexShrink: 0, marginTop: 1 }} />
          <div>
            {(block.title || c.title) && <p className="font-bold text-sm mb-1" style={{ color: ct.color }}>{block.title || c.title}</p>}
            <RichContent value={c.html || c.content || ''} className="text-sm text-gray-700" />
          </div>
        </div>
      );

    case 'important':
      return (
        <div className="flex gap-3 p-4 rounded-xl my-4" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <AlertTriangle size={18} style={{ color: '#DC2626', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p className="font-bold text-sm mb-1" style={{ color: '#DC2626' }}>{block.title || c.title || 'Important'}</p>
            <RichContent value={c.html || c.content || ''} className="text-sm text-gray-700" />
          </div>
        </div>
      );

    // ── PÉDAGOGIQUE ────────────────────────────────────────────
    case 'objective':
      return (
        <div className="flex gap-3 p-4 rounded-xl my-4" style={{ background: '#D1FAE5', border: '1px solid #6EE7B7' }}>
          <CheckCircle size={18} style={{ color: '#065F46', flexShrink: 0, marginTop: 1 }} />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm mb-1" style={{ color: '#065F46' }}>{block.title || c.title || 'Objectif pédagogique'}</p>
            <RichContent value={c.html || c.text || c.content || ''} className="text-sm text-gray-700" />
          </div>
        </div>
      );

    case 'remember':
      return (
        <div className="p-5 rounded-xl my-4" style={{ background: 'rgba(191,136,19,0.06)', border: '1px solid rgba(191,136,19,0.25)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Star size={16} style={{ color: '#BF8813' }} />
            <p className="font-bold" style={{ color: '#BF8813' }}>{block.title || c.title || 'À retenir'}</p>
          </div>
          <ul className="space-y-2">
            {(c.points || []).map((pt: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#374151' }}>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5" style={{ background: '#BF8813', color: 'white' }}>{i + 1}</span>
                <RichContent value={pt} className="min-w-0 flex-1 text-sm text-gray-700" />
              </li>
            ))}
          </ul>
        </div>
      );

    case 'example':
      return (
        <div className="p-5 rounded-xl my-4" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={16} style={{ color: '#D97706' }} />
            <p className="font-bold" style={{ color: '#D97706' }}>{block.title || c.title || 'Exemple'}</p>
          </div>
          {(c.html || c.content) && <RichContent value={c.html || c.content} className="mb-3 text-sm text-gray-700" />}
          {c.situation && <p className="text-sm mb-2" style={{ color: '#374151' }}><strong>Situation :</strong> {c.situation}</p>}
          {c.explication && <p className="text-sm mb-2" style={{ color: '#374151' }}><strong>Explication :</strong> {c.explication}</p>}
          {c.conclusion && <p className="text-sm italic mt-2 pt-2" style={{ color: '#92400E', borderTop: '1px solid #FDE68A' }}>{c.conclusion}</p>}
        </div>
      );

    case 'definition':
      return (
        <div className="p-4 rounded-xl my-4" style={{ background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
          {(block.title || c.title) && <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: '#0369A1' }}>{block.title || c.title}</p>}
          {c.term && <p className="font-bold text-base mb-2" style={{ color: '#0369A1' }}>{c.term}</p>}
          <RichContent value={c.definition || ''} className="text-sm text-gray-700" />
          {c.example && <div className="mt-3 border-t pt-3 text-xs italic" style={{ color: '#6B7280', borderColor:'#BAE6FD' }}><span className="font-semibold not-italic">Exemple : </span><RichContent value={c.example} className="inline text-xs text-gray-500" /></div>}
        </div>
      );

    case 'summary':
      return (
        <div className="p-5 rounded-xl my-4" style={{ background: '#F5F3FF', border: '1px solid #DDD6FE' }}>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={16} style={{ color: '#7C3AED' }} />
            <p className="font-bold" style={{ color: '#7C3AED' }}>{block.title || c.title || 'Résumé'}</p>
          </div>
          {(c.html || c.content) && <RichContent value={c.html || c.content} className="mb-3 text-sm text-gray-700" />}
          {c.intro && <p className="text-sm font-semibold mb-2" style={{ color: '#374151' }}>{c.intro}</p>}
          {(c.points || []).length > 0 && (
            <ul className="space-y-1">
              {(c.points || []).map((pt: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#374151' }}>
                  <span style={{ color: '#7C3AED' }}>•</span>{pt}
                </li>
              ))}
            </ul>
          )}
        </div>
      );

    case 'case_study':
      return <CaseStudyTraining c={c} training={block.interaction_mode === 'training'} threshold={trainingThreshold} graded={graded} onResult={(score, answer, passed) => onTrainingResult?.(block.id, score, answer, passed)} onFileSubmit={onFileTrainingSubmit ? (file,answer) => onFileTrainingSubmit(block.id,file,answer) : undefined} />;

    case 'correction':
      return (
        <div className="p-5 rounded-xl my-4" style={{ background: '#D1FAE5', border: '1px solid #6EE7B7' }}>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={16} style={{ color: '#065F46' }} />
            <p className="font-bold" style={{ color: '#065F46' }}>{block.title || c.title || 'Correction'}</p>
          </div>
          <RichContent value={c.html || c.content || ''} className="text-sm text-gray-700" />
          {(c.key_points || []).length > 0 && (
            <ul className="mt-3 space-y-1">
              {(c.key_points || []).map((pt: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm"><span style={{ color: '#065F46' }}>✓</span>{pt}</li>
              ))}
            </ul>
          )}
        </div>
      );

    case 'exercise':
      return <ExerciseTraining c={c} training={block.interaction_mode === 'training'} onResult={(score, answer, passed) => onTrainingResult?.(block.id, score, answer, passed)} onFileSubmit={onFileTrainingSubmit ? (file,answer) => onFileTrainingSubmit(block.id,file,answer) : undefined} />;

    // ── MÉDIAS ─────────────────────────────────────────────────
    case 'image':
      if (!block.file_url && !c.url) return <ResourceUnavailable block={block} label="Image" />;
      return (
        <figure className="my-5">
          <img
            src={block.file_url || c.url}
            alt={c.alt || c.caption || ''}
            loading="lazy"
            className="h-auto w-full rounded-xl object-contain"
          />
          {(c.caption || block.title) && (
            <figcaption className="text-xs text-center mt-2" style={{ color: '#9CA3AF' }}>
              {c.caption || block.title}
            </figcaption>
          )}
        </figure>
      );

    case 'video':
      if (!c.url && !block.file_url) return <ResourceUnavailable block={block} label="Vidéo" />;
      return <VideoBlock url={c.url || block.file_url || ''} eco={c.eco_data !== false} title={block.title} />;

    case 'audio':
      if (!c.url && !block.file_url) return <ResourceUnavailable block={block} label="Audio" />;
      return (
        <div className="my-4 p-4 rounded-xl" style={{ background: '#F5F3FF', border: '1px solid #DDD6FE' }}>
          {(block.title || c.description) && (
            <p className="text-sm font-semibold mb-2" style={{ color: '#7C3AED' }}>{block.title || c.description}</p>
          )}
          <audio controls controlsList="nodownload" className="w-full" style={{ accentColor: '#7C3AED' }}>
            <source src={c.url || block.file_url} />
            Votre navigateur ne supporte pas l'audio.
          </audio>
          {c.transcription && (
            <details className="mt-2">
              <summary className="text-xs cursor-pointer" style={{ color: '#7C3AED' }}>Voir la transcription</summary>
              <p className="text-xs mt-2" style={{ color: '#6B7280' }}>{c.transcription}</p>
            </details>
          )}
        </div>
      );

    case 'pdf':
    case 'word':
      return <DocumentViewBlock block={block} />;
    case 'download':
      return <DownloadOnlyBlock block={block} />;

    case 'excel':
      return <ExcelBlock block={block} />;

    case 'scorm':
      return <ScormBlock block={block} />;

    // ── ÉVALUATION ─────────────────────────────────────────────
    case 'vocabulary':
      return <div className="my-4">{c.title&&<p className="mb-2 font-bold text-[#002050]">{c.title}</p>}<div className="overflow-hidden rounded-xl border" style={{borderColor:'#E4E7EC'}}>{(c.items||[]).map((x:any,i:number)=><div key={i} className="grid gap-1 border-b p-3 last:border-b-0 sm:grid-cols-2"><div><strong style={{color:'#002050'}}>{x.term}</strong>{x.example&&<p className="mt-1 text-xs text-slate-500">{x.example}</p>}</div><div className="text-sm text-slate-600">{x.translation}{x.audio_url&&<audio className="mt-2 w-full" controls src={x.audio_url}/>}</div></div>)}</div></div>;
    case 'dialogue':
      return <div className="my-4 space-y-2">{c.title&&<p className="mb-2 font-bold text-[#002050]">{c.title}</p>}{(c.lines||[]).map((x:any,i:number)=><div key={i} className="rounded-xl border p-3" style={{borderColor:'#E4E7EC'}}><span className="text-xs font-bold text-[#BF8813]">{x.speaker||`#${i+1}`}</span><RichContent value={x.text} className="mt-1 text-sm font-semibold text-[#002050]"/>{x.translation&&<RichContent value={x.translation} className="mt-1 text-xs text-slate-500"/>}</div>)}</div>;
    case 'cloze':
      return <ClozeBlock c={c} threshold={trainingThreshold} graded={graded} onResult={(score, answer, passed)=>onTrainingResult?.(block.id, score, answer, passed)}/>;
    case 'matching':
      return <MatchingBlock c={c} threshold={trainingThreshold} graded={graded} onResult={(score, answer, passed)=>onTrainingResult?.(block.id, score, answer, passed)}/>;
    case 'sentence_order':
      return <SentenceOrderBlock c={c} threshold={trainingThreshold} graded={graded} onResult={(score, answer, passed)=>onTrainingResult?.(block.id, score, answer, passed)}/>;
    case 'dictation':
      return <DictationTraining c={c} threshold={trainingThreshold} graded={graded} onResult={(score,answer,passed)=>onTrainingResult?.(block.id,score,answer,passed)}/>;
    case 'pronunciation':
      return <SelfAssessedOralTraining title={c.title || 'Prononciation'} prompt={c.instructions || 'Écoutez puis répétez les éléments à voix haute.'} audios={(c.items||[]).map((x:any)=>({label:x.text,phonetic:x.phonetic,url:x.audio_url}))} threshold={trainingThreshold} graded={graded} onResult={(score,answer,passed)=>onTrainingResult?.(block.id,score,answer,passed)}/>;
    case 'oral_response':
      return <SelfAssessedOralTraining title="Réponse orale" prompt={c.prompt || ''} audios={c.reference_audio_url?[{label:'Audio de référence',url:c.reference_audio_url}]:[]} threshold={trainingThreshold} graded={graded} onResult={(score,answer,passed)=>onTrainingResult?.(block.id,score,answer,passed)}/>;
    case 'listening_comprehension':
      return <ListeningTraining c={c} threshold={trainingThreshold} graded={graded} onResult={(score,answer,passed)=>onTrainingResult?.(block.id,score,answer,passed)}/>;
    case 'written_expression':
      return <WrittenTraining c={c} threshold={trainingThreshold} graded={graded} onResult={(score,answer,passed)=>onTrainingResult?.(block.id,score,answer,passed)}/>;

    case 'qcm':
      return <QcmBlock block={{...block, content_json:c}} onAnswer={(id,a,correct)=>{onQuizAnswer?.(id,a,correct);onTrainingResult?.(id,correct?100:0,a,correct);}} />;

    case 'true_false':
      return <TrueFalseBlock block={{...block, content_json:c}} onAnswer={(id,a,correct)=>{onQuizAnswer?.(id,a,correct);onTrainingResult?.(id,correct?100:0,a,correct);}} />;

    case 'open_question':
      return <OpenQuestionTraining c={c} threshold={trainingThreshold} graded={graded} onResult={(score,answer,passed)=>onTrainingResult?.(block.id,score,answer,passed)}/>;

    // ── AVANCÉS ────────────────────────────────────────────────
    case 'accordion':
      return <div className="my-4">{c.title&&<p className="mb-2 font-bold text-[#002050]">{c.title}</p>}<AccordionBlock items={c.items || []} /></div>;

    case 'flashcards':
      return <div className="my-4">{c.title&&<p className="mb-2 font-bold text-[#002050]">{c.title}</p>}<FlashcardsBlock cards={c.cards || []} onComplete={(score)=>onTrainingResult?.(block.id,score,{cards_seen:c.cards?.length||0},graded ? score>=trainingThreshold : true)} /></div>;

    case 'interactive_table': {
      const headers = Array.isArray(c.headers) ? c.headers.map((x:any)=>String(x??'')) : [];
      const rows = Array.isArray(c.rows) ? c.rows.map((row:any)=>headers.map((_:string,i:number)=>String(Array.isArray(row)?(row[i]??''):''))) : [];
      return <div className="my-4">{(block.title || c.title) && <p className="mb-2 font-bold text-[#002050]">{block.title || c.title}</p>}<InteractiveTableBlock headers={headers} rows={rows} style={c.style} training={block.interaction_mode==='training'||c.mode==='training'} trainingColumns={Array.isArray(c.training_column_indexes)?c.training_column_indexes:[]} threshold={trainingThreshold} graded={graded} onResult={(score,answer,passed)=>onTrainingResult?.(block.id,score,answer,passed)} /></div>;
    }

    case 'timeline':
      return (
        <div className="my-5 relative">
          {c.title&&<p className="mb-4 font-bold text-[#002050]">{c.title}</p>}
          <div className="absolute left-5 top-0 bottom-0 w-0.5" style={{ background: '#E4E7EC' }} />
          <div className="space-y-4">
            {(c.steps || []).map((step: any, i: number) => (
              <div key={step.id || i} className="flex gap-4 relative">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 z-10"
                  style={{ background: '#002050', color: '#BF8813' }}>{i + 1}</div>
                <div className="flex-1 pb-4">
                  <p className="font-bold" style={{ color: '#002050' }}>{step.title}</p>
                  {step.description && <RichContent value={step.description} className="text-sm mt-1 text-slate-500"/>}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'columns':
      return (
        <div className="my-4">
          {c.title&&<p className="mb-3 font-bold text-[#002050]">{c.title}</p>}
          <div className={`grid gap-4 ${(c.columns||[]).length===2?'md:grid-cols-2':(c.columns||[]).length>=3?'md:grid-cols-3':''}`}>
          {(c.columns || []).map((col: any, i: number) => (
            <div key={col.id || i} className="p-4 rounded-xl border" style={{ borderColor: '#E4E7EC' }}>
              <RichContent value={col.content || ''} className="text-sm text-slate-700" />
            </div>
          ))}
          </div>
        </div>
      );


    case 'bullet_list':
      return <div className="my-4">{(block.title || c.title) && <p className="mb-2 font-bold text-[#002050]">{block.title || c.title}</p>}<ul className="list-disc pl-6 space-y-2 text-sm text-gray-700">{(c.items || []).map((x: string, i: number) => <li key={i}><RichContent value={x} className="text-sm text-gray-700" /></li>)}</ul></div>;
    case 'numbered_list':
      return <div className="my-4">{(block.title || c.title) && <p className="mb-2 font-bold text-[#002050]">{block.title || c.title}</p>}<ol className="list-decimal pl-6 space-y-2 text-sm text-gray-700">{(c.items || []).map((x: string, i: number) => <li key={i}><RichContent value={x} className="text-sm text-gray-700" /></li>)}</ol></div>;
    case 'quote':
      return <blockquote className="my-4 border-l-4 pl-4 py-2 italic text-gray-700" style={{ borderColor: '#BF8813' }}>{(block.title || c.title) && <p className="mb-2 text-sm font-bold not-italic text-[#002050]">{block.title || c.title}</p>}<RichContent value={c.html || c.text || ''} className="text-sm text-gray-700" />{c.author && <footer className="mt-2 text-xs not-italic text-gray-500">— {c.author}</footer>}</blockquote>;
    case 'code':
      return <pre className="overflow-x-auto rounded-lg bg-gray-950 p-4 text-xs text-gray-100"><code>{c.code || ''}</code></pre>;
    case 'checklist':
      return <div className="my-4">{c.title&&<p className="mb-2 font-bold text-[#002050]">{c.title}</p>}<ChecklistBlock items={c.items || []} initialState={learnerState || {}} onChange={(state,completed)=>{onStateChange?.(block.id,state,completed); if((block as any).interaction_mode==='training'){const total=(c.items||[]).filter((x:any)=>x.required!==false).length||1; const done=(c.items||[]).filter((x:any,i:number)=>x.required!==false&&state[String(x.id||i)]).length; const score=Math.round(done/total*100); onTrainingResult?.(block.id,score,state,completed);}}}/></div>;
    case 'link_button': {
      const href = safeExternalResourceUrl(c.url, true);
      return href ? <a href={href} target={c.open_new_tab ? '_blank' : undefined} rel="noopener noreferrer" className="inline-flex rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: '#002050' }}>{c.label || 'Ouvrir le lien'}</a> : <ResourceUnavailable block={block} label="Lien" />;
    }
    case 'embed': {
      const src = safeExternalResourceUrl(c.url);
      return src ? <div className="overflow-hidden rounded-xl border"><iframe src={src} title={c.title || 'Contenu intégré'} className="h-80 w-full" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /></div> : <ResourceUnavailable block={block} label="Contenu intégré" />;
    }
    case 'gallery': {
      const images = (c.images || []).filter((img: any) => String(img?.url || '').trim());
      return images.length ? <div className="my-4">{c.title&&<p className="mb-2 font-bold text-[#002050]">{c.title}</p>}<div className="grid grid-cols-2 gap-3 md:grid-cols-3">{images.map((img: any, i: number) => <figure key={i}><img src={img.url} alt={img.alt || ''} className="h-auto w-full rounded-lg object-contain" />{img.caption && <figcaption className="mt-1 text-xs text-gray-500">{img.caption}</figcaption>}</figure>)}</div></div> : <ResourceUnavailable block={block} label="Galerie" />;
    }
    case 'formula':
      return <div className="my-4">{c.title&&<p className="mb-2 font-bold text-[#002050]">{c.title}</p>}<MathFormula latex={c.latex || ''} explanation={c.explanation || ''} /></div>;
    case 'chart':
      return <div className="my-4">{c.title&&<p className="mb-2 font-bold text-[#002050]">{c.title}</p>}<ChartBlock c={c} /></div>;
    case 'assignment_upload':
      return <AssignmentTraining c={c} training={block.interaction_mode === 'training'} onFileSubmit={onFileTrainingSubmit ? (file) => onFileTrainingSubmit(block.id, file) : undefined} />;
    case 'rubric':
      return <div className="overflow-x-auto"><table className="w-full border-collapse text-sm"><thead><tr><th className="border p-2 text-left">Critère</th><th className="border p-2 text-left">Description</th><th className="border p-2 text-right">Points</th></tr></thead><tbody>{(c.criteria || []).map((x: any, i: number) => <tr key={i}><td className="border p-2">{x.name}</td><td className="border p-2">{x.description}</td><td className="border p-2 text-right">{x.points}</td></tr>)}</tbody></table></div>;

    default:
      return <div className="my-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Type de bloc non pris en charge : <strong>{block.block_type}</strong></div>;
  }
}

// ─── Sous-composants ──────────────────────────────────────────



function normAnswer(value:string){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()}
function latexToMathMl(latex:string){const source=String(latex||'').trim();if(!source)return '';const escaped=source.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mtext>${escaped}</mtext></math>`}
function similarityScore(expected:string,actual:string){const a=normAnswer(expected),b=normAnswer(actual);if(!a||!b)return 0;const aw=new Set(a.split(' ').filter(Boolean)),bw=new Set(b.split(' ').filter(Boolean));const common=[...aw].filter(x=>bw.has(x)).length;const union=new Set([...aw,...bw]).size||1;const lexical=Math.round(common/union*100);const lengthRatio=Math.round(Math.min(a.length,b.length)/Math.max(a.length,b.length)*100);return Math.round(lexical*.75+lengthRatio*.25)}
function DictationTraining({c,threshold,graded=true,onResult}:{c:Record<string,any>;threshold:number;graded?:boolean;onResult?:(score:number,answer:any,passed:boolean)=>void}){const [value,setValue]=useState(''),[score,setScore]=useState<number|null>(null);const verify=()=>{const s=similarityScore(String(c.transcript||''),value);setScore(s);onResult?.(s,{text:value},s>=threshold)};return <div className="my-4 rounded-xl border p-4" style={{borderColor:'#E4E7EC'}}>{c.audio_url&&<audio className="w-full" controls src={c.audio_url}/>}<textarea value={value} onChange={e=>{setValue(e.target.value);setScore(null)}} className="mt-3 w-full rounded-lg border p-3 text-sm" rows={4} placeholder="Écrivez ce que vous entendez…"/><button type="button" onClick={verify} disabled={!value.trim()||!String(c.transcript||'').trim()} className="mt-3 rounded-lg bg-[#002050] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Vérifier</button>{score!==null&&(graded?<div className={`mt-2 text-xs font-semibold ${score>=threshold?'text-emerald-700':'text-red-700'}`}>{score}% · {score>=threshold?'Seuil atteint':'À retravailler'}</div>:<div className="mt-2 text-xs font-semibold text-emerald-700">Entraînement réalisé.</div>)}{score!==null&&<details className="mt-2 text-xs text-slate-500"><summary>Voir le corrigé</summary><p className="mt-2">{c.transcript}</p></details>}</div>}
function SelfAssessedOralTraining({title,prompt,audios,threshold,graded=true,onResult}:{title:string;prompt:string;audios:Array<{label?:string;phonetic?:string;url?:string}>;threshold:number;graded?:boolean;onResult?:(score:number,answer:any,passed:boolean)=>void}){
  const [score,setScore]=useState<number|null>(null);
  const [recording,setRecording]=useState(false);
  const [audioUrl,setAudioUrl]=useState('');
  const recorderRef=useState<{recorder:MediaRecorder|null;stream:MediaStream|null;chunks:Blob[]}>({recorder:null,stream:null,chunks:[]})[0];
  const startRecording=async()=>{
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const recorder=new MediaRecorder(stream);recorderRef.stream=stream;recorderRef.recorder=recorder;recorderRef.chunks=[];
      recorder.ondataavailable=e=>{if(e.data.size)recorderRef.chunks.push(e.data)};
      recorder.onstop=()=>{const blob=new Blob(recorderRef.chunks,{type:recorder.mimeType||'audio/webm'});if(audioUrl)URL.revokeObjectURL(audioUrl);setAudioUrl(URL.createObjectURL(blob));recorderRef.stream?.getTracks().forEach(t=>t.stop());recorderRef.stream=null;setRecording(false)};
      recorder.start();setRecording(true);
    }catch{setRecording(false)}
  };
  const stopRecording=()=>{if(recorderRef.recorder&&recorderRef.recorder.state!=='inactive')recorderRef.recorder.stop()};
  const choose=(value:number)=>{setScore(value);onResult?.(value,{self_assessment:value,recorded:Boolean(audioUrl)},value>=threshold)};
  return <div className="my-4 rounded-xl border p-4" style={{borderColor:'#E4E7EC'}}>
    <p className="font-semibold text-[#002050]">{title}</p>{prompt&&<p className="mt-1 text-sm text-slate-600">{prompt}</p>}
    {audios.map((x,i)=><div key={i} className="mt-3"><div className="text-xs font-semibold text-slate-600">{x.label}</div>{x.phonetic&&<div className="text-xs text-slate-400">{x.phonetic}</div>}{x.url&&<audio className="mt-1 w-full" controls src={x.url}/>}</div>)}
    <div className="mt-4 rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-[#002050]">Enregistrez-vous puis réécoutez votre réponse</p><div className="mt-2 flex flex-wrap items-center gap-2">{!recording?<button type="button" onClick={startRecording} className="inline-flex items-center gap-2 rounded-lg bg-[#002050] px-3 py-2 text-xs font-semibold text-white"><Mic size={14}/>Enregistrer</button>:<button type="button" onClick={stopRecording} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white"><Square size={12}/>Arrêter</button>}{audioUrl&&<audio controls src={audioUrl} className="h-9 max-w-full"/>}</div></div>
    <p className="mt-3 text-xs text-slate-500">Lorsque l’analyse automatique n’est pas suffisamment fiable pour la langue, Omnia conserve une auto-évaluation explicite plutôt qu’une fausse note automatique.</p>
    <div className="mt-3 flex gap-2"><button type="button" onClick={()=>choose(100)} disabled={!audioUrl} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Maîtrisé</button><button type="button" onClick={()=>choose(0)} disabled={!audioUrl} className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40">À retravailler</button></div>
    {score!==null&&(graded?<p className={`mt-2 text-xs font-semibold ${score>=threshold?'text-emerald-700':'text-red-700'}`}>Note d’entraînement : {score}%</p>:<p className="mt-2 text-xs font-semibold text-emerald-700">Entraînement réalisé.</p>)}
  </div>;
}


function ClozeBlock({c,threshold,graded=true,onResult}:{c:Record<string,any>;threshold:number;graded?:boolean;onResult?:(score:number,answer:any,passed:boolean)=>void}){
  const parts=Array.isArray(c.blanks)?c.blanks:[];const [answers,setAnswers]=useState<Record<string,string>>({});const [score,setScore]=useState<number|null>(null);
  const verify=()=>{const expected=parts.length?parts.map((x:any,i:number)=>String(x.answer??x.value??'')):[];if(!expected.length)return;let good=0;expected.forEach((exp:string,i:number)=>{if(normAnswer(answers[String(i)]||'')===normAnswer(exp))good++});const s=Math.round(good/expected.length*100);setScore(s);onResult?.(s,{answers},s>=threshold)};
  const text=String(c.text||c.sentence||'');
  return <div className="my-4 rounded-xl border p-4" style={{borderColor:'#E4E7EC'}}><p className="font-semibold text-[#002050]">{c.title||'Texte à trous'}</p>{text&&<p className="mt-2 text-sm text-slate-600">{text}</p>}<div className="mt-3 grid gap-2">{parts.map((x:any,i:number)=><label key={i} className="text-xs font-semibold text-slate-600">{x.label||`Réponse ${i+1}`}<input value={answers[String(i)]||''} onChange={e=>{setAnswers(v=>({...v,[String(i)]:e.target.value}));setScore(null)}} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label>)}</div><button type="button" onClick={verify} disabled={!parts.length} className="mt-3 rounded-lg bg-[#002050] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Vérifier</button>{score!==null&&(graded?<p className={`mt-2 text-xs font-semibold ${score>=threshold?'text-emerald-700':'text-red-700'}`}>{score}% · {score>=threshold?'Seuil atteint':'À retravailler'}</p>:<p className="mt-2 text-xs font-semibold text-emerald-700">Réponse enregistrée.</p>)}</div>
}
function MatchingBlock({c,threshold,graded=true,onResult}:{c:Record<string,any>;threshold:number;graded?:boolean;onResult?:(score:number,answer:any,passed:boolean)=>void}){
  const pairs=Array.isArray(c.pairs)?c.pairs:[];const rights=pairs.map((x:any)=>String(x.right??x.answer??''));const [answers,setAnswers]=useState<Record<string,string>>({});const [score,setScore]=useState<number|null>(null);
  const verify=()=>{if(!pairs.length)return;let good=0;pairs.forEach((x:any,i:number)=>{if(normAnswer(answers[String(i)]||'')===normAnswer(String(x.right??x.answer??'')))good++});const s=Math.round(good/pairs.length*100);setScore(s);onResult?.(s,{answers},s>=threshold)};
  return <div className="my-4 rounded-xl border p-4" style={{borderColor:'#E4E7EC'}}><p className="font-semibold text-[#002050]">{c.title||'Association'}</p><div className="mt-3 grid gap-2">{pairs.map((x:any,i:number)=><div key={i} className="grid items-center gap-2 sm:grid-cols-2"><div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">{x.left??x.prompt}</div><select value={answers[String(i)]||''} onChange={e=>{setAnswers(v=>({...v,[String(i)]:e.target.value}));setScore(null)}} className="rounded-lg border px-3 py-2 text-sm"><option value="">Choisir…</option>{rights.map((r:string,j:number)=><option key={j} value={r}>{r}</option>)}</select></div>)}</div><button type="button" onClick={verify} disabled={!pairs.length} className="mt-3 rounded-lg bg-[#002050] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Vérifier</button>{score!==null&&(graded?<p className={`mt-2 text-xs font-semibold ${score>=threshold?'text-emerald-700':'text-red-700'}`}>{score}%</p>:<p className="mt-2 text-xs font-semibold text-emerald-700">Entraînement réalisé.</p>)}</div>
}
function SentenceOrderBlock({c,threshold,graded=true,onResult}:{c:Record<string,any>;threshold:number;graded?:boolean;onResult?:(score:number,answer:any,passed:boolean)=>void}){
  const expected=(Array.isArray(c.items)?c.items:Array.isArray(c.words)?c.words:[]).map((x:any)=>String(x.text??x));const [value,setValue]=useState('');const [score,setScore]=useState<number|null>(null);
  const verify=()=>{const exp=expected.join(' ');const s=similarityScore(exp,value);setScore(s);onResult?.(s,{text:value},s>=threshold)};
  return <div className="my-4 rounded-xl border p-4" style={{borderColor:'#E4E7EC'}}><p className="font-semibold text-[#002050]">{c.title||'Remettre la phrase dans l’ordre'}</p>{expected.length>0&&<div className="mt-2 flex flex-wrap gap-2">{[...expected].sort().map((x,i)=><span key={i} className="rounded-full bg-slate-100 px-3 py-1 text-xs">{x}</span>)}</div>}<input value={value} onChange={e=>{setValue(e.target.value);setScore(null)}} className="mt-3 w-full rounded-lg border px-3 py-2 text-sm" placeholder="Reconstituez la phrase"/><button type="button" onClick={verify} disabled={!value.trim()||!expected.length} className="mt-3 rounded-lg bg-[#002050] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Vérifier</button>{score!==null&&(graded?<p className={`mt-2 text-xs font-semibold ${score>=threshold?'text-emerald-700':'text-red-700'}`}>{score}%</p>:<p className="mt-2 text-xs font-semibold text-emerald-700">Entraînement réalisé.</p>)}</div>
}
function ListeningTraining({c,threshold,graded=true,onResult}:{c:Record<string,any>;threshold:number;graded?:boolean;onResult?:(score:number,answer:any,passed:boolean)=>void}){
  const questions=Array.isArray(c.questions)?c.questions:[];const [answers,setAnswers]=useState<Record<string,string>>({});const [score,setScore]=useState<number|null>(null);
  const verify=()=>{if(!questions.length)return;let gradable=0,good=0;questions.forEach((q:any,i:number)=>{const exp=q.correct_answer??q.answer;if(exp!==undefined&&String(exp)!==''){gradable++;if(normAnswer(answers[String(i)]||'')===normAnswer(String(exp)))good++}});const s=gradable?Math.round(good/gradable*100):0;setScore(s);onResult?.(s,{answers},graded&&gradable>0?s>=threshold:true)};
  return <div className="my-4 rounded-xl border p-4" style={{borderColor:'#E4E7EC'}}><p className="font-semibold text-[#002050]">{c.title||'Compréhension orale'}</p>{c.audio_url&&<audio className="mt-3 w-full" controls src={c.audio_url}/>}<div className="mt-3 space-y-3">{questions.map((q:any,i:number)=><label key={i} className="block text-xs font-semibold text-slate-600">{q.question||`Question ${i+1}`}<input value={answers[String(i)]||''} onChange={e=>{setAnswers(v=>({...v,[String(i)]:e.target.value}));setScore(null)}} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label>)}</div><button type="button" onClick={verify} disabled={!questions.length} className="mt-3 rounded-lg bg-[#002050] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Valider</button>{score!==null&&(graded?<p className={`mt-2 text-xs font-semibold ${score>=threshold?'text-emerald-700':'text-red-700'}`}>{score}%</p>:<p className="mt-2 text-xs font-semibold text-emerald-700">Entraînement réalisé.</p>)}</div>
}
function WrittenTraining({c,threshold,graded=true,onResult}:{c:Record<string,any>;threshold:number;graded?:boolean;onResult?:TrainingLocalResultHandler}){
  const [text,setText]=useState('');const [result,setResult]=useState<TrainingServerResult|null>(null);const [busy,setBusy]=useState(false);const min=Math.max(1,Number(c.min_words||1));const words=text.trim()?text.trim().split(/\s+/).length:0;
  const submit=async()=>{if(!text.trim()||busy)return;setBusy(true);setResult(null);try{const server=await onResult?.(0,{text,word_count:words},false);if(server&&typeof server==='object')setResult(server as TrainingServerResult);else if(!graded)setResult({graded:false,passed:true});}finally{setBusy(false)}};
  return <div className="my-3 rounded-xl border p-4" style={{borderColor:'#E4E7EC'}}><p className="font-semibold text-[#002050]">{c.title||'Expression écrite'}</p>{c.prompt&&<p className="mt-1 text-sm text-slate-600">{c.prompt}</p>}<textarea value={text} onChange={e=>{setText(e.target.value);setResult(null)}} rows={6} className="mt-3 w-full rounded-lg border p-3 text-sm" placeholder="Rédigez votre réponse…"/><div className="mt-2 flex items-center justify-between text-xs text-slate-500"><span>{words} mot(s){min>1?` · minimum ${min}`:''}</span><button type="button" onClick={()=>void submit()} disabled={!text.trim()||busy} className="rounded-lg bg-[#002050] px-3 py-1.5 font-semibold text-white disabled:opacity-40">{busy?'Correction IA…':'Terminer l’entraînement'}</button></div>{result&&(result.graded!==false&&typeof result.score==='number'?<><p className={`mt-2 text-xs font-semibold ${result.passed?'text-emerald-700':'text-red-700'}`}>{result.score}% · {result.passed?'Seuil atteint':'À retravailler'}</p>{result.feedback&&<p className="mt-1 text-xs text-slate-600">{result.feedback}</p>}</>:<p className="mt-2 text-xs font-semibold text-emerald-700">Réponse enregistrée.</p>)}</div>
}
function OpenQuestionTraining({c,threshold,graded=true,onResult}:{c:Record<string,any>;threshold:number;graded?:boolean;onResult?:TrainingLocalResultHandler}){
  const [text,setText]=useState('');const [result,setResult]=useState<TrainingServerResult|null>(null);const [busy,setBusy]=useState(false);
  const verify=async()=>{if(!text.trim()||busy)return;setBusy(true);setResult(null);try{const server=await onResult?.(0,{text},false);if(server&&typeof server==='object')setResult(server as TrainingServerResult);else if(!graded)setResult({graded:false,passed:true});}finally{setBusy(false)}};
  return <div className="my-3 rounded-xl border p-4" style={{borderColor:'#E4E7EC'}}>{c.title&&<p className="mb-2 font-bold text-[#002050]">{c.title}</p>}<RichContent value={c.question||'Question ouverte'} className="font-semibold text-[#002050]"/>{c.guidance&&<RichContent value={c.guidance} className="mt-1 text-xs text-slate-500"/>}<textarea value={text} onChange={e=>{setText(e.target.value);setResult(null)}} rows={5} className="mt-3 w-full rounded-lg border p-3 text-sm"/><button type="button" onClick={()=>void verify()} disabled={!text.trim()||busy} className="mt-3 rounded-lg bg-[#002050] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">{busy?'Correction IA…':'Terminer l’entraînement'}</button>{result&&(result.graded!==false&&typeof result.score==='number'?<><p className={`mt-2 text-xs font-semibold ${result.passed?'text-emerald-700':'text-red-700'}`}>{result.score}% · {result.passed?'Seuil atteint':'À retravailler'}</p>{result.feedback&&<p className="mt-1 text-xs text-slate-600">{result.feedback}</p>}</>:<p className="mt-2 text-xs font-semibold text-emerald-700">Réponse enregistrée.</p>)}</div>
}
function ChecklistBlock({items,initialState,onChange}:{items:any[];initialState:Record<string,any>;onChange?:(state:Record<string,any>,completed:boolean)=>void}){
  const [state,setState]=useState<Record<string,any>>(initialState||{});const update=(key:string,val:boolean)=>{const next={...state,[key]:val};setState(next);const required=items.filter(x=>x.required!==false);const completed=required.every((x:any,i:number)=>Boolean(next[String(x.id||items.indexOf(x))]));onChange?.(next,completed)};
  return <div className="my-4 rounded-xl border p-4" style={{borderColor:'#E4E7EC'}}><div className="space-y-2">{items.map((item:any,i:number)=>{const key=String(item.id||i);return <label key={key} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-slate-50"><input type="checkbox" checked={Boolean(state[key])} onChange={e=>update(key,e.target.checked)} className="mt-0.5"/><span className="text-sm text-slate-700">{item.text||item.label||String(item)}{item.required===false&&<span className="ml-2 text-[10px] text-slate-400">facultatif</span>}</span></label>})}</div></div>
}
function CaseStudyTraining({c,training,threshold,graded=true,onResult,onFileSubmit}:{c:Record<string,any>;training:boolean;threshold:number;graded?:boolean;onResult?:TrainingLocalResultHandler;onFileSubmit?:(file:File,answer?:Record<string,any>)=>Promise<boolean>}){
  const qs=(Array.isArray(c.questions)?c.questions:[]).map((q:any)=>typeof q==='string'?q:String(q?.question||q?.text||'')).filter(Boolean);const responseMode=String(c.response_mode||'text');const responseLayout=String(c.response_layout||'per_question');const needsText=responseMode==='text'||responseMode==='text_file';const needsFile=responseMode==='file'||responseMode==='text_file';const [answers,setAnswers]=useState<Record<string,string>>({});const [globalText,setGlobalText]=useState('');const [file,setFile]=useState<File|null>(null);const [busy,setBusy]=useState(false);const [status,setStatus]=useState('');const [result,setResult]=useState<TrainingServerResult|null>(null);
  const textComplete=!needsText||(responseLayout==='single'?globalText.trim().length>0:(qs.length>0?qs.every((_:string,i:number)=>String(answers[String(i)]||'').trim().length>0):globalText.trim().length>0));const fileComplete=!needsFile||Boolean(file);const canSubmit=textComplete&&fileComplete;const answerPayload=()=>responseLayout==='single'?{text:globalText,response_layout:'single'}:{answers,response_layout:'per_question'};
  const submit=async()=>{if(!canSubmit||busy)return;setBusy(true);setStatus('');setResult(null);const payload=answerPayload();try{if(needsFile&&file&&onFileSubmit){const ok=await onFileSubmit(file,payload);setStatus(ok?'Étude de cas remise.':'Échec de la remise.');}else{const server=await onResult?.(0,payload,false);if(server&&typeof server==='object')setResult(server as TrainingServerResult);else if(!graded)setResult({graded:false,passed:true});}}finally{setBusy(false)}};
  return <div className="p-4 rounded-xl my-3 border" style={{borderColor:'#E4E7EC'}}><p className="font-bold mb-2" style={{color:'#002050'}}>Étude de cas{c.title?` : ${c.title}`:''}</p>{c.context&&<div className="mb-2"><p className="text-xs font-bold uppercase tracking-wide mb-1 text-slate-400">Contexte</p><RichContent value={c.context} className="text-sm text-slate-700"/></div>}{c.data&&<div className="mb-2"><p className="text-xs font-bold uppercase tracking-wide mb-1 text-slate-400">Données</p><RichContent value={c.data} className="text-sm text-slate-700"/></div>}{c.task&&<div className="rounded-lg bg-blue-50 p-3 text-sm text-slate-700"><RichContent value={c.task}/></div>}{qs.length>0&&<div className="mt-3 space-y-1.5"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Questions d’analyse</p>{qs.map((q:string,i:number)=><p key={i} className="text-sm font-semibold text-slate-700">{i+1}. {q}</p>)}</div>}{training&&needsText&&responseLayout==='per_question'&&qs.length>0&&<div className="mt-3 space-y-2">{qs.map((q:string,i:number)=><label key={i} className="block text-xs font-semibold text-slate-600"><span>{i+1}. {q}</span><textarea value={answers[String(i)]||''} onChange={e=>setAnswers(v=>({...v,[String(i)]:e.target.value}))} rows={3} className="mt-1 w-full rounded-lg border p-3 text-sm" placeholder="Construisez votre réponse…"/></label>)}</div>}{training&&needsText&&(responseLayout==='single'||!qs.length)&&<textarea value={globalText} onChange={e=>setGlobalText(e.target.value)} rows={6} className="mt-3 w-full rounded-lg border p-3 text-sm" placeholder="Rédigez votre réponse globale…"/>}{training&&needsFile&&<label className="mt-3 block cursor-pointer rounded-xl border border-dashed p-3 text-center text-sm text-slate-600"><input type="file" className="hidden" disabled={busy} accept={(c.accepted_types||[]).map((x:string)=>`.${String(x).replace(/^\./,'')}`).join(',')} onChange={e=>setFile(e.target.files?.[0]||null)}/>{file?`Fichier sélectionné : ${file.name}`:'Choisir le fichier à joindre'}</label>}{training&&<button type="button" onClick={()=>void submit()} disabled={!canSubmit||busy} className="mt-3 rounded-lg bg-[#002050] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">{busy?'Correction / envoi…':'Remettre l’étude de cas'}</button>}{result&&result.graded!==false&&typeof result.score==='number'&&<><p className={`mt-2 text-xs font-semibold ${result.passed?'text-emerald-700':'text-red-700'}`}>{result.score}% · {result.passed?'Seuil atteint':'À retravailler'}</p>{result.feedback&&<p className="mt-1 text-xs text-slate-600">{result.feedback}</p>}</>}{training&&status&&<p className={`mt-2 text-xs font-semibold ${status.startsWith('Échec')?'text-red-700':'text-emerald-700'}`}>{status}</p>}</div>
}
function ExerciseTraining({c,training,onResult,onFileSubmit}:{c:Record<string,any>;training:boolean;onResult?:TrainingLocalResultHandler;onFileSubmit?:(file:File,answer?:Record<string,any>)=>Promise<boolean>}){
  const legacyMode=c.learner_upload_required===true?'file':'text';const responseMode=String(c.response_mode||legacyMode);const needsText=responseMode==='text'||responseMode==='text_file';const needsFile=responseMode==='file'||responseMode==='text_file';const [text,setText]=useState('');const [file,setFile]=useState<File|null>(null);const [busy,setBusy]=useState(false);const [status,setStatus]=useState('');const [result,setResult]=useState<TrainingServerResult|null>(null);const canSubmit=(!needsText||text.trim().length>0)&&(!needsFile||Boolean(file));
  const submit=async()=>{if(!canSubmit||busy)return;setBusy(true);setStatus('');setResult(null);try{if(needsFile&&file&&onFileSubmit){const ok=await onFileSubmit(file,{text});setStatus(ok?'Exercice remis et enregistré.':'Échec de la remise.');}else{const server=await onResult?.(0,{text},false);if(server&&typeof server==='object')setResult(server as TrainingServerResult);}}finally{setBusy(false)}};
  return <div className="p-4 rounded-xl my-3 border" style={{borderColor:'#002050'}}><p className="font-bold mb-2 text-[#002050]">Exercice{c.title?` : ${c.title}`:''}</p>{c.instructions&&<div className="mb-2"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Consigne</p><RichContent value={c.instructions} className="text-sm text-slate-700"/></div>}{c.task&&<div className="rounded-lg bg-slate-50 p-3"><RichContent value={c.task} className="text-sm font-semibold text-[#002050]"/></div>}{training&&needsText&&<textarea value={text} onChange={e=>{setText(e.target.value);setResult(null)}} rows={5} className="mt-3 w-full rounded-lg border p-3 text-sm" placeholder="Votre réponse…"/>}{training&&needsFile&&<label className="mt-3 block cursor-pointer rounded-xl border border-dashed p-3 text-center text-sm text-slate-600"><input type="file" className="hidden" disabled={busy} accept={(c.accepted_types||[]).map((x:string)=>`.${String(x).replace(/^\./,'')}`).join(',')} onChange={e=>setFile(e.target.files?.[0]||null)}/>{file?`Fichier sélectionné : ${file.name}`:'Choisir le fichier de réponse'}</label>}{training&&<button type="button" onClick={()=>void submit()} disabled={!canSubmit||busy} className="mt-3 rounded-lg bg-[#002050] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">{busy?'Correction / envoi…':'Remettre l’exercice'}</button>}{result&&result.graded!==false&&typeof result.score==='number'&&<><p className={`mt-2 text-xs font-semibold ${result.passed?'text-emerald-700':'text-red-700'}`}>{result.score}% · {result.passed?'Seuil atteint':'À retravailler'}</p>{result.feedback&&<p className="mt-1 text-xs text-slate-600">{result.feedback}</p>}</>}{status&&<p className={`mt-2 text-xs font-semibold ${status.startsWith('Échec')?'text-red-700':'text-emerald-700'}`}>{status}</p>}</div>
}
function AssignmentTraining({c,training,onFileSubmit}:{c:Record<string,any>;training:boolean;onFileSubmit?:(file:File)=>Promise<boolean>}){
  const [busy,setBusy]=useState(false);const [status,setStatus]=useState('');const upload=async(file:File)=>{if(!onFileSubmit)return;setBusy(true);const ok=await onFileSubmit(file).catch(()=>false);setBusy(false);setStatus(ok?'Travail remis et entraînement validé.':'Échec de la remise du fichier.')};
  return <div className="rounded-xl border border-dashed p-4"><p className="font-semibold text-[#002050]">{c.title||'Travail à remettre'}</p><p className="mt-1 text-sm text-gray-600">{c.instructions||''}</p><p className="mt-2 text-xs text-gray-500">Formats : {(c.accepted_types||[]).join(', ')} · maximum {c.max_size_mb||10} Mo</p>{training&&<label className="mt-4 block cursor-pointer rounded-xl bg-slate-50 p-4 text-center text-sm font-semibold text-[#002050]"><input type="file" className="hidden" disabled={busy} accept={(c.accepted_types||[]).map((x:string)=>`.${String(x).replace(/^\\./,'')}`).join(',')} onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f)}}/>{busy?'Envoi en cours…':'Choisir et remettre mon fichier'}</label>}{status&&<p className={`mt-2 text-xs font-semibold ${status.startsWith('Échec')?'text-red-700':'text-emerald-700'}`}>{status}</p>}</div>
}

function MathFormula({latex,explanation}:{latex:string;explanation?:string}){const math=latexToMathMl(latex);return <div className="rounded-xl border bg-white p-5 text-center" style={{borderColor:'#E4E7EC'}}>{math?<div className="overflow-x-auto text-xl" aria-label={`Formule ${latex}`} dangerouslySetInnerHTML={{__html:math}}/>:<div className="text-sm text-slate-400">Formule non renseignée</div>}{explanation&&<p className="mt-2 text-sm text-slate-600">{explanation}</p>}</div>}

function ChartBlock({c}:{c:Record<string,any>}){const data=(c.labels||[]).map((label:string,i:number)=>({name:label,value:Number(c.values?.[i]||0)}));if(!data.length)return <div className="rounded-xl border p-4 text-sm text-slate-400" style={{borderColor:'#E4E7EC'}}>Ajoutez des données au graphique.</div>;const grid=<CartesianGrid strokeDasharray="3 3"/>;return <div className="rounded-xl border p-4" style={{borderColor:'#E4E7EC'}}><p className="mb-3 text-sm font-semibold text-[#002050]">{c.title||'Graphique'}{c.unit?` · ${c.unit}`:''}</p><div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%">{c.chart_type==='line'?<LineChart data={data}>{grid}<XAxis dataKey="name"/><YAxis/><Tooltip/><Legend/><Line type="monotone" dataKey="value" stroke="#002050"/></LineChart>:c.chart_type==='pie'?<PieChart><Tooltip/><Legend/><Pie data={data} dataKey="value" nameKey="name" outerRadius={90} label>{data.map((_:any,i:number)=><Cell key={i} fill={['#002050','#BF8813','#1E7A52','#7C3AED','#0369A1','#D97706'][i%6]}/>)}</Pie></PieChart>:<BarChart data={data}>{grid}<XAxis dataKey="name"/><YAxis/><Tooltip/><Legend/><Bar dataKey="value" fill="#002050"/></BarChart>}</ResponsiveContainer></div></div>}
function VideoBlock({ url, eco, title }: { url: string; eco: boolean; title?: string }) {
  const [loaded, setLoaded] = useState(!eco);
  const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');
  const isVimeo = url.includes('vimeo.com');
  const isCloudflareStream = /\/(?:[^/?#]+)\/iframe(?:[?#]|$)/.test(url) || url.includes('cloudflarestream.com') && url.includes('/iframe');

  function getEmbedUrl(u: string) {
    if (u.includes('youtu.be/')) return `https://www.youtube.com/embed/${u.split('youtu.be/')[1].split('?')[0]}`;
    if (u.includes('youtube.com/watch?v=')) return `https://www.youtube.com/embed/${new URLSearchParams(u.split('?')[1]).get('v')}`;
    if (u.includes('vimeo.com/')) return `https://player.vimeo.com/video/${u.split('vimeo.com/')[1].split('?')[0]}`;
    return u;
  }

  return (
    <div className="my-5 rounded-xl overflow-hidden" style={{ border: '1px solid #E4E7EC' }}>
      {title && <p className="px-4 py-2.5 text-sm font-semibold" style={{ color: '#002050', background: '#F8F9FA' }}>{title}</p>}
      {!loaded ? (
        <div className="flex flex-col items-center justify-center py-10 cursor-pointer" style={{ background: '#F8F9FA' }}
          onClick={() => setLoaded(true)}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: '#002050' }}>
            <Play size={24} color="white" style={{ marginLeft: 3 }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: '#002050' }}>Cliquer pour charger la vidéo</p>
          <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Mode éco-data — évite la consommation de données</p>
        </div>
      ) : (isYoutube || isVimeo || isCloudflareStream) ? (
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
          <iframe src={getEmbedUrl(url)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            frameBorder="0" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
        </div>
      ) : (
        <video controls controlsList="nodownload" className="w-full" style={{ maxHeight: '70vh' }}>
          <source src={url} />
        </video>
      )}
    </div>
  );
}

function DocumentViewBlock({ block }: { block: Block }) {
  const c = block.content_json || {};
  const url = block.file_url || c.url || '';
  if (!url) return <ResourceUnavailable block={block} label={block.block_type === 'pdf' ? 'PDF' : 'Document Word'} />;
  const title = resourceDisplayTitle(block, block.block_type === 'pdf' ? 'Document PDF' : 'Document Word');
  if (block.block_type === 'pdf') {
    return (
      <section className="my-4 overflow-hidden rounded-xl border" style={{ borderColor: '#E4E7EC' }}>
        <div className="flex items-center gap-2 px-4 py-3" style={{ background: '#F8F9FA' }}>
          <FileText size={16} style={{ color: '#DC2626' }} />
          <span className="text-sm font-semibold" style={{ color: '#002050' }}>{title}</span>
        </div>
        <iframe src={`${url}#toolbar=0&navpanes=0`} title={title} className="h-[70vh] min-h-[520px] w-full bg-white" />
      </section>
    );
  }
  return (
    <section className="my-4 rounded-xl border p-4" style={{ borderColor: '#E4E7EC', background: '#F8F9FA' }}>
      <div className="flex items-center gap-3">
        <FileText size={22} style={{ color: '#1D4ED8' }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: '#002050' }}>{title}</p>
          {c.description && <p className="mt-1 text-xs text-slate-500">{c.description}</p>}
          <p className="mt-1 text-xs text-slate-400">Document protégé · téléchargement désactivé</p>
        </div>
      </div>
    </section>
  );
}

function DownloadOnlyBlock({ block }: { block: Block }) {
  const c = block.content_json || {};
  const url = block.file_url || c.url || '';
  if (!url) return <ResourceUnavailable block={block} label="Téléchargement" />;
  const title = String(c.title || block.title || 'Ressource à télécharger');
  return (
    <div className="my-4 flex items-center gap-4 rounded-xl border p-4" style={{ background: '#F8F9FA', borderColor: '#E4E7EC' }}>
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: '#37415115' }}>
        <Download size={22} style={{ color: '#374151' }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold" style={{ color: '#002050' }}>{title}</p>
        {c.description && <p className="mt-0.5 text-xs" style={{ color: '#6B7280' }}>{c.description}</p>}
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer" download
        className="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold"
        style={{ background: '#002050', color: 'white' }}>
        <Download size={14} /> Télécharger
      </a>
    </div>
  );
}

function ExcelBlock({ block }: { block: Block }) {
  const c = block.content_json || {};
  const headers: string[] = c.headers || [];
  const rows: string[][] = c.preview_rows || [];
  const url = block.file_url || c.url || '';

  return (
    <div className="my-4 rounded-xl overflow-hidden border" style={{ borderColor: '#E4E7EC' }}>
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: '#1E7A52' }}>
        <div className="flex items-center gap-2">
          <Table size={16} color="white" />
          <span className="font-semibold text-sm text-white">{resourceDisplayTitle(block, 'Tableau')}</span>
        </div>
      </div>
      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {headers.length > 0 && (
              <thead>
                <tr style={{ background: '#ECFDF5', borderBottom: '2px solid #1E7A52' }}>
                  {headers.map((h, i) => (
                    <th key={i} className="px-4 py-2.5 text-left font-bold" style={{ color: '#065F46', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: '1px solid #E4E7EC', background: ri % 2 === 0 ? 'white' : '#F9FAFB' }}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-4 py-2.5 text-sm" style={{ color: '#374151' }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-6 text-center">
          <p className="text-sm" style={{ color: '#9CA3AF' }}>Aperçu non disponible — téléchargez le fichier pour le consulter</p>
        </div>
      )}
    </div>
  );
}

function ScormBlock({ block }: { block: Block }) {
  const [launched, setLaunched] = useState(false);
  const c = block.content_json || {};
  const url = block.file_url || c.url || '';
  const packageType = c.package_type || 'scorm_2004';

  return (
    <div className="my-4 overflow-hidden rounded-xl border" style={{ borderColor: '#E4E7EC' }}>
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: '#78350F' }}>
        <Layers size={16} color="white" />
        <span className="font-semibold text-sm text-white">{c.title || 'Module SCORM'}</span>
        <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-xs text-white/80">
          SCORM 2004 4th Edition
        </span>
      </div>
      {!launched ? (
        <div className="p-8 text-center" style={{ background: '#FFF7ED' }}>
          <Layers size={36} className="mx-auto mb-3" style={{ color: '#92400E' }} />
          <p className="font-semibold mb-1" style={{ color: '#78350F' }}>Module interactif SCORM</p>
          {c.description && <p className="text-sm mb-4" style={{ color: '#6B7280' }}>{c.description}</p>}
          {c.duration_min ? <p className="mb-4 text-xs" style={{ color: '#6B7280' }}>Durée pédagogique : ~{c.duration_min} min</p> : null}
          <button onClick={() => setLaunched(true)} disabled={!url}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white mx-auto disabled:opacity-40"
            style={{ background: '#78350F' }}>
            <Play size={15} /> Lancer le module
          </button>
          {!c.scorm_ready && <p className="mt-3 text-xs text-amber-700">Le package doit être validé et extrait avant lecture.</p>}
        </div>
      ) : url ? (
        <ScormPlayer
          scormUrl={url}
          packageType={packageType}
          title={c.title || block.title || 'Module SCORM'}
          runtimeToken={c.runtime_session_token}
          initialData={c.runtime_state || {}}
        />
      ) : (
        <div className="p-6 text-center" style={{ color: '#9CA3AF' }}>
          <p>Fichier SCORM non disponible</p>
        </div>
      )}
    </div>
  );
}

function QcmBlock({ block, onAnswer }: { block: Block; onAnswer?: (id: string, a: any, correct: boolean) => void }) {
  const c = block.content_json || {};
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const options: unknown[] = Array.isArray(c.options) ? c.options : [];
  const configured = Number.isInteger(c.correctIndex) && c.correctIndex >= 0 && c.correctIndex < options.length;

  function submit() {
    if (selected === null || !configured) return;
    setRevealed(true);
    const correct = selected === c.correctIndex;
    onAnswer?.(block.id, selected, correct);
  }

  return (
    <div className="p-5 rounded-xl my-4 border-2" style={{ borderColor: '#002050' }}>
      <p className="font-semibold mb-4 text-sm" style={{ color: '#002050' }}>
        ❓ {c.question || ''}
      </p>
      {!configured && <p role="status" className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">Cet exercice est en cours de configuration. Il ne peut pas encore être noté.</p>}
      <div className="space-y-2 mb-4">
        {options.map((opt, i: number) => {
          const isSelected = selected === i;
          const isCorrect = revealed && i === c.correctIndex;
          const isWrong = revealed && isSelected && i !== c.correctIndex;
          return (
            <button key={i} onClick={() => !revealed && setSelected(i)} disabled={revealed}
              className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-sm"
              style={{
                borderColor: isCorrect ? '#1E7A52' : isWrong ? '#DC2626' : isSelected ? '#002050' : '#E4E7EC',
                background: isCorrect ? '#D1FAE5' : isWrong ? '#FEE2E2' : isSelected ? '#EEF2FF' : 'white',
                color: '#374151',
              }}>
              <span className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ borderColor: isCorrect ? '#1E7A52' : isWrong ? '#DC2626' : isSelected ? '#002050' : '#D1D5DB', background: (isCorrect || isWrong || isSelected) ? 'currentColor' : 'transparent' }}>
                {isCorrect ? <Check size={12} color="white" /> : isWrong ? <X size={12} color="white" /> : String.fromCharCode(65 + i)}
              </span>
              {opt}
            </button>
          );
        })}
      </div>
      {!revealed ? (
        <button onClick={submit} disabled={selected === null || !configured}
          className="px-5 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40"
          style={{ background: '#002050' }}>
          Valider ma réponse
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: selected === c.correctIndex ? '#D1FAE5' : '#FEE2E2' }}>
            {selected === c.correctIndex
              ? <><Check size={16} style={{ color: '#065F46' }} /><span className="font-bold text-sm" style={{ color: '#065F46' }}>Bonne réponse !</span></>
              : <><X size={16} style={{ color: '#DC2626' }} /><span className="font-bold text-sm" style={{ color: '#DC2626' }}>Mauvaise réponse</span></>}
          </div>
          {c.explanation && <p className="text-sm p-3 rounded-xl" style={{ background: '#F8F9FA', color: '#374151' }}>💡 {c.explanation}</p>}
          <button onClick={() => { setSelected(null); setRevealed(false); }}
            className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#6B7280' }}>
            <RotateCcw size={12} /> Réessayer
          </button>
        </div>
      )}
    </div>
  );
}

function TrueFalseBlock({ block, onAnswer }: { block: Block; onAnswer?: (id: string, a: any, correct: boolean) => void }) {
  const c = block.content_json || {};
  const [selected, setSelected] = useState<boolean | null>(null);
  const [revealed, setRevealed] = useState(false);

  function answer(val: boolean) {
    if (revealed) return;
    setSelected(val);
    setRevealed(true);
    onAnswer?.(block.id, val, val === c.answer);
  }

  return (
    <div className="p-5 rounded-xl my-4 border-2" style={{ borderColor: '#1E7A52' }}>
      <p className="font-semibold mb-4 text-sm" style={{ color: '#002050' }}>
        ✅ {c.statement || ''}
      </p>
      <div className="flex gap-3 mb-3">
        {[true, false].map(val => {
          const isSelected = selected === val;
          const isCorrect = revealed && val === c.answer;
          const isWrong = revealed && isSelected && val !== c.answer;
          return (
            <button key={String(val)} onClick={() => answer(val)} disabled={revealed}
              className="flex-1 py-3 rounded-xl font-bold text-sm transition-all border-2"
              style={{
                borderColor: isCorrect ? '#1E7A52' : isWrong ? '#DC2626' : isSelected ? '#002050' : '#E4E7EC',
                background: isCorrect ? '#D1FAE5' : isWrong ? '#FEE2E2' : isSelected ? '#EEF2FF' : 'white',
                color: isCorrect ? '#065F46' : isWrong ? '#DC2626' : '#374151',
              }}>
              {val ? 'Vrai ✓' : 'Faux ✗'}
            </button>
          );
        })}
      </div>
      {revealed && c.explanation && (
        <p className="text-sm p-3 rounded-xl" style={{ background: '#F8F9FA', color: '#374151' }}>
          💡 {c.explanation}
        </p>
      )}
    </div>
  );
}

function AccordionBlock({ items }: { items: Array<{ id: string; title: string; content: string }> }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className="my-4 space-y-2">
      {items.map(item => (
        <div key={item.id} className="rounded-xl overflow-hidden border" style={{ borderColor: '#E4E7EC' }}>
          <button className="w-full flex items-center justify-between px-5 py-3.5 text-left font-semibold text-sm"
            style={{ color: '#002050', background: openId === item.id ? '#EEF2FF' : 'white' }}
            aria-expanded={openId === item.id}
            onClick={() => setOpenId(openId === item.id ? null : item.id)}>
            {item.title}
            {openId === item.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {openId === item.id && (
            <div className="px-5 py-4 text-sm" style={{ color: '#374151', borderTop: '1px solid #E4E7EC' }}
              dangerouslySetInnerHTML={{ __html: richHtml(item.content || '') }} />
          )}
        </div>
      ))}
    </div>
  );
}

function FlashcardsBlock({ cards, onComplete }: { cards: Array<{ id: string; front: string; back: string }>; onComplete?: (score:number)=>void }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[idx];
  if (!card) return null;
  return (
    <div className="my-5">
      <div className="cursor-pointer mx-auto" style={{ maxWidth: '400px' }} onClick={() => setFlipped(f => !f)}>
        <div className="p-8 rounded-2xl text-center font-semibold text-lg shadow-md transition-all"
          style={{
            background: flipped ? '#002050' : 'white',
            color: flipped ? 'white' : '#002050',
            border: `2px solid #002050`,
            minHeight: '160px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          {flipped ? card.back : card.front}
        </div>
      </div>
      <p className="text-center text-xs mt-2 mb-4" style={{ color: '#9CA3AF' }}>
        {flipped ? '← Verso' : '→ Recto'} · Cliquez pour retourner
      </p>
      <div className="flex items-center justify-between max-w-sm mx-auto">
        <button onClick={() => { setIdx(i => Math.max(0, i - 1)); setFlipped(false); }}
          disabled={idx === 0} className="flex items-center gap-1 text-sm font-medium disabled:opacity-30" style={{ color: '#002050' }}>
          ← Précédente
        </button>
        <span className="text-xs" style={{ color: '#9CA3AF' }}>{idx + 1} / {cards.length}</span>
        <button onClick={() => { setIdx(i => Math.min(cards.length - 1, i + 1)); setFlipped(false); }}
          disabled={idx === cards.length - 1} className="flex items-center gap-1 text-sm font-medium disabled:opacity-30" style={{ color: '#002050' }}>
          Suivante →
        </button>
      </div>
      <div className="mt-4 flex justify-center gap-2"><button type="button" onClick={()=>onComplete?.(100)} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">Je maîtrise</button><button type="button" onClick={()=>onComplete?.(0)} className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">À revoir</button></div>
    </div>
  );
}

function InteractiveTableBlock({ headers, rows, style, training = false, trainingColumns = [], threshold = 80, graded = true, onResult }: { headers: string[]; rows: string[][]; style?: string; training?: boolean; trainingColumns?: number[]; threshold?: number; graded?: boolean; onResult?: (score:number, answer:any, passed:boolean)=>void }) {
  const [answers,setAnswers]=useState<Record<string,string>>({});
  const [score,setScore]=useState<number|null>(null);
  const targetColumns=(trainingColumns.length?trainingColumns:headers.map((_,i)=>i).filter(i=>i>0)).filter(i=>i>=0&&i<headers.length);
  const norm=(v:any)=>String(v??'').trim().toLocaleLowerCase().replace(/\s+/g,' ');
  const check=()=>{
    const targets:Array<{key:string;expected:string}>=[];
    rows.forEach((row,ri)=>targetColumns.forEach(ci=>{const expected=String(row?.[ci]??'').trim();if(expected)targets.push({key:`${ri}:${ci}`,expected})}));
    const correct=targets.filter(t=>norm(answers[t.key])===norm(t.expected)).length;
    const next=targets.length?Math.round(correct/targets.length*100):100;
    setScore(next);onResult?.(next,{answers,target_columns:targetColumns},next>=threshold);
  };
  if (style === 'cards' && !training) {
    return (
      <div className="my-4 grid gap-3 md:grid-cols-2">
        {rows.map((row, ri) => (
          <div key={ri} className="p-4 rounded-xl border" style={{ borderColor: '#E4E7EC' }}>
            {headers.map((h, ci) => (
              <div key={ci} className="mb-2">
                <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: '#9CA3AF' }}>{h}</p>
                <p className="text-sm" style={{ color: '#374151' }}>{row[ci] || ''}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="my-4">
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: '#E4E7EC' }}>
        <table className="w-full text-sm">
          {headers.length > 0 && <thead><tr style={{ background: '#F8F9FA', borderBottom: '2px solid #E4E7EC' }}>{headers.map((h,i)=><th key={i} className="px-4 py-3 text-left font-bold" style={{color:'#002050'}}>{h}</th>)}</tr></thead>}
          <tbody>{rows.map((row,ri)=><tr key={ri} style={{borderBottom:ri<rows.length-1?'1px solid #E4E7EC':'none',background:ri%2===0?'white':'#F9FAFB'}}>{headers.map((_,ci)=>{
            const key=`${ri}:${ci}`; const editable=training&&targetColumns.includes(ci)&&String(row?.[ci]??'').trim();
            return <td key={ci} className="px-4 py-3" style={{color:'#374151'}}>{editable?<input value={answers[key]||''} onChange={e=>{setAnswers(a=>({...a,[key]:e.target.value}));setScore(null)}} className="w-full rounded-lg border px-2 py-1.5 outline-none focus:ring-2" style={{borderColor:'#D1D5DB'}} placeholder="Votre réponse"/>:(row?.[ci]||'')}</td>;
          })}</tr>)}</tbody>
        </table>
      </div>
      {training&&<div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" onClick={check} className="rounded-lg bg-[#002050] px-3 py-2 text-xs font-semibold text-white">Vérifier le tableau</button>{score!==null&&(graded?<span className={`text-xs font-semibold ${score>=threshold?'text-emerald-700':'text-red-700'}`}>Note d’entraînement : {score}% · seuil {threshold}%</span>:<span className="text-xs font-semibold text-emerald-700">Tableau complété.</span>)}</div>}
    </div>
  );
}
class BlockRenderBoundary extends Component<{ children: ReactNode; blockType: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error('Learner block render error', this.props.blockType, error); }
  componentDidUpdate(prevProps: { blockType: string }) { if (prevProps.blockType !== this.props.blockType && this.state.failed) this.setState({ failed: false }); }
  render() {
    if (this.state.failed) return <div className="my-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p className="font-semibold">Ce contenu n’a pas pu être affiché.</p><p className="mt-1 text-xs">Le reste de la leçon reste accessible. Rechargez ce bloc ou signalez la ressource au créateur.</p></div>;
    return this.props.children;
  }
}

// ─── Export : Rendu d'une leçon complète ─────────────────────
export function LessonBlocksRenderer({ blocks, contentText, onQuizAnswer, onTrainingResult, onFileTrainingSubmit, learnerStateByBlock = {}, completedInteractionBlockIds = [], revealAllCorrections = false, onStateChange, isOnline = true, pedagogicalCurrency = null, pedagogicalLocale = 'fr-FR' }: {
  blocks: Block[];
  contentText?: string;
  onQuizAnswer?: (blockId: string, answer: any, correct: boolean) => void;
  onTrainingResult?: TrainingResultHandler;
  onFileTrainingSubmit?: (blockId: string, file: File, answer?: Record<string, any>) => Promise<boolean>;
  learnerStateByBlock?: Record<string, Record<string, any>>;
  completedInteractionBlockIds?: string[];
  revealAllCorrections?: boolean;
  onStateChange?: (blockId: string, state: Record<string, any>, completed: boolean) => void;
  isOnline?: boolean;
  pedagogicalCurrency?: string | null;
  pedagogicalLocale?: string;
}) {
  // Compatibilité ascendante : si pas de blocs, afficher content_text
  if (!blocks || blocks.length === 0) {
    if (contentText) {
      return (
        <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
          style={{ lineHeight: 1.65 }}
          dangerouslySetInnerHTML={{ __html: richHtml(contentText) }}
        />
      );
    }
    return <p className="text-sm text-gray-400 text-center py-8">Aucun contenu pour cette leçon.</p>;
  }

  return (
    <div>
      {(() => {
        const orderedBlocks=[...blocks].filter((block): block is Block => Boolean(block && block.id && block.block_type)).sort((a,b)=>(Number(a.position)||0)-(Number(b.position)||0));
        const completedSet=new Set(completedInteractionBlockIds.map(String));
        return orderedBlocks.map((block,index) => {
          if(block.block_type==='correction'&&!revealAllCorrections){
            const explicitTargets=Array.isArray(block.linked_block_ids)?block.linked_block_ids.map(String).filter(Boolean):[];
            if(explicitTargets.length){if(!explicitTargets.some(id=>completedSet.has(id)))return null;}
            else {
              let previous:Block|undefined;
              for(let i=index-1;i>=0;i--){if(orderedBlocks[i].block_type!=='correction'){previous=orderedBlocks[i];break;}}
              const requiresAttempt=Boolean(previous && (previous.interaction_mode==='training'||['qcm','true_false','open_question','exercise','assignment_upload','case_study','cloze','dictation','pronunciation','matching','sentence_order','oral_response','listening_comprehension','written_expression','interactive_table','checklist'].includes(previous.block_type)));
              if(requiresAttempt&&previous&&!completedSet.has(String(previous.id)))return null;
            }
          }
          const compactTypes = new Set(['image','gallery','video','audio','pdf','word','excel','table','interactive_table','chart','scorm','embed','download']);
          const widthClass = compactTypes.has(block.block_type) ? 'max-w-3xl' : 'max-w-5xl';
          const titleHandledTypes = new Set(['callout','important','objective','remember','example','definition','summary','correction','bullet_list','numbered_list','quote','interactive_table','image','video','audio','pdf','word','excel','download','scorm','embed','assignment_upload','exercise','case_study']);
          return (
            <div key={block.id} className={`mx-auto w-full ${widthClass}`}>
              {block.title && !titleHandledTypes.has(block.block_type) && <h4 className="mb-2 mt-4 text-base font-bold" style={{color:'#002050'}}>{block.title}</h4>}
              <BlockRenderBoundary key={`${block.id}:${block.block_type}`} blockType={block.block_type}><BlockRenderer block={block} onQuizAnswer={onQuizAnswer} onTrainingResult={block.interaction_mode === 'training' ? onTrainingResult : undefined} onFileTrainingSubmit={block.interaction_mode === 'training' ? onFileTrainingSubmit : undefined} learnerState={learnerStateByBlock[block.id] || {}} onStateChange={onStateChange} isOnline={isOnline} pedagogicalCurrency={pedagogicalCurrency} pedagogicalLocale={pedagogicalLocale} /></BlockRenderBoundary>
            </div>
          );
        });
      })()}
    </div>
  );
}
