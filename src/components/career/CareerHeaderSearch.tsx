import { FormEvent, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCareerNavigation } from '../../lib/careerNavigation';

function withPreview(path: string, search: string) {
  const current = new URLSearchParams(search);
  if (current.get('preview') !== 'true') return path;
  const [base, hash = ''] = path.split('#', 2);
  const [pathname, query = ''] = base.split('?', 2);
  const next = new URLSearchParams(query);
  next.set('preview', 'true');
  return `${pathname}?${next.toString()}${hash ? `#${hash}` : ''}`;
}

export default function CareerHeaderSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);

  const results = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    const groups = getCareerNavigation('apprenant');
    const entries = groups.flatMap(group => [
      { label: group.label, description: group.description, path: group.path },
      ...(group.children || []).map(child => ({ label: child.label, description: child.description, path: child.path })),
    ]);
    return entries.filter(item => `${item.label} ${item.description}`.toLowerCase().includes(q)).slice(0, 7);
  }, [value]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const first = results[0];
    if (first) {
      navigate(withPreview(first.path, location.search));
      setFocused(false);
      return;
    }
    const query = value.trim();
    if (query) navigate(`/forum/emploi?search=${encodeURIComponent(query)}`);
  }

  return (
    <form onSubmit={submit} className="relative w-full">
      <div className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm focus-within:border-[#3E63B8] focus-within:ring-2 focus-within:ring-[#3E63B8]/15">
        <Search size={16} className="shrink-0 text-slate-400" />
        <input
          value={value}
          onChange={event => setValue(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          type="search"
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          placeholder="Rechercher dans Career..."
          aria-label="Rechercher dans Omnia Career"
        />
        {value && <button type="button" onClick={() => setValue('')} className="rounded-full p-1 text-slate-400 hover:bg-slate-100" aria-label="Effacer la recherche"><X size={13} /></button>}
      </div>
      {focused && value.trim() && results.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[80] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
          {results.map(result => (
            <button key={`${result.path}-${result.label}`} type="button" onMouseDown={event => event.preventDefault()} onClick={() => { navigate(withPreview(result.path, location.search)); setFocused(false); }} className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50">
              <Search size={15} className="mt-0.5 shrink-0 text-[#3E63B8]" />
              <span className="min-w-0"><strong className="block truncate text-sm text-[#002050]">{result.label}</strong><span className="mt-0.5 block truncate text-xs text-slate-500">{result.description}</span></span>
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
