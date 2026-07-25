import { useEffect, useMemo, useState } from 'react';
import {
  Award, BadgeCheck, BookOpen, Briefcase, CheckCircle2, ClipboardCheck, ExternalLink, FileCheck2,
  FolderOpen, GraduationCap, MessageSquare, Radio, ShieldCheck, Star, Users, XCircle,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ClrAchievement, ClrRecord, ClrShare, credentialStatusLabel, credentialsRequest } from '../../lib/credentialsApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

const SECTION_META: Record<string, { label: string; icon: typeof FileCheck2 }> = {
  formations: { label: 'Formations', icon: BookOpen },
  certificats: { label: 'Certificats', icon: GraduationCap },
  competences_verifiees: { label: 'Compétences vérifiées', icon: ShieldCheck },
  evaluations: { label: 'Évaluations', icon: ClipboardCheck },
  badges: { label: 'Badges', icon: BadgeCheck },
  coaching: { label: 'Coaching', icon: Users },
  omnia_live: { label: 'Omnia Live', icon: Radio },
  projets: { label: 'Projets', icon: FolderOpen },
  experiences: { label: 'Expériences', icon: Briefcase },
  recommandations: { label: 'Recommandations', icon: MessageSquare },
  engagement_communautaire: { label: 'Engagement communautaire', icon: Award },
};

type PublicClrResponse = {
  success: true;
  record: ClrRecord;
  share: Pick<ClrShare, 'label' | 'expires_at' | 'visibility_filter' | 'include_sections'>;
  achievements: ClrAchievement[];
};

export default function PublicClrShare() {
  const { shareToken = '' } = useParams();
  const [record, setRecord] = useState<ClrRecord | null>(null);
  const [share, setShare] = useState<PublicClrResponse['share'] | null>(null);
  const [achievements, setAchievements] = useState<ClrAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await credentialsRequest<PublicClrResponse>('public_clr', { token: shareToken });
        if (!active) return;
        setRecord(response.record);
        setShare(response.share);
        setAchievements(response.achievements || []);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Lien invalide.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [shareToken]);

  const sections = useMemo(() => {
    const grouped = new Map<string, ClrAchievement[]>();
    for (const item of achievements) grouped.set(item.section, [...(grouped.get(item.section) || []), item]);
    const preferred = record?.section_order || [];
    const order = [...preferred, ...[...grouped.keys()].filter(section => !preferred.includes(section))];
    return order.map(section => [section, grouped.get(section) || []] as const).filter(([, items]) => items.length > 0);
  }, [achievements, record]);

  const metrics = useMemo(() => ({
    total: achievements.length,
    verified: achievements.filter(item => item.verification_status === 'verified').length,
    skills: new Set(achievements.flatMap(item => item.skills || [])).size,
    featured: achievements.filter(item => item.is_featured).length,
  }), [achievements]);

  return <div className="min-h-screen bg-slate-50 px-4 py-8 md:py-10">
    <div className="mx-auto max-w-5xl">
      <Link to="/accueil" className="inline-flex items-center gap-3">
        <img src="/omnia-sidebar-logo.png" alt="Omnia Global Academy" className="h-11 w-11 object-contain" />
        <span className="font-bold" style={{ color: BLUE }}>Omnia Global Academy</span>
      </Link>

      {loading ? <div className="py-32 text-center text-sm text-slate-500">Chargement du Learning Record…</div>
        : error || !record ? <Unavailable message={humanError(error)} />
          : <>
            <header className="mt-8 overflow-hidden rounded-3xl text-white shadow-xl" style={{ background: 'linear-gradient(135deg,#002050,#003579)' }}>
              <div className="p-7 md:p-9">
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div className="flex min-w-0 items-start gap-4">
                    {record.user?.avatar_url ? <img src={record.user.avatar_url} alt="" className="h-16 w-16 rounded-2xl border border-white/20 object-cover" /> : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-2xl font-semibold">{initials(record.user?.full_name || record.title)}</span>}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[.16em]" style={{ color: GOLD }}>Omnia Learning Record</p>
                      <h1 className="mt-2 truncate text-2xl font-semibold md:text-3xl">{record.user?.full_name || record.title}</h1>
                      <p className="mt-2 font-medium text-white/90">{record.profile_headline || record.title}</p>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">{record.summary || record.description || 'Dossier de réalisations, compétences et expériences partagé par son titulaire.'}</p>
                    </div>
                  </div>
                  <FileCheck2 size={48} color={GOLD} className="shrink-0" />
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-white/80">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><ShieldCheck size={14} />{record.standards_status === 'clr2_signed' ? 'CLR 2.0 signé' : 'CLR 2.0 généré par Omnia'}</span>
                  <span>Version {record.version}</span>
                  {record.signed_at && <span>Signé le {new Date(record.signed_at).toLocaleDateString('fr-FR')}</span>}
                  {record.user?.country_code && <span>Pays : {record.user.country_code}</span>}
                </div>
              </div>
              <div className="grid grid-cols-2 border-t border-white/10 bg-black/10 md:grid-cols-4">
                <Metric label="Éléments partagés" value={metrics.total} />
                <Metric label="Vérifiés" value={metrics.verified} />
                <Metric label="Compétences" value={metrics.skills} />
                <Metric label="Mis en avant" value={metrics.featured} />
              </div>
            </header>

            <div className="mt-5 rounded-2xl border bg-white p-4 text-sm text-slate-600" style={{ borderColor: BORDER }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><span className="font-semibold" style={{ color: BLUE }}>{share?.label || 'Partage du Learning Record'}</span><p className="mt-1 text-xs text-slate-500">Seules les sections et informations autorisées par le titulaire sont affichées.</p></div>
                {share?.expires_at && <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs">Lien valable jusqu’au {new Date(share.expires_at).toLocaleDateString('fr-FR')}</span>}
              </div>
            </div>

            <main className="mt-6 space-y-6">
              {sections.map(([section, items]) => {
                const meta = SECTION_META[section] || { label: section.replace(/_/g, ' '), icon: FileCheck2 };
                const Icon = meta.icon;
                return <section key={section} className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: BORDER }}>
                  <div className="flex items-center gap-3 border-b p-5" style={{ borderColor: BORDER }}>
                    <span className="rounded-xl bg-amber-50 p-2.5" style={{ color: GOLD }}><Icon size={20} /></span>
                    <div><h2 className="font-semibold" style={{ color: BLUE }}>{meta.label}</h2><p className="text-xs text-slate-500">{items.length} élément{items.length > 1 ? 's' : ''} partagé{items.length > 1 ? 's' : ''}</p></div>
                  </div>
                  <div className="divide-y" style={{ borderColor: BORDER }}>
                    {items.map(item => <AchievementCard key={item.id} item={item} />)}
                  </div>
                </section>;
              })}
              {sections.length === 0 && <div className="rounded-2xl border bg-white p-12 text-center text-slate-500" style={{ borderColor: BORDER }}>Aucune réalisation n’est incluse dans ce partage.</div>}
            </main>

            <footer className="mt-8 rounded-2xl border bg-white p-5 text-center text-xs text-slate-500" style={{ borderColor: BORDER }}>
              Ce dossier est contrôlé par son titulaire. Les éléments « vérifiés » proviennent d’Omnia ou ont été contrôlés ; les éléments « déclarés » restent identifiés comme tels.
            </footer>
          </>}
    </div>
  </div>;
}

function AchievementCard({ item }: { item: ClrAchievement }) {
  const range = dateRange(item);
  return <article className="p-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold" style={{ color: BLUE }}>{item.title}</h3>
          {item.is_featured && <Star size={14} fill={GOLD} color={GOLD} aria-label="Élément mis en avant" />}
          <VerificationStatus value={item.verification_status} />
        </div>
        {(item.issuer_name || range) && <p className="mt-1 text-xs text-slate-500">{[item.issuer_name, range].filter(Boolean).join(' · ')}</p>}
        {item.description && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{item.description}</p>}
        {(item.result_label || item.score != null) && <p className="mt-3 text-sm font-medium" style={{ color: BLUE }}>{item.result_label || `Résultat : ${item.score}${item.score_max ? ` / ${item.score_max}` : ''}`}</p>}
        {(item.skills || []).length > 0 && <div className="mt-3 flex flex-wrap gap-2">{item.skills.map(skill => <span key={skill} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{skill}</span>)}</div>}
      </div>
      {item.external_url && <a href={item.external_url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: BORDER, color: BLUE }}><ExternalLink size={13} /> Consulter</a>}
    </div>
  </article>;
}

function VerificationStatus({ value }: { value: ClrAchievement['verification_status'] }) {
  if (value === 'verified') return <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-700"><CheckCircle2 size={12} /> Vérifié</span>;
  if (value === 'pending_review') return <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">À vérifier</span>;
  return <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{credentialStatusLabel(value)}</span>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="border-r border-white/10 p-4 last:border-r-0"><p className="text-xs text-white/60">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>; }
function Unavailable({ message }: { message: string }) { return <div className="mt-10 rounded-2xl border border-red-200 bg-white p-10 text-center"><XCircle className="mx-auto h-14 w-14 text-red-500" /><h1 className="mt-4 text-2xl font-semibold text-red-700">Lien indisponible</h1><p className="mt-2 text-sm text-slate-500">{message}</p></div>; }
function dateRange(item: ClrAchievement) { const start = item.started_at || item.issued_at; const end = item.ended_at; if (!start) return ''; const first = new Date(start).toLocaleDateString('fr-FR'); return end && end !== start ? `${first} – ${new Date(end).toLocaleDateString('fr-FR')}` : first; }
function initials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map(item => item[0]?.toUpperCase()).join('') || 'OL'; }
function humanError(value: string) { return ({ CLR_SHARE_NOT_FOUND: 'Ce lien est invalide, révoqué ou expiré.', CLR_NOT_FOUND: 'Le Learning Record demandé est indisponible.' } as Record<string, string>)[value] || value || 'Ce lien est invalide, révoqué ou expiré.'; }
