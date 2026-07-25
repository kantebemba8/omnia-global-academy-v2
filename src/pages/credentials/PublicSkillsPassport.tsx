import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertTriangle, BadgeCheck, Briefcase, CalendarDays, CheckCircle2, ExternalLink,
  Globe2, Languages, MapPin, ShieldCheck, Star, Target,
} from 'lucide-react';
import { PublicSkillsPassportResponse, credentialsRequest } from '../../lib/credentialsApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

const SECTION_LABELS: Record<string, string> = {
  competences_verifiees: 'Compétences vérifiées',
  certificats: 'Certificats',
  badges: 'Badges',
  evaluations: 'Évaluations',
  projets: 'Projets',
  experiences: 'Expériences',
  recommandations: 'Recommandations',
};

export default function PublicSkillsPassport() {
  const { shareToken = '' } = useParams();
  const [data, setData] = useState<PublicSkillsPassportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    credentialsRequest<PublicSkillsPassportResponse>('public_skills_passport', { token: shareToken })
      .then(response => { if (active) setData(response); })
      .catch(cause => { if (active) setError(humanError(cause instanceof Error ? cause.message : 'Passeport indisponible.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [shareToken]);

  const grouped = useMemo(() => {
    const map = new Map<string, PublicSkillsPassportResponse['items']>();
    for (const item of data?.items || []) map.set(item.section, [...(map.get(item.section) || []), item]);
    return Object.entries(SECTION_LABELS).map(([section, label]) => ({ section, label, items: map.get(section) || [] })).filter(group => group.items.length);
  }, [data]);

  if (loading) return <PublicShell><div className="py-24 text-center text-sm text-slate-500">Vérification du Skills Passport…</div></PublicShell>;
  if (error || !data) return <PublicShell><div className="mx-auto mt-16 max-w-xl rounded-2xl border border-red-200 bg-red-50 p-8 text-center"><AlertTriangle className="mx-auto text-red-600" size={34} /><h1 className="mt-4 text-xl font-semibold text-red-800">Skills Passport indisponible</h1><p className="mt-2 text-sm text-red-700">{error || 'Ce lien ne peut pas être ouvert.'}</p></div></PublicShell>;

  const { passport, share, verification } = data;
  return <PublicShell>
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <header className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: BORDER }}>
        <div className="h-2" style={{ background: GOLD }} />
        <div className="p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[.18em]" style={{ color: GOLD }}>Omnia Skills Passport</div>
              <h1 className="mt-2 text-3xl font-semibold" style={{ color: BLUE }}>{passport.user?.full_name || 'Titulaire Omnia'}</h1>
              {passport.professional_headline && <p className="mt-2 text-lg font-medium text-slate-700">{passport.professional_headline}</p>}
              <p className="mt-2 text-sm text-slate-500">{passport.title} · Version {passport.version}</p>
            </div>
            <VerificationPanel valid={verification.overall_valid} publishedAt={passport.published_at} />
          </div>

          {passport.professional_summary && <p className="mt-6 max-w-4xl whitespace-pre-wrap text-sm leading-7 text-slate-600">{passport.professional_summary}</p>}

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Info icon={Target} label="Objectifs" value={(passport.target_roles || []).join(' · ') || 'Non précisés'} />
            <Info icon={Languages} label="Langues" value={(passport.languages || []).join(' · ') || 'Non précisées'} />
            <Info icon={MapPin} label="Localisation" value={passport.location_text || 'Non précisée'} />
            <Info icon={Globe2} label="Disponibilité" value={passport.availability_text || 'Non précisée'} />
          </div>
        </div>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <Metric label="Éléments présentés" value={data.items.length} />
        <Metric label="Compétences distinctes" value={new Set(data.items.flatMap(item => item.skills || [])).size} />
        <Metric label="Éléments vérifiés" value={data.items.filter(item => item.verification_status === 'verified').length} />
      </section>

      <div className="mt-6 space-y-6">
        {grouped.map(group => <section key={group.section} className="rounded-2xl border bg-white p-5 md:p-6" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-2"><Briefcase size={18} color={GOLD} /><h2 className="font-semibold" style={{ color: BLUE }}>{group.label}</h2></div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">{group.items.map(item => <article key={item.id} className="rounded-xl border p-4" style={{ borderColor: BORDER }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><div className="flex items-center gap-2">{item.is_featured && <Star size={15} fill="currentColor" color={GOLD} />}<h3 className="font-semibold" style={{ color: BLUE }}>{item.title}</h3></div>{item.issuer_name && <p className="mt-1 text-xs font-medium text-slate-500">{item.issuer_name}</p>}</div>
              <Status verified={item.verification_status === 'verified'} />
            </div>
            {item.description && <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>}
            {(item.started_at || item.ended_at || item.issued_at) && <p className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500"><CalendarDays size={13} /> {dateRange(item)}</p>}
            {item.result_label && <p className="mt-2 text-sm font-medium text-slate-700">{item.result_label}</p>}
            {item.skills?.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{item.skills.map(skill => <span key={skill} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{skill}</span>)}</div>}
            {item.external_url && <a href={item.external_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: BLUE }}>Voir la preuve <ExternalLink size={13} /></a>}
          </article>)}</div>
        </section>)}
      </div>

      <footer className="mt-6 rounded-2xl border bg-white p-5 text-sm text-slate-500" style={{ borderColor: BORDER }}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold" style={{ color: BLUE }}>{share.label || 'Partage professionnel'}</p><p className="mt-1">{share.expires_at ? `Lien valable jusqu’au ${new Date(share.expires_at).toLocaleDateString('fr-FR')}` : 'Lien sans date d’expiration'}{share.max_views ? ` · Consultation ${share.view_count}/${share.max_views}` : ''}</p></div><div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${verification.overall_valid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}><ShieldCheck size={14} /> {verification.overall_valid ? 'Signature RS256 vérifiée' : 'Vérification cryptographique incomplète'}</div></div>
      </footer>
    </div>
  </PublicShell>;
}

function PublicShell({ children }: { children: React.ReactNode }) { return <div className="min-h-screen bg-[#F8FAFC]"><div className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 md:px-6"><img src="/omnia-sidebar-logo.png" alt="Omnia Global Academy" className="h-10 w-10 object-contain" /><div><p className="font-semibold" style={{ color: BLUE }}>Omnia Global Academy</p><p className="text-xs" style={{ color: GOLD }}>Skills Passport vérifiable</p></div></div></div>{children}</div>; }
function VerificationPanel({ valid, publishedAt }: { valid: boolean; publishedAt?: string | null }) { return <div className={`rounded-xl border p-4 ${valid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}><div className={`flex items-center gap-2 text-sm font-semibold ${valid ? 'text-green-700' : 'text-red-700'}`}>{valid ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}{valid ? 'Passeport authentique' : 'Vérification incomplète'}</div><p className="mt-1 text-xs text-slate-500">{publishedAt ? `Publié le ${new Date(publishedAt).toLocaleDateString('fr-FR')}` : 'Date de publication indisponible'}</p></div>; }
function Status({ verified }: { verified: boolean }) { return verified ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-700"><BadgeCheck size={12} /> Vérifié</span> : <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">Déclaré</span>; }
function Info({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) { return <div className="rounded-xl border p-3" style={{ borderColor: BORDER }}><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400"><Icon size={14} /> {label}</div><p className="mt-2 text-sm text-slate-700">{value}</p></div>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold" style={{ color: BLUE }}>{value}</p></div>; }
function dateRange(item: PublicSkillsPassportResponse['items'][number]) { const start = item.started_at || item.issued_at; const end = item.ended_at; if (!start) return ''; const first = new Date(start).toLocaleDateString('fr-FR'); return end && end !== start ? `${first} – ${new Date(end).toLocaleDateString('fr-FR')}` : first; }
function humanError(value: string) { return ({ SKILLS_PASSPORT_SHARE_NOT_FOUND: 'Ce lien a été révoqué ou n’existe plus.', SKILLS_PASSPORT_SHARE_EXPIRED: 'Ce lien de partage a expiré.', SKILLS_PASSPORT_SHARE_LIMIT_REACHED: 'Le nombre maximal de consultations a été atteint.', SKILLS_PASSPORT_NOT_PUBLISHED: 'Ce Skills Passport n’est plus public.' } as Record<string, string>)[value] || value; }
