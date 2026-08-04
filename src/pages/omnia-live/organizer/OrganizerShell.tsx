import { clearSession } from '../../../lib/session';
import {ElementType,ReactNode,useEffect,useState} from 'react';
import {Link,NavLink,useLocation,useNavigate} from 'react-router-dom';
import {
  LayoutDashboard,Radio,Users,Film,BarChart3,Wallet,CreditCard,Settings2,
  PlusCircle,MessageSquare,KeyRound,Menu,X,LogOut,ArrowLeft,ChevronDown,User
} from 'lucide-react';
import {isOrganizerPreviewMode} from '../liveApi';

const BLUE='#002050';
const GOLD='#BF8813';

type OrganizerNavItem={path:string;label:string;icon:ElementType;exact?:boolean};
type OrganizerNavGroup={id:string;label:string;items:OrganizerNavItem[]};

const NAV_GROUPS:OrganizerNavGroup[]=[
  {
    id:'dashboard',
    label:'Accueil',
    items:[{path:'/omnia-live/organisateur',label:'Accueil',icon:LayoutDashboard,exact:true}],
  },
  {
    id:'events',
    label:'Événements',
    items:[
      {path:'/omnia-live/proposer',label:'Créer un événement',icon:PlusCircle},
      {path:'/omnia-live/organisateur/evenements',label:'Mes événements',icon:Radio},
      {path:'/omnia-live/organisateur/participants',label:'Participants',icon:Users},
      {path:'/omnia-live/organisateur/communications',label:'Communications',icon:MessageSquare},
      {path:'/omnia-live/organisateur/acces-prives',label:'Codes privés',icon:KeyRound},
      {path:'/omnia-live/organisateur/medias',label:'Médias & Replays',icon:Film},
    ],
  },
  {
    id:'analytics',
    label:'Pilotage',
    items:[{path:'/omnia-live/organisateur/statistiques',label:'Analytics',icon:BarChart3}],
  },
  {
    id:'commerce',
    label:'Offres & revenus',
    items:[
      {path:'/omnia-live/organisateur/offres',label:'Offres aux participants',icon:CreditCard},
      {path:'/omnia-live/organisateur/plan-omnia',label:'Mon plan organisateur',icon:CreditCard},
      {path:'/omnia-live/revenus',label:'Revenus & Payouts',icon:Wallet},
    ],
  },
  {
    id:'settings',
    label:'Configuration',
    items:[
      {path:'/mon-profil',label:'Mon profil',icon:User},
      {path:'/omnia-live/organisateur/parametres',label:'Paramètres',icon:Settings2},
    ],
  },
];

export default function OrganizerShell({
  children,title,subtitle
}:{children:ReactNode;title:string;subtitle?:string}){
  const location=useLocation();
  const navigate=useNavigate();
  const [mobileOpen,setMobileOpen]=useState(false);
  const [expandedGroups,setExpandedGroups]=useState<Record<string,boolean>>({});

  const preview=isOrganizerPreviewMode();

  const buildPath=(path:string)=>{
    if(!preview)return path;
    return `${path}${path.includes('?')?'&':'?'}preview=true`;
  };

  useEffect(()=>setMobileOpen(false),[location.pathname,location.search]);

  useEffect(()=>{
    if(!mobileOpen)return;
    const previousOverflow=document.body.style.overflow;
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape')setMobileOpen(false)};
    document.body.style.overflow='hidden';
    window.addEventListener('keydown',closeOnEscape);
    return()=>{
      document.body.style.overflow=previousOverflow;
      window.removeEventListener('keydown',closeOnEscape);
    };
  },[mobileOpen]);

  function logout(){
    sessionStorage.removeItem('omnia_admin_role_preview');
    clearSession();
    localStorage.removeItem('omnia_user');
    localStorage.removeItem('omnia_access_token');
    localStorage.removeItem('access_token');
    navigate('/connexion');
  }

  const sidebar=<aside className="flex h-full flex-col" style={{backgroundColor:BLUE}}>
    <div className="border-b border-white/10 px-5 py-5">
      <Link to={buildPath('/omnia-live')} className="flex items-center gap-3">
        <img
          src="/omnia-sidebar-logo.png"
          alt="Omnia Global Academy"
          className="h-10 w-10 flex-shrink-0 object-contain"
        />
        <div className="font-bold leading-tight">
          <div className="text-base text-white">Omnia</div>
          <div className="text-sm" style={{color:GOLD}}>Global Academy</div>
        </div>
      </Link>
      <div className="mt-4 text-base font-bold">
        <span className="text-white">Omnia </span>
        <span style={{color:GOLD}}>Live</span>
      </div>
    </div>

    <nav className="oga-sidebar-scroll flex-1 overflow-y-auto px-3 py-4">
      <div className="space-y-5">
        {NAV_GROUPS.map(group=>{
          const open=expandedGroups[group.id]===true;
          const GroupIcon=group.items[0].icon;

          if(group.id==='dashboard'){
            const item=group.items[0];
            return <NavLink
              key={group.id}
              to={buildPath(item.path)}
              end
              className={({isActive})=>
                `relative flex items-center gap-3 px-3 py-2.5 text-sm font-semibold transition ${
                  isActive ? 'text-white' : 'text-white/75 hover:text-white'
                }`
              }
            >
              {({isActive})=><>
                {isActive&&<span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full" style={{backgroundColor:GOLD}}/>}
                <GroupIcon style={{width:18,height:18,flexShrink:0}}/>
                <span className="flex-1">{group.label}</span>
              </>}
            </NavLink>;
          }

          return <section key={group.id}>
            <button
              type="button"
              onClick={()=>setExpandedGroups(previous=>({...previous,[group.id]:!previous[group.id]}))}
              aria-expanded={open}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-semibold text-white/75 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#BF8813]"
            >
              <GroupIcon style={{width:18,height:18,flexShrink:0}}/>
              <span className="flex-1">{group.label}</span>
              <ChevronDown size={14} className={`transition-transform ${open?'rotate-180':''}`}/>
            </button>
            {open&&<div className="mb-2 ml-5 mt-1 space-y-0.5 border-l border-white/10 pl-3">
              {group.items.map(item=>{
                const Icon=item.icon;
                return <NavLink
                  key={item.path}
                  to={buildPath(item.path)}
                  end={Boolean(item.exact)}
                  className={({isActive})=>
                    `relative flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition ${
                      isActive ? 'text-[#BF8813]' : 'text-white/60 hover:text-white'
                    }`
                  }
                >
                  {({isActive})=><>
                    {isActive&&<span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full" style={{backgroundColor:GOLD}}/>}
                    <Icon style={{width:15,height:15,flexShrink:0}}/>
                    <span className="flex-1">{item.label}</span>
                  </>}
                </NavLink>;
              })}
            </div>}
          </section>;
        })}
      </div>
    </nav>

    <div className="border-t border-white/10 px-3 pb-5 pt-3">
      <Link
        to={buildPath('/omnia-live')}
        className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition hover:bg-white/5"
        style={{color:GOLD}}
      >
        <ArrowLeft style={{width:18,height:18,flexShrink:0}}/>
        <span>Retour à Omnia Live</span>
      </Link>
      <button
        type="button"
        onClick={logout}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/65 transition hover:bg-white/5 hover:text-white"
      >
        <LogOut style={{width:18,height:18}}/>
        <span>Déconnexion</span>
      </button>
    </div>
  </aside>;

  return <div className="flex h-screen overflow-hidden bg-white">
    {/* Desktop: same 260px width / typographic scale as Super Admin */}
    <div className="hidden lg:flex flex-shrink-0 flex-col" style={{width:260}}>
      {sidebar}
    </div>

    {/* Mobile only */}
    {mobileOpen&&<div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation de l’espace Organisateur">
      <button type="button" className="fixed inset-0 bg-black/50" onClick={()=>setMobileOpen(false)} aria-label="Fermer le menu organisateur"/>
      <div id="organizer-mobile-navigation" className="relative z-10 flex h-full flex-col" style={{width:260,maxWidth:'88vw'}}>
        <button
          onClick={()=>setMobileOpen(false)}
          className="absolute right-3 top-3 z-20 rounded-lg bg-white/10 p-1.5 text-white"
          aria-label="Fermer le menu"
        >
          <X size={18}/>
        </button>
        {sidebar}
      </div>
    </div>}

    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={()=>setMobileOpen(true)}
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813]"
          aria-label="Ouvrir le menu"
          aria-expanded={mobileOpen}
          aria-controls="organizer-mobile-navigation"
        >
          <Menu size={20}/>
        </button>
        <Link to={buildPath('/omnia-live')} className="flex items-center gap-2">
          <img src="/omnia-sidebar-logo.png" alt="Omnia" className="h-8 w-8 object-contain"/>
          <span className="text-sm font-bold">
            <span style={{color:BLUE}}>Omnia </span>
            <span style={{color:GOLD}}>Live</span>
          </span>
        </Link>
        <span className="w-8"/>
      </header>

      <main className="flex-1 overflow-y-auto bg-white">
        <section className="mx-auto max-w-7xl px-4 py-8 md:px-8">
          <div className="mb-7 border-b border-slate-200 pb-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight" style={{color:BLUE}}>{title}</h1>
                {subtitle&&<p className="mt-2 max-w-3xl text-sm text-slate-600">{subtitle}</p>}
              </div>
            </div>
          </div>
          {children}
        </section>
      </main>
    </div>
  </div>;
}
