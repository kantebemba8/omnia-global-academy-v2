import {ReactNode,useEffect,useState} from 'react';
import {Link,NavLink,useLocation,useNavigate} from 'react-router-dom';
import {
  LayoutDashboard,Radio,Users,Film,BarChart3,Wallet,Settings2,
  PlusCircle,MessageSquare,KeyRound,Menu,X,ExternalLink,LogOut,ArrowLeft
} from 'lucide-react';

const BLUE='#002050';
const GOLD='#BF8813';

const NAV=[
  ['/omnia-live/organisateur','Tableau de bord',LayoutDashboard,true],
  ['/omnia-live/proposer','Créer un événement',PlusCircle],
  ['/omnia-live/organisateur/evenements','Mes événements',Radio],
  ['/omnia-live/organisateur/participants','Participants',Users],
  ['/omnia-live/organisateur/medias','Médias & Replays',Film],
  ['/omnia-live/organisateur/communications','Communications',MessageSquare],
  ['/omnia-live/organisateur/acces-prives','Codes privés',KeyRound],
  ['/omnia-live/revenus','Revenus & Payouts',Wallet],
  ['/omnia-live/organisateur/statistiques','Analytics',BarChart3],
  ['/omnia-live/organisateur/parametres','Paramètres',Settings2],
] as const;

export default function OrganizerShell({
  children,title,subtitle
}:{children:ReactNode;title:string;subtitle?:string}){
  const location=useLocation();
  const navigate=useNavigate();
  const [mobileOpen,setMobileOpen]=useState(false);

  const previewRequested=new URLSearchParams(location.search).get('preview')==='true';
  const isSuperAdmin=(()=>{
    try{
      const u=JSON.parse(localStorage.getItem('omnia_user')||'{}');
      return Array.isArray(u?.roles)&&u.roles.includes('super_admin');
    }catch{return false}
  })();
  const preview=previewRequested&&isSuperAdmin;

  const buildPath=(path:string)=>{
    if(!preview)return path;
    return `${path}${path.includes('?')?'&':'?'}preview=true`;
  };

  useEffect(()=>setMobileOpen(false),[location.pathname]);

  function logout(){
    localStorage.removeItem('omnia_session_token');
    localStorage.removeItem('omnia_user');
    localStorage.removeItem('omnia_access_token');
    localStorage.removeItem('access_token');
    navigate('/connexion');
  }

  const sidebar=<aside className="flex h-full flex-col" style={{backgroundColor:BLUE}}>
    <div className="border-b border-white/10 px-5 py-5">
      <Link to={buildPath('/')} className="flex items-center gap-3">
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

    <nav className="sidebar-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {NAV.map(([path,label,Icon,exact])=>
        <NavLink
          key={path}
          to={buildPath(path)}
          end={Boolean(exact)}
          className={({isActive})=>
            `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              isActive
                ? 'bg-white/10 text-white'
                : 'text-white/75 hover:bg-white/5 hover:text-white'
            }`
          }
        >
          {({isActive})=><>
            {isActive&&<span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full" style={{backgroundColor:GOLD}}/>}
            <Icon style={{width:18,height:18,flexShrink:0}}/>
            <span className="flex-1">{label}</span>
          </>}
        </NavLink>
      )}
    </nav>

    <div className="border-t border-white/10 px-3 pb-5 pt-3">
      <Link
        to={buildPath('/omnia-live')}
        className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition hover:bg-white/5"
        style={{color:GOLD}}
      >
        <ExternalLink style={{width:18,height:18,flexShrink:0}}/>
        <span>Voir Omnia Live</span>
      </Link>
      <button
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
    {mobileOpen&&<div className="fixed inset-0 z-50 flex lg:hidden">
      <div className="fixed inset-0 bg-black/50" onClick={()=>setMobileOpen(false)}/>
      <div className="relative z-10 flex h-full flex-col" style={{width:260}}>
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
          onClick={()=>setMobileOpen(true)}
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
          aria-label="Ouvrir le menu"
        >
          <Menu size={20}/>
        </button>
        <Link to={buildPath('/omnia-live')} className="flex items-center gap-2">
          <img src="/logo.png" alt="Omnia" className="h-8 w-8 object-contain"/>
          <span className="text-sm font-bold">
            <span style={{color:BLUE}}>Omnia </span>
            <span style={{color:GOLD}}>Live</span>
          </span>
        </Link>
        <span className="w-8"/>
      </header>

      {preview&&(
        <button
          type="button"
          onClick={()=>navigate('/admin/dashboard')}
          className="fixed bottom-5 left-[280px] z-50 inline-flex items-center gap-2 rounded-lg bg-[#002050] px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 max-lg:left-5"
        >
          <ArrowLeft size={16}/>
          <span>Retour au dashboard admin</span>
        </button>
      )}

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
