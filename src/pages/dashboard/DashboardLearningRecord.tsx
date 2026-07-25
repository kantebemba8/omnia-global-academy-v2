import { FormEvent, useEffect, useMemo, useState } from 'react';
import { FileCheck2, Link2, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { ClrAchievement, ClrRecord, credentialsRequest } from '../../lib/credentialsApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
type Share = { id: string; label?: string | null; include_sections: string[]; visibility_filter: string; expires_at?: string | null; revoked_at?: string | null; created_at: string; url?: string; token?: string };

export default function DashboardLearningRecord() {
  const [record, setRecord] = useState<ClrRecord | null>(null);
  const [achievements, setAchievements] = useState<ClrAchievement[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newShareUrl, setNewShareUrl] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const response = await credentialsRequest<{ success: true; record: ClrRecord; achievements: ClrAchievement[]; shares: Share[] }>('learner_clr');
      setRecord(response.record); setAchievements(response.achievements); setShares(response.shares);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Learning Record indisponible.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const sections = useMemo(() => {
    const grouped = new Map<string, ClrAchievement[]>();
    for (const achievement of achievements) grouped.set(achievement.section, [...(grouped.get(achievement.section) || []), achievement]);
    return [...grouped.entries()];
  }, [achievements]);

  async function createShare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNewShareUrl('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await credentialsRequest<{ success: true; share: Share & { url: string } }>('learner_create_clr_share', {
        label: String(form.get('label') || ''), validity_days: Number(form.get('validity_days') || 30), visibility_filter: String(form.get('visibility_filter') || 'public'), include_sections: sections.map(([section]) => section),
      });
      setNewShareUrl(response.share.url); setShares(current => [response.share, ...current]); event.currentTarget.reset();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Création du partage impossible.'); }
  }

  async function revokeShare(shareId: string) {
    await credentialsRequest('learner_revoke_clr_share', { share_id: shareId });
    setShares(current => current.map(share => share.id === shareId ? { ...share, revoked_at: new Date().toISOString() } : share));
  }

  return <DashboardLayout><div className="mx-auto max-w-7xl px-4 py-7 md:px-6"><header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5"><div><span className="text-xs font-semibold uppercase tracking-[.16em]" style={{ color: GOLD }}>CLR 2.0</span><h1 className="mt-1 text-2xl font-semibold" style={{ color: BLUE }}>Omnia Learning Record</h1><p className="mt-2 text-sm text-slate-500">Votre dossier global de réalisations, badges et compétences.</p></div><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}><RefreshCw size={16} /> Actualiser</button></header>{error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}{loading ? <div className="py-24 text-center text-sm text-slate-500">Chargement…</div> : <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]"><div className="space-y-6"><section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold" style={{ color: BLUE }}>{record?.title || 'Omnia Learning Record'}</h2><p className="mt-1 text-sm text-slate-500">Version {record?.version || 1} · {record?.standards_status === 'clr2_signed' ? 'CLR 2.0 signé' : 'Préparation CLR 2.0'}</p></div><ShieldCheck color={GOLD} /></div><div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Les données sont vérifiées dans Omnia. La signature cryptographique CLR 2.0 sera activée dans le module d’interopérabilité.</div></section>{sections.map(([section, items]) => <section key={section} className="rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-200 p-4"><h2 className="font-semibold capitalize" style={{ color: BLUE }}>{section.replaceAll('_', ' ')}</h2></div><div className="divide-y">{items.map(item => <div key={item.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold" style={{ color: BLUE }}>{item.title}</p><p className="mt-1 text-sm text-slate-500">{item.description || item.achievement_type}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{item.visibility}</span></div></div>)}</div></section>)}{sections.length === 0 && <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center"><FileCheck2 className="mx-auto h-12 w-12 text-slate-200" /><p className="mt-4 text-slate-500">Votre Learning Record se remplira avec vos badges et réalisations.</p></div>}</div><aside className="space-y-6"><section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold" style={{ color: BLUE }}>Créer un lien de partage</h2><form onSubmit={createShare} className="mt-4 space-y-3"><input name="label" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Ex. Candidature entreprise" /><select name="visibility_filter" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="public">Éléments publics</option><option value="recruiters">Éléments recruteurs</option><option value="oga">Éléments OGA</option><option value="structure">Éléments Structure</option></select><select name="validity_days" defaultValue="30" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="7">7 jours</option><option value="30">30 jours</option><option value="90">90 jours</option><option value="365">1 an</option></select><button className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}><Link2 size={15} /> Créer le lien</button></form>{newShareUrl && <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700"><p className="font-semibold">Lien créé</p><button onClick={() => navigator.clipboard?.writeText(newShareUrl)} className="mt-2 break-all text-left underline">{newShareUrl}</button></div>}</section><section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold" style={{ color: BLUE }}>Liens actifs</h2><div className="mt-3 space-y-3">{shares.map(share => <div key={share.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold" style={{ color: BLUE }}>{share.label || 'Partage CLR'}</p><p className="mt-1 text-xs text-slate-500">{share.revoked_at ? 'Révoqué' : share.expires_at ? `Expire le ${new Date(share.expires_at).toLocaleDateString('fr-FR')}` : 'Sans expiration'}</p></div>{!share.revoked_at && <button onClick={() => void revokeShare(share.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>}</div></div>)}{shares.length === 0 && <p className="text-sm text-slate-500">Aucun lien créé.</p>}</div></section></aside></div>}</div></DashboardLayout>;
}
