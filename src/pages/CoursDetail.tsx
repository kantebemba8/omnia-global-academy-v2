import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Lock, PlayCircle, Volume2, FileText, Check, Ear, BookOpen, Mic, PenLine, AlertTriangle, BadgeCheck, Building2, ExternalLink, Eye, Radio, Video, ShieldCheck, MapPin, CalendarDays, Users } from 'lucide-react';
import { AdaptiveFormationsLayout } from '../components/formations/FormationsRoleLayout';
import { CourseCard, type CourseCardData } from '../components/CourseCard';
import { useAuth } from '../hooks/useAuth';
import { ENDPOINTS } from '../lib/config';

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const LEVEL_COLORS: Record<string, string> = {
  'Débutant': '#1E7A52', 'Intermédiaire': '#F59E0B', 'Avancé': '#DC2626', 'Expert': '#7C3AED',
};

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const safe = Number.isFinite(Number(rating)) ? Math.min(5, Math.max(0, Number(rating))) : 0;
  const n = Math.round(safe);
  return <span style={{ color: '#BF8813', fontSize: `${size}px`, letterSpacing: '1px' }}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>;
}

function Monogram({ name, size = 56 }: { name: string; size?: number }) {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
  return (
    <div className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: '#002050', fontSize: size * 0.35 }}>
      {initials}
    </div>
  );
}

function SkeletonHero() {
  return (
    <div className="animate-pulse" style={{ backgroundColor: '#001540', minHeight: '420px' }}>
      <div className="max-w-6xl mx-auto px-6 py-16 flex gap-8">
        <div className="flex-1 space-y-4">
          <div className="h-3 rounded w-32" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
          <div className="h-8 rounded w-3/4" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
          <div className="h-4 rounded w-full" style={{ backgroundColor: 'rgba(255,255,255,0.10)' }} />
          <div className="h-4 rounded w-2/3" style={{ backgroundColor: 'rgba(255,255,255,0.10)' }} />
        </div>
        <div className="hidden md:block w-80 h-64 rounded-2xl flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.10)' }} />
      </div>
    </div>
  );
}

export function CoursDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, sessionToken } = useAuth();
  const previewMode = new URLSearchParams(window.location.search).get('preview');
  const isCreatorPreview = previewMode === 'visitor';

  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState('');
  const [similar, setSimilar] = useState<CourseCardData[]>([]);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [trainingSessions, setTrainingSessions] = useState<any[]>([]);
  const [sessionAction, setSessionAction] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const headers: Record<string, string> = { Authorization: `Bearer ${ANON_KEY}` };
    if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;

    fetch(`${ENDPOINTS.courseDetail}?id=${id}${isCreatorPreview ? '&preview=visitor' : ''}`, { headers })
      .then(async r => { const d = await r.json().catch(() => null); if (!r.ok || !d?.course) throw new Error(d?.message || d?.error || 'COURSE_DETAIL_UNAVAILABLE'); return d; })
      .then(d => {
        setDetail(d);
        setIsEnrolled(d.is_enrolled ?? false);
        fetch(`${ENDPOINTS.courseSessions}?course_id=${encodeURIComponent(String(id))}`, { headers: { Authorization: `Bearer ${ANON_KEY}` } })
          .then(r => r.json()).then(s => setTrainingSessions(Array.isArray(s.sessions) ? s.sessions : [])).catch(() => setTrainingSessions([]));
        // Open first module by default
        const firstMod = Array.isArray(d.modules) ? d.modules[0] : null;
        if (firstMod?.id) setOpenModules(new Set([firstMod.id as string]));
        // Fetch similar courses
        const cat = (d.course as Record<string, unknown>)?.category;
        if (cat) {
          fetch(`${ENDPOINTS.catalogueList}?categorie=${encodeURIComponent(String(cat))}&limit=4`, { headers: { Authorization: `Bearer ${ANON_KEY}` } })
            .then(r2 => r2.json())
            .then(d2 => setSimilar((d2.courses ?? []).filter((c: CourseCardData) => c.id !== id).slice(0, 4)));
        }
      })
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [id, sessionToken, isCreatorPreview]);

  const toggleModule = (mid: string) => {
    setOpenModules(prev => {
      const next = new Set(prev);
      if (next.has(mid)) next.delete(mid); else next.add(mid);
      return next;
    });
  };

  const handleEnroll = async () => {
    if (!sessionToken) { navigate('/inscription'); return; }
    setEnrolling(true); setEnrollMsg('');
    try {
      const res = await fetch(ENDPOINTS.courseEnroll, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ course_id: id }),
      });
      const data = await res.json();
      if (data.success) setIsEnrolled(true);
      else setEnrollMsg(data.message);
    } finally {
      setEnrolling(false);
    }
  };


  const registerTrainingSession = async (session: any) => {
    if (!sessionToken) { navigate(`/connexion?redirect=${encodeURIComponent(`/cours/${id}`)}`); return; }
    setSessionAction(session.id);
    try {
      const r = await fetch(ENDPOINTS.courseSessions, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}`, 'x-omnia-session-token': sessionToken },
        body: JSON.stringify({ action: 'register', session_id: session.id }),
      });
      const d = await r.json();
      if (!r.ok || d.success === false) throw new Error(d.message || d.error || 'Inscription impossible');
      if (d.payment_required) navigate(`/paiement/${id}?session_id=${session.id}`);
      else if (d.waitlisted) setEnrollMsg("La session est complète : vous avez été ajouté à la liste d'attente.");
      else setEnrollMsg('Inscription à la session confirmée.');
    } catch (e) { setEnrollMsg(e instanceof Error ? e.message : 'Erreur'); }
    finally { setSessionAction(null); }
  };

  if (loading) return <AdaptiveFormationsLayout><div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}><SkeletonHero /></div></AdaptiveFormationsLayout>;
  if (!detail || !detail.course) {
    return (
      <AdaptiveFormationsLayout><div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
          <p className="font-bold text-lg mb-4" style={{ color: '#002050' }}>Formation introuvable.</p>
          <button onClick={() => navigate('/catalogue')} className="px-6 py-3 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: '#002050' }}>← Retour au catalogue</button>
        </div>
      </div></AdaptiveFormationsLayout>
    );
  }

  const course = detail.course as Record<string, unknown>;
  const creator = (detail.creator ?? {}) as Record<string, unknown>;
  const modules = Array.isArray(detail.modules) ? detail.modules as Record<string, unknown>[] : [];
  const reviews = Array.isArray(detail.reviews) ? detail.reviews as Record<string, unknown>[] : [];
  const ratingDist = Array.isArray(detail.rating_distribution) ? detail.rating_distribution as { stars: number; count: number; pct: number }[] : [];
  const freePreviewId = detail.free_preview_lesson_id as string | null;
  const certifications = (Array.isArray(detail.certifications) ? detail.certifications : []) as Array<{
    id: string;
    certification_type?: string | null;
    organization_name?: string | null;
    certification_name?: string | null;
    certification_code?: string | null;
    credit_value?: number | null;
    credit_unit?: string | null;
    logo_url?: string | null;
    verification_url?: string | null;
    website_url?: string | null;
    valid_from?: string | null;
    expires_at?: string | null;
    display_on_certificate?: boolean;
  }>;
  const liveContent = (Array.isArray(detail.live_content) ? detail.live_content : []) as Array<{
    id: string;
    event_id?: string | null;
    media_id?: string | null;
    title_override?: string | null;
    position?: number;
    required?: boolean;
    live_events?: { id:string; title:string; delivery_type?:string; status?:string; starts_at?:string|null; organizer_display_name?:string|null } | null;
    live_media?: { id:string; event_id?:string; title?:string|null; media_type?:string; status?:string; processing_status?:string; sequence_no?:number|null; duration_seconds?:number|null } | null;
  }>;

  const realModules = modules.filter((m:any) => (m.section_type || (m.is_intro ? 'introduction' : m.is_conclusion ? 'conclusion' : m.is_final_exam ? 'final_exam' : 'module')) === 'module');
  const totalLessons = realModules.reduce((sum:number, m:any) => sum + ((m.lessons as any[]) || []).filter((lesson:any) => (lesson.stage_type || (lesson.is_module_intro ? 'module_presentation' : 'lesson')) === 'lesson').length, 0);
  const totalModules = realModules.length;
  const cpd = course.cpd_hours as number ?? 0;
  const levelColor = LEVEL_COLORS[course.level as string] ?? '#6B7280';
  const isFree = course.is_free as boolean;
  const averageRating = Number(course.average_rating || 0);
  const totalReviews = Number(course.total_reviews || 0);
  const totalStudents = Number(course.total_students || 0);
  const priceXof = Number(course.price_xof || 0);
  const trainingMode = String(course.training_delivery_mode || 'online');

  // Purchase card CTA
  const renderCTA = () => {
    if (isCreatorPreview) {
      return <button type="button" disabled className="w-full py-3 rounded-lg font-semibold text-white opacity-90" style={{ backgroundColor: '#BF8813' }}>Acheter maintenant</button>;
    }
    if (!user) {
      return (
        <div className="space-y-2">
          <button onClick={() => navigate('/inscription')} className="w-full py-3 rounded-lg font-semibold text-white transition-opacity hover:opacity-85" style={{ backgroundColor: '#BF8813' }}>
            S'inscrire pour commencer
          </button>
          <button onClick={() => navigate('/connexion')} className="w-full py-3 rounded-lg font-semibold transition-opacity hover:opacity-80" style={{ border: '1.5px solid #002050', color: '#002050' }}>
            Se connecter
          </button>
        </div>
      );
    }
    if (isEnrolled) {
      return (
        <button onClick={() => navigate(`/cours/${id}/apprendre`)} className="w-full py-3 rounded-lg font-semibold text-white transition-opacity hover:opacity-85" style={{ backgroundColor: '#002050' }}>
          Continuer ma formation →
        </button>
      );
    }
    if (isFree) {
      return (
        <div className="space-y-2">
          <button onClick={handleEnroll} disabled={enrolling} className="w-full py-3 rounded-lg font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-60" style={{ backgroundColor: '#1E7A52' }}>
            {enrolling ? 'Inscription...' : "S'inscrire gratuitement"}
          </button>
          {enrollMsg && <p className="text-xs text-center" style={{ color: '#DC2626' }}>{enrollMsg}</p>}
        </div>
      );
    }
    return (
      <button onClick={() => navigate(`/paiement/${id}`)} className="w-full py-3 rounded-lg font-semibold text-white transition-opacity hover:opacity-85" style={{ backgroundColor: '#BF8813' }}>
        Acheter maintenant
      </button>
    );
  };

  return (
    <AdaptiveFormationsLayout>
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#FFFFFF' }}>

      {isCreatorPreview && <div className="fixed left-0 right-0 top-0 z-50 border-b" style={{background:'#FFFBEB',borderColor:'#E9C969'}}><div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2.5 text-xs font-semibold" style={{color:'#7A560C'}}><ShieldCheck size={15}/>Prévisualisation « visiteur avant achat » — cette page est la vraie présentation de la formation. Les actions d’achat sont neutralisées.</div></div>}

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section className={isCreatorPreview ? "pt-24" : "pt-16"} style={{ background: 'linear-gradient(135deg,#00183F 0%,#002050 62%,#123C6A 100%)' }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-10 sm:py-14 grid lg:grid-cols-[minmax(0,1fr)_minmax(390px,480px)] gap-9 items-center">
          {/* Left */}
          <div className="flex-1">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs mb-5 flex-wrap" style={{ color: 'rgba(255,255,255,0.55)' }}>
              <button onClick={() => navigate('/catalogue')} className="hover:text-white transition-colors">Catalogue</button>
              <ChevronRight size={12} />
              {course.category && <button onClick={() => navigate(`/catalogue?categorie=${encodeURIComponent(String(course.category))}`)} className="hover:text-white transition-colors">{String(course.category)}</button>}
              <ChevronRight size={12} />
              <span className="text-white truncate max-w-xs">{String(course.title)}</span>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-white" style={{ backgroundColor: levelColor }}>{String(course.level)}</span>
              {course.cpd_accredited && <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#BF8813', color: '#FFF' }}>Reconnaissance ✓</span>}
              {course.language && <span className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)' }}>{String(course.language).toUpperCase()}</span>}
              {course.niveau_cecrl && <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#1E3A6E', color: '#60A5FA', border: '1px solid rgba(96,165,250,0.35)' }}>CECRL {String(course.niveau_cecrl)}</span>}
              {course.langue_enseignee && <span className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.80)' }}>🌐 {String(course.langue_enseignee)}</span>}
            </div>

            <h1 className="font-bold text-white mb-3" style={{ fontSize: 'clamp(22px,3vw,38px)', lineHeight: 1.15 }}>{String(course.title)}</h1>
            {course.short_description && <p className="mb-4" style={{ color: '#BF8813', fontSize: '15px', lineHeight: 1.6 }}>{String(course.short_description)}</p>}

            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <Stars rating={averageRating} size={16} />
              <span className="font-bold text-white text-sm">{averageRating.toFixed(1)}</span>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.60)' }}>({totalReviews} avis)</span>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.60)' }}>· {totalStudents} élèves</span>
            </div>

            {(creator.full_name || creator.school_name) && (
              <div className="mt-5 flex items-center gap-3">
                {((course.creator_type === 'plateforme' || course.creator_context === 'super_admin') || String(creator.full_name ?? creator.school_name ?? '').toLowerCase().includes('omnia global academy')) ? <img src="/omnia-sidebar-logo.png" alt="Omnia Global Academy" className="h-11 w-11 rounded-xl border border-white/30 bg-white p-1 object-contain" /> : (creator.avatar_url || creator.logo_url) ? <img src={String(creator.avatar_url || creator.logo_url)} alt="" className="h-11 w-11 rounded-full border-2 border-white/30 object-cover" /> : <Monogram name={String(creator.full_name || creator.school_name || 'Omnia')} size={44} />}
                <div><p className="text-xs" style={{ color:'rgba(255,255,255,.55)' }}>Créé par</p><p className="text-sm font-bold text-white">{String(creator.full_name || creator.school_name)}</p>{creator.expertise_domain&&<p className="text-xs" style={{color:'#E5BE5B'}}>{String(creator.expertise_domain)}</p>}</div>
              </div>
            )}
            {creator.school_name && (
              <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.70)' }}>École : <span>{String(creator.school_name)}</span></p>
            )}
            {cpd > 0 && <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.70)' }}>⏱ {cpd} h d’apprentissage reconnu</p>}
          </div>

          {/* Purchase card */}
          <div className="w-full min-w-0">
            <div className="rounded-2xl overflow-hidden sticky" style={{ top: '88px', backgroundColor: '#FFFFFF', boxShadow: '0 8px 32px rgba(0,0,0,0.22)' }}>
              {course.cover_image_url
                ? <img src={String(course.cover_image_url)} alt={String(course.title)} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                : <div style={{ aspectRatio: '16/9', backgroundColor: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PlayCircle size={40} style={{ color: '#BF8813' }} /></div>
              }
              <div className="p-5">
                <p className="font-bold mb-4" style={{ color: isFree ? '#1E7A52' : '#002050', fontSize: '28px' }}>
                  {isFree ? 'Gratuit' : `${priceXof.toLocaleString('fr-FR')} XOF`}
                </p>
                {renderCTA()}
                  <button onClick={() => navigate(isCreatorPreview ? `/cours/${id}/apprendre?preview=learner` : `/cours/${id}/apercu`)} className="w-full mt-2 py-2.5 rounded-lg text-sm font-semibold" style={{ border: '1.5px solid #002050', color: '#002050', backgroundColor: '#FFFFFF' }}>
                    {isCreatorPreview ? 'Voir le rendu apprenant après achat' : 'Lire un aperçu gratuit'}
                  </button>
                <ul className="mt-4 space-y-1.5">
                  {[
                    'Accès illimité à vie',
                    'Certificat à l\'obtention',
                    'Support via le forum du cours',
                    ...(course.cpd_accredited ? ['Certification ou reconnaissance professionnelle'] : []),
                    ...(liveContent.length ? ['Lives / Replays Omnia inclus'] : []),
                  ].map(g => (
                    <li key={g} className="flex items-center gap-2 text-xs" style={{ color: '#6B7280' }}>
                      <Check size={12} style={{ color: '#1E7A52', flexShrink: 0 }} /> {g}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-10 sm:py-12 space-y-10">

        {/* Présentation visible avant achat */}
        {course.long_description && (() => { const text=String(course.long_description); const isLong=text.length>900; const visible=!isLong||aboutOpen?text:`${text.slice(0,900).trim()}…`; return (
          <section className="rounded-[22px] border bg-white p-5 sm:p-7" style={{borderColor:'#E4E7EC'}}>
            <p className="text-xs font-black uppercase tracking-[.15em]" style={{color:'#BF8813'}}>Présentation</p>
            <h2 className="mt-1 font-black" style={{ color: '#002050', fontSize: '24px' }}>À propos de cette formation</h2>
            <div className="mt-4 text-sm whitespace-pre-line" style={{ color: '#475569', lineHeight: 1.8 }}>{visible}</div>
            {isLong&&<button type="button" onClick={()=>setAboutOpen(value=>!value)} className="mt-3 text-sm font-bold" style={{color:'#002050'}}>{aboutOpen?'Réduire':'Voir plus'}</button>}
          </section>
        ); })()}

        {course.target_audience && (
          <section>
            <h2 className="font-bold mb-4" style={{ color: '#002050', fontSize: '22px' }}>À qui s’adresse cette formation ?</h2>
            <div className="flex items-start gap-3 p-5 rounded-xl" style={{ border: '1px solid #E4E7EC', background: '#FFFBEB' }}>
              <Check size={17} style={{ color: '#BF8813', flexShrink: 0, marginTop: 2 }} />
              <p className="text-sm whitespace-pre-line" style={{ color: '#374151', lineHeight: 1.7 }}>{String(course.target_audience)}</p>
            </div>
          </section>
        )}

        {/* Objectives */}
        {Array.isArray(course.objectives) && (course.objectives as unknown[]).length > 0 && (
          <section className="rounded-[22px] border bg-white p-5 sm:p-7" style={{borderColor:'#E4E7EC'}}>
            <h2 className="font-black mb-5" style={{ color: '#002050', fontSize: '22px' }}>Ce que vous allez apprendre</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(course.objectives as string[]).map((obj, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Check size={15} style={{ color: '#BF8813', flexShrink: 0, marginTop: 2 }} />
                  <span className="text-sm" style={{ color: '#374151' }}>{obj}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {liveContent.length > 0 && (
          <section>
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[.14em]" style={{ color: '#BF8813' }}>Inclus dans votre accès</p>
              <h2 className="mt-1 font-bold" style={{ color: '#002050', fontSize: '22px' }}>Lives & Replays liés à la formation</h2>
              <p className="mt-1 text-sm text-gray-500">Ces contenus restent hébergés dans Omnia Live. L’inscription ou l’achat de cette formation vous accorde automatiquement les droits correspondants.</p>
            </div>
            <div className="divide-y rounded-xl border" style={{ borderColor: '#E4E7EC' }}>
              {liveContent.map((link) => {
                const media = link.live_media;
                const event = link.live_events;
                const title = link.title_override || media?.title || event?.title || 'Contenu Omnia Live';
                const isMedia = !!media;
                return <div key={link.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background:'#FFF9EA', color:'#BF8813' }}>{isMedia?<Video size={17}/>:<Radio size={17}/>}</span>
                    <div className="min-w-0"><p className="font-semibold" style={{ color:'#002050' }}>{title}</p><p className="mt-1 text-xs text-gray-500">{isMedia?(media?.media_type==='replay'?'Replay Omnia Live':'Vidéo Omnia Live'):event?.delivery_type==='synchronous_training'?'Formation Live multi-sessions':'Live Omnia'}{event?.starts_at?` · ${new Date(event.starts_at).toLocaleString('fr-FR')}`:''}</p></div>
                  </div>
                  {isEnrolled?<button type="button" onClick={()=>navigate(isMedia?`/omnia-live/watch/${media?.id}`:`/omnia-live/${event?.id}`)} className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-white" style={{background:'#002050'}}>{isMedia?'Regarder':'Ouvrir dans Omnia Live'}</button>:<span className="shrink-0 text-xs font-semibold text-gray-500">Accès après inscription</span>}
                </div>;
              })}
            </div>
          </section>
        )}

        {/* Certifications and recognized partners */}
        {certifications.length > 0 && (
          <section>
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.14em]" style={{ color: '#BF8813' }}>Reconnaissance vérifiée</p>
                <h2 className="mt-1 font-bold" style={{ color: '#002050', fontSize: '22px' }}>Certifications et partenaires</h2>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Seuls les organismes et logos validés par Omnia sont affichés. Les reconnaissances applicables seront reprises sur le certificat final.
                </p>
              </div>
              <BadgeCheck size={30} style={{ color: '#BF8813', flexShrink: 0 }} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {certifications.map((certification) => {
                const content = (
                  <div className="flex h-full items-start gap-4 rounded-xl border bg-white p-4 transition hover:shadow-sm" style={{ borderColor: '#E4E7EC' }}>
                    {certification.logo_url ? (
                      <img
                        src={certification.logo_url}
                        alt={`Logo ${certification.organization_name || 'organisme partenaire'}`}
                        loading="lazy"
                        decoding="async"
                        className="h-14 w-20 flex-shrink-0 rounded-lg border border-slate-100 bg-white object-contain p-1.5"
                      />
                    ) : (
                      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-amber-50">
                        <Building2 size={24} style={{ color: '#BF8813' }} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black" style={{ color: '#002050' }}>{certification.organization_name || 'Organisme partenaire'}</p>
                      <p className="mt-1 text-sm text-gray-600">{certification.certification_name || 'Reconnaissance associée'}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {certification.certification_code && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                            {certification.certification_code}
                          </span>
                        )}
                        {(certification.credit_value || certification.credit_unit) && (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                            {certification.credit_value ?? ''} {certification.credit_unit ?? ''}
                          </span>
                        )}
                        {certification.display_on_certificate !== false && (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                            Mention sur le certificat
                          </span>
                        )}
                      </div>
                    </div>
                    {(certification.verification_url || certification.website_url) && <ExternalLink size={15} className="flex-shrink-0 text-slate-400" />}
                  </div>
                );
                const href = certification.verification_url || certification.website_url;
                return href ? (
                  <a key={certification.id} href={href} target="_blank" rel="noopener noreferrer" className="block rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400">
                    {content}
                  </a>
                ) : <div key={certification.id}>{content}</div>;
              })}
            </div>
          </section>
        )}

        {/* Language section */}
        {course.niveau_cecrl && (() => {
          const CECRL_DESCS: Record<string, string> = {
            A1: 'Débutant complet', A2: 'Élémentaire', B1: 'Intermédiaire',
            B2: 'Intermédiaire supérieur', C1: 'Avancé', C2: 'Maîtrise',
          };
          const CECRL_LEVELS = ['A1','A2','B1','B2','C1','C2'];
          const currentIdx = CECRL_LEVELS.indexOf(String(course.niveau_cecrl));
          const COMP_ICONS: Record<string, React.ReactNode> = {
            comprehension_orale: <Ear size={16} />,
            comprehension_ecrite: <BookOpen size={16} />,
            expression_orale: <Mic size={16} />,
            expression_ecrite: <PenLine size={16} />,
          };
          const COMP_LABELS: Record<string, string> = {
            comprehension_orale: 'Compréhension orale',
            comprehension_ecrite: 'Compréhension écrite',
            expression_orale: 'Expression orale',
            expression_ecrite: 'Expression écrite',
          };
          const allComps = new Set(
            (modules as Array<{ competences_linguistiques?: string[] }>)
              .flatMap(m => m.competences_linguistiques ?? [])
          );
          const hasOralExam = course.examen_oral_statut === 'confirme';
          const isCertPrep = course.sous_categorie_langue === 'preparation_certification';
          return (
            <section>
              {isCertPrep && (
                <div className="flex items-start gap-3 p-4 rounded-xl mb-5" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                  <AlertTriangle size={16} style={{ color: '#D97706', flexShrink: 0, marginTop: 2 }} />
                  <p className="text-sm" style={{ color: '#92400E' }}>
                    Cette formation prépare à une certification officielle. Elle ne garantit pas l'obtention du titre mais vous donne toutes les clés pour y parvenir.
                  </p>
                </div>
              )}
              <h2 className="font-bold mb-5" style={{ color: '#002050', fontSize: '22px' }}>Compétences linguistiques</h2>
              <div className="p-5 rounded-xl mb-5" style={{ border: '1px solid #E4E7EC' }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold" style={{ color: '#002050' }}>Niveau CECRL visé</p>
                  <span className="text-sm font-bold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
                    {String(course.niveau_cecrl)} — {CECRL_DESCS[String(course.niveau_cecrl)] ?? ''}
                  </span>
                </div>
                <div className="flex gap-1">
                  {CECRL_LEVELS.map((lvl, i) => (
                    <div key={lvl} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-sm" style={{ height: '6px', backgroundColor: i <= currentIdx ? '#002050' : '#E4E7EC' }} />
                      <span className="text-xs" style={{ color: i <= currentIdx ? '#002050' : '#D1D5DB', fontWeight: i === currentIdx ? 700 : 400 }}>{lvl}</span>
                    </div>
                  ))}
                </div>
              </div>
              {allComps.size > 0 && (
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {Object.keys(COMP_LABELS).map(comp => {
                    const covered = allComps.has(comp);
                    return (
                      <div key={comp} className="flex items-center gap-3 p-3.5 rounded-xl" style={{ border: `1px solid ${covered ? '#BBF7D0' : '#F0F0F0'}`, backgroundColor: covered ? '#F0FDF4' : '#FAFAFA' }}>
                        <span style={{ color: covered ? '#1E7A52' : '#D1D5DB' }}>{COMP_ICONS[comp]}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium" style={{ color: covered ? '#166534' : '#9CA3AF' }}>{COMP_LABELS[comp]}</p>
                          <p className="text-xs" style={{ color: covered ? '#86EFAC' : '#D1D5DB' }}>{covered ? 'Couvert' : 'Non couvert'}</p>
                        </div>
                        {covered && <Check size={14} style={{ color: '#1E7A52', flexShrink: 0 }} />}
                      </div>
                    );
                  })}
                </div>
              )}
              {hasOralExam && (
                <div className="flex items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <Mic size={18} style={{ color: '#1E7A52', flexShrink: 0 }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#166534' }}>Examen oral inclus</p>
                    <p className="text-xs" style={{ color: '#4B7A5E' }}>Cette formation inclut un examen oral validé par notre équipe pédagogique.</p>
                  </div>
                </div>
              )}
            </section>
          );
        })()}

        {/* Prerequisites */}
        {course.prerequisites && (
          <section>
            <h2 className="font-bold mb-4" style={{ color: '#002050', fontSize: '20px' }}>Prérequis</h2>
            <ul className="space-y-2">
              {String(course.prerequisites).split('\n').filter(Boolean).map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#374151' }}>
                  <span style={{ color: '#BF8813' }}>•</span> {p}
                </li>
              ))}
            </ul>
          </section>
        )}


      {trainingMode !== 'online' && (
        <section className="mx-auto max-w-7xl px-5 sm:px-6 py-8">
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-widest" style={{color:'#0B817A'}}>{trainingMode === 'hybrid' ? 'Formation hybride' : 'Formation présentielle'}</p>
            <h2 className="mt-1 text-xl font-black" style={{color:'#002050'}}>Choisir une session</h2>
            <p className="mt-1 text-sm text-slate-500">Inscrivez-vous à la date et au lieu qui vous conviennent. Une formation 100 % présentielle ne nécessite pas de Builder.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {trainingSessions.map((s:any) => (
              <article key={s.id} className="rounded-2xl border bg-white p-5" style={{borderColor:'#E4E7EC'}}>
                <div className="flex items-start justify-between gap-3"><div><h3 className="font-black" style={{color:'#002050'}}>{s.title}</h3><p className="mt-1 text-xs font-semibold" style={{color:'#0B817A'}}>{s.delivery_mode === 'hybrid' ? 'Hybride' : 'Présentiel'} · {s.status === 'full' ? 'Complet' : 'Inscriptions ouvertes'}</p></div><span className="text-sm font-black" style={{color:'#BF8813'}}>{s.is_free ? 'Gratuit' : `${Number(s.price_xof || 0).toLocaleString('fr-FR')} XOF`}</span></div>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <p className="flex items-center gap-2"><CalendarDays size={16}/>{new Date(s.starts_at).toLocaleString('fr-FR')} → {new Date(s.ends_at).toLocaleString('fr-FR')}</p>
                  <p className="flex items-center gap-2"><MapPin size={16}/>{[s.venue,s.address,s.city,s.country].filter(Boolean).join(' · ') || 'Lieu à confirmer'}</p>
                  <p className="flex items-center gap-2"><Users size={16}/>{s.registered_count || 0}{s.capacity ? ` / ${s.capacity}` : ''} inscrit(s){s.places_remaining != null ? ` · ${s.places_remaining} place(s) restante(s)` : ''}</p>
                </div>
                <button type="button" disabled={sessionAction===s.id} onClick={() => registerTrainingSession(s)} className="mt-4 w-full rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50" style={{background:'#002050'}}>
                  {sessionAction===s.id ? 'Inscription…' : s.places_remaining===0 ? "Rejoindre la liste d’attente" : s.is_free ? "S’inscrire à cette session" : "Réserver / payer cette session"}
                </button>
              </article>
            ))}
          </div>
          {!trainingSessions.length && <div className="rounded-xl border border-dashed px-5 py-8 text-center text-sm text-slate-500">Aucune session publiée pour le moment.</div>}
          {enrollMsg && <p className="mt-3 text-sm font-semibold" style={{color:'#0B817A'}}>{enrollMsg}</p>}
        </section>
      )}

        {/* Programme */}
        {modules.length > 0 && (
          <section>
            <h2 className="font-bold mb-2" style={{ color: '#002050', fontSize: '22px' }}>Programme de la formation</h2>
            <p className="text-sm mb-5" style={{ color: '#6B7280' }}>{totalModules} module{totalModules > 1 ? 's' : ''} · {totalLessons} leçon{totalLessons > 1 ? 's' : ''}{cpd > 0 ? ` · ${cpd} h reconnues` : ''}</p>
            <div className="space-y-2">
              {modules.map((mod, mi) => {
                const mid = mod.id as string;
                const isOpen = openModules.has(mid);
                const lessons = (mod.lessons as Record<string, unknown>[]) ?? [];
                const sectionType = String(mod.section_type || (mod.is_intro ? 'introduction' : mod.is_conclusion ? 'conclusion' : mod.is_final_exam ? 'final_exam' : 'module'));
                const displayLessons = sectionType === 'module' ? lessons.filter((lesson:any) => String(lesson.stage_type || (lesson.is_module_intro ? 'module_presentation' : 'lesson')) === 'lesson') : [];
                const realLessonCount = displayLessons.length;
                return (
                  <div key={mid} className="rounded-xl overflow-hidden" style={{ border: '1px solid #E4E7EC' }}>
                    <button
                      className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-gray-50"
                      onClick={() => toggleModule(mid)}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-[10px] font-black uppercase tracking-[.08em] mt-0.5 rounded-lg px-2 py-1" style={{ color: '#8A650F', background:'#FFF7E1' }}>{(mod.section_type || (mod.is_intro ? 'introduction' : mod.is_conclusion ? 'conclusion' : mod.is_final_exam ? 'final_exam' : 'module')) === 'introduction' ? 'Introduction' : (mod.section_type || '') === 'conclusion' || mod.is_conclusion ? 'Conclusion' : (mod.section_type || '') === 'final_exam' || mod.is_final_exam ? 'Examen final' : `Module ${modules.slice(0,mi+1).filter((item:any)=>(item.section_type || (item.is_intro ? 'introduction' : item.is_conclusion ? 'conclusion' : item.is_final_exam ? 'final_exam' : 'module')) === 'module').length}`}</span>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: '#002050' }}>{String(mod.title)}</p>
                          {sectionType === 'module' && <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{realLessonCount} leçon{realLessonCount > 1 ? 's' : ''}</p>}
                        </div>
                      </div>
                      {isOpen ? <ChevronDown size={18} style={{ color: '#6B7280', flexShrink: 0 }} /> : <ChevronRight size={18} style={{ color: '#6B7280', flexShrink: 0 }} />}
                    </button>
                    {isOpen && (
                      <div style={{ borderTop: '1px solid #F0F0F0' }}>
                        {mod.objective && sectionType === 'module' && (
                          <p className="px-5 py-3 text-xs" style={{ color: '#6B7280', backgroundColor: '#FAFAFA' }}>{String(mod.objective)}</p>
                        )}
                        {displayLessons.map((lesson, li) => {
                          const isPreview = lesson.is_free_preview as boolean;
                          const sec = lesson.cpd_calculated_time_seconds as number ?? 0;
                          const mins = sec > 0 ? `${Math.ceil(sec / 60)} min` : '';
                          return (
                            <div key={lesson.id as string} className="flex items-center gap-3 px-5 py-3" style={{ borderTop: '1px solid #F8F9FA' }}>
                              {lesson.has_video ? <PlayCircle size={14} style={{ color: '#BF8813', flexShrink: 0 }} />
                                : lesson.has_audio ? <Volume2 size={14} style={{ color: '#BF8813', flexShrink: 0 }} />
                                : <FileText size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />}
                              <span className="flex-1 text-sm" style={{ color: '#374151' }}>{String(lesson.title)}</span>
                              {mins && <span className="text-xs" style={{ color: '#9CA3AF' }}>{mins}</span>}
                              {isPreview
                                ? <button onClick={() => navigate(isCreatorPreview ? `/cours/${id}/apprendre/${lesson.id}?preview=learner` : `/cours/${id}/apercu`)} className="text-xs font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(30,122,82,0.10)', color: '#1E7A52' }}>APERÇU</button>
                                : <Lock size={13} style={{ color: '#D1D5DB', flexShrink: 0 }} />
                              }
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Creator */}
        <section>
          <h2 className="font-bold mb-5" style={{ color: '#002050', fontSize: '22px' }}>{creator.public_creator_type === 'plateforme' ? 'Publié par' : creator.public_creator_type === 'structure' ? 'Structure créatrice' : 'Votre formateur'}</h2>
          <div className="flex items-start gap-4 p-5 rounded-xl" style={{ border: '1px solid #E4E7EC' }}>
            {((course.creator_type === 'plateforme' || course.creator_context === 'super_admin') || String(creator.full_name ?? creator.school_name ?? '').toLowerCase().includes('omnia global academy')) ? <img src="/omnia-sidebar-logo.png" alt="Omnia Global Academy" className="h-16 w-16 rounded-xl object-contain bg-white p-1" /> : (creator.avatar_url || creator.logo_url) ? <img src={String(creator.avatar_url || creator.logo_url)} alt="" className="h-16 w-16 rounded-full object-cover" /> : <Monogram name={String(creator.full_name ?? creator.school_name ?? 'Omnia')} size={64} />}
            <div>
              <p className="font-bold" style={{ color: '#002050', fontSize: '17px' }}>
                {String(creator.full_name ?? creator.school_name ?? 'Omnia Global Academy')}
              </p>
              {creator.expertise_domain && <p className="text-sm mt-0.5" style={{ color: '#BF8813' }}>{String(creator.expertise_domain)}</p>}
              {creator.bio && <p className="text-sm mt-2" style={{ color: '#6B7280', lineHeight: 1.65 }}>{String(creator.bio)}</p>}
              {(course.creator_type === 'plateforme' || course.creator_context === 'super_admin') && <p className="text-sm mt-2" style={{ color: '#6B7280' }}>Formation créée et publiée par Omnia Global Academy.</p>}
            </div>
          </div>
        </section>

        {/* Reviews */}
        <section>
          <h2 className="font-bold mb-6" style={{ color: '#002050', fontSize: '22px' }}>Avis et évaluations</h2>
          <div className="flex flex-col sm:flex-row gap-8 mb-8">
            <div className="text-center flex-shrink-0">
              <p className="font-bold leading-none" style={{ color: '#002050', fontSize: '56px' }}>{averageRating.toFixed(1)}</p>
              <Stars rating={averageRating} size={20} />
              <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>{totalReviews} avis</p>
            </div>
            <div className="flex-1 space-y-2">
              {ratingDist.map(({ stars, count, pct }) => (
                <div key={stars} className="flex items-center gap-3">
                  <span className="text-xs w-4 text-right" style={{ color: '#6B7280' }}>{stars}</span>
                  <span style={{ color: '#BF8813', fontSize: '12px' }}>★</span>
                  <div className="flex-1 rounded-full overflow-hidden" style={{ height: '6px', backgroundColor: '#F0F0F0' }}>
                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#BF8813', borderRadius: '9999px' }} />
                  </div>
                  <span className="text-xs w-8" style={{ color: '#9CA3AF' }}>{pct}%</span>
                  <span className="text-xs w-6" style={{ color: '#9CA3AF' }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
          {reviews.length === 0 ? (
            <p className="text-sm py-8 text-center rounded-xl" style={{ color: '#9CA3AF', border: '1px solid #F0F0F0' }}>
              Aucun avis pour l'instant. Les avis sont accessibles après l'obtention du certificat.
            </p>
          ) : (
            <div className="space-y-4">
              {reviews.map(r => (
                <div key={r.id as string} className="p-4 rounded-xl" style={{ border: '1px solid #E4E7EC' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <Monogram name={String(r.reviewer_initials ?? '?')} size={36} />
                    <div>
                      <Stars rating={r.rating as number} size={13} />
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>{new Date(r.created_at as string).toLocaleDateString('fr-FR')}</p>
                    </div>
                  </div>
                  {r.comment && <p className="text-sm line-clamp-3" style={{ color: '#374151', lineHeight: 1.65 }}>{String(r.comment)}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Similar courses */}
      {similar.length > 0 && (
        <section className="px-6 py-12" style={{ backgroundColor: '#F8F9FA', borderTop: '1px solid #E4E7EC' }}>
          <div className="max-w-6xl mx-auto">
            <h2 className="font-bold mb-6" style={{ color: '#002050', fontSize: '22px' }}>Vous pourriez aussi aimer</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {similar.map(c => <CourseCard key={c.id} course={c} />)}
            </div>
          </div>
        </section>
      )}

      {freePreviewId && !isEnrolled && (
        <div className="px-6 py-6 text-center" style={{ backgroundColor: '#FFFFFF', borderTop: '1px solid #E4E7EC' }}>
          <button onClick={() => navigate(`/cours/${id}/apercu`)} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white transition-opacity hover:opacity-85" style={{ backgroundColor: '#1E7A52' }}>
            <Eye size={17} /> Voir l'aperçu gratuit de la 1ère leçon
          </button>
        </div>
      )}

    </div>
    </AdaptiveFormationsLayout>
  );
}
