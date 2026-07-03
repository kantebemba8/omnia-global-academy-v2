import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { FileText, ChevronRight, Sparkles, Eye, Download, CheckCircle, AlertCircle } from 'lucide-react';

interface CvData {
  step1_data: Record<string, unknown> | null;
  step2_data: Record<string, unknown> | null;
  step3_data: Record<string, unknown> | null;
  step4_template: string;
}

function getApiBase() {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return url ? `${url}/functions/v1` : '/api';
}

const TEMPLATES = [
  { id: 'moderne', label: 'Moderne', color: '#002050', accent: '#BF8813' },
  { id: 'classique', label: 'Classique', color: '#1a1a1a', accent: '#444' },
  { id: 'elegant', label: 'Élégant', color: '#1E7A52', accent: '#333' },
];

const STEPS = [
  { num: 1, label: 'Informations personnelles' },
  { num: 2, label: 'Expériences professionnelles' },
  { num: 3, label: 'Formation & Compétences' },
  { num: 4, label: 'Modèle & Génération' },
];

function Step1({ data, onChange }: { data: Record<string, string>; onChange: (d: Record<string, string>) => void }) {
  const fields = [
    { key: 'prenom', label: 'Prénom', placeholder: 'Votre prénom' },
    { key: 'nom', label: 'Nom de famille', placeholder: 'Votre nom' },
    { key: 'titre', label: 'Titre professionnel', placeholder: 'Ex : Développeur Web Senior' },
    { key: 'email', label: 'Email', placeholder: 'email@exemple.com' },
    { key: 'telephone', label: 'Téléphone', placeholder: '+223 XX XX XX XX' },
    { key: 'ville', label: 'Ville / Pays', placeholder: 'Bamako, Mali' },
    { key: 'profil', label: 'Résumé de profil', placeholder: 'Quelques lignes sur vous...', multiline: true },
  ];
  return (
    <div className="space-y-4">
      {fields.map((f) => (
        <div key={f.key}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
          {(f as unknown as { multiline?: boolean }).multiline ? (
            <textarea rows={4} value={(data[f.key] as string) ?? ''} onChange={(e) => onChange({ ...data, [f.key]: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-gray-400"
              placeholder={f.placeholder} />
          ) : (
            <input type="text" value={(data[f.key] as string) ?? ''} onChange={(e) => onChange({ ...data, [f.key]: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
              placeholder={f.placeholder} />
          )}
        </div>
      ))}
    </div>
  );
}

function Step2({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const exps = (data.experiences as Array<Record<string, string>>) ?? [];
  function addExp() { onChange({ experiences: [...exps, { poste: '', entreprise: '', debut: '', fin: '', description: '' }] }); }
  function updateExp(i: number, k: string, v: string) {
    const next = exps.map((e, idx) => idx === i ? { ...e, [k]: v } : e);
    onChange({ experiences: next });
  }
  function removeExp(i: number) { onChange({ experiences: exps.filter((_, idx) => idx !== i) }); }
  return (
    <div className="space-y-4">
      {exps.map((exp, i) => (
        <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Expérience {i + 1}</span>
            <button onClick={() => removeExp(i)} className="text-xs text-red-500 hover:text-red-700">Supprimer</button>
          </div>
          {[
            { k: 'poste', l: 'Intitulé du poste', p: 'Chef de projet' },
            { k: 'entreprise', l: 'Entreprise', p: 'Nom de l\'entreprise' },
            { k: 'debut', l: 'Date de début', p: 'Jan 2022' },
            { k: 'fin', l: 'Date de fin', p: 'Présent' },
          ].map((f) => (
            <div key={f.k}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{f.l}</label>
              <input type="text" value={exp[f.k] ?? ''} onChange={(e) => updateExp(i, f.k, e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400" placeholder={f.p} />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea rows={3} value={exp.description ?? ''} onChange={(e) => updateExp(i, 'description', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-gray-400"
              placeholder="Décrivez vos missions et réalisations..." />
          </div>
        </div>
      ))}
      <button onClick={addExp} className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-all">
        + Ajouter une expérience
      </button>
    </div>
  );
}

function Step3({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const formations = (data.formations as Array<Record<string, string>>) ?? [];
  const competences = (data.competences as string) ?? '';
  const langues = (data.langues as string) ?? '';

  function addFormation() {
    onChange({ ...data, formations: [...formations, { diplome: '', etablissement: '', annee: '' }] });
  }
  function updateFormation(i: number, k: string, v: string) {
    onChange({ ...data, formations: formations.map((f, idx) => idx === i ? { ...f, [k]: v } : f) });
  }
  function removeFormation(i: number) {
    onChange({ ...data, formations: formations.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Diplômes et formations</h3>
        {formations.map((f, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-4 mb-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-xs font-medium text-gray-600">Formation {i + 1}</span>
              <button onClick={() => removeFormation(i)} className="text-xs text-red-500">Supprimer</button>
            </div>
            {[
              { k: 'diplome', l: 'Diplôme', p: 'Licence en Informatique' },
              { k: 'etablissement', l: 'Établissement', p: 'Université de Bamako' },
              { k: 'annee', l: 'Année', p: '2020' },
            ].map((field) => (
              <div key={field.k}>
                <label className="block text-xs text-gray-500 mb-1">{field.l}</label>
                <input type="text" value={f[field.k] ?? ''} onChange={(e) => updateFormation(i, field.k, e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400" placeholder={field.p} />
              </div>
            ))}
          </div>
        ))}
        <button onClick={addFormation} className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-gray-300 transition-all">
          + Ajouter une formation
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Compétences techniques</label>
        <textarea rows={3} value={competences} onChange={(e) => onChange({ ...data, competences: e.target.value })}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-gray-400"
          placeholder="Ex : Python, JavaScript, Gestion de projet, Microsoft Office..." />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Langues</label>
        <input type="text" value={langues} onChange={(e) => onChange({ ...data, langues: e.target.value })}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
          placeholder="Ex : Français (courant), Anglais (intermédiaire), Bambara (natif)" />
      </div>
    </div>
  );
}

export function DashboardCvBuilder() {
  const [cvData, setCvData] = useState<CvData>({ step1_data: null, step2_data: null, step3_data: null, step4_template: 'moderne' });
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [generating, setGenerating] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [genError, setGenError] = useState('');
  const [userTokens, setUserTokens] = useState(0);

  const bypassAuth = new URLSearchParams(window.location.search).get('preview') === 'true' &&
    (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; } })();

  const load = useCallback(async () => {
    if (bypassAuth) return;
    const token = localStorage.getItem('omnia_session_token');
    if (!token) return;
    try {
      const [cvRes, dashRes] = await Promise.all([
        fetch(`${getApiBase()}/cv-builder-save`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${getApiBase()}/dashboard-apprenant`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (cvRes.ok) {
        const json = await cvRes.json();
        if (json.cv) setCvData(json.cv);
      }
      if (dashRes.ok) {
        const json = await dashRes.json();
        setUserTokens(json.user?.ai_tokens ?? 0);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveStep(step: number, data: unknown, templateOverride?: string) {
    const token = localStorage.getItem('omnia_session_token');
    if (!token) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const body: Record<string, unknown> = { step, data };
      if (templateOverride) { body.step = 4; body.data = undefined; body.template = templateOverride; }
      const res = await fetch(`${getApiBase()}/cv-builder-save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) { setSaveMsg('Sauvegardé'); setTimeout(() => setSaveMsg(''), 2000); }
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  async function generatePreview(useToken: boolean) {
    const token = localStorage.getItem('omnia_session_token');
    if (!token) return;
    setGenerating(true);
    setGenError('');
    try {
      const res = await fetch(`${getApiBase()}/cv-builder-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ preview: !useToken }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.error === 'INSUFFICIENT_TOKENS') setGenError('Pas assez de jetons IA. Parrainez un ami pour en obtenir.');
        else if (json.error === 'CV_DATA_INCOMPLETE') setGenError('Complétez au moins l\'étape 1 avant de générer.');
        else setGenError(json.message || json.error || 'Erreur');
        return;
      }
      setPreviewHtml(json.html ?? '');
      if (useToken) setUserTokens((t) => Math.max(0, t - 1));
    } catch { setGenError('Erreur réseau'); }
    finally { setGenerating(false); }
  }

  function downloadHtml() {
    if (!previewHtml) return;
    const blob = new Blob([previewHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'mon-cv.html'; a.click();
    URL.revokeObjectURL(url);
  }

  const step1 = (cvData.step1_data ?? {}) as Record<string, string>;
  const step2 = (cvData.step2_data ?? {}) as Record<string, unknown>;
  const step3 = (cvData.step3_data ?? {}) as Record<string, unknown>;
  const template = cvData.step4_template ?? 'moderne';

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6" style={{ color: '#002050' }} />
            CV Builder IA
          </h1>
          <p className="text-gray-500 text-sm mt-1">Créez un CV professionnel en quelques minutes avec l'intelligence artificielle</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setCurrentStep(s.num)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={currentStep === s.num ? { backgroundColor: '#002050', color: 'white' } : currentStep > s.num ? { backgroundColor: '#1E7A52' + '15', color: '#1E7A52' } : { backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                {currentStep > s.num ? <CheckCircle className="w-3.5 h-3.5" /> : <span className="w-4 h-4 rounded-full flex items-center justify-center text-xs border" style={{ borderColor: currentStep === s.num ? 'white' : '#d1d5db' }}>{s.num}</span>}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">{STEPS[currentStep - 1].label}</h2>
          </div>
          <div className="p-5">
            {currentStep === 1 && (
              <Step1 data={step1} onChange={(d) => setCvData((p) => ({ ...p, step1_data: d }))} />
            )}
            {currentStep === 2 && (
              <Step2 data={step2} onChange={(d) => setCvData((p) => ({ ...p, step2_data: d }))} />
            )}
            {currentStep === 3 && (
              <Step3 data={step3} onChange={(d) => setCvData((p) => ({ ...p, step3_data: d }))} />
            )}
            {currentStep === 4 && (
              <div className="space-y-6">
                {/* Template selector */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Choisissez votre modèle</label>
                  <div className="grid grid-cols-3 gap-3">
                    {TEMPLATES.map((t) => (
                      <button key={t.id} onClick={() => { setCvData((p) => ({ ...p, step4_template: t.id })); saveStep(4, null, t.id); }}
                        className="border-2 rounded-xl p-4 transition-all text-left"
                        style={{ borderColor: template === t.id ? t.color : '#e5e7eb', backgroundColor: template === t.id ? t.color + '08' : 'white' }}>
                        <div className="w-8 h-8 rounded-lg mb-2" style={{ backgroundColor: t.color }} />
                        <div className="w-full h-1 rounded mb-1" style={{ backgroundColor: t.color + '40' }} />
                        <div className="w-3/4 h-1 rounded mb-1" style={{ backgroundColor: t.accent + '40' }} />
                        <div className="w-1/2 h-1 rounded" style={{ backgroundColor: t.color + '20' }} />
                        <p className="text-xs font-medium mt-2" style={{ color: template === t.id ? t.color : '#374151' }}>{t.label}</p>
                        {template === t.id && <CheckCircle className="w-4 h-4 mt-1" style={{ color: t.color }} />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Token info */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#BF8813' }} />
                    <div>
                      <p className="text-sm font-semibold text-amber-900">Jetons IA : {userTokens} restant{userTokens !== 1 ? 's' : ''}</p>
                      <p className="text-xs text-amber-700 mt-0.5">La prévisualisation est gratuite. Le téléchargement du CV final coûte 1 jeton IA.</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button onClick={() => generatePreview(false)} disabled={generating}
                    className="flex-1 py-2.5 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    style={{ borderColor: '#002050', color: '#002050' }}>
                    <Eye className="w-4 h-4" />
                    {generating ? 'Génération...' : 'Prévisualiser (gratuit)'}
                  </button>
                  <button onClick={() => generatePreview(true)} disabled={generating || userTokens < 1}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    style={{ backgroundColor: '#002050' }}>
                    <Sparkles className="w-4 h-4" />
                    {generating ? 'Génération...' : 'Générer (1 jeton)'}
                  </button>
                </div>

                {genError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {genError}
                  </div>
                )}

                {/* Preview iframe */}
                {previewHtml && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <span className="text-sm font-medium text-gray-700">Aperçu du CV</span>
                      <button onClick={downloadHtml}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-80"
                        style={{ backgroundColor: '#1E7A52' }}>
                        <Download className="w-3.5 h-3.5" /> Télécharger HTML
                      </button>
                    </div>
                    <iframe srcDoc={previewHtml} className="w-full border-0" style={{ height: 600 }} title="CV Preview" />
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Footer */}
          <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              {saving && <span>Sauvegarde...</span>}
              {saveMsg && <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-3.5 h-3.5" />{saveMsg}</span>}
            </div>
            <div className="flex gap-2">
              {currentStep > 1 && (
                <button onClick={() => setCurrentStep((s) => s - 1)}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all">
                  Précédent
                </button>
              )}
              {currentStep < 4 && (
                <button onClick={async () => {
                  const stepData = currentStep === 1 ? step1 : currentStep === 2 ? step2 : step3;
                  await saveStep(currentStep, stepData);
                  setCurrentStep((s) => s + 1);
                }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: '#002050' }}>
                  Sauvegarder & Continuer
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
