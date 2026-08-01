import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import LiveCard from './LiveCard';
import type { LiveItem } from './liveApi';

const BLUE = '#002050';
const GOLD = '#BF8813';

export default function LiveRail({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle?: string;
  items: LiveItem[];
}) {
  const railRef = useRef<HTMLDivElement>(null);

  if (!items.length) return null;

  const move = (direction: -1 | 1) => {
    railRef.current?.scrollBy({
      left: direction * Math.max(280, Math.round((railRef.current?.clientWidth || 900) * 0.82)),
      behavior: 'smooth',
    });
  };

  return (
    <section aria-label={title}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.14em]" style={{ color: GOLD }}>Omnia Live</p>
          <h2 className="mt-1 text-2xl font-black" style={{ color: BLUE }}>{title}</h2>
          {subtitle && <p className="mt-1 max-w-3xl text-sm text-slate-600">{subtitle}</p>}
        </div>
        <div className="hidden gap-2 sm:flex">
          <button
            type="button"
            onClick={() => move(-1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm hover:border-amber-300"
            aria-label={`Faire défiler ${title} vers la gauche`}
          >
            <ChevronLeft size={18} style={{ color: BLUE }} />
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm hover:border-amber-300"
            aria-label={`Faire défiler ${title} vers la droite`}
          >
            <ChevronRight size={18} style={{ color: BLUE }} />
          </button>
        </div>
      </div>

      <div
        ref={railRef}
        className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 [scrollbar-width:thin] md:-mx-2 md:px-2"
      >
        {items.map(item => (
          <div
            key={item.id}
            className="w-[84vw] max-w-[380px] flex-none snap-start sm:w-[360px]"
          >
            <LiveCard item={item} />
          </div>
        ))}
      </div>
    </section>
  );
}
