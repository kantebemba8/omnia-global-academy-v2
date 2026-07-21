import {ReactNode,useEffect,useState} from 'react';
import {Link,NavLink,useLocation,useNavigate} from 'react-router-dom';
import {
  LayoutDashboard,Radio,Users,Film,BarChart3,Wallet,Settings2,
  PlusCircle,MessageSquare,KeyRound,Menu,X,ExternalLink,LogOut
} from 'lucide-react';

const GOLD='#BF8813';
const BLUE='#002050';

const NAV=[
  ['/omnia-live/organisateur','Tableau de bord',LayoutDashboard,true],
  ['/omnia-live/organisateur/evenements','Mes événements',Radio],
  ['/omnia-live/proposer','Créer un contenu',PlusCircle],
  ['/omnia-live/organisateur/participants','Participants',Users],
  ['/omnia-live/organisateur/medias','Médias & Replays',Film],
  ['/omnia-live/organisateur/communications','Communications',MessageSquare],
  ['/omnia-live/organisateur/acces-prives','Codes privés',KeyRound],
  ['/omnia-live/organisateur/statistiques','Analytics',BarChart3],
  ['/omnia-live/revenus','Revenus & Payouts',Wallet],
  ['/omnia-live/organisateur/parametres','Paramètres',Settings2],
] as const;

export default function OrganizerShell({
  children,title,subtitle
}:{children:ReactNode;title:string;subtitle?:string}){
  const location=useLocation();
  const navigate=useNavigate();
  const [mobileOpen,setMobileOpen]=useState(false);

  const params=new URLSearchParams(location.search);
  const preview=params.get('preview')==='true';

  const buildPath=(path:string)=>{
    if(!preview)return path;
    return `${path}${path.includes('?')?'&':'?'}preview=true`;
  };

  useEffect(()=>{setMobileOpen(false)},[location.pathname]);

  function logout(){
    if(preview){navigate('/admin/dashboard');return}
    localStorage.removeItem('omnia_session_token');
    localStorage.removeItem('omnia_user');
    navigate('/connexion');
  }

  const sidebar=<aside
    className="flex h-full flex-col"
    style={{backgroundColor:GOLD}}
  >
    <div className="border-b border-black/10 px-6 py-5">
      <Link to={buildPath('/omnia-live')} className="block">
        <img src="/logo.png" alt="Omnia Global Academy" className="h-12 w-auto object-contain"/>
      </Link>
      <div className="mt-4 text-base font-bold leading-none">
        <span style={{color:BLUE}}>Omnia </span>
        <span className="text-white">Live</span>
      </div>
    </div>

    <div className="px-3 pt-4">
      <Link
        to={buildPath('/omnia-live')}
        className="flex items-center gap-3 rounded-lg border border-black/10 bg-white/90 px-3 py-2.5 text-sm font-semibold shadow-sm transition hover:bg-white"
        style={{color:BLUE}}
      >
        <ExternalLink style={{width:18,height:18,flexShrink:0}}/>
        <span>Voir Omnia Live</span>
      </Link>
    </div>

    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {NAV.map(([path,label,Icon,exact])=>
        <NavLink
          key={path}
          to={buildPath(path)}
          end={Boolean(exact)}
          className={({isActive})=>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              isActive
                ? 'bg-white text-[#002050] shadow-sm'
                : 'text-[#002050]/85 hover:bg-white/20 hover:text-[#002050]'
            }`
          }
        >
          <Icon style={{width:18,height:18,flexShrink:0}}/>
          <span className="flex-1">{label}</span>
        </NavLink>
      )}
    </nav>

    <div className="border-t border-black/10 px-3 pb-5 pt-3">
      <button
        onClick={logout}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#002050]/80 transition hover:bg-white/20 hover:text-[#002050]"
      >
        <LogOut style={{width:18,height:18}}/>
        <span>{preview?'Retour au Dashboard':'Déconnexion'}</span>
      </button>
    </div>
  </aside>;

  return <div className="flex h-screen overflow-hidden bg-white">
    {/* Desktop: same 260px width as Super Admin. No hamburger on desktop. */}
    <div className="hidden lg:flex flex-shrink-0 flex-col" style={{width:260}}>
      {sidebar}
    </div>

    {/* Mobile only: hamburger opens the same sidebar */}
    {mobileOpen&&<div className="fixed inset-0 z-50 flex lg:hidden">
      <div className="fixed inset-0 bg-black/45" onClick={()=>setMobileOpen(false)}/>
      <div className="relative z-10 flex h-full flex-col" style={{width:260}}>
        <button
          onClick={()=>setMobileOpen(false)}
          className="absolute right-3 top-3 z-20 rounded-lg bg-white/90 p-1.5"
          aria-label="Fermer le menu"
        >
          <X size={18} style={{color:BLUE}}/>
        </button>
        {sidebar}
      </div>
    </div>}

    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <button
          onClick={()=>setMobileOpen(true)}
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
          aria-label="Ouvrir le menu"
        >
          <Menu size={20}/>
        </button>
        <Link to={buildPath('/omnia-live')} className="flex items-center gap-2">
          <img src="/logo.png" alt="Omnia" className="h-8 w-auto object-contain"/>
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
            <h1 className="text-3xl font-bold tracking-tight" style={{color:BLUE}}>{title}</h1>
            {subtitle&&<p className="mt-2 max-w-3xl text-sm text-slate-600">{subtitle}</p>}
          </div>
          {children}
        </section>
      </main>
    </div>
  </div>;
}
