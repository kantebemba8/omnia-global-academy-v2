import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Eye, EyeOff,
  Loader2, Plus, RefreshCw, Save, Send, Trash2,
} from 'lucide-react';
import { ENDPOINTS } from '../../lib/config';
import {
  LANDING_SECTION_LIBRARY,
  createLandingSection,
  normalizeLandingPage,
  type LandingPageConfig,
  type LandingSectionConfig,
  type LandingSectionType,
} from '../../types/landingCms';

type PublicationMeta = {
  published_at?: string | null;
  published_by?: string | null;
  previous_available?: boolean;
};

function parseSetting<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'object') return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

function formatDate(value?: string | null) {
  if (!value) return 'Aucune publication enregistrée';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fr-FR');
}

function Field({ label, value, onChange, placeholder = '' }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#BF8813]"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, rows = 3 }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        rows={rows}
        className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#BF8813]"
      />
    </label>
  );
}

export function LandingCmsFoundation() {
  const [draft, setDraft] = useState<LandingPageConfig>(() => normalizeLandingPage(null));
  const [published, setPublished] = useState<LandingPageConfig>(() => normalizeLandingPage(null));
  const [meta, setMeta] = useState<PublicationMeta>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newType, setNewType] = useState<LandingSectionType>('custom_text');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const token = () => localStorage.getItem('omnia_session_token') || '';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(ENDPOINTS.adminCmsUpdate, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || 'Chargement impossible');
      const settingsMap: Record<string, unknown> = {};
      (data.settings || []).forEach((item: { key: string; value: unknown }) => {
        settingsMap[item.key] = item.value;
      });
      const loadedPublished = normalizeLandingPage(parseSetting(settingsMap.landing_page_published, null));
      const cmsState = data.landing_cms && typeof data.landing_cms === 'object'
        ? data.landing_cms as { draft?: unknown; previous_published?: unknown; published_at?: string | null; published_by?: string | null }
        : {};
      const loadedDraft = normalizeLandingPage(cmsState.draft || loadedPublished);
      setDraft(loadedDraft);
      setPublished(loadedPublished);
      setMeta({
        published_at: cmsState.published_at || loadedPublished.published_at,
        published_by: cmsState.published_by || null,
        previous_available: Boolean(cmsState.previous_published),
      });
      setExpanded(loadedDraft.sections[0]?.id || null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const orderedSections = useMemo(
    () => [...draft.sections].sort((a, b) => a.order - b.order),
    [draft.sections],
  );

  const availableLibrary = useMemo(() => {
    const presentTypes = new Set(draft.sections.map(section => section.type));
    return LANDING_SECTION_LIBRARY.filter(item => !item.unique || !presentTypes.has(item.type));
  }, [draft.sections]);

  useEffect(() => {
    if (!availableLibrary.some(item => item.type === newType)) {
      setNewType(availableLibrary[0]?.type || 'custom_text');
    }
  }, [availableLibrary, newType]);

  function updateSection(id: string, changes: Partial<LandingSectionConfig>) {
    setDraft(previous => ({
      ...previous,
      updated_at: new Date().toISOString(),
      sections: previous.sections.map(section => section.id === id ? { ...section, ...changes } : section),
    }));
  }

  function normalizeOrders(sections: LandingSectionConfig[]) {
    return sections.map((section, index) => ({ ...section, order: index + 1 }));
  }

  function moveSection(id: string, direction: -1 | 1) {
    setDraft(previous => {
      const sections = [...previous.sections].sort((a, b) => a.order - b.order);
      const index = sections.findIndex(section => section.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= sections.length) return previous;
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...previous, updated_at: new Date().toISOString(), sections: normalizeOrders(sections) };
    });
  }

  function addSection() {
    const item = LANDING_SECTION_LIBRARY.find(entry => entry.type === newType);
    if (!item) return;
    if (item.unique && draft.sections.some(section => section.type === newType)) {
      setError('Cette section existe déjà dans la page.');
      return;
    }
    const created = createLandingSection(newType, draft.sections.length + 1);
    setDraft(previous => ({
      ...previous,
      updated_at: new Date().toISOString(),
      sections: [...previous.sections, created],
    }));
    setExpanded(created.id);
    setMessage('Section ajoutée au brouillon.');
    setError('');
  }

  function removeSection(section: LandingSectionConfig) {
    if (section.type === 'hero' || section.type === 'final_cta') {
      setError('Cette section structurante peut être masquée, mais pas supprimée.');
      return;
    }
    setDraft(previous => ({
      ...previous,
      updated_at: new Date().toISOString(),
      sections: normalizeOrders(previous.sections.filter(item => item.id !== section.id)),
    }));
    if (expanded === section.id) setExpanded(null);
  }

  async function execute(action: string, successMessage: string, page = draft) {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch(ENDPOINTS.adminCmsUpdate, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, landing_page: page }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Opération impossible');
      }
      setMessage(successMessage);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Opération impossible');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 py-14 text-sm text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement de la fondation CMS…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <h3 className="font-semibold text-[#002050]">Fondation de la nouvelle page d’accueil</h3>
        <p className="mt-1 text-sm leading-6 text-blue-800">
          Préparez les textes, l’ordre et la visibilité des futurs blocs. La page publique actuelle reste inchangée jusqu’au Grand bloc 2.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Brouillon</p>
          <p className="mt-2 text-sm font-semibold text-[#002050]">{draft.sections.length} sections configurées</p>
          <p className="mt-1 text-xs text-gray-500">Les modifications ne sont pas publiques avant publication.</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Dernière publication</p>
          <p className="mt-2 text-sm font-semibold text-[#002050]">{formatDate(meta.published_at || published.published_at)}</p>
          <p className="mt-1 text-xs text-gray-500">Version publique préparée pour la future page.</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Retour arrière</p>
          <p className="mt-2 text-sm font-semibold text-[#002050]">{meta.previous_available ? 'Version précédente disponible' : 'Aucune version précédente'}</p>
          <p className="mt-1 text-xs text-gray-500">Une publication précédente est conservée automatiquement.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => execute('save_landing_draft', 'Brouillon enregistré.')}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: '#002050' }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer le brouillon
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => execute('publish_landing_page', 'Configuration de la page publiée.')}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: '#BF8813' }}
        >
          <Send className="h-4 w-4" /> Publier la configuration
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => execute('restore_landing_draft', 'Le brouillon correspond à nouveau à la version publiée.', published)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" /> Restaurer la version publiée
        </button>
        <button
          type="button"
          disabled={busy || !meta.previous_available}
          onClick={() => execute('rollback_landing_publication', 'La publication précédente a été restaurée.')}
          className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-40"
        >
          <RefreshCw className="h-4 w-4" /> Annuler la dernière publication
        </button>
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {message}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex-1">
            <span className="mb-1 block text-xs font-medium text-gray-600">Ajouter un bloc validé</span>
            <select
              value={newType}
              onChange={event => setNewType(event.target.value as LandingSectionType)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              {availableLibrary.map(item => (
                <option key={item.type} value={item.type}>{item.label} — {item.description}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={addSection}
            disabled={availableLibrary.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            style={{ backgroundColor: '#002050' }}
          >
            <Plus className="h-4 w-4" /> Ajouter
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {orderedSections.map((section, index) => {
          const definition = LANDING_SECTION_LIBRARY.find(item => item.type === section.type);
          const isExpanded = expanded === section.id;
          return (
            <article key={section.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="flex flex-wrap items-center gap-3 p-4">
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : section.id)}
                  className="flex min-w-[240px] flex-1 items-center gap-3 text-left"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-[#002050]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-[#002050]">{section.internal_name || definition?.label}</span>
                    <span className="block text-xs text-gray-500">{definition?.description}</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => updateSection(section.id, { enabled: !section.enabled })}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                  style={{
                    borderColor: section.enabled ? '#A7F3D0' : '#E4E7EC',
                    color: section.enabled ? '#047857' : '#667085',
                    backgroundColor: section.enabled ? '#ECFDF3' : '#F9FAFB',
                  }}
                >
                  {section.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  {section.enabled ? 'Visible' : 'Masquée'}
                </button>
                <button type="button" onClick={() => moveSection(section.id, -1)} disabled={index === 0} className="rounded-lg border p-2 disabled:opacity-30" aria-label="Monter la section">
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => moveSection(section.id, 1)} disabled={index === orderedSections.length - 1} className="rounded-lg border p-2 disabled:opacity-30" aria-label="Descendre la section">
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => removeSection(section)} className="rounded-lg border border-red-100 p-2 text-red-600" aria-label="Supprimer la section">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {isExpanded && (
                <div className="space-y-4 border-t border-gray-100 bg-gray-50/60 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Nom interne dans le CMS" value={section.internal_name} onChange={value => updateSection(section.id, { internal_name: value })} />
                    <Field label="Accroche supérieure" value={section.eyebrow} onChange={value => updateSection(section.id, { eyebrow: value })} />
                  </div>
                  <Field label="Titre public" value={section.title} onChange={value => updateSection(section.id, { title: value })} />
                  <TextArea label="Sous-titre" value={section.subtitle} onChange={value => updateSection(section.id, { subtitle: value })} />
                  <TextArea label="Texte complémentaire" value={section.body} onChange={value => updateSection(section.id, { body: value })} rows={4} />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Bouton principal" value={section.primary_cta_label} onChange={value => updateSection(section.id, { primary_cta_label: value })} />
                    <Field label="Destination principale" value={section.primary_cta_url} onChange={value => updateSection(section.id, { primary_cta_url: value })} placeholder="/catalogue ou https://…" />
                    <Field label="Bouton secondaire" value={section.secondary_cta_label} onChange={value => updateSection(section.id, { secondary_cta_label: value })} />
                    <Field label="Destination secondaire" value={section.secondary_cta_url} onChange={value => updateSection(section.id, { secondary_cta_url: value })} placeholder="/inscription ou https://…" />
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
