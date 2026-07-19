import { Link } from 'react-router-dom';
import AdminOmniaLiveShell from './AdminOmniaLiveShell';
export default function AdminOmniaLiveOperations(){
 const links=[['Remboursements','/admin/omnia-live/remboursements','Demandes, approbations partielles et traitement.'],['Annulations & reports','/admin/omnia-live/annulations','Motifs, validation et pénalités.'],['Événements','/admin/omnia-live/evenements','Salles actives, présence et supervision.']];
 return <AdminOmniaLiveShell title="Opérations" subtitle="Gestion opérationnelle après inscription et publication."><div className="grid gap-4 md:grid-cols-3">{links.map(([t,p,d])=><Link key={p} to={p} className="rounded-2xl border bg-white p-5 hover:border-[#BF8813]"><div className="font-bold text-[#002050]">{t}</div><p className="mt-2 text-sm text-slate-500">{d}</p></Link>)}</div></AdminOmniaLiveShell>
}
