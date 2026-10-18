import { useEffect, useMemo, useState } from 'react';
import { StructureLayout } from '../../components/StructureLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { Award, BarChart3, CheckCircle2, Clock3, Download, FileText, GraduationCap, RefreshCw, Search, ShieldCheck, Users } from 'lucide-react';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/structure-manage`;

type Filters = { department_id: string; group_id: string; cohort_id: string; search: string };

export default function StructureRHConformite() {
  const [structureId, setStructureId] = useState('');
  const [data, setData] = useState<any>({ indicators: {}, members: [], departments: [], groups: [], cohorts: [], skills: [] });
  const [filters, setFilters] = useState<Filters>({ department_id: '', group_id: '', cohort_id: '', search: '' });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  async function call(action: string, payload: Record<string, unknown> = {}) {
    const response = await fetch(API, {
      method: 'POST',
      headers: edgeAuthHeaders(),
      body: JSON.stringify({ action, structure_id: structureId, ...payload }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.success) throw new Error(body.message || body.error || 'Action impossible');
    return body;
  }

  async function load(id = structureId) {
    if (!id) return;
    setLoading(true);
    try { setData(await call('gm3_rh_dashboard', { structure_id: id })); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Chargement impossible'); }
    finally { setLoading(false); }
  }

  useEffect(() => { (async () => {
    try {
      const response = await fetch(API, { method: 'POST', headers: edgeAuthHeaders(), body: JSON.stringify({ action: 'get_my_structure' }) });
      const body = await response.json();
      if (!body.success) throw new Error(body.message || body.error || 'Structure introuvable');
      setStructureId(body.structure.id);
      const dashboard = await fetch(API, { method: 'POST', headers: edgeAuthHeaders(), body: JSON.stringify({ action: 'gm3_rh_dashboard', structure_id: body.structure.id }) }).then(r => r.json());
      if (!dashboard.success) throw new Error(dashboard.message || dashboard.error || 'Chargement impossible');
      setData(dashboard);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Chargement impossible'); }
    finally { setLoading(false); }
  })(); }, []);

  const members = useMemo(() => (data.members || []).filter((member: any) => {
    const text = `${member.full_name || ''} ${member.email || ''} ${member.job_title || ''}`.toLowerCase();
    return (!filters.search || text.includes(filters.search.toLowerCase()))
      && (!filters.department_id || member.department_id === filters.department_id)
      && (!filters.group_id || member.group_id === filters.group_id)
      && (!filters.cohort_id || (member.cohort_ids || []).includes(filters.cohort_id));
  }), [data.members, filters]);

  function exportCsv() {
    const rows = members.map((m: any) => [m.full_name, m.email, m.department_name, m.group_name, `${m.progress_percent}%`, m.average_score, m.training_hours, m.cpd_hours, m.certificates, m.badges, `${m.compliance_percent}%`, m.overdue_assignments]);
    const header = ['Nom','E-mail','Département','Groupe','Progression','Score moyen','Heures reconnues','Heures reconnues','Certificats','Badges','Conformité','Retards'];
    const csv = [header, ...rows].map(row => row.map((value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `rapport-rh-structure-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  function exportPdf() { window.print(); }

  const cards = [
    ['Membres suivis', data.indicators?.members || 0, Users],
    ['Progression moyenne', `${data.indicators?.average_progress || 0}%`, BarChart3],
    ['Score moyen', `${data.indicators?.average_score || 0}%`, GraduationCap],
    ['Heures reconnues', data.indicators?.training_hours || 0, Clock3],
    ['Heures reconnues', data.indicators?.cpd_hours || 0, Award],
    ['Conformité', `${data.indicators?.compliance_percent || 0}%`, ShieldCheck],
    ['Certificats valides', data.indicators?.certificates || 0, FileText],
    ['Retards', data.indicators?.overdue || 0, CheckCircle2],
  ];

  return <StructureLayout>
    <div className="mx-auto max-w-7xl space-y-6 p-6 print:p-0">
      {message && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>}
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div><h1 className="text-2xl font-black" style={{ color: '#002050' }}>Suivi RH, conformité et rapports</h1><p className="mt-1 text-sm text-gray-500">Progression, évaluations, compétences, reconnaissances, certificats et obligations de formation.</p></div>
        <div className="flex gap-2"><button onClick={() => load()} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold"><RefreshCw size={15}/>Actualiser</button><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold"><Download size={15}/>Exporter pour Excel</button><button onClick={exportPdf} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: '#002050' }}><FileText size={15}/>Rapport PDF</button></div>
      </div>

      <div className="hidden print:block"><h1 className="text-2xl font-bold">Rapport RH et conformité</h1><p className="text-sm">Édité le {new Date().toLocaleDateString('fr-FR')}</p></div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label,value,Icon]: any) => <div key={label} className="rounded-2xl border bg-white p-4"><Icon size={19} style={{ color: '#BF8813' }}/><div className="mt-3 text-2xl font-black" style={{ color: '#002050' }}>{value}</div><div className="text-xs text-gray-500">{label}</div></div>)}</div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 lg:col-span-2"><h2 className="font-black" style={{ color: '#002050' }}>Cartographie des compétences</h2><p className="mb-4 text-sm text-gray-500">Compétences vérifiées issues des badges et du dossier d’apprentissage.</p><div className="space-y-3">{(data.skills || []).slice(0,12).map((skill: any) => <div key={skill.name}><div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{skill.name}</span><span>{skill.members} membre(s)</span></div><div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full" style={{ width: `${Math.min(100, skill.coverage_percent)}%`, background: '#BF8813' }}/></div></div>)}{!(data.skills || []).length && <p className="text-sm text-gray-500">Aucune compétence vérifiée disponible pour le moment.</p>}</div></div>
        <div className="rounded-2xl border bg-white p-5"><h2 className="font-black" style={{ color: '#002050' }}>Conformité</h2><div className="mt-4 space-y-4">{[['À jour', data.indicators?.compliant || 0], ['En cours', data.indicators?.in_progress || 0], ['En retard', data.indicators?.overdue || 0], ['Certificats expirés', data.indicators?.expired_certificates || 0]].map(([label,value]) => <div key={label as string} className="flex items-center justify-between border-b pb-3 text-sm"><span>{label}</span><strong>{value}</strong></div>)}</div></div>
      </div>

      <div className="rounded-2xl border bg-white p-5 print:border-0 print:p-0">
        <div className="mb-4 flex flex-wrap gap-3 print:hidden"><div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-2.5 text-gray-400" size={17}/><input value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} placeholder="Rechercher un membre" className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm"/></div><select value={filters.department_id} onChange={e => setFilters({ ...filters, department_id: e.target.value })} className="rounded-xl border px-3 py-2 text-sm"><option value="">Tous les départements</option>{(data.departments || []).map((d:any)=><option key={d.id} value={d.id}>{d.name}</option>)}</select><select value={filters.group_id} onChange={e => setFilters({ ...filters, group_id: e.target.value })} className="rounded-xl border px-3 py-2 text-sm"><option value="">Tous les groupes</option>{(data.groups || []).map((g:any)=><option key={g.id} value={g.id}>{g.name}</option>)}</select><select value={filters.cohort_id} onChange={e => setFilters({ ...filters, cohort_id: e.target.value })} className="rounded-xl border px-3 py-2 text-sm"><option value="">Toutes les cohortes</option>{(data.cohorts || []).map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-gray-500">{['Membre','Organisation','Progression','Score','Temps','Reconnaissance','Certificats','Badges','Conformité','Retards'].map(h=><th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody>{members.map((m:any)=><tr key={m.user_id} className="border-b last:border-0"><td className="px-3 py-3"><div className="font-semibold">{m.full_name}</div><div className="text-xs text-gray-500">{m.email}</div></td><td className="px-3 py-3"><div>{m.department_name || '—'}</div><div className="text-xs text-gray-500">{m.group_name || ''}</div></td><td className="px-3 py-3 font-semibold">{m.progress_percent}%</td><td className="px-3 py-3">{m.average_score}%</td><td className="px-3 py-3">{m.training_hours} h</td><td className="px-3 py-3">{m.cpd_hours} h</td><td className="px-3 py-3">{m.certificates}</td><td className="px-3 py-3">{m.badges}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${m.compliance_percent === 100 ? 'bg-green-100 text-green-700' : m.overdue_assignments ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{m.compliance_percent}%</span></td><td className="px-3 py-3">{m.overdue_assignments}</td></tr>)}{!members.length && <tr><td colSpan={10} className="py-12 text-center text-gray-500">{loading ? 'Chargement…' : 'Aucun membre correspondant.'}</td></tr>}</tbody></table></div>
      </div>
    </div>
  </StructureLayout>;
}
