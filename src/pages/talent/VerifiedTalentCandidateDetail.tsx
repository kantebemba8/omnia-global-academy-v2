import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { ArrowLeft, Award, Briefcase, FileCheck2, MapPin, MessageSquare, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { RecruiterLayout } from '../../components/talent/RecruiterLayout';
import { StructureLayout } from '../../components/StructureLayout';
import { employabilityRequest } from '../../lib/employabilityApi';

const BLUE = '#002050';
const GOLD = '#BF8813';

export default function VerifiedTalentCandidateDetail() {
  const location = useLocation();
  const structureContext = location.pathname.startsWith('/structure/recrutement');
  const listPath = structureContext
    ? '/structure/recrutement/competences-verifiees'
    : '/talent/recruteur/competences-verifiees';
  const { userId = '' } = useParams();
  const [candidate, setCandidate] = useState<any>(null);
  const [form, setForm] = useState({ subject: '', message: '', job_id: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError('');
    try {
      const result = await employabilityRequest<any>('candidate_details', { talent_user_id: userId, purpose: 'Évaluation professionnelle autorisée' });
      setCandidate(result.candidate);
    } catch (err) { setError(err instanceof Error ? err.message : 'Profil inaccessible.'); }
  };
  useEffect(() => { load(); }, [userId]);

  const requestContact = async (event:FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await employabilityRequest('request_contact', { talent_user_id: userId, subject: form.subject, message: form.message, job_id: form.job_id || null });
      setMessage('La demande a été transmise au talent. Ses coordonnées ne sont pas révélées automatiquement.');
      setForm({subject:'',message:'',job_id:''}); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Demande impossible.'); }
    finally { setBusy(false); }
  };

  const content = <main className="mx-auto max-w-6xl p-5 md:p-8">
      <Link to={listPath} className="flex items-center gap-2 text-sm font-bold" style={{color:BLUE}}><ArrowLeft size={16}/>Retour à la recherche</Link>
      {error&&<p className="mt-5 border-l-4 border-red-500 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!candidate&&!error&&<p className="mt-8 text-sm text-gray-500">Chargement du profil autorisé…</p>}
      {candidate&&<>
        <section className="mt-6 grid gap-6 border-b pb-7 md:grid-cols-[auto_1fr_auto]">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full text-2xl font-black text-white" style={{background:BLUE}}>{candidate.avatar_url?<img src={candidate.avatar_url} alt="" className="h-full w-full object-cover"/>:initials(candidate.full_name)}</div>
          <div><p className="text-xs font-bold uppercase tracking-[.16em]" style={{color:GOLD}}>Talent avec compétences vérifiées</p><h1 className="mt-2 text-3xl font-black" style={{color:BLUE}}>{candidate.full_name}</h1><p className="mt-1 font-semibold text-gray-700">{candidate.professional_title}</p>{candidate.location&&<p className="mt-2 flex items-center gap-2 text-sm text-gray-500"><MapPin size={15}/>{candidate.location}</p>}</div>
          <div className="text-sm text-gray-600"><p className="flex items-center gap-2"><ShieldCheck size={17} style={{color:GOLD}}/>{candidate.verified_project_evidence_count} preuve(s) projet</p><p className="mt-2 flex items-center gap-2"><Award size={17} style={{color:GOLD}}/>{candidate.certifications.length} certification(s)</p></div>
        </section>

        <section className="mt-7 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            {candidate.career&&<Block title="Profil Omnia Career" icon={<Briefcase size={18}/>}><p className="text-sm text-gray-700">{candidate.career.bio||'Présentation non renseignée.'}</p><TagList values={candidate.career.languages||[]} empty="Aucune langue publiée."/></Block>}
            <Block title="Compétences vérifiées" icon={<ShieldCheck size={18}/>}><TagList values={candidate.verified_skills||[]} empty="Aucune compétence publiée dans les sources autorisées."/></Block>
            <Block title="Certifications et reconnaissances" icon={<Award size={18}/>}><TagList values={candidate.certifications||[]} empty="Aucune certification visible."/></Block>
            {candidate.portfolio&&<Block title="Portfolio professionnel" icon={<FileCheck2 size={18}/>}><h3 className="font-bold">{candidate.portfolio.headline}</h3><p className="mt-2 text-sm text-gray-600">{candidate.portfolio.professional_summary}</p><TagList values={candidate.portfolio.target_roles||[]} empty=""/></Block>}
            {(candidate.project_evidence||[]).length>0&&<Block title="Preuves de projets autorisées" icon={<FileCheck2 size={18}/>}><div className="divide-y">{candidate.project_evidence.map((item:any)=><article key={item.id} className="py-4"><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-sm text-gray-600">{item.summary||item.description}</p><p className="mt-2 text-xs text-gray-500">{item.project?.title||'Projet Omnia'} · validé le {item.validated_at?new Date(item.validated_at).toLocaleDateString('fr-FR'):'date non précisée'}</p><TagList values={item.skill_codes||[]} empty=""/></article>)}</div></Block>}
            {candidate.skills_passport&&<Block title="Skills Passport publié" icon={<ShieldCheck size={18}/>}><p className="font-semibold">{candidate.skills_passport.title}</p><p className="mt-1 text-sm text-gray-600">{candidate.skills_passport.professional_summary}</p><p className="mt-3 text-xs text-gray-500">{candidate.skills_passport.items?.length||0} élément(s) autorisé(s)</p></Block>}
            {candidate.learning_record&&<Block title="Learning Record autorisé" icon={<Award size={18}/>}><p className="font-semibold">{candidate.learning_record.title}</p><div className="mt-3 divide-y">{(candidate.learning_record.achievements||[]).slice(0,20).map((item:any)=><div key={item.id} className="py-3"><p className="text-sm font-semibold">{item.title}</p><p className="text-xs text-gray-500">{item.section||item.achievement_type}</p></div>)}</div></Block>}
          </div>

          <aside><section className="sticky top-4 border bg-white p-5"><h2 className="flex items-center gap-2 font-black" style={{color:BLUE}}><MessageSquare size={18}/>Demander un contact</h2>{candidate.allow_recruiter_contact?<><p className="mt-2 text-sm text-gray-600">Le talent décide d’accepter ou de refuser. Aucune coordonnée privée n’est communiquée avant son accord.</p><form onSubmit={requestContact} className="mt-4 space-y-3"><input required value={form.subject} onChange={event=>setForm({...form,subject:event.target.value})} placeholder="Objet de la demande" className="w-full border p-3"/><input value={form.job_id} onChange={event=>setForm({...form,job_id:event.target.value})} placeholder="Identifiant d’offre (facultatif)" className="w-full border p-3"/><textarea required value={form.message} onChange={event=>setForm({...form,message:event.target.value})} rows={7} placeholder="Présentez l’opportunité et la raison du contact…" className="w-full border p-3"/><button disabled={busy} className="w-full px-4 py-3 font-bold text-white" style={{background:BLUE}}>{busy?'Envoi…':'Envoyer la demande'}</button></form>{message&&<p className="mt-4 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}</>:<p className="mt-3 bg-gray-50 p-3 text-sm text-gray-600">Ce talent n’autorise pas actuellement les demandes de contact.</p>}
          {(candidate.contact_requests||[]).length>0&&<div className="mt-5 border-t pt-4"><p className="text-xs font-bold uppercase text-gray-500">Vos demandes précédentes</p>{candidate.contact_requests.map((item:any)=><div key={item.id} className="mt-3 border p-3 text-xs"><p className="font-semibold">{item.subject||'Demande'}</p><p className="mt-1 text-gray-500">{item.status} · {new Date(item.requested_at).toLocaleDateString('fr-FR')}</p></div>)}</div>}</section></aside>
        </section>
      </>}
    </main>;

  return structureContext
    ? <StructureLayout>{content}</StructureLayout>
    : <RecruiterLayout title="Profil vérifié" subtitle="Données partagées avec consentement">{content}</RecruiterLayout>;
}

function initials(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'OT'}
function Block({title,icon,children}:{title:string;icon:ReactNode;children:ReactNode}){return <section className="border bg-white p-5"><h2 className="flex items-center gap-2 font-black" style={{color:BLUE}}><span style={{color:GOLD}}>{icon}</span>{title}</h2><div className="mt-4">{children}</div></section>}
function TagList({values,empty}:{values:string[];empty:string}){return values.length?<div className="mt-3 flex flex-wrap gap-2">{values.map(value=><span key={value} className="border bg-gray-50 px-2 py-1 text-xs">{value}</span>)}</div>:empty?<p className="mt-3 text-sm text-gray-500">{empty}</p>:null}
