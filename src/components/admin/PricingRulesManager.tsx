import { getSessionToken } from '../../lib/session';
import { useEffect, useState } from 'react';
import { ENDPOINTS } from '../../lib/config';
import { Save } from 'lucide-react';

const DEFAULT: any = {
  module_points: 2,
  lesson_points: 0.5,
  hour_points: 1,
  level_points: { debutant: 2, intermediaire: 5, avance: 8, expert: 12 },
  validation_points: { qcm: 3, projet_soumettre: 8, projet_corriger: 12 },
  oral_exam_points: 6,
  resource_global_cap: 5,
  resources: {
    pdf_fiche: { points: 0.5, max: 4 },
    url_externe: { points: 0.3, max: 5 },
    glossaire: { points: 1, max: 1 },
    exercice_pratique: { points: 0.5, max: 3 },
    audio: { points: 0.5, max: 2 },
    template: { points: 0.7, max: 3 },
    etude_de_cas: { points: 1, max: 2 },
  },
};

const LEVELS = [
  ['debutant', 'Débutant'],
  ['intermediaire', 'Intermédiaire'],
  ['avance', 'Avancé'],
  ['expert', 'Expert'],
] as const;

const VALIDATIONS = [
  ['qcm', 'QCM'],
  ['projet_soumettre', 'Projet à soumettre'],
  ['projet_corriger', 'Projet corrigé'],
] as const;

const RESOURCE_LABELS: Record<string, string> = {
  pdf_fiche: 'Document PDF / Fiche',
  url_externe: 'Lien URL externe',
  glossaire: 'Glossaire',
  exercice_pratique: 'Exercice pratique supplémentaire',
  audio: 'Ressource audio',
  template: 'Template / fichier téléchargeable',
  etude_de_cas: 'Étude de cas',
};

export function PricingRulesManager() {
  const [rules, setRules] = useState<any>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const token = () => getSessionToken() || '';

  useEffect(() => {
    fetch(ENDPOINTS.adminCmsUpdate, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(d => {
        const row = (d.settings || []).find((x: any) => x.key === 'course_pricing_rules');
        if (!row?.value) return;
        try {
          const incoming = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
          setRules({
            ...DEFAULT,
            ...incoming,
            level_points: { ...DEFAULT.level_points, ...(incoming.level_points || {}) },
            validation_points: { ...DEFAULT.validation_points, ...(incoming.validation_points || {}) },
            resources: { ...DEFAULT.resources, ...(incoming.resources || {}) },
          });
        } catch {}
      });
  }, []);

  async function save() {
    setSaving(true);
    setSaved('');
    const res = await fetch(ENDPOINTS.adminCmsUpdate, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: [{ key: 'course_pricing_rules', value: rules }] }),
    });
    setSaving(false);
    setSaved(res.ok ? 'Règles de calcul enregistrées.' : 'Erreur pendant l’enregistrement.');
    setTimeout(() => setSaved(''), 3000);
  }

  const num = (label: string, key: string) => (
    <label className="text-xs text-gray-600">
      {label}
      <input
        type="number" step="0.1" value={rules[key]}
        onChange={e => setRules({ ...rules, [key]: Number(e.target.value) })}
        className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
      />
    </label>
  );

  return <div className="space-y-6">
    <div>
      <h3 className="font-semibold" style={{ color: '#002050' }}>Tarification automatique — Professeurs indépendants</h3>
      <p className="text-xs text-gray-500 mt-1">
        Ces valeurs sont celles du cahier des charges et alimentent directement le calcul du score.
      </p>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {num('Points par module', 'module_points')}
      {num('Points par leçon', 'lesson_points')}
      {num('Points par heure reconnue', 'hour_points')}
      {num('Examen oral confirmé', 'oral_exam_points')}
    </div>

    <div>
      <p className="text-sm font-semibold mb-2" style={{ color: '#002050' }}>Niveaux</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {LEVELS.map(([key, label]) => (
          <label key={key} className="text-xs text-gray-600">
            {label}
            <input
              type="number"
              value={rules.level_points?.[key] ?? DEFAULT.level_points[key]}
              onChange={e => setRules({
                ...rules,
                level_points: { ...rules.level_points, [key]: Number(e.target.value) },
              })}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2"
            />
          </label>
        ))}
      </div>
    </div>

    <div>
      <p className="text-sm font-semibold mb-2" style={{ color: '#002050' }}>Validation finale</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {VALIDATIONS.map(([key, label]) => (
          <label key={key} className="text-xs text-gray-600">
            {label}
            <input
              type="number"
              value={rules.validation_points?.[key] ?? DEFAULT.validation_points[key]}
              onChange={e => setRules({
                ...rules,
                validation_points: { ...rules.validation_points, [key]: Number(e.target.value) },
              })}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2"
            />
          </label>
        ))}
      </div>
    </div>

    <div>
      <div className="flex items-end justify-between gap-4 mb-2">
        <div>
          <p className="text-sm font-semibold" style={{ color: '#002050' }}>Ressources bonus</p>
          <p className="text-xs text-gray-500 mt-1">
            « Points par ressource » = bonus ajouté pour chaque ressource reconnue. « Quantité maximale » = nombre maximum pris en compte pour ce type.
          </p>
        </div>
        <label className="text-xs text-gray-600 w-40">
          Plafond global bonus
          <input
            type="number" step="0.1" value={rules.resource_global_cap ?? 5}
            onChange={e => setRules({ ...rules, resource_global_cap: Number(e.target.value) })}
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(rules.resources || {}).map(([key, value]: any) => (
          <div key={key} className="border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-gray-700">{RESOURCE_LABELS[key] || key}</p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <label className="text-xs text-gray-500">
                Points par ressource
                <input
                  type="number" step="0.1" min="0"
                  value={value.points}
                  onChange={e => setRules({
                    ...rules,
                    resources: {
                      ...rules.resources,
                      [key]: { ...value, points: Number(e.target.value) },
                    },
                  })}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs text-gray-500">
                Quantité maximale
                <input
                  type="number" min="0"
                  value={value.max}
                  onChange={e => setRules({
                    ...rules,
                    resources: {
                      ...rules.resources,
                      [key]: { ...value, max: Number(e.target.value) },
                    },
                  })}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="flex items-center justify-end gap-3">
      {saved && <span className="text-xs text-gray-500">{saved}</span>}
      <button
        onClick={save} disabled={saving}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-60"
        style={{ backgroundColor: '#002050' }}
      >
        <Save className="w-4 h-4" />
        {saving ? 'Enregistrement…' : 'Enregistrer les règles de calcul'}
      </button>
    </div>
  </div>;
}
