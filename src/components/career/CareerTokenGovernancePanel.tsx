import { useMemo, useState } from 'react';
import { CheckCircle2, Coins, Gift, Plus, Save, ShieldCheck, Sparkles } from 'lucide-react';

const OMNIA_BLUE = '#002050';
const OMNIA_GOLD = '#bf8813';
const BORDER = '#E4E7EC';
const MUTED = '#667085';

export type CareerTokenRuleType = 'earn' | 'spend';
export type CareerTokenRepeatPolicy =
  | 'once'
  | 'per_reference'
  | 'unlimited'
  | 'daily'
  | 'weekly'
  | 'monthly';

export type CareerTokenRuleConfig = {
  id?: string;
  config_key: string;
  label_fr?: string | null;
  config_value: number;
  description_fr?: string | null;
  config_group?: string | null;
  rule_type?: CareerTokenRuleType | null;
  repeat_policy?: CareerTokenRepeatPolicy | null;
  min_value?: number | null;
  max_value?: number | null;
  value_unit?: string | null;
  display_order?: number | null;
  max_per_day?: number | null;
  max_per_month?: number | null;
  max_per_lifetime?: number | null;
  cooldown_hours?: number | null;
  free_uses_per_month?: number | null;
  requires_validation?: boolean | null;
  eligible_role?: string | null;
  metadata?: Record<string, unknown> | null;
  is_active: boolean;
};

export type CareerTokenGlobalRule = {
  rule_key: string;
  label_fr: string;
  description_fr?: string | null;
  value_json: { value?: boolean | number | string };
  is_active: boolean;
};

type Props = {
  configs: CareerTokenRuleConfig[];
  globalRules: CareerTokenGlobalRule[];
  saving: boolean;
  onChange: (configs: CareerTokenRuleConfig[]) => void;
  onGlobalRulesChange: (rules: CareerTokenGlobalRule[]) => void;
  onSave: () => void;
};

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition"
      style={{
        borderColor: checked ? OMNIA_BLUE : BORDER,
        background: checked ? `${OMNIA_BLUE}10` : '#fff',
        color: checked ? OMNIA_BLUE : MUTED,
      }}
      aria-pressed={checked}
    >
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: checked ? '#16A34A' : '#CBD5E1' }}
      />
      {label}
    </button>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  suffix,
}: {
  label: string;
  value?: number | null;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          value={Number.isFinite(Number(value)) ? Number(value) : 0}
          onChange={(event) => onChange(Math.max(min, Number(event.target.value || 0)))}
          className="h-10 w-full rounded-xl border bg-white px-3 text-sm font-semibold outline-none focus:border-[#002050]"
          style={{ borderColor: BORDER, color: OMNIA_BLUE }}
        />
        {suffix && <span className="whitespace-nowrap text-xs" style={{ color: MUTED }}>{suffix}</span>}
      </div>
    </label>
  );
}

function normalizeType(config: CareerTokenRuleConfig): CareerTokenRuleType {
  if (config.rule_type === 'earn' || config.rule_type === 'spend') return config.rule_type;
  return String(config.config_group || '').toLowerCase().includes('earn') ? 'earn' : 'spend';
}

function normalizeRepeat(config: CareerTokenRuleConfig): CareerTokenRepeatPolicy {
  return config.repeat_policy || (normalizeType(config) === 'earn' ? 'once' : 'unlimited');
}

export default function CareerTokenGovernancePanel({ configs, globalRules, saving, onChange, onGlobalRulesChange, onSave }: Props) {
  const [activeType, setActiveType] = useState<CareerTokenRuleType>('earn');
  const [showCreator, setShowCreator] = useState(false);
  const [draft, setDraft] = useState({
    config_key: '',
    label_fr: '',
    description_fr: '',
    rule_type: 'earn' as CareerTokenRuleType,
  });

  const grouped = useMemo(() => ({
    earn: configs
      .filter(config => config.metadata?.hidden !== true && normalizeType(config) === 'earn')
      .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0)),
    spend: configs
      .filter(config => config.metadata?.hidden !== true && normalizeType(config) === 'spend')
      .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0)),
  }), [configs]);

  const enabledEarn = grouped.earn.filter(config => config.is_active && Number(config.config_value || 0) > 0).length;
  const enabledSpend = grouped.spend.filter(config => config.is_active && Number(config.config_value || 0) > 0).length;

  function update(configKey: string, patch: Partial<CareerTokenRuleConfig>) {
    onChange(configs.map(config => config.config_key === configKey ? { ...config, ...patch } : config));
  }

  function globalRule(ruleKey: string) {
    return globalRules.find(rule => rule.rule_key === ruleKey);
  }

  function updateGlobal(ruleKey: string, value: boolean) {
    onGlobalRulesChange(globalRules.map(rule => rule.rule_key === ruleKey
      ? { ...rule, value_json: { ...rule.value_json, value } }
      : rule));
  }

  function addCustomRule() {
    const key = draft.config_key
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (!key || !draft.label_fr.trim() || configs.some(config => config.config_key === key)) return;

    const next: CareerTokenRuleConfig = {
      config_key: key,
      label_fr: draft.label_fr.trim(),
      description_fr: draft.description_fr.trim(),
      config_value: 0,
      config_group: draft.rule_type,
      rule_type: draft.rule_type,
      repeat_policy: draft.rule_type === 'earn' ? 'once' : 'unlimited',
      min_value: 0,
      max_value: 10000,
      value_unit: 'jeton(s)',
      display_order: configs.length + 100,
      max_per_day: 0,
      max_per_month: 0,
      max_per_lifetime: 0,
      cooldown_hours: 0,
      free_uses_per_month: 0,
      requires_validation: draft.rule_type === 'earn',
      eligible_role: 'apprenant',
      metadata: { custom: true },
      is_active: false,
    };

    onChange([...configs, next]);
    setActiveType(draft.rule_type);
    setDraft({ config_key: '', label_fr: '', description_fr: '', rule_type: 'earn' });
    setShowCreator(false);
  }

  const visible = grouped[activeType];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: OMNIA_BLUE }}>Gouvernance avancée des jetons</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6" style={{ color: MUTED }}>
            L’Administration Omnia choisit les événements qui créditent les apprenants et le coût de chaque action.
            Une règle inactive ou réglée à zéro ne crédite et ne débite aucun jeton.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowCreator(value => !value)}
            className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold"
            style={{ borderColor: BORDER, color: OMNIA_BLUE }}
          >
            <Plus size={15} /> Nouvelle méthode
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: OMNIA_BLUE }}
          >
            <Save size={15} /> Enregistrer
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: OMNIA_BLUE }}>
            <Gift size={17} /> Gains actifs
          </div>
          <div className="mt-2 text-3xl font-bold" style={{ color: OMNIA_GOLD }}>{enabledEarn}</div>
          <p className="mt-1 text-xs" style={{ color: MUTED }}>Sur {grouped.earn.length} méthode(s) disponible(s)</p>
        </div>
        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: OMNIA_BLUE }}>
            <Coins size={17} /> Dépenses actives
          </div>
          <div className="mt-2 text-3xl font-bold" style={{ color: OMNIA_GOLD }}>{enabledSpend}</div>
          <p className="mt-1 text-xs" style={{ color: MUTED }}>Sur {grouped.spend.length} action(s) configurable(s)</p>
        </div>
        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: OMNIA_BLUE }}>
            <ShieldCheck size={17} /> État initial sécurisé
          </div>
          <p className="mt-3 text-sm leading-6" style={{ color: MUTED }}>
            Tous les soldes et toutes les règles automatiques repartent à zéro. Rien n’est attribué sans activation explicite.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
        <div className="flex items-start gap-3">
          <ShieldCheck size={20} style={{ color: OMNIA_GOLD }} />
          <div>
            <h3 className="font-semibold" style={{ color: OMNIA_BLUE }}>Activation générale</h3>
            <p className="mt-1 text-sm leading-6" style={{ color: MUTED }}>
              Les interrupteurs généraux priment sur toutes les règles individuelles. Un modèle marqué Premium reste accessible tant que l’accès Premium global est désactivé.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {[
            ['career_token_earning_enabled', 'Autoriser les gains', 'Active les crédits automatiques configurés ci-dessous.'],
            ['career_token_spending_enabled', 'Autoriser les dépenses', 'Active les débits configurés pour les actions apprenant.'],
            ['career_premium_templates_enabled', 'Activer les modèles Premium', 'Applique le statut Premium aux modèles choisis par l’Administration Omnia.'],
          ].map(([key, label, description]) => {
            const rule = globalRule(key);
            const checked = Boolean(rule?.value_json?.value);
            return (
              <div key={key} className="rounded-xl border p-4" style={{ borderColor: BORDER, background: '#F8FAFC' }}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{label}</p>
                  <Toggle checked={checked} onChange={value => updateGlobal(key, value)} label={checked ? 'Activé' : 'Désactivé'} />
                </div>
                <p className="mt-2 text-xs leading-5" style={{ color: MUTED }}>{description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {showCreator && (
        <div className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
          <h3 className="font-semibold" style={{ color: OMNIA_BLUE }}>Ajouter une méthode configurable</h3>
          <p className="mt-1 text-xs" style={{ color: MUTED }}>
            La clé technique permet aux autres modules Omnia d’appeler cette règle sans recoder son montant.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold" style={{ color: MUTED }}>Type</span>
              <select
                value={draft.rule_type}
                onChange={event => setDraft(value => ({ ...value, rule_type: event.target.value as CareerTokenRuleType }))}
                className="h-11 w-full rounded-xl border bg-white px-3 text-sm"
                style={{ borderColor: BORDER }}
              >
                <option value="earn">Gain</option>
                <option value="spend">Dépense</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold" style={{ color: MUTED }}>Clé technique</span>
              <input
                value={draft.config_key}
                onChange={event => setDraft(value => ({ ...value, config_key: event.target.value }))}
                placeholder="ex. earn_challenge_validated"
                className="h-11 w-full rounded-xl border px-3 text-sm"
                style={{ borderColor: BORDER }}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold" style={{ color: MUTED }}>Nom affiché</span>
              <input
                value={draft.label_fr}
                onChange={event => setDraft(value => ({ ...value, label_fr: event.target.value }))}
                placeholder="Challenge validé"
                className="h-11 w-full rounded-xl border px-3 text-sm"
                style={{ borderColor: BORDER }}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold" style={{ color: MUTED }}>Description</span>
              <input
                value={draft.description_fr}
                onChange={event => setDraft(value => ({ ...value, description_fr: event.target.value }))}
                placeholder="Condition d’attribution ou action concernée"
                className="h-11 w-full rounded-xl border px-3 text-sm"
                style={{ borderColor: BORDER }}
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={addCustomRule}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ background: OMNIA_GOLD }}
            >
              Ajouter désactivée et à zéro
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 rounded-2xl border bg-white p-2" style={{ borderColor: BORDER }}>
        <button
          type="button"
          onClick={() => setActiveType('earn')}
          className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition"
          style={{
            background: activeType === 'earn' ? OMNIA_BLUE : '#F8FAFC',
            color: activeType === 'earn' ? '#fff' : OMNIA_BLUE,
          }}
        >
          Méthodes de gain ({grouped.earn.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveType('spend')}
          className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition"
          style={{
            background: activeType === 'spend' ? OMNIA_BLUE : '#F8FAFC',
            color: activeType === 'spend' ? '#fff' : OMNIA_BLUE,
          }}
        >
          Coûts des actions ({grouped.spend.length})
        </button>
      </div>

      <div className="space-y-4">
        {visible.map(config => {
          const type = normalizeType(config);
          const repeat = normalizeRepeat(config);
          const enabled = Boolean(config.is_active);
          const effective = enabled && Number(config.config_value || 0) > 0;

          return (
            <section
              key={config.config_key}
              className="rounded-2xl border bg-white p-5"
              style={{ borderColor: effective ? `${OMNIA_GOLD}70` : BORDER }}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-[260px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold" style={{ color: OMNIA_BLUE }}>
                      {config.label_fr || config.description_fr || config.config_key}
                    </h3>
                    <span
                      className="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
                      style={{
                        background: type === 'earn' ? '#ECFDF3' : '#FFF7E6',
                        color: type === 'earn' ? '#15803D' : '#9A6700',
                      }}
                    >
                      {type === 'earn' ? 'Gain' : 'Dépense'}
                    </span>
                    {effective && <CheckCircle2 size={16} className="text-emerald-600" />}
                  </div>
                  <p className="mt-1 text-sm leading-6" style={{ color: MUTED }}>
                    {config.description_fr || 'Règle configurable par l’Administration Omnia.'}
                  </p>
                  <p className="mt-1 font-mono text-[11px]" style={{ color: '#98A2B3' }}>{config.config_key}</p>
                </div>
                <Toggle
                  checked={enabled}
                  onChange={value => update(config.config_key, { is_active: value })}
                  label={enabled ? 'Activée' : 'Désactivée'}
                />
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <NumberField
                  label={type === 'earn' ? 'Jetons gagnés' : 'Coût de l’action'}
                  value={config.config_value}
                  min={0}
                  max={Number(config.max_value || 10000)}
                  suffix="jeton(s)"
                  onChange={value => update(config.config_key, { config_value: value })}
                />

                {type === 'earn' ? (
                  <>
                    <label className="block">
                      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                        Fréquence
                      </span>
                      <select
                        value={repeat}
                        onChange={event => update(config.config_key, { repeat_policy: event.target.value as CareerTokenRepeatPolicy })}
                        className="h-10 w-full rounded-xl border bg-white px-3 text-sm"
                        style={{ borderColor: BORDER, color: OMNIA_BLUE }}
                      >
                        <option value="once">Une seule fois</option>
                        <option value="per_reference">Une fois par élément validé</option>
                        <option value="daily">Une fois par jour</option>
                        <option value="weekly">Une fois par semaine</option>
                        <option value="monthly">Une fois par mois</option>
                        <option value="unlimited">À chaque événement</option>
                      </select>
                    </label>
                    <NumberField
                      label="Plafond par jour"
                      value={config.max_per_day}
                      onChange={value => update(config.config_key, { max_per_day: value })}
                    />
                    <NumberField
                      label="Plafond par mois"
                      value={config.max_per_month}
                      onChange={value => update(config.config_key, { max_per_month: value })}
                    />
                    <NumberField
                      label="Plafond total"
                      value={config.max_per_lifetime}
                      onChange={value => update(config.config_key, { max_per_lifetime: value })}
                    />
                    <NumberField
                      label="Délai entre deux gains"
                      value={config.cooldown_hours}
                      suffix="heure(s)"
                      onChange={value => update(config.config_key, { cooldown_hours: value })}
                    />
                    <div className="flex items-end">
                      <Toggle
                        checked={Boolean(config.requires_validation)}
                        onChange={value => update(config.config_key, { requires_validation: value })}
                        label={config.requires_validation ? 'Validation exigée' : 'Validation automatique'}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <NumberField
                      label="Utilisations gratuites / mois"
                      value={config.free_uses_per_month}
                      onChange={value => update(config.config_key, { free_uses_per_month: value })}
                    />
                    <div className="rounded-xl border p-3 md:col-span-2" style={{ borderColor: BORDER, background: '#F8FAFC' }}>
                      <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: OMNIA_BLUE }}>
                        <Sparkles size={14} /> Application
                      </div>
                      <p className="mt-1 text-xs leading-5" style={{ color: MUTED }}>
                        La règle est gratuite tant qu’elle est désactivée ou à zéro. Lorsqu’elle est active, le débit est atomique et refuse l’action si le solde est insuffisant.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </section>
          );
        })}

        {visible.length === 0 && (
          <div className="rounded-2xl border border-dashed bg-white p-10 text-center" style={{ borderColor: BORDER }}>
            <Coins className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm" style={{ color: MUTED }}>Aucune règle dans cette catégorie.</p>
          </div>
        )}
      </div>
    </div>
  );
}
