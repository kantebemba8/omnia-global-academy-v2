import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Lock, PlayCircle, Volume2, FileText, Check, Ear, BookOpen, Mic, PenLine, AlertTriangle, BadgeCheck, Building2, ExternalLink } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { PageFooter } from '../components/PageFooter';
import { CourseCard, type CourseCardData } from '../components/CourseCard';
import { useAuth } from '../hooks/useAuth';
import { ENDPOINTS } from '../lib/config';

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const LEVEL_COLORS: Record<string, string> = {
  'Débutant': '#1E7A52', 'Intermédiaire': '#F59E0B', 'Avancé': '#DC2626', 'Expert': '#7C3AED',
};

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const n = Math.round(rating);
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

  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState('');
  const [similar, setSimilar] = useState<CourseCardData[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const headers: Record<string, string> = { Authorization: `Bearer ${ANON_KEY}` };
    if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;

    fetch(`${ENDPOINTS.courseDetail}?id=${id}`, { headers })
      .then(r => r.json())
      .then(d => {
        setDetail(d);
        setIsEnrolled(d.is_enrolled ?? false);
        // Open first module by default
        const firstMod = (d.modules as Record<string,unknown>[])?.[0];
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
  }, [id, sessionToken]);

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

  if (loading) return <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}><Navbar /><SkeletonHero /></div>;
  if (!detail || !detail.course) {
    return (
      <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}><Navbar />
        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
          <p className="font-bold text-lg mb-4" style={{ color: '#002050' }}>Formation introuvable.</p>
          <button onClick={() => navigate('/catalogue')} className="px-6 py-3 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: '#002050' }}>← Retour au catalogue</button>
        </div>
        <PageFooter />
      </div>
    );
  }

  const course = detail.course as Record<string, unknown>;
  const creator = (detail.creator ?? {}) as Record<string, unknown>;
  const modules = (detail.modules ?? []) as Record<string, unknown>[];
  const reviews = (detail.reviews ?? []) as Record<string, unknown>[];
  const ratingDist = (detail.rating_distribution ?? []) as { stars: number; count: number; pct: number }[];
  const freePreviewId = detail.free_preview_lesson_id as string | null;
  const certifications = (detail.certifications ?? []) as Array<{
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

  const totalLessons = modules.reduce((s, m) => s + ((m.lessons as unknown[])?.length ?? 0), 0);
  const cpd = course.cpd_hours as number ?? 0;
  const levelColor = LEVEL_COLORS[course.level as string] ?? '#6B7280';
  const isFree = course.is_free as boolean;

  // Purchase card CTA
  const renderCTA = () => {
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
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#FFFFFF' }}>
      <Navbar />

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section className="pt-16" style={{ backgroundColor: '#002050' }}>
        <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col md:flex-row gap-8 items-start">
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
              {course.cpd_accredited && <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#BF8813', color: '#FFF' }}>CPD ✓</span>}
              {course.language && <span className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)' }}>{String(course.language).toUpperCase()}</span>}
              {course.niveau_cecrl && <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#1E3A6E', color: '#60A5FA', border: '1px solid rgba(96,165,250,0.35)' }}>CECRL {String(course.niveau_cecrl)}</span>}
              {course.langue_enseignee && <span className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.80)' }}>🌐 {String(course.langue_enseignee)}</span>}
            </div>

            <h1 className="font-bold text-white mb-3" style={{ fontSize: 'clamp(22px,3vw,38px)', lineHeight: 1.15 }}>{String(course.title)}</h1>
            {course.short_description && <p className="mb-4" style={{ color: '#BF8813', fontSize: '15px', lineHeight: 1.6 }}>{String(course.short_description)}</p>}

            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <Stars rating={course.average_rating as number} size={16} />
              <span className="font-bold text-white text-sm">{(course.average_rating as number).toFixed(1)}</span>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.60)' }}>({course.total_reviews as number} avis)</span>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.60)' }}>· {course.total_students as number} élèves</span>
            </div>

            {creator.full_name && (
              <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.70)' }}>
                Créé par <span className="underline cursor-pointer hover:text-white">{String(creator.full_name)}</span>
              </p>
            )}
            {creator.school_name && (
              <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.70)' }}>École : <span>{String(creator.school_name)}</span></p>
            )}
            {cpd > 0 && <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.70)' }}>⏱ {cpd}h de formation CPD</p>}
          </div>

          {/* Purchase card */}
          <div className="w-full md:w-80 flex-shrink-0">
            <div className="rounded-2xl overflow-hidden sticky" style={{ top: '88px', backgroundColor: '#FFFFFF', boxShadow: '0 8px 32px rgba(0,0,0,0.22)' }}>
              {course.cover_image_url
                ? <img src={String(course.cover_image_url)} alt={String(course.title)} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                : <div style={{ aspectRatio: '16/9', backgroundColor: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PlayCircle size={40} style={{ color: '#BF8813' }} /></div>
              }
              <div className="p-5">
                <p className="font-bold mb-4" style={{ color: isFree ? '#1E7A52' : '#002050', fontSize: '28px' }}>
                  {isFree ? 'Gratuit' : `${(course.price_xof as number).toLocaleString()} XOF`}
                </p>
                {renderCTA()}
                  <button onClick={() => navigate(`/cours/${id}/apercu`)} className="w-full mt-2 py-2.5 rounded-lg text-sm font-semibold" style={{ border: '1.5px solid #002050', color: '#002050', backgroundColor: '#FFFFFF' }}>
                    Lire l’introduction gratuitement
                  </button>
                <ul className="mt-4 space-y-1.5">
                  {[
                    'Accès illimité à vie',
                    'Certificat à l\'obtention',
                    'Support via le forum du cours',
                    ...(course.cpd_accredited ? ['Accréditation CPD internationale'] : []),
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
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">

        {/* Présentation visible avant achat */}
        {course.long_description && (
          <section>
            <h2 className="font-bold mb-4" style={{ color: '#002050', fontSize: '22px' }}>À propos de cette formation</h2>
            <div className="p-5 rounded-xl text-sm whitespace-pre-line" style={{ border: '1px solid #E4E7EC', color: '#374151', lineHeight: 1.75 }}>
              {String(course.long_description)}
            </div>
          </section>
        )}

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
          <section>
            <h2 className="font-bold mb-5" style={{ color: '#002050', fontSize: '22px' }}>Ce que vous apprendrez</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-5 rounded-xl" style={{ border: '1px solid #E4E7EC' }}>
              {(course.objectives as string[]).map((obj, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Check size={15} style={{ color: '#BF8813', flexShrink: 0, marginTop: 2 }} />
                  <span className="text-sm" style={{ color: '#374151' }}>{obj}</span>
                </div>
              ))}
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

        {/* Programme */}
        {modules.length > 0 && (
          <section>
            <h2 className="font-bold mb-2" style={{ color: '#002050', fontSize: '22px' }}>Programme de la formation</h2>
            <p className="text-sm mb-5" style={{ color: '#6B7280' }}>{modules.length} module{modules.length > 1 ? 's' : ''} · {totalLessons} leçon{totalLessons > 1 ? 's' : ''}{cpd > 0 ? ` · ${cpd}h CPD` : ''}</p>
            <div className="space-y-2">
              {modules.map((mod, mi) => {
                const mid = mod.id as string;
                const isOpen = openModules.has(mid);
                const lessons = (mod.lessons as Record<string, unknown>[]) ?? [];
                return (
                  <div key={mid} className="rounded-xl overflow-hidden" style={{ border: '1px solid #E4E7EC' }}>
                    <button
                      className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-gray-50"
                      onClick={() => toggleModule(mid)}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xs font-bold mt-0.5" style={{ color: '#BF8813' }}>Module {mi + 1}</span>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: '#002050' }}>{String(mod.title)}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{lessons.length} leçon{lessons.length > 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      {isOpen ? <ChevronDown size={18} style={{ color: '#6B7280', flexShrink: 0 }} /> : <ChevronRight size={18} style={{ color: '#6B7280', flexShrink: 0 }} />}
                    </button>
                    {isOpen && (
                      <div style={{ borderTop: '1px solid #F0F0F0' }}>
                        {String(mod.objective) && (
                          <p className="px-5 py-3 text-xs" style={{ color: '#6B7280', backgroundColor: '#FAFAFA' }}>Objectif : {String(mod.objective)}</p>
                        )}
                        {lessons.map((lesson, li) => {
                          const isPreview = lesson.is_free_preview as boolean || (mi === 0 && li === 0);
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
                                ? <button onClick={() => navigate(`/cours/${id}/apercu`)} className="text-xs font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(30,122,82,0.10)', color: '#1E7A52' }}>APERÇU</button>
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
          <h2 className="font-bold mb-5" style={{ color: '#002050', fontSize: '22px' }}>Votre formateur</h2>
          <div className="flex items-start gap-4 p-5 rounded-xl" style={{ border: '1px solid #E4E7EC' }}>
            <Monogram name={String(creator.full_name ?? creator.school_name ?? 'Omnia')} size={64} />
            <div>
              <p className="font-bold" style={{ color: '#002050', fontSize: '17px' }}>
                {String(creator.full_name ?? creator.school_name ?? 'Omnia Global Academy')}
              </p>
              {creator.expertise_domain && <p className="text-sm mt-0.5" style={{ color: '#BF8813' }}>{String(creator.expertise_domain)}</p>}
              {creator.bio && <p className="text-sm mt-2" style={{ color: '#6B7280', lineHeight: 1.65 }}>{String(creator.bio)}</p>}
              {course.creator_type === 'plateforme' && <p className="text-sm mt-2" style={{ color: '#6B7280' }}>Formation générée par la plateforme Omnia Global Academy.</p>}
            </div>
          </div>
        </section>

        {/* Reviews */}
        <section>
          <h2 className="font-bold mb-6" style={{ color: '#002050', fontSize: '22px' }}>Avis et évaluations</h2>
          <div className="flex flex-col sm:flex-row gap-8 mb-8">
            <div className="text-center flex-shrink-0">
              <p className="font-bold leading-none" style={{ color: '#002050', fontSize: '56px' }}>{(course.average_rating as number).toFixed(1)}</p>
              <Stars rating={course.average_rating as number} size={20} />
              <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>{course.total_reviews as number} avis</p>
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
          <button onClick={() => navigate(`/cours/${id}/apercu`)} className="px-6 py-3 rounded-lg font-semibold text-white transition-opacity hover:opacity-85" style={{ backgroundColor: '#1E7A52' }}>
            👁 Voir l'aperçu gratuit de la 1ère leçon
          </button>
        </div>
      )}

      <PageFooter />
    </div>
  );
}
