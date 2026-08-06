import { useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BLUE = '#002050';
const GOLD = '#BF8813';

export type ContextualHeaderSearchItem = {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  path?: string;
  onSelect?: () => void;
};

type Props = {
  items: ContextualHeaderSearchItem[];
  placeholder: string;
  ariaLabel?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  maxResults?: number;
};

function normalized(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function ContextualHeaderSearch({
  items,
  placeholder,
  ariaLabel,
  value,
  onChange,
  onSubmit,
  maxResults = 8,
}: Props) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLFormElement>(null);
  const [internalValue, setInternalValue] = useState('');
  const [focused, setFocused] = useState(false);
  const query = value ?? internalValue;

  const results = useMemo(() => {
    const needle = normalized(query);
    if (!needle) return [];
    return items
      .filter(item => normalized([item.label, item.description, ...(item.keywords || [])].filter(Boolean).join(' ')).includes(needle))
      .slice(0, maxResults);
  }, [items, maxResults, query]);

  function setQuery(next: string) {
    if (onChange) onChange(next);
    else setInternalValue(next);
  }

  function select(item: ContextualHeaderSearchItem) {
    item.onSelect?.();
    if (item.path) navigate(item.path);
    setFocused(false);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const clean = query.trim();
    if (onSubmit) {
      onSubmit(clean);
      setFocused(false);
      return;
    }
    if (results[0]) select(results[0]);
  }

  return (
    <form
      ref={rootRef}
      onSubmit={submit}
      className="relative w-full max-w-[460px]"
      role="search"
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className="flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 shadow-sm focus-within:border-[#BF8813] focus-within:ring-2 focus-within:ring-[#BF8813]/15">
        <Search size={16} className="flex-none text-slate-400" />
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          placeholder={placeholder}
          aria-label={ariaLabel || placeholder}
          className="min-w-0 flex-1 border-0 bg-transparent px-2 text-sm text-slate-700 outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Effacer la recherche"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {focused && query.trim() && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[80] max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
          {results.length ? results.map(item => (
            <button
              key={item.id}
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => select(item)}
              className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813]"
            >
              <Search size={15} className="mt-0.5 flex-none" style={{ color: GOLD }} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold" style={{ color: BLUE }}>{item.label}</span>
                {item.description && <span className="mt-0.5 block truncate text-xs text-slate-500">{item.description}</span>}
              </span>
            </button>
          )) : (
            <p className="px-3 py-4 text-sm text-slate-500">Aucun résultat dans cet espace.</p>
          )}
        </div>
      )}
    </form>
  );
}
