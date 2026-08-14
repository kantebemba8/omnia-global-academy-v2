import { useState } from 'react';
import {
  Star, Info, AlertTriangle, Lightbulb, BookOpen, CheckCircle,
  Download, Play, FileText, Table, Layers, ChevronDown, ChevronUp,
  RotateCcw, Check, X, WifiOff
} from 'lucide-react';

interface Block {
  id: string;
  block_type: string;
  position: number;
  title?: string;
  content_json: Record<string, any>;
  settings_json?: Record<string, any>;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  file_mime?: string;
}

interface BlockRendererProps {
  block: Block;
  onQuizAnswer?: (blockId: string, answer: any, correct: boolean) => void;
  isOnline?: boolean;
}

// ─── Utilitaire taille fichier ─────────────────────────────────
function fmtSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

// ══════════════════════════════════════════════════════════════
// BLOCK RENDERER PRINCIPAL
// ══════════════════════════════════════════════════════════════
export function BlockRenderer({ block, onQuizAnswer, isOnline = true }: BlockRendererProps) {
  const c = block.content_json;
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
        <div className="text-2xl font-bold mt-6 mb-3 leading-tight" style={{ color: '#002050' }} dangerouslySetInnerHTML={{ __html: c.html }} />
      ) : (
        <h2 className="text-2xl font-bold mt-6 mb-3 leading-tight" style={{ color: '#002050' }}>{c.text || ''}</h2>
      );

    case 'subheading':
      return c.html ? (
        <div className="text-lg font-semibold mt-5 mb-2" style={{ color: '#374151' }} dangerouslySetInnerHTML={{ __html: c.html }} />
      ) : (
        <h3 className="text-lg font-semibold mt-5 mb-2" style={{ color: '#374151' }}>{c.text || ''}</h3>
      );

    case 'text':
      return (
        <div className="prose prose-sm max-w-none my-3 text-gray-700 leading-relaxed"
          style={{ lineHeight: 1.75 }}
          dangerouslySetInnerHTML={{ __html: c.html || `<p>${c.text || ''}</p>` }}
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
            {c.title && <p className="font-bold text-sm mb-1" style={{ color: ct.color }}>{c.title}</p>}
            <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{c.content || ''}</p>
          </div>
        </div>
      );

    case 'important':
      return (
        <div className="flex gap-3 p-4 rounded-xl my-4" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <AlertTriangle size={18} style={{ color: '#DC2626', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p className="font-bold text-sm mb-1" style={{ color: '#DC2626' }}>Important</p>
            <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{c.content || ''}</p>
          </div>
        </div>
      );

    // ── PÉDAGOGIQUE ────────────────────────────────────────────
    case 'objective':
      return (
        <div className="flex gap-3 p-4 rounded-xl my-4" style={{ background: '#D1FAE5', border: '1px solid #6EE7B7' }}>
          <CheckCircle size={18} style={{ color: '#065F46', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p className="font-bold text-sm mb-1" style={{ color: '#065F46' }}>Objectif pédagogique</p>
            <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{c.text || ''}</p>
          </div>
        </div>
      );

    case 'remember':
      return (
        <div className="p-5 rounded-xl my-4" style={{ background: 'rgba(191,136,19,0.06)', border: '1px solid rgba(191,136,19,0.25)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Star size={16} style={{ color: '#BF8813' }} />
            <p className="font-bold" style={{ color: '#BF8813' }}>{c.title || 'À retenir'}</p>
          </div>
          <ul className="space-y-2">
            {(c.points || []).map((pt: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#374151' }}>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5" style={{ background: '#BF8813', color: 'white' }}>{i + 1}</span>
                {pt}
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
            <p className="font-bold" style={{ color: '#D97706' }}>{c.title || 'Exemple'}</p>
          </div>
          {c.situation && <p className="text-sm mb-2" style={{ color: '#374151' }}><strong>Situation :</strong> {c.situation}</p>}
          {c.explication && <p className="text-sm mb-2" style={{ color: '#374151' }}><strong>Explication :</strong> {c.explication}</p>}
          {c.conclusion && <p className="text-sm italic mt-2 pt-2" style={{ color: '#92400E', borderTop: '1px solid #FDE68A' }}>{c.conclusion}</p>}
        </div>
      );

    case 'definition':
      return (
        <div className="p-4 rounded-xl my-4" style={{ background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
          <p className="font-bold text-base mb-2" style={{ color: '#0369A1' }}>{c.term || ''}</p>
          <p className="text-sm mb-2" style={{ color: '#374151' }}>{c.definition || ''}</p>
          {c.example && <p className="text-xs italic" style={{ color: '#6B7280' }}>Exemple : {c.example}</p>}
        </div>
      );

    case 'summary':
      return (
        <div className="p-5 rounded-xl my-4" style={{ background: '#F5F3FF', border: '1px solid #DDD6FE' }}>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={16} style={{ color: '#7C3AED' }} />
            <p className="font-bold" style={{ color: '#7C3AED' }}>Résumé</p>
          </div>
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
      return (
        <div className="p-5 rounded-xl my-4 border" style={{ borderColor: '#E4E7EC' }}>
          <p className="font-bold mb-3" style={{ color: '#002050' }}>📋 Étude de cas</p>
          {c.context && <div className="mb-3"><p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#9CA3AF' }}>Contexte</p><p className="text-sm" style={{ color: '#374151' }}>{c.context}</p></div>}
          {c.data && <div className="mb-3"><p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#9CA3AF' }}>Données</p><p className="text-sm" style={{ color: '#374151' }}>{c.data}</p></div>}
          {c.task && <div className="p-3 rounded-lg" style={{ background: '#EFF6FF' }}><p className="text-xs font-bold mb-1" style={{ color: '#1D4ED8' }}>Travail demandé</p><p className="text-sm" style={{ color: '#374151' }}>{c.task}</p></div>}
        </div>
      );

    case 'correction':
      return (
        <div className="p-5 rounded-xl my-4" style={{ background: '#D1FAE5', border: '1px solid #6EE7B7' }}>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={16} style={{ color: '#065F46' }} />
            <p className="font-bold" style={{ color: '#065F46' }}>Correction</p>
          </div>
          <div className="text-sm" style={{ color: '#374151' }} dangerouslySetInnerHTML={{ __html: c.content || '' }} />
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
      return (
        <div className="p-5 rounded-xl my-4 border-2" style={{ borderColor: '#002050' }}>
          <p className="font-bold mb-3" style={{ color: '#002050' }}>✏️ Exercice{c.title ? ` : ${c.title}` : ''}</p>
          {c.instructions && <p className="text-sm mb-2" style={{ color: '#374151' }}><strong>Consigne :</strong> {c.instructions}</p>}
          {c.data && <p className="text-sm mb-2" style={{ color: '#374151' }}><strong>Données :</strong> {c.data}</p>}
          {c.task && <div className="p-3 rounded-lg mt-2" style={{ background: '#F8F9FA' }}><p className="text-sm font-semibold" style={{ color: '#002050' }}>{c.task}</p></div>}
        </div>
      );

    // ── MÉDIAS ─────────────────────────────────────────────────
    case 'image':
      if (!block.file_url && !c.url) return null;
      return (
        <figure className="my-5">
          <img
            src={block.file_url || c.url}
            alt={c.alt || c.caption || ''}
            loading="lazy"
            className="w-full rounded-xl object-cover"
            style={{ maxHeight: '400px' }}
          />
          {(c.caption || block.title) && (
            <figcaption className="text-xs text-center mt-2" style={{ color: '#9CA3AF' }}>
              {c.caption || block.title}
            </figcaption>
          )}
        </figure>
      );

    case 'video':
      if (!c.url && !block.file_url) return null;
      return <VideoBlock url={c.url || block.file_url || ''} eco={c.eco_data !== false} title={block.title} />;

    case 'audio':
      if (!c.url && !block.file_url) return null;
      return (
        <div className="my-4 p-4 rounded-xl" style={{ background: '#F5F3FF', border: '1px solid #DDD6FE' }}>
          {(block.title || c.description) && (
            <p className="text-sm font-semibold mb-2" style={{ color: '#7C3AED' }}>{block.title || c.description}</p>
          )}
          <audio controls className="w-full" style={{ accentColor: '#7C3AED' }}>
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
    case 'download':
      return <FileDownloadBlock block={block} />;

    case 'excel':
      return <ExcelBlock block={block} />;

    case 'scorm':
      return <ScormBlock block={block} />;

    // ── ÉVALUATION ─────────────────────────────────────────────
    case 'qcm':
      return <QcmBlock block={block} onAnswer={onQuizAnswer} />;

    case 'true_false':
      return <TrueFalseBlock block={block} onAnswer={onQuizAnswer} />;

    case 'open_question':
      return (
        <div className="p-5 rounded-xl my-4 border" style={{ borderColor: '#E4E7EC' }}>
          <p className="font-semibold mb-3" style={{ color: '#002050' }}>{c.question || ''}</p>
          {c.guidance && <p className="text-xs mb-2" style={{ color: '#6B7280' }}>{c.guidance}</p>}
          <textarea className="w-full px-3 py-2.5 border rounded-lg text-sm resize-none focus:outline-none"
            style={{ borderColor: '#E4E7EC' }} rows={4} placeholder="Votre réponse..." />
        </div>
      );

    // ── AVANCÉS ────────────────────────────────────────────────
    case 'accordion':
      return <AccordionBlock items={c.items || []} />;

    case 'flashcards':
      return <FlashcardsBlock cards={c.cards || []} />;

    case 'interactive_table':
      return <InteractiveTableBlock headers={c.headers || []} rows={c.rows || []} style={c.style} />;

    case 'timeline':
      return (
        <div className="my-5 relative">
          <div className="absolute left-5 top-0 bottom-0 w-0.5" style={{ background: '#E4E7EC' }} />
          <div className="space-y-4">
            {(c.steps || []).map((step: any, i: number) => (
              <div key={step.id || i} className="flex gap-4 relative">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 z-10"
                  style={{ background: '#002050', color: '#BF8813' }}>{i + 1}</div>
                <div className="flex-1 pb-4">
                  <p className="font-bold" style={{ color: '#002050' }}>{step.title}</p>
                  {step.description && <p className="text-sm mt-1" style={{ color: '#6B7280' }}>{step.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'columns':
      return (
        <div className="grid gap-4 my-4" style={{ gridTemplateColumns: `repeat(${(c.columns || []).length}, 1fr)` }}>
          {(c.columns || []).map((col: any, i: number) => (
            <div key={col.id || i} className="p-4 rounded-xl border" style={{ borderColor: '#E4E7EC' }}>
              <div className="text-sm" style={{ color: '#374151' }} dangerouslySetInnerHTML={{ __html: col.content || '' }} />
            </div>
          ))}
        </div>
      );


    case 'bullet_list':
      return <ul className="list-disc pl-6 space-y-1 text-sm text-gray-700">{(c.items || []).map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>;
    case 'numbered_list':
      return <ol className="list-decimal pl-6 space-y-1 text-sm text-gray-700">{(c.items || []).map((x: string, i: number) => <li key={i}>{x}</li>)}</ol>;
    case 'quote':
      return <blockquote className="border-l-4 pl-4 py-2 italic text-gray-700" style={{ borderColor: '#BF8813' }}><p>{c.text || ''}</p>{c.author && <footer className="mt-2 text-xs not-italic text-gray-500">— {c.author}</footer>}</blockquote>;
    case 'code':
      return <pre className="overflow-x-auto rounded-lg bg-gray-950 p-4 text-xs text-gray-100"><code>{c.code || ''}</code></pre>;
    case 'checklist':
      return <div className="space-y-2">{(c.items || []).map((x: any, i: number) => <label key={x.id || i} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!x.checked} readOnly /> <span>{x.text}</span></label>)}</div>;
    case 'link_button':
      return <a href={c.url || '#'} target={c.open_new_tab ? '_blank' : undefined} rel="noreferrer" className="inline-flex rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: '#002050' }}>{c.label || 'Ouvrir le lien'}</a>;
    case 'embed':
      return c.url ? <div className="overflow-hidden rounded-xl border"><iframe src={c.url} title={c.title || 'Contenu intégré'} className="h-80 w-full" loading="lazy" /></div> : <p className="text-sm text-gray-400">Aucun contenu intégré.</p>;
    case 'gallery':
      return <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{(c.images || []).map((img: any, i: number) => <figure key={i}><img src={img.url} alt={img.alt || ''} className="h-36 w-full rounded-lg object-cover" />{img.caption && <figcaption className="mt-1 text-xs text-gray-500">{img.caption}</figcaption>}</figure>)}</div>;
    case 'formula':
      return <div className="rounded-xl border bg-white p-4 text-center font-mono text-lg" style={{ borderColor: '#E4E7EC' }}>{c.latex || 'Formule non renseignée'}</div>;
    case 'chart':
      return <div className="space-y-2 rounded-xl border p-4" style={{ borderColor: '#E4E7EC' }}><p className="text-sm font-semibold">Graphique</p>{(c.labels || []).map((label: string, i: number) => <div key={i}><div className="mb-1 flex justify-between text-xs"><span>{label}</span><span>{Number(c.values?.[i] || 0)}</span></div><div className="h-2 rounded bg-gray-100"><div className="h-2 rounded" style={{ width: `${Math.min(100, Math.max(0, Number(c.values?.[i] || 0)))}%`, background: '#002050' }} /></div></div>)}</div>;
    case 'assignment_upload':
      return <div className="rounded-xl border border-dashed p-4"><p className="font-semibold" style={{ color: '#002050' }}>{c.title || 'Travail à remettre'}</p><p className="mt-1 text-sm text-gray-600">{c.instructions || ''}</p><p className="mt-2 text-xs text-gray-500">Formats : {(c.accepted_types || []).join(', ')} · maximum {c.max_size_mb || 10} Mo</p></div>;
    case 'rubric':
      return <div className="overflow-x-auto"><table className="w-full border-collapse text-sm"><thead><tr><th className="border p-2 text-left">Critère</th><th className="border p-2 text-left">Description</th><th className="border p-2 text-right">Points</th></tr></thead><tbody>{(c.criteria || []).map((x: any, i: number) => <tr key={i}><td className="border p-2">{x.name}</td><td className="border p-2">{x.description}</td><td className="border p-2 text-right">{x.points}</td></tr>)}</tbody></table></div>;

    default:
      return null;
  }
}

// ─── Sous-composants ──────────────────────────────────────────

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
        <video controls className="w-full" style={{ maxHeight: '400px' }}>
          <source src={url} />
        </video>
      )}
    </div>
  );
}

function FileDownloadBlock({ block }: { block: Block }) {
  const c = block.content_json;
  const url = block.file_url || c.url || '';
  if (!url) return null;

  const icons: Record<string, { icon: typeof FileText; color: string }> = {
    pdf:      { icon: FileText, color: '#DC2626' },
    word:     { icon: FileText, color: '#1D4ED8' },
    download: { icon: Download, color: '#374151' },
  };
  const cfg = icons[block.block_type] || icons.download;
  const Icon = cfg.icon;

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl my-4" style={{ background: '#F8F9FA', border: '1px solid #E4E7EC' }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${cfg.color}15` }}>
        <Icon size={22} style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate" style={{ color: '#002050' }}>{c.title || block.file_name || 'Document'}</p>
        {c.description && <p className="text-xs mt-0.5 truncate" style={{ color: '#6B7280' }}>{c.description}</p>}
        {block.file_size && <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{fmtSize(block.file_size)}</p>}
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer" download
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold flex-shrink-0"
        style={{ background: '#002050', color: 'white' }}>
        <Download size={14} /> Télécharger
      </a>
    </div>
  );
}

function ExcelBlock({ block }: { block: Block }) {
  const c = block.content_json;
  const headers: string[] = c.headers || [];
  const rows: string[][] = c.preview_rows || [];
  const url = block.file_url || c.url || '';

  return (
    <div className="my-4 rounded-xl overflow-hidden border" style={{ borderColor: '#E4E7EC' }}>
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: '#1E7A52' }}>
        <div className="flex items-center gap-2">
          <Table size={16} color="white" />
          <span className="font-semibold text-sm text-white">{c.title || block.file_name || 'Tableau Excel'}</span>
        </div>
        {url && (
          <a href={url} download className="flex items-center gap-1 text-xs text-white opacity-80 hover:opacity-100">
            <Download size={12} /> Télécharger
          </a>
        )}
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
  const c = block.content_json;
  const url = block.file_url || c.url || '';

  return (
    <div className="my-4 rounded-xl overflow-hidden border" style={{ borderColor: '#E4E7EC' }}>
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: '#78350F' }}>
        <Layers size={16} color="white" />
        <span className="font-semibold text-sm text-white">{c.title || 'Module SCORM'}</span>
        {c.duration_min && <span className="ml-auto text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>~{c.duration_min} min</span>}
      </div>
      {!launched ? (
        <div className="p-8 text-center" style={{ background: '#FFF7ED' }}>
          <Layers size={36} className="mx-auto mb-3" style={{ color: '#92400E' }} />
          <p className="font-semibold mb-1" style={{ color: '#78350F' }}>Module interactif SCORM</p>
          {c.description && <p className="text-sm mb-4" style={{ color: '#6B7280' }}>{c.description}</p>}
          <button onClick={() => setLaunched(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white mx-auto"
            style={{ background: '#78350F' }}>
            <Play size={15} /> Lancer le module
          </button>
          <p className="text-xs mt-3" style={{ color: '#9CA3AF' }}>Le module ne se charge que sur demande</p>
        </div>
      ) : url ? (
        <iframe src={url} className="w-full" style={{ height: '600px', border: 'none' }} title={c.title || 'SCORM'} />
      ) : (
        <div className="p-6 text-center" style={{ color: '#9CA3AF' }}>
          <p>Fichier SCORM non disponible</p>
        </div>
      )}
    </div>
  );
}

function QcmBlock({ block, onAnswer }: { block: Block; onAnswer?: (id: string, a: any, correct: boolean) => void }) {
  const c = block.content_json;
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  function submit() {
    if (selected === null) return;
    setRevealed(true);
    const correct = selected === c.correctIndex;
    onAnswer?.(block.id, selected, correct);
  }

  return (
    <div className="p-5 rounded-xl my-4 border-2" style={{ borderColor: '#002050' }}>
      <p className="font-semibold mb-4 text-sm" style={{ color: '#002050' }}>
        ❓ {c.question || ''}
      </p>
      <div className="space-y-2 mb-4">
        {(c.options || []).map((opt: string, i: number) => {
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
        <button onClick={submit} disabled={selected === null}
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
  const c = block.content_json;
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
            onClick={() => setOpenId(openId === item.id ? null : item.id)}>
            {item.title}
            {openId === item.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {openId === item.id && (
            <div className="px-5 py-4 text-sm" style={{ color: '#374151', borderTop: '1px solid #E4E7EC' }}
              dangerouslySetInnerHTML={{ __html: item.content || '' }} />
          )}
        </div>
      ))}
    </div>
  );
}

function FlashcardsBlock({ cards }: { cards: Array<{ id: string; front: string; back: string }> }) {
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
    </div>
  );
}

function InteractiveTableBlock({ headers, rows, style }: { headers: string[]; rows: string[][]; style?: string }) {
  if (style === 'cards') {
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
    <div className="my-4 overflow-x-auto rounded-xl border" style={{ borderColor: '#E4E7EC' }}>
      <table className="w-full text-sm">
        {headers.length > 0 && (
          <thead>
            <tr style={{ background: '#F8F9FA', borderBottom: '2px solid #E4E7EC' }}>
              {headers.map((h, i) => (
                <th key={i} className="px-4 py-3 text-left font-bold" style={{ color: '#002050' }}>{h}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: ri < rows.length - 1 ? '1px solid #E4E7EC' : 'none', background: ri % 2 === 0 ? 'white' : '#F9FAFB' }}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-4 py-3" style={{ color: '#374151' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Export : Rendu d'une leçon complète ─────────────────────
export function LessonBlocksRenderer({ blocks, contentText, onQuizAnswer, isOnline = true }: {
  blocks: Block[];
  contentText?: string;
  onQuizAnswer?: (blockId: string, answer: any, correct: boolean) => void;
  isOnline?: boolean;
}) {
  // Compatibilité ascendante : si pas de blocs, afficher content_text
  if (!blocks || blocks.length === 0) {
    if (contentText) {
      return (
        <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
          style={{ lineHeight: 1.75 }}
          dangerouslySetInnerHTML={{ __html: contentText.startsWith('<') ? contentText : `<p>${contentText}</p>` }}
        />
      );
    }
    return <p className="text-sm text-gray-400 text-center py-8">Aucun contenu pour cette leçon.</p>;
  }

  return (
    <div>
      {blocks
        .sort((a, b) => a.position - b.position)
        .map(block => (
          <BlockRenderer key={block.id} block={block} onQuizAnswer={onQuizAnswer} isOnline={isOnline} />
        ))}
    </div>
  );
}
