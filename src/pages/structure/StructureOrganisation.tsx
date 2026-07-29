import { useEffect, useMemo, useRef, useState } from 'react';
import { StructureLayout } from '../../components/StructureLayout';
import { Building2, CalendarDays, CheckCircle2, Download, FileSpreadsheet, GraduationCap, Plus, RefreshCw, Search, Trash2, Upload, Users } from 'lucide-react';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/structure-manage`;
type Tab = 'organisation' | 'membres' | 'formations';

function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delimiter).map(v => v.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] || '']));
  });
}

export default function StructureOrganisation() {
  const [structureId, setStructureId] = useState('');
  const [tab, setTab] = useState<Tab>('organisation');
  const [data, setData] = useState<any>({ departments: [], groups: [], cohorts: [], members: [], trainings: [], assignments: [], indicators: {} });
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [unit, setUnit] = useState({ type: 'department', name: '', description: '', department_id: '', starts_at: '', ends_at: '' });
  const [training, setTraining] = useState({ course_id: '', title: '', target_type: 'tous', target_id: '', starts_at: '', due_at: '', priority: 'normale', reminder_days: '30,7,1' });

  const token = () => localStorage.getItem('omnia_session_token') || '';
  async function request(action: string, payload: Record<string, unknown> = {}) {
    const res = await fetch(API, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, structure_id: structureId, ...payload }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) throw new Error(body.message || body.error || 'Action impossible');
    return body;
  }
  const toast = (text: string) => { setMessage(text); window.setTimeout(() => setMessage(''), 3500); };

  async function load(id = structureId) {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(API, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'gm2_overview', structure_id: id }) });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || body.error || 'Chargement impossible');
      setData(body);
    } catch (error) { toast(error instanceof Error ? error.message : 'Chargement impossible'); }
    finally { setLoading(false); }
  }

  useEffect(() => { (async () => {
    try {
      const res = await fetch(API, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get_my_structure' }) });
      const body = await res.json();
      if (!body.success) throw new Error(body.message || body.error || 'Structure introuvable');
      setStructureId(body.structure.id);
      const [overview, catalogue] = await Promise.all([
        fetch(API, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'gm2_overview', structure_id: body.structure.id }) }).then(r => r.json()),
        fetch(API, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'gm2_list_courses', structure_id: body.structure.id }) }).then(r => r.json()),
      ]);
      if (overview.success) setData(overview);
      if (catalogue.success) setCourses(catalogue.courses || []);
    } catch (error) { toast(error instanceof Error ? error.message : 'Chargement impossible'); }
    finally { setLoading(false); }
  })(); }, []);

  async function saveUnit() {
    if (!unit.name.trim()) return toast('Le nom est obligatoire.');
    setBusy(true);
    try {
      const action = unit.type === 'department' ? 'gm2_save_department' : unit.type === 'group' ? 'gm2_save_group' : 'gm2_save_cohort';
      await request(action, unit);
      setUnit({ type: unit.type, name: '', description: '', department_id: '', starts_at: '', ends_at: '' });
      toast('Enregistrement effectué.'); await load();
    } catch (error) { toast(error instanceof Error ? error.message : 'Action impossible'); }
    finally { setBusy(false); }
  }

  async function deleteUnit(type: string, id: string) {
    if (!confirm('Supprimer cet élément ?')) return;
    try { await request('gm2_delete_unit', { unit_type: type, id }); toast('Élément supprimé.'); await load(); }
    catch (error) { toast(error instanceof Error ? error.message : 'Suppression impossible'); }
  }

  async function updateMember(member: any, field: string, value: string) {
    try { await request('gm2_update_member', { user_id: member.user_id, ...member.organization, [field]: value || null }); toast('Membre mis à jour.'); await load(); }
    catch (error) { toast(error instanceof Error ? error.message : 'Mise à jour impossible'); }
  }

  async function importCsv(file: File) {
    setBusy(true);
    try {
      const rows = parseCsv(await file.text());
      if (!rows.length) throw new Error('Le fichier CSV ne contient aucune ligne exploitable.');
      const result = await request('gm2_import_members', { file_name: file.name, rows });
      toast(`${result.import.successful_rows} membre(s) mis à jour, ${result.import.failed_rows} erreur(s).`);
      await load();
    } catch (error) { toast(error instanceof Error ? error.message : 'Import impossible'); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  function downloadTemplate() {
    const csv = 'email;reference;fonction;departement;groupe;date_arrivee\nnom@exemple.com;EMP-001;Responsable RH;Ressources humaines;Équipe RH;2026-07-29\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'modele_import_membres_structure.csv'; a.click(); URL.revokeObjectURL(url);
  }

  async function createTraining() {
    if (!training.course_id || !training.due_at) return toast('Choisissez une formation et une date limite.');
    setBusy(true);
    try {
      const result = await request('gm2_create_mandatory_training', { ...training, target_id: training.target_type === 'tous' ? null : training.target_id, reminder_days: training.reminder_days.split(',').map(v => Number(v.trim())).filter(Number.isFinite) });
      toast(`Formation obligatoire créée pour ${result.assigned_count} membre(s).`);
      setTraining({ course_id: '', title: '', target_type: 'tous', target_id: '', starts_at: '', due_at: '', priority: 'normale', reminder_days: '30,7,1' });
      await load();
    } catch (error) { toast(error instanceof Error ? error.message : 'Création impossible'); }
    finally { setBusy(false); }
  }

  const members = useMemo(() => (data.members || []).filter((m: any) => {
    const user = Array.isArray(m.users) ? m.users[0] : m.users;
    return !search || `${user?.full_name || ''} ${user?.email || ''}`.toLowerCase().includes(search.toLowerCase());
  }), [data.members, search]);
  const targetOptions = training.target_type === 'département' ? data.departments : training.target_type === 'groupe' ? data.groups : training.target_type === 'cohorte' ? data.cohorts : [];

  return <StructureLayout>
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {message && <div className="fixed right-5 top-5 z-50 rounded-xl border bg-white px-4 py-3 text-sm font-semibold shadow-lg" style={{ color: '#002050' }}>{message}</div>}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-black" style={{ color: '#002050' }}>Organisation et formations obligatoires</h1><p className="mt-1 text-sm text-gray-500">Départements, groupes, cohortes, membres et échéances de formation.</p></div>
        <button onClick={() => load()} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold"><RefreshCw size={15}/>Actualiser</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[['Membres', data.indicators?.members || 0, Users], ['Départements', data.indicators?.departments || 0, Building2], ['Groupes', data.indicators?.groups || 0, Users], ['Cohortes', data.indicators?.cohorts || 0, CalendarDays], ['Obligations actives', data.indicators?.mandatory_trainings || 0, GraduationCap], ['En retard', data.indicators?.overdue || 0, CheckCircle2]].map(([label, value, Icon]: any) => <div key={label} className="rounded-2xl border bg-white p-4"><Icon size={18} style={{ color: '#BF8813' }}/><div className="mt-3 text-2xl font-black" style={{ color: '#002050' }}>{value}</div><div className="text-xs text-gray-500">{label}</div></div>)}
      </div>

      <div className="flex gap-2 overflow-x-auto border-b">
        {[['organisation','Organisation'],['membres','Membres et import CSV'],['formations','Formations obligatoires']].map(([key,label]) => <button key={key} onClick={() => setTab(key as Tab)} className="whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold" style={{ borderColor: tab === key ? '#BF8813' : 'transparent', color: tab === key ? '#002050' : '#6B7280' }}>{label}</button>)}
      </div>

      {loading ? <div className="py-20 text-center text-sm text-gray-500">Chargement…</div> : tab === 'organisation' ? <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <section className="rounded-2xl border bg-white p-5 space-y-4">
          <h2 className="font-black" style={{ color: '#002050' }}>Ajouter un élément</h2>
          <select value={unit.type} onChange={e => setUnit(v => ({ ...v, type: e.target.value }))} className="w-full rounded-xl border px-3 py-2.5 text-sm"><option value="department">Département</option><option value="group">Groupe</option><option value="cohort">Cohorte</option></select>
          <input value={unit.name} onChange={e => setUnit(v => ({ ...v, name: e.target.value }))} placeholder="Nom" className="w-full rounded-xl border px-3 py-2.5 text-sm"/>
          <textarea value={unit.description} onChange={e => setUnit(v => ({ ...v, description: e.target.value }))} placeholder="Description facultative" className="w-full rounded-xl border px-3 py-2.5 text-sm"/>
          {unit.type === 'group' && <select value={unit.department_id} onChange={e => setUnit(v => ({ ...v, department_id: e.target.value }))} className="w-full rounded-xl border px-3 py-2.5 text-sm"><option value="">Sans département</option>{data.departments.map((d:any)=><option key={d.id} value={d.id}>{d.name}</option>)}</select>}
          {unit.type === 'cohort' && <div className="grid grid-cols-2 gap-2"><input type="date" value={unit.starts_at} onChange={e => setUnit(v => ({ ...v, starts_at: e.target.value }))} className="rounded-xl border px-3 py-2.5 text-sm"/><input type="date" value={unit.ends_at} onChange={e => setUnit(v => ({ ...v, ends_at: e.target.value }))} className="rounded-xl border px-3 py-2.5 text-sm"/></div>}
          <button disabled={busy} onClick={saveUnit} className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" style={{ background: '#002050' }}><Plus size={15}/>Ajouter</button>
        </section>
        <div className="grid gap-4 md:grid-cols-3">
          {([['department','Départements',data.departments],['group','Groupes',data.groups],['cohort','Cohortes',data.cohorts]] as any[]).map(([type,title,items]) => <section key={type} className="rounded-2xl border bg-white p-5"><h2 className="font-black" style={{ color: '#002050' }}>{title}</h2><div className="mt-4 space-y-2">{items.length ? items.map((item:any)=><div key={item.id} className="flex items-start gap-2 rounded-xl border p-3"><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{item.name}</div><div className="mt-1 text-xs text-gray-500">{item.description || 'Aucune description'}</div></div><button onClick={()=>deleteUnit(type,item.id)} className="text-red-600"><Trash2 size={15}/></button></div>) : <p className="text-sm text-gray-400">Aucun élément.</p>}</div></section>)}
        </div>
      </div> : tab === 'membres' ? <div className="space-y-5">
        <div className="flex flex-wrap gap-3 rounded-2xl border bg-white p-5"><button onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold"><Download size={15}/>Télécharger le modèle CSV</button><input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => e.target.files?.[0] && importCsv(e.target.files[0])}/><button disabled={busy} onClick={()=>fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-50" style={{ background: '#002050' }}><Upload size={15}/>Importer un CSV</button><div className="relative min-w-64 flex-1"><Search size={15} className="absolute left-3 top-3 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un membre" className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm"/></div></div>
        <div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[900px] text-sm"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr>{['Membre','Référence','Fonction','Département','Groupe'].map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody>{members.map((m:any)=>{const u=Array.isArray(m.users)?m.users[0]:m.users; const o=m.organization||{}; return <tr key={m.user_id} className="border-t"><td className="px-4 py-3"><div className="font-bold">{u?.full_name||'Membre'}</div><div className="text-xs text-gray-500">{u?.email}</div></td><td className="px-4 py-3"><input defaultValue={o.employee_reference||''} onBlur={e=>updateMember(m,'employee_reference',e.target.value)} className="w-28 rounded-lg border px-2 py-1.5"/></td><td className="px-4 py-3"><input defaultValue={o.job_title||''} onBlur={e=>updateMember(m,'job_title',e.target.value)} className="w-40 rounded-lg border px-2 py-1.5"/></td><td className="px-4 py-3"><select value={o.department_id||''} onChange={e=>updateMember(m,'department_id',e.target.value)} className="w-40 rounded-lg border px-2 py-1.5"><option value="">Non défini</option>{data.departments.map((d:any)=><option key={d.id} value={d.id}>{d.name}</option>)}</select></td><td className="px-4 py-3"><select value={o.group_id||''} onChange={e=>updateMember(m,'group_id',e.target.value)} className="w-40 rounded-lg border px-2 py-1.5"><option value="">Non défini</option>{data.groups.map((g:any)=><option key={g.id} value={g.id}>{g.name}</option>)}</select></td></tr>})}</tbody></table>{!members.length&&<div className="p-10 text-center text-sm text-gray-400">Aucun membre rattaché.</div>}</div>
      </div> : <div className="grid gap-6 lg:grid-cols-[390px_1fr]">
        <section className="rounded-2xl border bg-white p-5 space-y-3"><h2 className="font-black" style={{ color: '#002050' }}>Créer une obligation</h2><select value={training.course_id} onChange={e=>setTraining(v=>({...v,course_id:e.target.value,title:courses.find(c=>c.id===e.target.value)?.title||''}))} className="w-full rounded-xl border px-3 py-2.5 text-sm"><option value="">Choisir une formation publiée</option>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select><select value={training.target_type} onChange={e=>setTraining(v=>({...v,target_type:e.target.value,target_id:''}))} className="w-full rounded-xl border px-3 py-2.5 text-sm"><option value="tous">Tous les membres</option><option value="département">Un département</option><option value="groupe">Un groupe</option><option value="cohorte">Une cohorte</option></select>{training.target_type!=='tous'&&<select value={training.target_id} onChange={e=>setTraining(v=>({...v,target_id:e.target.value}))} className="w-full rounded-xl border px-3 py-2.5 text-sm"><option value="">Choisir la cible</option>{targetOptions.map((o:any)=><option key={o.id} value={o.id}>{o.name}</option>)}</select>}<div className="grid grid-cols-2 gap-2"><input type="date" value={training.starts_at} onChange={e=>setTraining(v=>({...v,starts_at:e.target.value}))} className="rounded-xl border px-3 py-2.5 text-sm"/><input type="date" value={training.due_at} onChange={e=>setTraining(v=>({...v,due_at:e.target.value}))} className="rounded-xl border px-3 py-2.5 text-sm"/></div><select value={training.priority} onChange={e=>setTraining(v=>({...v,priority:e.target.value}))} className="w-full rounded-xl border px-3 py-2.5 text-sm"><option value="faible">Priorité faible</option><option value="normale">Priorité normale</option><option value="haute">Priorité haute</option><option value="critique">Priorité critique</option></select><input value={training.reminder_days} onChange={e=>setTraining(v=>({...v,reminder_days:e.target.value}))} placeholder="Rappels : 30,7,1" className="w-full rounded-xl border px-3 py-2.5 text-sm"/><button disabled={busy} onClick={createTraining} className="w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" style={{ background: '#002050' }}>Créer et affecter</button></section>
        <section className="rounded-2xl border bg-white p-5"><h2 className="font-black" style={{ color: '#002050' }}>Obligations de formation</h2><div className="mt-4 space-y-3">{data.trainings.length?data.trainings.map((t:any)=>{const assigned=data.assignments.filter((a:any)=>a.mandatory_training_id===t.id); const done=assigned.filter((a:any)=>a.status==='terminée').length; return <div key={t.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-bold">{t.title}</div><div className="mt-1 text-xs text-gray-500">Date limite : {t.due_at} · Cible : {t.target_type}</div></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-900">{t.status}</span></div><div className="mt-3 text-sm text-gray-600">{done} terminée(s) sur {assigned.length} affectation(s)</div><div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full" style={{ width: `${assigned.length?Math.round(done/assigned.length*100):0}%`, background:'#BF8813' }}/></div></div>}) : <div className="py-12 text-center text-sm text-gray-400"><FileSpreadsheet size={34} className="mx-auto mb-3 opacity-30"/>Aucune formation obligatoire.</div>}</div></section>
      </div>}
    </div>
  </StructureLayout>;
}
