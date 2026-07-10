import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Minus, CheckCircle2 } from 'lucide-react';
import { CVSectionPanel } from './CVSectionPanel';
import { CVLivePreview } from './CVLivePreview';
import { CVSettingsPanel } from './CVSettingsPanel';
import { CVAutosaveStatus } from './CVAutosaveStatus';

const SB = import.meta.env.VITE_SUPABASE_URL;
const API_CV = `${SB}/functions/v1/career-cv-manage`;

// ── Types ────────────────────────────────────────────────────
export interface CVSection {
  id: string;
  cv_id: string;
  section_type: string;
  title?: string;
  content_json: Record<string, any>;
  position: number;
  is_visible: boolean;
}

export interface CVData {
  id: string;
  title: string;
  target_job?: string;
  template_key: string;
  theme_color: string;
  is_primary: boolean;
  ats_score: number;
  sections: CVSection[];
}

// ── Contenu par défaut pour chaque section ───────────────────
function defaultContent(type: string): Record<string, any> {
  switch (type) {
    case 'profile': return {
      fullName: '', jobTitle: '', email: '', phone: '',
      location: '', linkedin: '', summary: '',
    };
    case 'skills': return { items: [] };
    case 'experiences': return { items: [] };
    case 'education': return { items: [] };
    case 'certifications': return { items: [] };
    case 'languages': return { items: [] };
    case 'interests': return { items: [] };
    default: return {};
  }
}

const SECTION_ORDER = ['profile', 'skills', 'experiences', 'education', 'certifications', 'languages', 'interests'];
const DEFAULT_SECTIONS = ['profile', 'skills', 'experiences', 'education', 'languages'];
const SECTION_LABELS: Record<string, string> = {
  profile: 'Profil', skills: 'Compétences', experiences: 'Expériences',
  education: 'Formation', certifications: 'Certifications',
  languages: 'Langues', interests: 'Centres d\'intérêt',
};

function token() { return localStorage.getItem('omnia_session_token') || ''; }

async function apiCall(action: string, body: Record<string, any> = {}) {
  const res = await fetch(API_CV, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  });
  return res.json();
}

// ── Éditeurs de sections ─────────────────────────────────────
function ProfileEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const fields = [
    { key: 'fullName', label: 'Nom complet', placeholder: 'Lina Amani' },
    { key: 'jobTitle', label: 'Titre professionnel', placeholder: 'Développeuse Full Stack' },
    { key: 'email', label: 'Email', placeholder: 'lina@email.com' },
    { key: 'phone', label: 'Téléphone', placeholder: '+33 6 12 34 56 78' },
    { key: 'location', label: 'Localisation', placeholder: 'Paris, France' },
    { key: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/linaamani' },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {fields.map(f => (
          <div key={f.key}>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#002050' }}>{f.label}</label>
            <input className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:border-[#002050]"
              style={{ borderColor: '#E5E7EB' }}
              placeholder={f.placeholder}
              value={data[f.key] || ''}
              onChange={e => onChange({ ...data, [f.key]: e.target.value })} />
          </div>
        ))}
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: '#002050' }}>Résumé professionnel</label>
        <textarea className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:border-[#002050] resize-none"
          style={{ borderColor: '#E5E7EB' }} rows={4}
          placeholder="Développeuse Full Stack passionnée avec 4 ans d'expérience..."
          value={data.summary || ''}
          onChange={e => onChange({ ...data, summary: e.target.value })} />
      </div>
    </div>
  );
}

function SkillsEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const items: string[] = data.items || [];
  const [newSkill, setNewSkill] = useState('');
  const add = () => {
    if (!newSkill.trim()) return;
    onChange({ items: [...items, newSkill.trim()] });
    setNewSkill('');
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {items.map((s, i) => (
          <span key={i} className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
            style={{ background: 'rgba(0,32,80,0.08)', color: '#002050' }}>
            {s}
            <button type="button" onClick={() => onChange({ items: items.filter((_, j) => j !== i) })}>
              <Minus size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="flex-1 rounded-xl border px-3 py-2 text-sm focus:outline-none focus:border-[#002050]"
          style={{ borderColor: '#E5E7EB' }}
          placeholder="Ex: JavaScript, React, Python..."
          value={newSkill}
          onChange={e => setNewSkill(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()} />
        <button type="button" onClick={add}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
          style={{ background: '#002050' }}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

function ExperiencesEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const items = data.items || [];
  const addItem = () => onChange({ items: [...items, { jobTitle: '', company: '', location: '', startDate: '', endDate: '', description: [''] }] });
  const updateItem = (i: number, updates: any) => { const n = [...items]; n[i] = { ...n[i], ...updates }; onChange({ items: n }); };
  const removeItem = (i: number) => onChange({ items: items.filter((_: any, j: number) => j !== i) });
  const addBullet = (i: number) => { const n = [...items]; n[i].description = [...(n[i].description || []), '']; onChange({ items: n }); };
  const updateBullet = (i: number, j: number, val: string) => { const n = [...items]; n[i].description[j] = val; onChange({ items: n }); };
  const removeBullet = (i: number, j: number) => { const n = [...items]; n[i].description.splice(j, 1); onChange({ items: n }); };

  return (
    <div className="space-y-4">
      {items.map((exp: any, i: number) => (
        <div key={i} className="rounded-xl border p-4 space-y-2" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-semibold" style={{ color: '#002050' }}>Expérience {i + 1}</span>
            <button type="button" onClick={() => removeItem(i)} className="text-xs" style={{ color: '#DC2626' }}>Supprimer</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[['jobTitle','Poste','Développeuse Full Stack'],['company','Entreprise','TechNova Solutions'],['location','Lieu','Paris, France'],['startDate','Début','Janv. 2022'],['endDate','Fin (vide = en cours)','Aujourd\'hui']].map(([k,l,p]) => (
              <div key={k}>
                <label className="block text-xs font-medium mb-0.5" style={{ color: '#64748B' }}>{l}</label>
                <input className="w-full rounded-lg border px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#002050]"
                  style={{ borderColor: '#E5E7EB' }} placeholder={p}
                  value={exp[k] || ''} onChange={e => updateItem(i, { [k]: e.target.value })} />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>Points clés</label>
            {(exp.description || []).map((d: string, j: number) => (
              <div key={j} className="flex items-center gap-2 mb-1.5">
                <span className="text-xs" style={{ color: '#bf8813' }}>•</span>
                <input className="flex-1 rounded-lg border px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#002050]"
                  style={{ borderColor: '#E5E7EB' }} placeholder="Description..."
                  value={d} onChange={e => updateBullet(i, j, e.target.value)} />
                <button type="button" onClick={() => removeBullet(i, j)}><Minus size={12} style={{ color: '#9CA3AF' }} /></button>
              </div>
            ))}
            <button type="button" onClick={() => addBullet(i)}
              className="flex items-center gap-1 text-xs font-medium" style={{ color: '#002050' }}>
              <Plus size={11} /> Ajouter un point
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={addItem}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-2.5 text-sm font-medium transition hover:bg-slate-50"
        style={{ borderColor: '#002050', color: '#002050' }}>
        <Plus size={14} /> Ajouter une expérience
      </button>
    </div>
  );
}

function EducationEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const items = data.items || [];
  const add = () => onChange({ items: [...items, { degree: '', school: '', location: '', startDate: '', endDate: '' }] });
  const upd = (i: number, k: string, v: string) => { const n = [...items]; n[i][k] = v; onChange({ items: n }); };
  const rem = (i: number) => onChange({ items: items.filter((_: any, j: number) => j !== i) });
  return (
    <div className="space-y-3">
      {items.map((edu: any, i: number) => (
        <div key={i} className="rounded-xl border p-4 space-y-2" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex justify-between"><span className="text-xs font-semibold" style={{ color: '#002050' }}>Formation {i + 1}</span>
            <button type="button" onClick={() => rem(i)} className="text-xs" style={{ color: '#DC2626' }}>Supprimer</button></div>
          <div className="grid grid-cols-2 gap-2">
            {[['degree','Diplôme','Master en Informatique'],['school','École / Université','Université Paris-Saclay'],['location','Lieu','Orsay, France'],['startDate','Début','2018'],['endDate','Fin','2020']].map(([k,l,p]) => (
              <div key={k}>
                <label className="block text-xs font-medium mb-0.5" style={{ color: '#64748B' }}>{l}</label>
                <input className="w-full rounded-lg border px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#002050]"
                  style={{ borderColor: '#E5E7EB' }} placeholder={p}
                  value={edu[k] || ''} onChange={e => upd(i, k, e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <button type="button" onClick={add}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-2.5 text-sm font-medium"
        style={{ borderColor: '#002050', color: '#002050' }}>
        <Plus size={14} /> Ajouter une formation
      </button>
    </div>
  );
}

function CertificationsEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const items = data.items || [];
  const add = () => onChange({ items: [...items, { title: '', issuer: '', date: '' }] });
  const upd = (i: number, k: string, v: string) => { const n = [...items]; n[i][k] = v; onChange({ items: n }); };
  const rem = (i: number) => onChange({ items: items.filter((_: any, j: number) => j !== i) });
  return (
    <div className="space-y-3">
      {items.map((cert: any, i: number) => (
        <div key={i} className="flex items-center gap-2 rounded-xl border p-3" style={{ borderColor: '#E5E7EB' }}>
          {[['title','Certification','Full Stack Developer'],['issuer','Émetteur','Omnia Global Academy'],['date','Date','Mars 2025']].map(([k,l,p]) => (
            <div key={k} className="flex-1">
              <label className="block text-xs font-medium mb-0.5" style={{ color: '#64748B' }}>{l}</label>
              <input className="w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#002050]"
                style={{ borderColor: '#E5E7EB' }} placeholder={p}
                value={cert[k] || ''} onChange={e => upd(i, k, e.target.value)} />
            </div>
          ))}
          <button type="button" onClick={() => rem(i)} className="mt-4"><Minus size={13} style={{ color: '#DC2626' }} /></button>
        </div>
      ))}
      <button type="button" onClick={add}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-2.5 text-sm font-medium"
        style={{ borderColor: '#002050', color: '#002050' }}>
        <Plus size={14} /> Ajouter une certification
      </button>
    </div>
  );
}

function LanguagesEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const items = data.items || [];
  const LEVELS = ['Langue maternelle', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1'];
  const add = () => onChange({ items: [...items, { language: '', level: 'B1' }] });
  const upd = (i: number, k: string, v: string) => { const n = [...items]; n[i][k] = v; onChange({ items: n }); };
  const rem = (i: number) => onChange({ items: items.filter((_: any, j: number) => j !== i) });
  return (
    <div className="space-y-2">
      {items.map((lang: any, i: number) => (
        <div key={i} className="flex items-center gap-2 rounded-xl border p-3" style={{ borderColor: '#E5E7EB' }}>
          <input className="flex-1 rounded-lg border px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#002050]"
            style={{ borderColor: '#E5E7EB' }} placeholder="Français"
            value={lang.language || ''} onChange={e => upd(i, 'language', e.target.value)} />
          <select className="rounded-lg border px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#002050]"
            style={{ borderColor: '#E5E7EB' }}
            value={lang.level || 'B1'} onChange={e => upd(i, 'level', e.target.value)}>
            {LEVELS.map(l => <option key={l}>{l}</option>)}
          </select>
          <button type="button" onClick={() => rem(i)}><Minus size={13} style={{ color: '#DC2626' }} /></button>
        </div>
      ))}
      <button type="button" onClick={add}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-2.5 text-sm font-medium"
        style={{ borderColor: '#002050', color: '#002050' }}>
        <Plus size={14} /> Ajouter une langue
      </button>
    </div>
  );
}

function InterestsEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const items: string[] = data.items || [];
  const [newItem, setNewItem] = useState('');
  const add = () => { if (!newItem.trim()) return; onChange({ items: [...items, newItem.trim()] }); setNewItem(''); };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {items.map((s, i) => (
          <span key={i} className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
            style={{ background: 'rgba(191,136,19,0.1)', color: '#bf8813' }}>
            {s}
            <button type="button" onClick={() => onChange({ items: items.filter((_, j) => j !== i) })}><Minus size={10} /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="flex-1 rounded-xl border px-3 py-2 text-sm focus:outline-none focus:border-[#002050]"
          style={{ borderColor: '#E5E7EB' }} placeholder="Ex: Photographie, Lecture..."
          value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
        <button type="button" onClick={add}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: '#002050' }}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

function SectionEditor({ section, onChange }: { section: CVSection; onChange: (content: any) => void }) {
  const c = section.content_json;
  switch (section.section_type) {
    case 'profile': return <ProfileEditor data={c} onChange={onChange} />;
    case 'skills': return <SkillsEditor data={c} onChange={onChange} />;
    case 'experiences': return <ExperiencesEditor data={c} onChange={onChange} />;
    case 'education': return <EducationEditor data={c} onChange={onChange} />;
    case 'certifications': return <CertificationsEditor data={c} onChange={onChange} />;
    case 'languages': return <LanguagesEditor data={c} onChange={onChange} />;
    case 'interests': return <InterestsEditor data={c} onChange={onChange} />;
    default: return <div className="text-sm text-slate-400">Section non reconnue</div>;
  }
}

// ── Composant principal ───────────────────────────────────────
export function CVBuilderEditor() {
  const [cvData, setCvData] = useState<CVData | null>(null);
  const [activeSection, setActiveSection] = useState<string>('profile');
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  // ── Charger ou créer le CV ────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await apiCall('get_or_create_cv');
        if (data.success) {
          setCvData(data.cv);
        } else {
          showToast('Erreur de chargement du CV');
        }
      } catch {
        showToast('Erreur réseau');
      }
      setLoading(false);
    })();
  }, []);

  // ── Autosave ──────────────────────────────────────────────
  const scheduleAutosave = useCallback((updatedCv: CVData) => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    setAutosaveStatus('saving');
    autosaveTimer.current = setTimeout(async () => {
      try {
        await apiCall('save_cv', { cv: updatedCv });
        setAutosaveStatus('saved');
        setTimeout(() => setAutosaveStatus('idle'), 3000);
      } catch {
        setAutosaveStatus('error');
      }
    }, 800);
  }, []);

  // ── Modifier une section ──────────────────────────────────
  function updateSection(sectionType: string, newContent: any) {
    if (!cvData) return;
    const updatedSections = cvData.sections.map(s =>
      s.section_type === sectionType ? { ...s, content_json: newContent } : s
    );
    const updated = { ...cvData, sections: updatedSections };
    setCvData(updated);
    scheduleAutosave(updated);
  }

  // ── Modifier template ou couleur ──────────────────────────
  function updateDesign(field: 'template_key' | 'theme_color', value: string) {
    if (!cvData) return;
    const updated = { ...cvData, [field]: value };
    setCvData(updated);
    scheduleAutosave(updated);
  }

  // ── Ajouter une section ───────────────────────────────────
  async function addSection(type: string) {
    if (!cvData) return;
    const newSection: CVSection = {
      id: crypto.randomUUID(),
      cv_id: cvData.id,
      section_type: type,
      title: SECTION_LABELS[type],
      content_json: defaultContent(type),
      position: cvData.sections.length,
      is_visible: true,
    };
    const updated = { ...cvData, sections: [...cvData.sections, newSection] };
    setCvData(updated);
    setActiveSection(type);
    scheduleAutosave(updated);
  }

  // ── Masquer/afficher section ──────────────────────────────
  function toggleVisible(id: string) {
    if (!cvData) return;
    const updated = {
      ...cvData,
      sections: cvData.sections.map(s => s.id === id ? { ...s, is_visible: !s.is_visible } : s)
    };
    setCvData(updated);
    scheduleAutosave(updated);
  }

  // ── Supprimer section ─────────────────────────────────────
  function deleteSection(id: string) {
    if (!cvData) return;
    const updated = { ...cvData, sections: cvData.sections.filter(s => s.id !== id) };
    setCvData(updated);
    scheduleAutosave(updated);
  }

  // ── Sauvegarde manuelle ───────────────────────────────────
  async function saveManually() {
    if (!cvData || saving) return;
    setSaving(true);
    try {
      await apiCall('save_cv', { cv: cvData });
      showToast('✅ CV sauvegardé');
    } catch { showToast('Erreur de sauvegarde'); }
    setSaving(false);
  }

  // ── Définir comme principal ───────────────────────────────
  async function setPrimary() {
    if (!cvData) return;
    await apiCall('set_primary', { cv_id: cvData.id });
    setCvData(prev => prev ? { ...prev, is_primary: true } : prev);
    showToast('✅ CV défini comme principal');
  }

  // ── Télécharger PDF ───────────────────────────────────────
  function downloadPDF() {
    showToast('Le téléchargement PDF sera activé à l\'étape suivante avec les jetons CV.');
  }

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
    </div>
  );

  if (!cvData) return (
    <div className="flex h-full items-center justify-center text-sm" style={{ color: '#64748B' }}>
      Impossible de charger le CV. Vérifiez votre connexion.
    </div>
  );

  const activeSectionData = cvData.sections.find(s => s.section_type === activeSection);

  return (
    <div className="flex h-full flex-col">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-medium shadow-lg"
          style={{ borderColor: '#E5E7EB', color: '#002050' }}>
          <CheckCircle2 size={15} style={{ color: '#065F46' }} /> {toast}
        </div>
      )}

      {/* Barre d'actions */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-3 flex-shrink-0"
        style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center gap-3">
          <input className="rounded-xl border px-3 py-1.5 text-sm font-semibold focus:outline-none focus:border-[#002050]"
            style={{ borderColor: '#E5E7EB', color: '#002050', minWidth: '200px' }}
            value={cvData.title}
            onChange={e => {
              const updated = { ...cvData, title: e.target.value };
              setCvData(updated);
              scheduleAutosave(updated);
            }} />
          <CVAutosaveStatus status={autosaveStatus} />
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={saveManually} disabled={saving}
            className="rounded-xl border px-4 py-1.5 text-sm font-semibold transition hover:bg-slate-50 disabled:opacity-50"
            style={{ borderColor: '#E5E7EB', color: '#374151' }}>
            {saving ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
          <button type="button" onClick={downloadPDF}
            className="rounded-xl px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: '#002050' }}>
            Télécharger PDF
          </button>
        </div>
      </div>

      {/* Corps — 3 colonnes */}
      <div className="flex flex-1 overflow-hidden">
        {/* Panneau gauche — Sections */}
        <div className="w-[260px] flex-shrink-0 overflow-y-auto border-r bg-white p-4"
          style={{ borderColor: '#E5E7EB' }}>
          <CVSectionPanel
            sections={cvData.sections}
            activeSection={activeSection}
            onSelect={setActiveSection}
            onToggleVisible={toggleVisible}
            onDelete={deleteSection}
            onAdd={addSection} />
        </div>

        {/* Zone centrale — Éditeur + aperçu */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Éditeur de la section active */}
          {activeSectionData && (
            <div className="border-b bg-white px-6 py-4 flex-shrink-0 max-h-[40%] overflow-y-auto"
              style={{ borderColor: '#E5E7EB' }}>
              <h3 className="text-base font-semibold mb-3" style={{ color: '#002050' }}>
                {SECTION_LABELS[activeSection] || activeSection}
              </h3>
              <SectionEditor
                section={activeSectionData}
                onChange={(newContent) => updateSection(activeSection, newContent)} />
            </div>
          )}
          {/* Aperçu CV */}
          <div className="flex-1 overflow-y-auto bg-slate-100 p-6">
            <CVLivePreview data={cvData} themeColor={cvData.theme_color} />
          </div>
        </div>

        {/* Panneau droit — Modèles, couleurs, score, actions */}
        <div className="w-[300px] flex-shrink-0 overflow-y-auto border-l bg-white p-4"
          style={{ borderColor: '#E5E7EB' }}>
          <CVSettingsPanel
            templateKey={cvData.template_key}
            themeColor={cvData.theme_color}
            atsScore={cvData.ats_score}
            isPrimary={cvData.is_primary}
            onTemplateChange={(key) => updateDesign('template_key', key)}
            onColorChange={(color) => updateDesign('theme_color', color)}
            onSetPrimary={setPrimary}
            onDownloadPDF={downloadPDF}
            onPreview={() => {}} />
        </div>
      </div>
    </div>
  );
}
