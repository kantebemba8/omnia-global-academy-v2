import { getSessionToken } from '../../lib/session';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, ExternalLink, LockKeyhole, ShieldCheck } from 'lucide-react';
import { ModerateurLayout } from '../../components/ModerateurLayout';
import { ENDPOINTS } from '../../lib/config';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import {
  MODERATOR_PERMISSION_KEYS,
  MODERATOR_PERMISSION_SECTIONS,
  ModeratorPermissions,
  normalizeModeratorPermissions,
} from '../../lib/moderatorPermissions';

function allPermissionsEnabled(): ModeratorPermissions {
  return Object.fromEntries(MODERATOR_PERMISSION_KEYS.map(key => [key, true])) as ModeratorPermissions;
}

export default function ModerateurMissions() {
  const isPreview = new URLSearchParams(window.location.search).get('preview') === 'true';
  const isSuperAdmin = (() => {
    try {
      return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false;
    } catch {
      return false;
    }
  })();
  const bypassAuth = isPreview && isSuperAdmin;

  const [permissions, setPermissions] = useState<ModeratorPermissions | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (bypassAuth) {
      setPermissions(allPermissionsEnabled());
      return;
    }

    if (!getSessionToken()) {
      setError('Session expirée. Veuillez vous reconnecter.');
      return;
    }

    fetch(ENDPOINTS.dashboardModerateur, { headers: edgeAuthHeaders() })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || payload.error || 'Permissions indisponibles.');
        return payload;
      })
      .then(payload => setPermissions(normalizeModeratorPermissions(payload.permissions)))
      .catch(requestError => setError(requestError instanceof Error ? requestError.message : 'Permissions indisponibles.'));
  }, [bypassAuth]);

  const activeSections = useMemo(() => (
    MODERATOR_PERMISSION_SECTIONS
      .map(section => ({
        ...section,
        permissions: section.permissions.filter(permission => permissions?.[permission.key]),
      }))
      .filter(section => section.permissions.length > 0)
  ), [permissions]);

  const activeCount = permissions
    ? MODERATOR_PERMISSION_KEYS.filter(key => permissions[key]).length
    : 0;

  const buildPath = (path: string) => {
    if (!bypassAuth) return path;
    return `${path}${path.includes('?') ? '&' : '?'}preview=true`;
  };

  return (
    <ModerateurLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold" style={{ background: '#FFF7E8', color: '#8A5A08' }}>
              <ClipboardCheck size={14} /> Centre de missions
            </div>
            <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>Permissions et contrôles autorisés</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-600">
              Cet espace rassemble toutes les permissions activées par l’Administration Omnia. Les actions sensibles restent préparatoires et la décision finale demeure réservée à l’Administration Omnia.
            </p>
          </div>
          <div className="rounded-2xl border bg-white px-5 py-4 text-center" style={{ borderColor: '#E4E7EC' }}>
            <div className="text-3xl font-black" style={{ color: '#002050' }}>{activeCount}</div>
            <div className="text-xs font-semibold text-gray-500">permission(s) active(s)</div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5" role="alert">
            <p className="font-semibold text-red-800">Impossible de charger les permissions</p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        )}

        {!permissions && !error && (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        )}

        {permissions && activeSections.length === 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-0.5 text-amber-700" size={22} />
              <div>
                <p className="font-semibold text-amber-900">Aucune mission active</p>
                <p className="mt-1 text-sm text-amber-800">L’Administration Omnia doit activer au moins une permission avant l’accès aux contrôles.</p>
              </div>
            </div>
          </div>
        )}

        {activeSections.map(section => (
          <section key={section.id} className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: '#E4E7EC' }}>
            <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: '#E4E7EC', background: '#F8F9FA' }}>
              <ShieldCheck size={20} style={{ color: '#BF8813' }} />
              <div>
                <h2 className="font-bold" style={{ color: '#002050' }}>{section.title}</h2>
                <p className="text-xs text-gray-500">{section.permissions.length} autorisation(s) active(s)</p>
              </div>
            </div>
            <div className="divide-y" style={{ borderColor: '#EEF0F3' }}>
              {section.permissions.map(permission => {
                const hasDedicatedWorkspace = permission.workspace !== '/moderator/missions';
                return (
                  <div key={permission.key} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
                    <CheckCircle2 className="flex-shrink-0 text-emerald-600" size={19} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold" style={{ color: '#002050' }}>{permission.label}</p>
                      <p className="mt-1 text-xs leading-5 text-gray-500">{permission.description}</p>
                    </div>
                    {hasDedicatedWorkspace ? (
                      <Link
                        to={buildPath(permission.workspace)}
                        className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition hover:bg-gray-50"
                        style={{ borderColor: '#D8DEE8', color: '#002050' }}
                      >
                        Ouvrir l’espace <ExternalLink size={13} />
                      </Link>
                    ) : (
                      <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: '#FFF7E8', color: '#8A5A08' }}>
                        Contrôle préparatoire · décision finale de l’Administration Omnia
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </ModerateurLayout>
  );
}
