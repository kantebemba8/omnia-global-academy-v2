import { FormEvent, useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

function destinationFor(pathname: string) {
  if (pathname === '/forum/general') return '/forum/general';
  if (pathname === '/forum/formations') return '/forum/formations';
  if (pathname.startsWith('/forum/cours/')) return pathname;
  if (pathname === '/moderator/forum' || pathname === '/moderateur/forum') return pathname;
  return '/forum';
}

export default function CommunityHeaderSearch() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const current = params.get('search') || '';
  const [value, setValue] = useState(current);

  useEffect(() => setValue(current), [current, location.pathname]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const target = destinationFor(location.pathname);
    const next = new URLSearchParams();
    const q = value.trim();
    if (q) next.set('search', q);
    if (params.get('preview') === 'true') {
      next.set('preview', 'true');
      const role = params.get('role');
      if (role) next.set('role', role);
    }
    navigate(`${target}${next.toString() ? `?${next.toString()}` : ''}`);
  }

  return (
    <form onSubmit={submit} className="relative flex w-full items-center rounded-xl border border-[#D9E6E3] bg-white px-3 shadow-[0_4px_18px_rgba(15,118,110,.05)]">
      <Search size={17} className="shrink-0 text-[#0F766E]" />
      <input
        value={value}
        onChange={event => setValue(event.target.value)}
        aria-label="Rechercher dans Omnia Communauté"
        placeholder="Rechercher une discussion ou une formation..."
        className="h-10 min-w-0 flex-1 border-0 bg-transparent px-2 text-sm text-[#002050] outline-none placeholder:text-slate-400"
      />
      {value && (
        <button type="button" onClick={() => setValue('')} className="rounded-full p-1 text-slate-400 hover:bg-slate-100" aria-label="Effacer la recherche">
          <X size={14} />
        </button>
      )}
    </form>
  );
}
