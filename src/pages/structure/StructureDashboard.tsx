import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StructureLayout } from '../../components/StructureLayout';
import { RoleDashboardActionCard, RoleDashboardStatCard } from '../../components/dashboard/RoleDashboardCards';
import {
  Users, QrCode, Gift, Clock, CheckCircle,
  AlertCircle, PlusCircle, ChevronRight, RefreshCw,
  Building2, Shield, XCircle,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const API = `${SUPABASE_URL}/functions/v1/studio-unified`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const gatewayHeaders = () => ({
  'Content-Type': 'application/json',
  ...(ANON_KEY ? { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } : {}),
});

const STRUCTURE_LABELS: Record<string, string> = {
  ministere: 'Espace Ministère',
  etablissement: 'Espace Établissement',
  universite: 'Espace Université',
  ecole: 'Espace École',
  centre_formation: 'Espace Centre de formation',
  entreprise: 'Espace Entreprise',
  ong: 'Espace ONG',
  association: 'Espace Association',
  institution_publique: 'Espace Institution publique',
  organisation_internationale: 'Espace Organisation internationale',
  cabinet_formation: 'Espace Cabinet de formation',
  autre: 'Espace Structure professionnelle',
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending_validation:  { label: 'En attente de validation',  color: '#92400E', bg: '#FEF3C7', icon: Clock },
  changes_requested:   { label: 'Modification demandée',     color: '#1D4ED8', bg: '#EFF6FF', icon: AlertCircle },
  validated:           { label: 'Validée',                   color: '#065F46', bg: '#D1FAE5', icon: CheckCircle },
  rejected:            { label: 'Refusée',                   color: '#991B1B', bg: '#FEE2E2', icon: XCircle },
  suspended:           { label: 'Suspendue',                 color: '#374151', bg: '#F3F4F6', icon: AlertCircle },
  draft:               { label: 'Brouillon',                 color: '#6B7280', bg: '#F3F4F6', icon: Clock },
};

interface Structure {
  id: string;
  name: string;
  structure_type: string;
  status: string;
  display_name: string;
  status_label: string;
  logo_url?: string;
  admin_comment?: string;
  modification_note?: string;
}

interface Stats {
  members: number;
  active_codes: number;
  active_benefits: number;
}

interface Membership {
  id: string;
  status: string;
  requested_at: string;
  users: { full_name: string; email: string };
}

export default function StructureDashboard() {
  const navigate = useNavigate();
  const [structure, setStructure] = useState<Structure | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingMembers, setPendingMembers] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

 const token = () => localStorage.getItem('omnia_session_token') || '';

  // Mode prévisualisation super admin
  const isPreview = new URLSearchParams(window.location.search).get('preview') === 'true' &&
    (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; } })();

 async function load() {
    if (isPreview) {
      setStructure({
        id: 'preview', name: 'Espace Structure', structure_type: 'autre', status: 'validated',
        display_name: 'Espace Structure', status_label: 'Lecture seule', logo_url: undefined,
        admin_comment: undefined,
      });
      setStats({ members: 0, active_codes: 0, active_benefits: 0 });
      setPendingMembers([]);
      setLoading(false);
      return;
    }
    const sessionToken = token();
    if (!sessionToken) {
      navigate('/connexion', { replace: true });
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: gatewayHeaders(),
        body: JSON.stringify({ action: 'structure_dashboard', session_token: sessionToken }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401 || data?.error === 'AUTH_REQUIRED') {
        navigate('/connexion', { replace: true });
        return;
      }
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || data?.error || 'Erreur de chargement');
      }
      if (!data?.structure) {
        setError('no_structure');
        setStructure(null);
        setStats(data?.stats ?? { members: 0, active_codes: 0, active_benefits: 0 });
        setPendingMembers([]);
        return;
      }
      setStructure(data.structure);
      setStats(data.stats ?? { members: 0, active_codes: 0, active_benefits: 0 });
      setPendingMembers(data.pending_members ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleMembership(_membershipId: string, _decision: 'approve' | 'reject') {
    setError('La gestion des rattachements est disponible dans le menu « Demandes de rattachement ».');
  }

  const displayName = structure
    ? (STRUCTURE_LABELS[structure.structure_type] ?? 'Espace Structure')
    : 'Espace Structure';

  // ── Pas encore de structure ──────────────────────────────────────────────
  if (!loading && error === 'no_structure') {
    return (
      <StructureLayout displayName="Espace Structure">
        <div className="flex flex-col items-center justify-center h-full gap-6 p-8 text-center">
          <Building2 size={56} style={{ color: '#002050', opacity: 0.15 }} />
          <div>
            <h2 className="text-xl font-bold mb-2" style={{ color: '#002050' }}>
              Aucune structure trouvée
            </h2>
            <p className="text-sm" style={{ color: '#6B7280' }}>
              Vous n'êtes pas encore associé(e) à une structure sur Omnia Global Academy.
            </p>
          </div>
          <button
            onClick={() => navigate('/inscription/structure')}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white"
            style={{ background: '#002050' }}>
            <PlusCircle size={16} /> Inscrire une structure
          </button>
        </div>
      </StructureLayout>
    );
  }

  // ── Chargement ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <StructureLayout displayName={displayName}>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
        </div>
      </StructureLayout>
    );
  }

  if (!structure) return null;

  const statusInfo = STATUS_LABELS[structure.status] ?? STATUS_LABELS.pending_validation;
  const StatusIcon = statusInfo.icon;
  const isValidated = structure.status === 'validated';
  const isChangesRequested = structure.status === 'changes_requested';
  const isPending = structure.status === 'pending_validation';

  return (
    <StructureLayout displayName={displayName}>
      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            {structure.logo_url ? (
              <img src={structure.logo_url} alt="Logo"
                className="w-14 h-14 rounded-xl object-contain border"
                style={{ borderColor: '#E4E7EC', background: 'white' }} />
            ) : (
              <div className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: '#EEF2FF' }}>
                <Building2 size={26} style={{ color: '#002050' }} />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-black" style={{ color: '#002050' }}>{structure.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: '#EEF2FF', color: '#002050' }}>
                  {displayName}
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: statusInfo.bg, color: statusInfo.color }}>
                  <StatusIcon size={11} />
                  {statusInfo.label}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isValidated && !isPreview && (
              <button onClick={() => navigate('/structure/offres-emploi')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: '#002050' }}>
                <PlusCircle size={15} /> Déposer une offre d’emploi
              </button>
            )}
            <button onClick={load}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm border"
              style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
              <RefreshCw size={13} /> Actualiser
            </button>
          </div>
        </div>

        {/* Bannière statut spécial */}
        {isPending && (
          <div className="flex items-start gap-3 p-4 rounded-2xl"
            style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>
            <Clock size={18} style={{ color: '#92400E', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p className="font-bold text-sm" style={{ color: '#92400E' }}>
                Validation en cours
              </p>
              <p className="text-sm mt-0.5" style={{ color: '#78350F' }}>
                Votre demande est examinée par notre équipe. Vous serez notifié(e) sous 48h ouvrées.
              </p>
            </div>
          </div>
        )}

        {isChangesRequested && (
          <div className="flex items-start gap-3 p-4 rounded-2xl"
            style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
            <AlertCircle size={18} style={{ color: '#1D4ED8', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p className="font-bold text-sm" style={{ color: '#1D4ED8' }}>
                Modification demandée par le Super Admin
              </p>
              {structure.admin_comment && (
                <p className="text-sm mt-1" style={{ color: '#1E40AF' }}>
                  💬 {structure.admin_comment}
                </p>
              )}
              <button onClick={() => navigate('/structure/profil')}
                className="mt-2 text-xs font-bold underline" style={{ color: '#1D4ED8' }}>
                Modifier le profil →
              </button>
            </div>
          </div>
        )}

        {isValidated && stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <RoleDashboardStatCard label="Membres liés" value={stats.members} icon={Users} accent="#002050" onClick={() => navigate('/structure/membres')} />
            <RoleDashboardStatCard label="Codes actifs" value={stats.active_codes} icon={QrCode} accent="#1E7A52" onClick={() => navigate('/structure/codes')} />
            <RoleDashboardStatCard label="Avantages actifs" value={stats.active_benefits} icon={Gift} accent="#BF8813" onClick={() => navigate('/structure/abonnements')} />
          </div>
        )}

        {isValidated && (
          <div>
            <h2 className="font-bold text-sm mb-4" style={{ color: '#002050' }}>Actions rapides</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <RoleDashboardActionCard title="Créer une formation" text="Préparer une formation pour les membres de votre structure." icon={PlusCircle} onClick={() => navigate('/structure/formations/nouvelle')} accent="#002050" />
              <RoleDashboardActionCard title="Créer un code structure" text="Générer un code d’adhésion et suivre son utilisation." icon={QrCode} onClick={() => navigate('/structure/codes')} accent="#1E7A52" />
              <RoleDashboardActionCard title="Voir les membres" text="Consulter les membres liés et leurs rattachements." icon={Users} onClick={() => navigate('/structure/membres')} accent="#7C3AED" />
              <RoleDashboardActionCard title="Demander un avantage" text="Accéder aux avantages et aux demandes de validation." icon={Gift} onClick={() => navigate('/structure/abonnements')} accent="#BF8813" />
            </div>
          </div>
        )}

        {/* Demandes de rattachement en attente */}
        {isValidated && pendingMembers.length > 0 && (
          <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-sm" style={{ color: '#002050' }}>
                Demandes de rattachement
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{ background: '#FEF3C7', color: '#92400E' }}>
                  {pendingMembers.length}
                </span>
              </h2>
              <button onClick={() => navigate('/structure/rattachements')}
                className="text-xs font-semibold" style={{ color: '#BF8813' }}>
                Voir tout →
              </button>
            </div>
            <div className="space-y-3">
              {pendingMembers.slice(0, 3).map(m => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: '#F8F9FA', border: '1px solid #E4E7EC' }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: '#EEF2FF', color: '#002050' }}>
                    {(m.users?.full_name ?? '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#002050' }}>
                      {m.users?.full_name ?? 'Utilisateur'}
                    </p>
                    <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>
                      {m.users?.email} · {new Date(m.requested_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => handleMembership(m.id, 'approve')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                      style={{ background: '#1E7A52' }}>
                      <CheckCircle size={12} /> Accepter
                    </button>
                    <button onClick={() => handleMembership(m.id, 'reject')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border"
                      style={{ borderColor: '#FECACA', color: '#DC2626' }}>
                      <XCircle size={12} /> Refuser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Menu de navigation rapide si non validée */}
        {!isValidated && (
          <div className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E4E7EC' }}>
            <h2 className="font-bold text-sm mb-4" style={{ color: '#002050' }}>
              En attendant la validation
            </h2>
            <div className="space-y-2">
              {[
                { label: 'Compléter le profil de la structure', icon: Building2, path: '/structure/profil' },
                { label: 'Gérer l\'équipe de la structure',     icon: Shield,    path: '/structure/equipe' },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <button key={item.path} onClick={() => navigate(item.path)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all hover:shadow-sm"
                    style={{ borderColor: '#E4E7EC' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: '#EEF2FF' }}>
                      <Icon size={16} style={{ color: '#002050' }} />
                    </div>
                    <span className="text-sm font-semibold flex-1" style={{ color: '#002050' }}>
                      {item.label}
                    </span>
                    <ChevronRight size={15} style={{ color: '#BF8813' }} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </StructureLayout>
  );
}
