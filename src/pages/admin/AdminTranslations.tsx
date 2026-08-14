import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Languages,
  RefreshCw,
  Save,
  Search,
  Sparkles,
} from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { PLATFORM_LANGUAGES, type PlatformLanguage } from '../../i18n/LanguageContext';
import {
  generateTranslationBatch,
  getTranslationOverview,
  listTranslations,
  saveTranslation,
  type TranslationOverview,
  type TranslationRow,
} from '../../lib/i18nApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
type TargetLanguage = Exclude<PlatformLanguage, 'fr'>;
type FilterStatus = 'all' | 'missing' | 'reviewed' | 'automatic';

const PAGE_SIZE = 30;
const TARGET_LANGUAGES = PLATFORM_LANGUAGES.filter(item => item.code !== 'fr') as Array<(typeof PLATFORM_LANGUAGES)[number] & { code: TargetLanguage }>;

export default function AdminTranslations() {
  const [overview, setOverview] = useState<TranslationOverview | null>(null);
  const [language, setLanguage] = useState<TargetLanguage>('en');
  const [status, setStatus] = useState<FilterStatus>('missing');
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [rows, setRows] = useState<TranslationRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadOverview = useCallback(async () => {
    const result = await getTranslationOverview();
    setOverview(result.overview);
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listTranslations({ language, status, query: submittedQuery, page, page_size: PAGE_SIZE });
      setRows(result.rows || []);
      setTotal(result.total || 0);
      setDrafts(Object.fromEntries((result.rows || []).map(row => [row.source_hash, row.translation || ''])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible de charger les traductions.');
    } finally {
      setLoading(false);
    }
  }, [language, page, status, submittedQuery]);

  useEffect(() => {
    void Promise.all([loadOverview(), loadRows()]).catch(caught => {
      setError(caught instanceof Error ? caught.message : 'Impossible de charger les traductions.');
      setLoading(false);
    });
  }, [loadOverview, loadRows]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeCoverage = overview?.languages?.[language];
  const missingCount = overview ? Math.max(0, overview.total - (activeCoverage?.translated || 0)) : 0;
  const languageLabel = TARGET_LANGUAGES.find(item => item.code === language)?.label || language;

  const cards = useMemo(() => [
    { label: 'Chaînes source', value: overview?.total ?? '—' },
    { label: `Traduites · ${languageLabel}`, value: activeCoverage?.translated ?? '—' },
    { label: 'Révisées', value: activeCoverage?.reviewed ?? '—' },
    { label: 'Traductions manquantes', value: overview ? missingCount : '—' },
  ], [activeCoverage?.reviewed, activeCoverage?.translated, languageLabel, missingCount, overview]);

  async function refreshAll() {
    setMessage('');
    setError('');
    setBusy('refresh');
    try {
      await Promise.all([loadOverview(), loadRows()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible de charger les traductions.');
    } finally {
      setBusy('');
    }
  }

  async function generateMissing() {
    setMessage('');
    setError('');
    setBusy('generate');
    try {
      const result = await generateTranslationBatch({ language, limit: 25 });
      setMessage(`${result.generated} traduction(s) générée(s). ${result.remaining} restante(s).`);
      await Promise.all([loadOverview(), loadRows()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'La traduction automatique est indisponible.');
    } finally {
      setBusy('');
    }
  }

  async function saveRow(row: TranslationRow) {
    const value = (drafts[row.source_hash] || '').trim();
    if (!value) {
      setError('La traduction ne peut pas être vide.');
      return;
    }
    setBusy(row.source_hash);
    setError('');
    setMessage('');
    try {
      await saveTranslation({ source_hash: row.source_hash, language, translation: value });
      setMessage('Traduction enregistrée et publiée.');
      await Promise.all([loadOverview(), loadRows()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible d’enregistrer la traduction.');
    } finally {
      setBusy('');
    }
  }

  return (
    <AdminLayout>
      <main className="mx-auto max-w-7xl p-5 md:p-7">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.16em]" style={{ color: GOLD }}>Internationalisation</p>
            <h1 className="mt-1 text-2xl font-extrabold" style={{ color: BLUE }}>Traductions de l’interface</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Contrôlez les traductions automatiques, corrigez les libellés et suivez la couverture de chaque langue.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void refreshAll()} disabled={busy === 'refresh'} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">
              <RefreshCw size={16} className={busy === 'refresh' ? 'animate-spin' : ''} /> Actualiser les traductions
            </button>
            <button type="button" onClick={() => void generateMissing()} disabled={busy === 'generate' || !overview?.ai_enabled || missingCount === 0} className="inline-flex items-center gap-2 rounded-xl bg-[#002050] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
              <Sparkles size={16} /> {busy === 'generate' ? 'Traduction en cours…' : 'Générer les suivantes'}
            </button>
          </div>
        </header>

        {!overview?.ai_enabled && !loading && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle size={19} className="mt-0.5 flex-none" />
            <p>La traduction automatique utilise ANTHROPIC_API_KEY en priorité ou OPENAI_API_KEY en secours. CLAUDE_API_KEY reste accepté uniquement comme compatibilité temporaire. La révision manuelle reste disponible.</p>
          </div>
        )}
        {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {message && <div className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={18} />{message}</div>}

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(card => (
            <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">{card.label}</p>
              <p className="mt-1 text-2xl font-extrabold" style={{ color: BLUE }}>{card.value}</p>
            </article>
          ))}
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[220px_190px_minmax(0,1fr)_auto]">
            <label className="text-sm font-semibold text-[#002050]">Langue
              <select value={language} onChange={event => { setLanguage(event.target.value as TargetLanguage); setPage(1); }} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                {TARGET_LANGUAGES.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-[#002050]">Statut
              <select value={status} onChange={event => { setStatus(event.target.value as FilterStatus); setPage(1); }} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                <option value="all">Toutes</option>
                <option value="missing">Non traduites</option>
                <option value="automatic">Automatiques</option>
                <option value="reviewed">Révisées</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-[#002050]">Rechercher un texte
              <div className="relative mt-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { setSubmittedQuery(query.trim()); setPage(1); } }} className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm" placeholder="Source française ou traduction..." />
              </div>
            </label>
            <button type="button" onClick={() => { setSubmittedQuery(query.trim()); setPage(1); }} className="mt-auto rounded-xl border border-[#002050]/15 px-4 py-2.5 text-sm font-bold text-[#002050]">Rechercher</button>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">Chargement des traductions…</div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center"><Languages className="mx-auto text-slate-300" size={36} /><p className="mt-3 font-bold text-[#002050]">Aucune chaîne trouvée</p></div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map(row => (
                <article key={row.source_hash} className="grid gap-4 p-5 lg:grid-cols-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">Source française</span>
                      {row.reviewed ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">Révisée</span> : row.machine_generated ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">Automatique</span> : <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700">Non traduite</span>}
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700" data-no-auto-translate="true">{row.source_text}</p>
                    <p className="mt-2 text-xs text-slate-400">Utilisations : {row.hit_count || 0}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[#002050]">Traduction · {languageLabel}
                      <textarea rows={4} value={drafts[row.source_hash] || ''} onChange={event => setDrafts(value => ({ ...value, [row.source_hash]: event.target.value }))} dir={TARGET_LANGUAGES.find(item => item.code === language)?.direction} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm leading-6 outline-none focus:border-[#BF8813] focus:ring-2 focus:ring-[#BF8813]/15" />
                    </label>
                    <div className="mt-3 flex justify-end">
                      <button type="button" disabled={busy === row.source_hash} onClick={() => void saveRow(row)} className="inline-flex items-center gap-2 rounded-xl bg-[#002050] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save size={15} /> Enregistrer la traduction</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">Page {page} sur {pageCount} · Total {total}</p>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"><ChevronLeft size={14} /> Page précédente</button>
              <button type="button" disabled={page >= pageCount} onClick={() => setPage(value => Math.min(pageCount, value + 1))} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40">Page suivante <ChevronRight size={14} /></button>
            </div>
          </footer>
        </section>
      </main>
    </AdminLayout>
  );
}
