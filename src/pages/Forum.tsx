import { getSessionToken } from '../lib/session';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ForumHamburgerNav from '../components/forum/ForumHamburgerNav';
import { PageFooter } from '../components/PageFooter';
import { MessageCircle, Briefcase, BookOpen, Globe, ChevronDown, Users } from 'lucide-react';
import { ENDPOINTS } from '../lib/config';

const COUNTRIES = [
  { code: 'ML', name: 'Mali' }, { code: 'SN', name: 'Sénégal' }, { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'BF', name: 'Burkina Faso' }, { code: 'GN', name: 'Guinée' }, { code: 'TG', name: 'Togo' },
  { code: 'BJ', name: 'Bénin' }, { code: 'NE', name: 'Niger' }, { code: 'CM', name: 'Cameroun' },
  { code: 'GH', name: 'Ghana' }, { code: 'NG', name: 'Nigeria' }, { code: 'MA', name: 'Maroc' },
  { code: 'DZ', name: 'Algérie' }, { code: 'TN', name: 'Tunisie' }, { code: 'CD', name: 'RD Congo' },
];

interface ForumStats { general: number; carriere: number; jobs: number }

export default function Forum() {
  const navigate = useNavigate();
  const [country, setCountry] = useState('ML');
  const [stats, setStats] = useState<ForumStats>({ general: 0, carriere: 0, jobs: 0 });
  const [enrollments, setEnrollments] = useState<Array<{ course_id: string; title: string }>>([]);
  const isLoggedIn = !!getSessionToken();
  const userRoles: string[] = (() => {
    try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles || []; } catch { return []; }
  })();
  const dashboardPath = userRoles.includes('super_admin') ? '/admin/dashboard'
    : userRoles.includes('moderateur') ? '/moderateur/dashboard'
    : userRoles.includes('professeur') ? '/professeur/dashboard'
    : userRoles.some(role => ['responsable_structure', 'structure_admin', 'gestionnaire_partenaire', 'directeur', 'etablissement_directeur'].includes(role)) ? '/structure/dashboard'
    : userRoles.some(role => ['enseignant', 'etablissement_enseignant'].includes(role)) ? '/professeur/dashboard'
    : '/dashboard';

  useEffect(() => {
    const stored = localStorage.getItem('omnia_user');
    if (stored) {
      try { const u = JSON.parse(stored); if (u.country_code) setCountry(u.country_code); } catch { /**/ }
    }

    // Load forum stats
    Promise.all([
      fetch(`${ENDPOINTS.forumPostsList}&space=general&country_code=${country}&limit=1`).then(r => r.json()).catch(() => ({})),
      fetch(`${ENDPOINTS.forumPostsList}&space=carriere&country_code=${country}&limit=1`).then(r => r.json()).catch(() => ({})),
      fetch(`${ENDPOINTS.jobsList}?limit=1`).then(r => r.json()).catch(() => ({})),
    ]).then(([gen, carr, jobs]) => {
      setStats({ general: gen.total || 0, carriere: carr.total || 0, jobs: jobs.total || 0 });
    });

    // Load enrollments if logged in
    if (isLoggedIn) {
      const token = getSessionToken();
      const supaUrl = import.meta.env.VITE_SUPABASE_URL || '';
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      const userData = JSON.parse(localStorage.getItem('omnia_user') || '{}');
      if (supaUrl && userData?.id) {
        fetch(`${supaUrl}/rest/v1/user_enrollments?user_id=eq.${userData.id}&select=course_id,courses(title)`, {
          headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
        }).then(r => r.json()).then(d => {
          if (Array.isArray(d)) setEnrollments(d.map((e: { course_id: string; courses: { title: string } }) => ({ course_id: e.course_id, title: e.courses?.title || '' })).filter((e: { title: string }) => e.title));
        }).catch(() => {});
      }
    }
  }, [country]);

  const countryName = COUNTRIES.find(c => c.code === country)?.name || country;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <ForumHamburgerNav />

{/* Hero */}
      <section className="py-16 px-4" style={{ background: 'linear-gradient(135deg, #001840 0%, #002050 60%, #003580 100%)' }}>
        <div className="max-w-4xl mx-auto text-center">
          {isLoggedIn && (
            <div className="flex justify-start mb-6">
              <button onClick={() => navigate(dashboardPath)}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-all"
                style={{ backgroundColor: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.80)', border: '1px solid rgba(255,255,255,0.15)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.18)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.10)'}>
                ← Retour au tableau de bord
              </button>
            </div>
          )}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 border border-amber-400/30" style={{ backgroundColor: 'rgba(191,136,19,0.12)' }}>
            <MessageCircle className="w-4 h-4" style={{ color: '#BF8813' }} />
            <span className="text-sm font-medium" style={{ color: '#BF8813' }}>Communauté Omnia</span>
          </div>
          <h1 className="mb-3 inline-flex rounded-2xl bg-white/95 px-5 py-3 text-4xl font-bold shadow-sm md:text-5xl"><span style={{ color: '#002050' }}>Omnia</span><span className="ml-3" style={{ color: '#BF8813' }}>Forum</span></h1>
          <p className="text-lg mb-8" style={{ color: '#BF8813' }}>Apprenez ensemble, posez vos questions, partagez votre savoir</p>

          {/* Country selector */}
          <div className="inline-flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2.5 border border-white/20">
              <Globe className="w-4 h-4 text-white/70" />
              <span className="text-white/70 text-sm">Affichage pour :</span>
              <div className="relative">
                <select value={country} onChange={e => setCountry(e.target.value)}
                  className="bg-transparent text-white font-semibold text-sm pr-6 focus:outline-none cursor-pointer appearance-none">
                  {COUNTRIES.map(c => <option key={c.code} value={c.code} style={{ color: '#002050' }}>{c.name}</option>)}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-white/70 absolute right-0 top-0.5 pointer-events-none" />
              </div>
            </div>
            <p className="text-white/40 text-xs">Le forum est filtré par pays. Changez pour voir d'autres communautés.</p>
          </div>
        </div>
      </section>

      {/* 3 Space Cards */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {/* Espace Général */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-amber-200 transition-all p-6 flex flex-col">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: '#FEF9EE' }}>
              <MessageCircle className="w-6 h-6" style={{ color: '#BF8813' }} />
            </div>
            <h2 className="text-lg font-bold mb-1" style={{ color: '#002050' }}>Espace Général</h2>
            <p className="text-sm text-gray-500 mb-3 flex-1">Discussions, entraide, vie étudiante</p>
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
              <Users className="w-3.5 h-3.5" />
              <span>{stats.general} discussion{stats.general !== 1 ? 's' : ''} · {countryName}</span>
            </div>
            <Link to={`/forum/general?country_code=${country}`}
              className="block text-center py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#002050' }}>
              Accéder →
            </Link>
          </div>

          {/* Espace Carrière */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-amber-200 transition-all p-6 flex flex-col">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: '#FEF9EE' }}>
              <Briefcase className="w-6 h-6" style={{ color: '#BF8813' }} />
            </div>
            <h2 className="text-lg font-bold mb-1" style={{ color: '#002050' }}>Carrière & Emploi</h2>
            <p className="text-sm text-gray-500 mb-3 flex-1">Offres d'emploi, conseils carrière</p>
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
              <Briefcase className="w-3.5 h-3.5" />
              <span>{stats.jobs} offre{stats.jobs !== 1 ? 's' : ''} active{stats.jobs !== 1 ? 's' : ''}</span>
            </div>
            <Link to="/emploi"
              className="block text-center py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 mb-2"
              style={{ backgroundColor: '#002050' }}>
              Voir les offres →
            </Link>
            <Link to="/recruteur" className="block text-center text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Vous recrutez ? Déposez une offre
            </Link>
          </div>

          {/* Forums de Cours */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-amber-200 transition-all p-6 flex flex-col">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: '#FEF9EE' }}>
              <BookOpen className="w-6 h-6" style={{ color: '#BF8813' }} />
            </div>
            <h2 className="text-lg font-bold mb-1" style={{ color: '#002050' }}>Forums des Formations</h2>
            <p className="text-sm text-gray-500 mb-3">Posez vos questions sur vos cours</p>

            {isLoggedIn && enrollments.length > 0 ? (
              <div className="flex-1 space-y-1.5 mb-4">
                {enrollments.slice(0, 4).map(e => (
                  <Link key={e.course_id} to={`/forum/cours/${e.course_id}`}
                    className="flex items-center gap-2 text-xs text-gray-600 hover:text-blue-700 py-1 px-2 rounded-lg hover:bg-gray-50 transition-colors truncate">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#BF8813' }} />
                    {e.title}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 flex-1 mb-4">Accessible depuis vos formations achetées</p>
            )}

            {isLoggedIn ? (
              enrollments.length === 0 && (
                <Link to="/catalogue"
                  className="block text-center py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#002050' }}>
                  Parcourir les formations
                </Link>
              )
            ) : (
              <Link to="/connexion"
                className="block text-center py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#002050' }}>
                Se connecter pour accéder
              </Link>
            )}
          </div>
        </div>
      </section>

      <PageFooter />
    </div>
  );
}
