import { FormEvent, useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function FormationsHeaderSearch({ initialValue }: { initialValue?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [value, setValue] = useState(initialValue ?? '');

  useEffect(() => {
    if (initialValue !== undefined) setValue(initialValue);
    else if (location.pathname === '/catalogue') setValue(new URLSearchParams(location.search).get('q') || '');
  }, [initialValue, location.pathname, location.search]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const query = value.trim();
    const current = new URLSearchParams(location.search);
    const next = new URLSearchParams();
    if (query) next.set('q', query);
    if (current.get('preview') === 'true') {
      next.set('preview', 'true');
      const role = current.get('role');
      if (role) next.set('role', role);
    }
    const qs = next.toString();
    navigate(qs ? `/catalogue?${qs}` : '/catalogue');
  }

  return (
    <form onSubmit={submit} className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm focus-within:border-[#BF8813] focus-within:ring-2 focus-within:ring-[#BF8813]/15">
      <Search size={16} className="shrink-0 text-slate-400" />
      <input
        value={value}
        onChange={event => setValue(event.target.value)}
        type="search"
        className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
        placeholder="Rechercher une formation, compétence..."
        aria-label="Rechercher dans les formations"
      />
      {value && <button type="button" onClick={() => setValue('')} className="rounded-full p-1 text-slate-400 hover:bg-slate-100" aria-label="Effacer la recherche"><X size={13} /></button>}
    </form>
  );
}
