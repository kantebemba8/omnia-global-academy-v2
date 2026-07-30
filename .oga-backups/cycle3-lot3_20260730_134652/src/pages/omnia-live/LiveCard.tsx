import { CalendarDays, Clock3, PlayCircle, Radio } from 'lucide-react';
import { LiveItem } from './liveApi';

const BLUE = '#002050';
const GOLD = '#BF8813';

function price(item: LiveItem) {
  if (!item.price_amount) return 'GRATUIT';
  try { return new Intl.NumberFormat('fr-FR').format(item.price_amount) + ` ${item.currency || 'XOF'}`; }
  catch { return `${item.price_amount} ${item.currency || 'XOF'}`; }
}

export default function LiveCard({ item }: { item: LiveItem }) {
  const d = item.starts_at ? new Date(item.starts_at) : null;
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[16/9] bg-slate-100">
        {item.cover_url ? <img src={item.cover_url} alt="" className="h-full w-full object-cover" /> : (
          <div className="flex h-full items-center justify-center" style={{ background: 'linear-gradient(135deg,#002050,#103d73)' }}>
            <PlayCircle size={54} className="text-white/90" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          <span className="rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold uppercase" style={{ color: BLUE }}>{item.event_type || 'Live'}</span>
          {item.status === 'live' && <span className="flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-[11px] font-bold text-white"><Radio size={12}/> EN DIRECT</span>}
        </div>
      </div>
      <div className="p-5">
        <h3 className="line-clamp-2 text-lg font-bold" style={{ color: BLUE }}>{item.title}</h3>
        {item.short_description && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.short_description}</p>}
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
          {d && <span className="flex items-center gap-1"><CalendarDays size={14}/>{d.toLocaleDateString()}</span>}
          {!!item.duration_minutes && <span className="flex items-center gap-1"><Clock3 size={14}/>{item.duration_minutes} min</span>}
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <strong style={{ color: item.price_amount ? BLUE : GOLD }}>{price(item)}</strong>
          <a href={`/omnia-live/${item.id}`} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}>Voir</a>
        </div>
      </div>
    </article>
  );
}
