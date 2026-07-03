import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, BookOpen, User, LogOut, ChevronRight, AlertTriangle, GraduationCap } from 'lucide-react';
import { ENDPOINTS } from '../../lib/config';
import DemoExpiredModal from '../../components/DemoExpiredModal';
import DemoWatermark from '../../components/DemoWatermark';

interface DemoCourse {
  id: string;
  title: string;
  cover_image_url?: string;
  category?: string;
}

const DEMO_ROLE_OPTIONS = [
  { key: 'apprenant', label: 'Apprenant', description: 'Accès aux cours inscrits, forum, certificats', color: '#002050' },
  { key: 'professeur', label: 'Professeur', description: 'Création de cours, studio, statistiques', color: '#1E7A52' },
  { key: 'etablissement_directeur', label: 'Directeur', description: 'Tableau de bord école, gestion enseignants', color: '#7C3AED' },
  { key: 'moderateur', label: 'Modérateur', description: 'File de modération, signalements, KYC', color: '#D97706' },
];

const ROLE_REDIRECTS: Record<string, string> = {
  professeur: '/professeur/dashboard',
  etablissement_directeur: '/school/dashboard',
  moderateur: '/moderateur/dashboard',
  apprenant: '/dashboard',
};

function formatTime(seconds: number) {
  if (seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export default function DemoDashboard() {
  const navigate = useNavigate();
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [expired, setExpired] = useState(false);
  const [courses, setCourses] = useState<DemoCourse[]>([]);
  const [demoRoles, setDemoRoles] = useState<string[]>([]);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function handleDemoExpired() {
    setExpired(true);
    localStorage.removeItem('omnia_session_token');
    localStorage.removeItem('heartbeat_token');
    localStorage.removeItem('is_demo');
    localStorage.removeItem('demo_roles');
    localStorage.removeItem('demo_expires_at');
  }

  async function sendHeartbeat() {
    const heartbeatToken = localStorage.getItem('heartbeat_token');
    if (!heartbeatToken) { handleDemoExpired(); return; }

    try {
      const res = await fetch(ENDPOINTS.demoHeartbeat, {
        headers: { 'X-Demo-Heartbeat-Token': heartbeatToken },
      });
      const data = await res.json();
      if (data.expired || !data.active) {
        handleDemoExpired();
      } else {
        setTimeRemaining(data.time_remaining_seconds ?? 0);
      }
    } catch {
      // network error — keep countdown ticking, don't expire
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('omnia_session_token');
    const isDemo = localStorage.getItem('is_demo');
    if (!token || isDemo !== 'true') {
      navigate('/login');
      return;
    }

    // Load demo state from localStorage
    const storedRoles = localStorage.getItem('demo_roles');
    const storedExpiry = localStorage.getItem('demo_expires_at');
    if (storedRoles) {
      try { setDemoRoles(JSON.parse(storedRoles)); } catch { setDemoRoles(['apprenant']); }
    }
    if (storedExpiry) {
      const secs = Math.max(0, Math.floor((new Date(storedExpiry).getTime() - Date.now()) / 1000));
      setTimeRemaining(secs);
      if (secs <= 0) { handleDemoExpired(); return; }
    }

    // Load demo courses
    const storedCourseIds = localStorage.getItem('demo_course_ids');
    if (storedCourseIds) {
      try {
        const ids: string[] = JSON.parse(storedCourseIds);
        if (ids.length > 0) {
          Promise.all(
            ids.map((id) =>
              fetch(`${ENDPOINTS.courseDetail}?course_id=${id}`, {
                headers: { Authorization: `Bearer ${token}` },
              }).then((r) => r.json()).then((d) => d.course ?? null)
            )
          ).then((results) => setCourses(results.filter(Boolean)));
        }
      } catch { /* ignore */ }
    }

    // Initial heartbeat + polling every 30s
    sendHeartbeat();
    heartbeatRef.current = setInterval(sendHeartbeat, 30_000);

    // Countdown tick every second
    countdownRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) { handleDemoExpired(); return 0; }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRoleSwitch(role: string) {
    if (!demoRoles.includes(role)) return;
    const dest = ROLE_REDIRECTS[role] ?? '/dashboard';
    navigate(dest);
  }

  function handleLogout() {
    localStorage.clear();
    navigate('/');
  }

  if (expired) return <DemoExpiredModal />;

  const urgentColor = timeRemaining < 600 ? '#DC2626' : timeRemaining < 3600 ? '#D97706' : '#002050';

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8F9FA' }}>
      <DemoWatermark />

      {/* Header banner */}
      <div className="relative z-10" style={{ backgroundColor: '#BF8813' }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-white flex-shrink-0" />
            <span className="text-white text-sm font-medium">
              Accès démo — Session temporaire. Cette session ne permet pas d'achats réels.
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-white/80 hover:text-white text-xs transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Quitter
          </button>
        </div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Countdown + header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>
                Bienvenue sur la démo Omnia
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                Explorez la plateforme librement. Toutes les fonctionnalités sont accessibles.
              </p>
            </div>
            <div className="flex flex-col items-center px-5 py-3 rounded-xl" style={{ backgroundColor: '#F0F4FF' }}>
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4" style={{ color: urgentColor }} />
                <span className="text-xs font-medium text-gray-500">Temps restant</span>
              </div>
              <span className="text-3xl font-black tabular-nums" style={{ color: urgentColor }}>
                {formatTime(timeRemaining)}
              </span>
            </div>
          </div>
        </div>

        {/* Role selector */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Explorer un profil
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {DEMO_ROLE_OPTIONS.map((opt) => {
              const available = demoRoles.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  onClick={() => handleRoleSwitch(opt.key)}
                  disabled={!available}
                  className="bg-white rounded-xl border border-gray-100 p-4 text-left transition-all hover:shadow-md hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:translate-y-0"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                    style={{ backgroundColor: available ? opt.color : '#9CA3AF' }}
                  >
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: available ? opt.color : '#9CA3AF' }}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{opt.description}</p>
                  {available && (
                    <div className="flex items-center gap-1 mt-3" style={{ color: opt.color }}>
                      <span className="text-xs font-medium">Accéder</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Demo courses */}
        {courses.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Cours pré-chargés pour la démo
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => navigate(`/cours/${course.id}`)}
                  className="bg-white rounded-xl border border-gray-100 overflow-hidden text-left hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <div
                    className="h-28 flex items-center justify-center"
                    style={{
                      backgroundImage: course.cover_image_url ? `url(${course.cover_image_url})` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundColor: course.cover_image_url ? undefined : '#002050',
                    }}
                  >
                    {!course.cover_image_url && <GraduationCap className="w-8 h-8 text-white/40" />}
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-semibold line-clamp-2" style={{ color: '#002050' }}>{course.title}</p>
                    {course.category && (
                      <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F0F4FF', color: '#002050' }}>
                        {course.category}
                      </span>
                    )}
                    <div className="flex items-center gap-1 mt-3" style={{ color: '#002050' }}>
                      <BookOpen className="w-3 h-3" />
                      <span className="text-xs font-medium">Voir le cours</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Usage note */}
        <div className="rounded-xl p-4 border" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: '#92400E' }}>
            Conditions d'utilisation de la démo
          </p>
          <ul className="space-y-1">
            {[
              'Cette session est strictement à des fins de démonstration.',
              'Aucun achat réel ni retrait de fonds n\'est possible.',
              'Une seule session active à la fois — toute nouvelle connexion invalide celle-ci.',
              'Les données créées durant la démo peuvent être réinitialisées.',
            ].map((note, i) => (
              <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: '#78350F' }}>
                <span className="mt-0.5 flex-shrink-0">•</span>
                {note}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
}
