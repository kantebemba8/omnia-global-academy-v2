import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X, RotateCcw } from 'lucide-react';
import { AdaptiveFormationsLayout } from '../components/formations/FormationsRoleLayout';
import { CourseCard, type CourseCardData } from '../components/CourseCard';
import { CATEGORY_LABELS } from '../lib/categories';
import { ENDPOINTS } from '../lib/config';

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const PRICE_OPTIONS = [
  { value: 'tous',       label: 'Tous les prix' },
  { value: 'gratuit',    label: 'Gratuit' },
  { value: '0-5000',     label: '1 – 5 000 XOF' },
  { value: '5001-15000', label: '5 001 – 15 000 XOF' },
  { value: '15001-25000',label: '15 001 – 25 000 XOF' },
  { value: '25001+',     label: '25 001+ XOF' },
];

const DUREE_OPTIONS = [
  { value: 'toutes',  label: 'Toutes les durées' },
  { value: 'courte',  label: 'Courte (< 2h)' },
  { value: 'moyenne', label: 'Moyenne (2 – 5h)' },
  { value: 'longue',  label: 'Longue (> 5h)' },
];

const NIVEAUX = ['Débutant', 'Intermédiaire', 'Avancé', 'Expert'];

const CREATOR_TYPES = [
  { value: '',            label: 'Tous' },
  { value: 'professeur',  label: 'Formateur indépendant' },
  { value: 'etablissement', label: 'École / Établissement' },
  { value: 'plateforme',  label: 'Plateforme Omnia' },
  { value: 'external',    label: 'Formations externes' },
];

const TRI_OPTIONS = [
  { value: 'pertinence', label: 'Pertinence' },
  { value: 'note',       label: 'Mieux notés' },
  { value: 'prix_asc',   label: 'Prix croissant' },
  { value: 'prix_desc',  label: 'Prix décroissant' },
  { value: 'recence',    label: 'Plus récents' },
  { value: 'popularite', label: 'Plus populaires' },
];

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden animate-pulse" style={{ border: '1px solid #E4E7EC' }}>
      <div style={{ aspectRatio: '16/9', backgroundColor: '#F0F0F0' }} />
      <div className="p-4 space-y-2">
        <div className="h-3 rounded" style={{ backgroundColor: '#F0F0F0', width: '40%' }} />
        <div className="h-4 rounded" style={{ backgroundColor: '#F0F0F0', width: '90%' }} />
        <div className="h-4 rounded" style={{ backgroundColor: '#F0F0F0', width: '70%' }} />
        <div className="h-3 rounded" style={{ backgroundColor: '#F0F0F0', width: '55%' }} />
      </div>
      <div className="h-10 border-t" style={{ backgroundColor: '#F8F9FA' }} />
    </div>
  );
}

// ── FilterSection ──────────────────────────────────────────────────────────────
function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#002050' }}>{title}</p>
      {children}
    </div>
  );
}

// ── FilterSidebar ─────────────────────────────────────────────────────────────
interface FilterSidebarProps {
  params: URLSearchParams;
  update: (k: string, v: string | null) => void;
  reset: () => void;
}

function FilterSidebar({ params, update, reset }: FilterSidebarProps) {
  const get = (k: string) => params.get(k) ?? '';
  const noteMin = parseInt(get('note_min') || '0');

  return (
    <div className="p-5" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Categories */}
      <FilterSection title="Catégorie">
        <div className="flex flex-col gap-1">
          <button
            onClick={() => update('categorie', null)}
            className="text-left text-sm px-2 py-1.5 rounded-lg transition-colors"
            style={{
              backgroundColor: !get('categorie') ? 'rgba(0,32,80,0.08)' : 'transparent',
              color: !get('categorie') ? '#002050' : '#6B7280',
              fontWeight: !get('categorie') ? 600 : 400,
            }}
          >
            Toutes les catégories
          </button>
          {CATEGORY_LABELS.map(cat => (
            <button
              key={cat}
              onClick={() => update('categorie', get('categorie') === cat ? null : cat)}
              className="text-left text-sm px-2 py-1.5 rounded-lg transition-colors"
              style={{
                backgroundColor: get('categorie') === cat ? 'rgba(0,32,80,0.08)' : 'transparent',
                color: get('categorie') === cat ? '#002050' : '#6B7280',
                fontWeight: get('categorie') === cat ? 600 : 400,
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Level */}
      <FilterSection title="Niveau">
        <div className="flex flex-col gap-1">
          {NIVEAUX.map(n => (
            <label key={n} className="flex items-center gap-2 cursor-pointer py-1">
              <input
                type="checkbox"
                checked={get('niveau') === n}
                onChange={() => update('niveau', get('niveau') === n ? null : n)}
                className="rounded"
                style={{ accentColor: '#002050' }}
              />
              <span className="text-sm" style={{ color: '#374151' }}>{n}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Price */}
      <FilterSection title="Prix">
        <div className="flex flex-col gap-1">
          {PRICE_OPTIONS.map(opt => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer py-1">
              <input
                type="radio"
                name="prix"
                checked={get('prix') === opt.value || (!get('prix') && opt.value === 'tous')}
                onChange={() => update('prix', opt.value === 'tous' ? null : opt.value)}
                style={{ accentColor: '#002050' }}
              />
              <span className="text-sm" style={{ color: '#374151' }}>{opt.label}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Duration */}
      <FilterSection title="Durée">
        <div className="flex flex-col gap-1">
          {DUREE_OPTIONS.map(opt => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer py-1">
              <input
                type="radio"
                name="duree"
                checked={get('duree') === opt.value || (!get('duree') && opt.value === 'toutes')}
                onChange={() => update('duree', opt.value === 'toutes' ? null : opt.value)}
                style={{ accentColor: '#002050' }}
              />
              <span className="text-sm" style={{ color: '#374151' }}>{opt.label}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Min rating */}
      <FilterSection title="Note minimale">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(s => (
            <button
              key={s}
              onClick={() => update('note_min', noteMin === s ? null : String(s))}
              className="text-xl transition-colors"
              style={{ color: s <= noteMin ? '#BF8813' : '#E4E7EC' }}
            >
              ★
            </button>
          ))}
          {noteMin > 0 && <span className="text-xs ml-1 self-center" style={{ color: '#6B7280' }}>≥ {noteMin}★</span>}
        </div>
      </FilterSection>

      {/* Language */}
      <FilterSection title="Langue d'enseignement">
        {[{ v: 'fr', l: 'Français' }, { v: 'en', l: 'English' }].map(({ v, l }) => (
          <label key={v} className="flex items-center gap-2 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={get('langue') === v}
              onChange={() => update('langue', get('langue') === v ? null : v)}
              style={{ accentColor: '#002050' }}
            />
            <span className="text-sm" style={{ color: '#374151' }}>{l}</span>
          </label>
        ))}
      </FilterSection>

      {/* CPD toggle */}
      <FilterSection title="Certification et reconnaissance">
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            className="relative w-10 h-5 rounded-full transition-colors"
            style={{ backgroundColor: get('cpd_only') === 'true' ? '#002050' : '#E4E7EC' }}
            onClick={() => update('cpd_only', get('cpd_only') === 'true' ? null : 'true')}
          >
            <div
              className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
              style={{ transform: get('cpd_only') === 'true' ? 'translateX(22px)' : 'translateX(2px)' }}
            />
          </div>
          <span className="text-sm" style={{ color: '#374151' }}>Formations reconnues</span>
        </label>
      </FilterSection>

      {/* Creator type */}
      <FilterSection title="Type de créateur">
        <div className="flex flex-col gap-1">
          {CREATOR_TYPES.map(ct => (
            <label key={ct.value} className="flex items-center gap-2 cursor-pointer py-1">
              <input
                type="radio"
                name="creator_type"
                checked={get('creator_type') === ct.value}
                onChange={() => update('creator_type', ct.value || null)}
                style={{ accentColor: '#002050' }}
              />
              <span className="text-sm" style={{ color: '#374151' }}>{ct.label}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Toggles */}
      <FilterSection title="Options">
        {[
          { k: 'sous_titres', label: 'Sous-titres disponibles' },
          { k: 'groupe_license', label: 'Licence de groupe' },
        ].map(({ k, label }) => (
          <label key={k} className="flex items-center gap-3 cursor-pointer mb-3">
            <div
              className="relative w-10 h-5 rounded-full transition-colors"
              style={{ backgroundColor: get(k) === 'true' ? '#002050' : '#E4E7EC' }}
              onClick={() => update(k, get(k) === 'true' ? null : 'true')}
            >
              <div
                className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                style={{ transform: get(k) === 'true' ? 'translateX(22px)' : 'translateX(2px)' }}
              />
            </div>
            <span className="text-sm" style={{ color: '#374151' }}>{label}</span>
          </label>
        ))}
      </FilterSection>

      {/* Reset */}
      <button
        onClick={reset}
        className="flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-75"
        style={{ color: '#BF8813' }}
      >
        <RotateCcw size={14} />
        Réinitialiser les filtres
      </button>
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────
function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;

  const pages: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }

  const btn = (active: boolean) => ({
    minWidth: '36px', height: '36px', borderRadius: '8px', fontSize: '13px', fontWeight: active ? 700 : 400,
    backgroundColor: active ? '#002050' : '#F8F9FA',
    color: active ? '#FFFFFF' : '#374151',
    border: active ? 'none' : '1px solid #E4E7EC',
  } as React.CSSProperties);

  return (
    <div className="flex items-center justify-center gap-1.5 pt-8 flex-wrap">
      <button onClick={() => onPage(page - 1)} disabled={page === 1}
        className="px-3 h-9 rounded-lg text-sm font-medium disabled:opacity-40 transition-opacity hover:opacity-70"
        style={{ border: '1px solid #E4E7EC', color: '#374151' }}>
        ← Précédent
      </button>
      {pages.map((p, i) =>
        p === '…'
          ? <span key={`ell-${i}`} className="px-1 text-sm" style={{ color: '#9CA3AF' }}>…</span>
          : <button key={p} onClick={() => onPage(p as number)} style={btn(p === page)}>{p}</button>
      )}
      <button onClick={() => onPage(page + 1)} disabled={page === totalPages}
        className="px-3 h-9 rounded-lg text-sm font-medium disabled:opacity-40 transition-opacity hover:opacity-70"
        style={{ border: '1px solid #E4E7EC', color: '#374151' }}>
        Suivant →
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function Catalogue() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [courses, setCourses] = useState<CourseCardData[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);

  const updateFilter = useCallback((k: string, v: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (v) next.set(k, v); else next.delete(k);
      next.delete('page');
      return next;
    });
  }, [setSearchParams]);

  const resetFilters = useCallback(() => {
    const q = searchParams.get('q');
    setSearchParams(q ? new URLSearchParams({ q }) : new URLSearchParams());
  }, [searchParams, setSearchParams]);

  const setPage = (p: number) => updateFilter('page', String(p));

  useEffect(() => {
    setLoading(true);
    const url = new URL(ENDPOINTS.catalogueList);
    searchParams.forEach((v, k) => url.searchParams.set(k, v));

    fetch(url.toString(), { headers: { Authorization: `Bearer ${ANON_KEY}` } })
      .then(r => r.json())
      .then(d => {
        setCourses(d.courses ?? []);
        setTotal(d.total ?? 0);
        setTotalPages(d.total_pages ?? 0);
      })
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, [searchParams]);

  const currentPage = parseInt(searchParams.get('page') || '1');

  return (
    <AdaptiveFormationsLayout>
      <div style={{ fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#FFFFFF' }}>
        <section className="border-b border-slate-200 bg-[linear-gradient(135deg,#F5F8FB_0%,#FFFFFF_55%,#FFF9EC_100%)]">
          <div className="mx-auto max-w-7xl px-5 py-9 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div className="max-w-3xl">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#BF8813]">Catalogue Formations</p>
                <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#002050] sm:text-4xl">Explorer les parcours sans perdre le fil.</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">La recherche reste dans l’en-tête. Ici, les filtres servent uniquement à affiner le catalogue par objectif, niveau, durée, origine et prix.</p>
              </div>
              <button
                onClick={() => setFilterOpen(true)}
                className="lg:hidden inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-[#002050] shadow-sm"
              >
                <SlidersHorizontal size={15} /> Filtres
              </button>
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 flex gap-7 pt-7 pb-16">
        {/* Desktop filter sidebar */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky" style={{ top: '76px', maxHeight: 'calc(100vh - 96px)', overflowY: 'auto', border: '1px solid #E4E7EC', borderRadius: '16px', backgroundColor: '#F8FAFC' }}>
            <FilterSidebar params={searchParams} update={updateFilter} reset={resetFilters} />
          </div>
        </aside>

        {/* Mobile drawer overlay */}
        {filterOpen && (
          <>
            <div className="fixed inset-0 z-40 lg:hidden" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={() => setFilterOpen(false)} />
            <div className="fixed inset-y-0 left-0 z-50 w-80 lg:hidden overflow-y-auto" style={{ backgroundColor: '#FFFFFF', boxShadow: '4px 0 24px rgba(0,0,0,0.12)' }}>
              <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#E4E7EC' }}>
                <p className="font-bold text-sm" style={{ color: '#002050' }}>Filtres</p>
                <button onClick={() => setFilterOpen(false)}><X size={18} style={{ color: '#6B7280' }} /></button>
              </div>
              <FilterSidebar params={searchParams} update={updateFilter} reset={resetFilters} />
            </div>
          </>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Results bar */}
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <p className="font-bold text-sm" style={{ color: '#002050' }}>
              {loading ? 'Chargement...' : `${total.toLocaleString()} formation${total !== 1 ? 's' : ''} trouvée${total !== 1 ? 's' : ''}`}
            </p>
            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: '#6B7280' }}>Trier par</label>
              <select
                value={searchParams.get('tri') || 'pertinence'}
                onChange={e => updateFilter('tri', e.target.value)}
                className="text-sm rounded-lg px-3 py-1.5 outline-none"
                style={{ border: '1px solid #E4E7EC', color: '#374151' }}
              >
                {TRI_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-20">
              <Search size={44} className="mx-auto mb-4 text-slate-300" aria-hidden="true" />
              <p className="font-semibold mb-2" style={{ color: '#002050', fontSize: '16px' }}>
                Aucune formation ne correspond à vos critères.
              </p>
              <button onClick={resetFilters} className="mt-4 px-6 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: '#002050' }}>
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {courses.map(c => <CourseCard key={c.id} course={c} />)}
              </div>
              <Pagination page={currentPage} totalPages={totalPages} onPage={setPage} />
            </>
          )}
        </div>
      </div>

      </div>
    </AdaptiveFormationsLayout>
  );
}
