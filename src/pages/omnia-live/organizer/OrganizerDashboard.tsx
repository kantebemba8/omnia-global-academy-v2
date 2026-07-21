import {useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {CalendarDays,MessageSquare,Users,Wallet,PlayCircle,ArrowRight} from 'lucide-react';
import {liveApi} from '../liveApi';
import OrganizerShell from './OrganizerShell';

const BLUE='#002050';
const GOLD='#BF8813';

export default function OrganizerDashboard(){
  const [k,setK]=useState<any>({});
  const [recent,setRecent]=useState<any[]>([]);
  const [err,setErr]=useState('');

  useEffect(()=>{
    liveApi('organizer_dashboard')
      .then(d=>{
        setK(d.kpis||{});
        setRecent(d.recent_events||[]);
      })
      .catch(e=>setErr(e instanceof Error?e.message:'Erreur'));
  },[]);

  const quickStats=useMemo(()=>[
    ['Événements',k.total_events??0],
    ['En validation',k.pending_review??0],
    ['Publiés',k.published??0],
    ['En direct',k.live_now??0],
    ['Inscriptions',k.registrations??0],
    ['Commandes payées',k.paid_orders??0],
    ['Revenu organisateur',k.organizer_revenue??0],
    ['Disponible payout',k.available_payout??0],
    ['Note moyenne',Number(k.average_rating||0).toFixed(1)],
  ],[k]);

  return <OrganizerShell
    title="Espace Organisateur"
    subtitle="Pilotez vos Lives, formations synchrones et vidéos depuis un seul espace."
  >
    {err&&<div className="mb-6 border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>}

    {/* Chiffres clés sans cartes */}
    <section className="border-b border-slate-200 pb-7">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold" style={{color:BLUE}}>Vue d’ensemble</h2>
        <Link to="/omnia-live/organisateur/statistiques" className="text-sm font-semibold" style={{color:GOLD}}>
          Voir les analytics
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-3 xl:grid-cols-5">
        {quickStats.map(([label,value])=>
          <div key={String(label)} className="border-b border-slate-200 pb-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
            <div className="mt-1 text-2xl font-bold" style={{color:BLUE}}>
              {typeof value==='number'?value.toLocaleString('fr-FR'):value||0}
            </div>
          </div>
        )}
      </div>
    </section>

    {/* Actions rapides en ligne, sans cartes */}
    <section className="border-b border-slate-200 py-7">
      <h2 className="mb-4 text-lg font-bold" style={{color:BLUE}}>Actions rapides</h2>
      <div className="flex flex-wrap items-center gap-y-3 text-sm">
        <Link to="/omnia-live/proposer" className="flex items-center gap-2 pr-5 font-semibold" style={{color:BLUE}}>
          <PlayCircle size={18} style={{color:GOLD}}/>Créer un événement
        </Link>
        <span className="hidden h-5 w-px bg-slate-300 sm:block"/>
        <Link to="/omnia-live/organisateur/participants" className="flex items-center gap-2 px-5 font-semibold" style={{color:BLUE}}>
          <Users size={18} style={{color:GOLD}}/>Voir les participants
        </Link>
        <span className="hidden h-5 w-px bg-slate-300 sm:block"/>
        <Link to="/omnia-live/organisateur/communications" className="flex items-center gap-2 px-5 font-semibold" style={{color:BLUE}}>
          <MessageSquare size={18} style={{color:GOLD}}/>Envoyer un message
        </Link>
        <span className="hidden h-5 w-px bg-slate-300 sm:block"/>
        <Link to="/omnia-live/revenus" className="flex items-center gap-2 px-5 font-semibold" style={{color:BLUE}}>
          <Wallet size={18} style={{color:GOLD}}/>Voir mes revenus
        </Link>
      </div>
    </section>

    {/* Activité récente sous forme de liste/tableau */}
    <section className="py-7">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold" style={{color:BLUE}}>Activité récente</h2>
        <Link to="/omnia-live/organisateur/evenements" className="flex items-center gap-1 text-sm font-semibold" style={{color:GOLD}}>
          Tous mes événements <ArrowRight size={15}/>
        </Link>
      </div>

      {recent.length>0?(
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[1.5fr_.8fr_.7fr_.4fr] border-b border-slate-300 px-1 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <div>Événement</div>
              <div>Format</div>
              <div>Statut</div>
              <div className="text-right">Action</div>
            </div>
            {recent.map(x=>
              <div key={x.id} className="grid grid-cols-[1.5fr_.8fr_.7fr_.4fr] items-center border-b border-slate-200 px-1 py-4 text-sm">
                <div>
                  <div className="font-semibold" style={{color:BLUE}}>{x.title}</div>
                  {x.starts_at&&<div className="mt-1 flex items-center gap-1 text-xs text-slate-400"><CalendarDays size={13}/>{new Date(x.starts_at).toLocaleString('fr-FR')}</div>}
                </div>
                <div className="text-slate-600">{x.delivery_type||'—'}</div>
                <div className="font-medium" style={{color:GOLD}}>{x.status||'—'}</div>
                <div className="text-right">
                  <Link to={`/omnia-live/organisateur/evenements/${x.id}`} className="text-sm font-semibold" style={{color:BLUE}}>
                    Gérer
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      ):(
        <div className="border-y border-slate-200 py-10 text-sm text-slate-500">
          Aucun événement pour le moment.
        </div>
      )}
    </section>
  </OrganizerShell>;
}
