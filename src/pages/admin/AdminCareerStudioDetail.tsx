import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Search } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

const META: Record<string, { title: string; subtitle: string }> = {
  cv: { title: 'CV créés par les apprenants', subtitle: 'Documents CV réels enregistrés dans Omnia Career Studio.' },
  lm: { title: 'Lettres de motivation créées', subtitle: 'Lettres de motivation réelles enregistrées par les apprenants.' },
  creators: { title: 'Créateurs Career Studio', subtitle: 'Apprenants ayant créé au moins un CV ou une lettre de motivation.' },
  'active-30d': { title: 'Utilisateurs actifs sur 30 jours', subtitle: 'Apprenants ayant modifié un document ou effectué une action Career durant les 30 derniers jours.' },
  exports: { title: 'Exports CV et LM', subtitle: 'Exports réellement enregistrés pour les apprenants.' },
  tokens: { title: 'Jetons consommés', subtitle: 'Mouvements de débit Career Studio, sans solde, moyen de paiement ni donnée financière sensible.' },
};

function messageFrom(value: unknown, fallback: string): string {
  if (value instanceof Error && value.message && value.message !== '[object Object]') return value.message;
  if (typeof value === 'string' && value.trim() && value.trim() !== '[object Object]') return value;
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    for (const key of ['message', 'error', 'details', 'hint']) {
      const nested = row[key];
      const text = messageFrom(nested, '');
      if (text) return text;
    }
  }
  return fallback;
}

function formatDate(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR');
}

export default function AdminCareerStudioDetail() {
  const { metric = 'cv' } = useParams();
  const meta = META[metric] || META.cv;
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/career-studio-admin-config`, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({ action: 'get_detail', metric }),
      });
      const text = await response.text();
      let payload: any = {};
      try { payload = text ? JSON.parse(text) : {}; }
      catch { payload = { message: text }; }
      if (!response.ok) throw new Error(messageFrom(payload, 'Impossible de charger le détail Career Studio.'));
      setRows(Array.isArray(payload.rows) ? payload.rows : []);
      setTotal(Number(payload.total || 0));
    } catch (caught) {
      setError(messageFrom(caught, 'Impossible de charger le détail Career Studio.'));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [metric]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return rows;
    return rows.filter((row) => Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(search)));
  }, [query, rows]);

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5" style={{ borderColor: BORDER }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em]" style={{ color: GOLD }}>Gestion Omnia Career Studio</p>
            <h1 className="mt-1 text-2xl font-bold" style={{ color: BLUE }}>{meta.title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-500">{meta.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/career-studio" className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}>
              <ArrowLeft size={15} /> Retour à la gestion Career
            </Link>
            <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualiser
            </button>
          </div>
        </header>

        <section className="flex flex-wrap items-center justify-between gap-4 border-y py-4" style={{ borderColor: BORDER }}>
          <p className="text-sm"><strong style={{ color: BLUE }}>{total}</strong> élément(s) réel(s)</p>
          <label className="relative w-full max-w-sm">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher…" className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm" style={{ borderColor: BORDER }} />
          </label>
        </section>

        <p className="text-xs text-gray-500">Seules les informations opérationnelles nécessaires sont affichées. Les mots de passe, moyens de paiement, soldes, pièces KYC et autres données sensibles ne sont jamais exposés ici.</p>

        {error && <div className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-500">Chargement…</div>
        ) : (
          <DetailTable metric={metric} rows={filtered} />
        )}
      </div>
    </AdminLayout>
  );
}

function DetailTable({ metric, rows }: { metric: string; rows: any[] }) {
  if (!rows.length) return <div className="border-y py-12 text-center text-sm text-gray-500" style={{ borderColor: BORDER }}>Aucune donnée correspondante.</div>;

  if (metric === 'cv' || metric === 'lm') {
    return <Table headers={['Apprenant', 'Document', 'Modèle', 'Statut', 'Création', 'Dernière modification']} rows={rows.map((row) => [row.user_name, row.document_title, row.template_key, row.status, formatDate(row.created_at), formatDate(row.updated_at)])} />;
  }
  if (metric === 'creators') {
    return <Table headers={['Apprenant', 'CV', 'LM', 'Total documents', 'Dernière activité']} rows={rows.map((row) => [row.user_name, row.cv_count, row.lm_count, row.total_documents, formatDate(row.last_activity)])} />;
  }
  if (metric === 'active-30d') {
    return <Table headers={['Apprenant', 'Documents actifs', 'Mouvements Career', 'Dernière activité']} rows={rows.map((row) => [row.user_name, row.documents_count, row.transactions_count, formatDate(row.last_activity)])} />;
  }
  if (metric === 'exports') {
    return <Table headers={['Apprenant', 'Type', 'Document', 'Jetons', 'Statut', 'Date']} rows={rows.map((row) => [row.user_name, String(row.doc_type || '').toUpperCase(), row.document_title, row.tokens_consumed ?? '—', row.status, formatDate(row.created_at)])} />;
  }
  return <Table headers={['Apprenant', 'Motif', 'Jetons consommés', 'Date']} rows={rows.map((row) => [row.user_name, row.reason, row.tokens, formatDate(row.created_at)])} />;
}

function Table({ headers, rows }: { headers: string[]; rows: unknown[][] }) {
  return (
    <div className="overflow-x-auto border-y" style={{ borderColor: BORDER }}>
      <table className="w-full min-w-[800px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-gray-500"><tr>{headers.map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index} className="border-t" style={{ borderColor: BORDER }}>{row.map((value, column) => <td key={column} className={column === 0 ? 'px-4 py-3 font-semibold' : 'px-4 py-3'} style={column === 0 ? { color: BLUE } : undefined}>{String(value ?? '—')}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
