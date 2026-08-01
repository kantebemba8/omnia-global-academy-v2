import { FormEvent, useEffect, useState } from 'react';
import { Briefcase, MapPin, Search, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RecruiterLayout } from '../../components/talent/RecruiterLayout';
import { employabilityRequest, VerifiedTalentCandidate } from '../../lib/employabilityApi';

const BLUE = '#002050';
const GOLD = '#BF8813';

export default function VerifiedTalentCandidates() {
  const [rows, setRows] = useState<VerifiedTalentCandidate[]>([]);
  const [filters, setFilters] = useState({ q: '', skill: '', sector: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const search = async (event?: FormEvent) => {
    event?.preventDefault(); setLoading(true); setError('');
    try {
      const result = await employabilityRequest<{ candidates: VerifiedTalentCandidate[] }>('verified_candidates', filters);
      setRows(result.candidates || []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Recherche impossible.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { search(); }, []);

  return <RecruiterLayout title="Compétences vérifiées" subtitle="Profils autorisés par les talents">
    <main className="mx-auto max-w-7xl p-5 md:p-8">
      
      <h1 className="mt-2 text-3xl font-black" style={{color:BLUE}}>Rechercher des talents vérifiés</h1>
      <p className="mt-2 max-w-3xl text-sm text-gray-600">Les résultats affichent uniquement les sources et preuves autorisées par chaque talent. Les documents privés restent masqués.</p>

      <form onSubmit={search} className="mt-7 grid gap-3 border bg-white p-4 md:grid-cols-[1.5fr_1fr_1fr_auto]">
        <label className="flex items-center gap-2 border px-3"><Search size={17}/><input value={filters.q} onChange={event=>setFilters({...filters,q:event.target.value})} placeholder="Métier, pays, certification…" className="w-full py-3 outline-none"/></label>
        <input value={filters.skill} onChange={event=>setFilters({...filters,skill:event.target.value})} placeholder="Compétence exacte" className="border p-3"/>
        <input value={filters.sector} onChange={event=>setFilters({...filters,sector:event.target.value})} placeholder="Secteur" className="border p-3"/>
        <button disabled={loading} className="flex items-center justify-center gap-2 px-5 py-3 font-bold text-white" style={{background:BLUE}}><SlidersHorizontal size={17}/>{loading?'Recherche…':'Rechercher'}</button>
      </form>

      {error&&<p className="mt-4 border-l-4 border-red-500 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-6 flex items-center justify-between border-b pb-3"><h2 className="font-black" style={{color:BLUE}}>{rows.length} profil(s) autorisé(s)</h2><p className="text-xs text-gray-500">Aucune décision de recrutement n’est automatisée.</p></div>
      <div className="divide-y border-b">
        {rows.map(candidate=><article key={candidate.user_id} className="grid gap-5 py-6 lg:grid-cols-[auto_1fr_auto]">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full text-lg font-black text-white" style={{background:BLUE}}>{candidate.avatar_url?<img src={candidate.avatar_url} alt="" className="h-full w-full object-cover"/>:initials(candidate.full_name)}</div>
          <div><h3 className="text-lg font-black" style={{color:BLUE}}>{candidate.full_name}</h3><p className="mt-1 text-sm font-semibold text-gray-700">{candidate.professional_title}</p>{candidate.location&&<p className="mt-1 flex items-center gap-1 text-xs text-gray-500"><MapPin size={13}/>{candidate.location}</p>}<div className="mt-3 flex flex-wrap gap-2">{candidate.verified_skills.slice(0,10).map(skill=><span key={skill} className="border bg-gray-50 px-2 py-1 text-xs">{skill}</span>)}</div><div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500"><span className="flex items-center gap-1"><ShieldCheck size={14}/>{candidate.verified_project_evidence_count} preuve(s) projet</span><span className="flex items-center gap-1"><Briefcase size={14}/>{candidate.target_roles.slice(0,3).join(', ')||'Rôle ouvert'}</span><span>{candidate.certifications.length} certification(s)</span></div></div>
          <Link to={`/talent/recruteur/competences-verifiees/${candidate.user_id}`} className="self-center border px-4 py-2 text-center text-sm font-bold" style={{color:BLUE}}>Consulter le profil autorisé</Link>
        </article>)}
        {!loading&&rows.length===0&&<p className="py-12 text-center text-sm text-gray-500">Aucun profil autorisé ne correspond aux filtres.</p>}
      </div>
    </main>
  </RecruiterLayout>;
}

function initials(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'OT'}
