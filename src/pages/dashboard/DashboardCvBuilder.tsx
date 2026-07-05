import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Plus, Edit2, Trash2, Copy, Download,
  Eye, ChevronRight, ChevronLeft, Sparkles,
  Award, Briefcase, GraduationCap, User,
  Globe, Shield, Cpu, BarChart2, BookOpen,
  Check, X, AlertCircle, Coins
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// ─── TYPES ────────────────────────────────────────────────
interface CvData {
  name: string;
  title: string;
  objective?: string;
  summary: string;
  photo_url?: string;
  contact: {
    email: string;
    phone: string;
    location: string;
    linkedin?: string;
    portfolio?: string;
  };
  experiences: Array<{
    id: string;
    position: string;
    company: string;
    location?: string;
    start_date: string;
    end_date?: string;
    current: boolean;
    description: string;
  }>;
  education: Array<{
    id: string;
    degree: string;
    school: string;
    location?: string;
    year: string;
  }>;
  omnia_formations: Array<{
    id: string;
    course_id: string;
    title: string;
    category: string;
    completed_at: string;
    cpd_accredited: boolean;
    cpd_hours?: number;
    certificate_id?: string;
    verify_url?: string;
    show: boolean;
  }>;
  skills: Array<{ id: string; name: string; level: number }>;
  languages: Array<{ id: string; name: string; level: string }>;
  certifications_external: Array<{
    id: string; name: string; issuer: string; year: string;
  }>;
  projects: Array<{
    id: string; name: string; description: string; technologies?: string;
  }>;
  interests: string[];
}

const EMPTY_CV: CvData = {
  name: '', title: '', summary: '', contact: {
    email: '', phone: '', location: '',
  },
  experiences: [], education: [], omnia_formations: [],
  skills: [], languages: [], certifications_external: [],
  projects: [], interests: [],
};

const TEMPLATES = [
  { id: 'classique', name: 'CV Classique', desc: 'Structure traditionnelle et professionnelle', icon: FileText, ats: false },
  { id: 'moderne_ats', name: 'CV Moderne ATS', desc: 'Optimisé pour les recruteurs automatiques', icon: Shield, ats: true },
  { id: 'etudiant', name: 'CV Étudiant', desc: 'Idéal pour stages et alternances', icon: GraduationCap, ats: false },
  { id: 'international', name: 'CV International', desc: 'Format candidatures internationales', icon: Globe, ats: false },
  { id: 'qse', name: 'CV QSE / HSE', desc: 'Qualité, Sécurité, Environnement', icon: Shield, ats: false },
  { id: 'it_digital', name: 'CV IT / Digital', desc: 'Profils techniques et numériques', icon: Cpu, ats: false },
  { id: 'business', name: 'CV Business', desc: 'Profils commerciaux et managériaux', icon: BarChart2, ats: false },
  { id: 'formateur', name: 'CV Formateur', desc: 'Profils pédagogiques et formateurs', icon: BookOpen, ats: false },
];

function uid() { return Math.random().toString(36).slice(2); }

// ─── CV PREVIEW INLINE ────────────────────────────────────
function CvPreview({ cvData, templateId, withPhoto }: {
  cvData: CvData; templateId: string; withPhoto: boolean;
}) {
  const colors: Record<string, { primary: string; accent: string; sidebar: string; dark?: boolean }> = {
    classique: { primary: '#002050', accent: '#BF8813', sidebar: '#F8F9FA' },
    moderne_ats: { primary: '#1A1A2E', accent: '#E94560', sidebar: '#FFFFFF' },
    etudiant: { primary: '#002050', accent: '#BF8813', sidebar: '#EEF2FF' },
    international: { primary: '#002050', accent: '#BF8813', sidebar: '#F0F4F8' },
    qse: { primary: '#1B4332', accent: '#52B788', sidebar: '#D8F3DC' },
    it_digital: { primary: '#0D1B2A', accent: '#00B4D8', sidebar: '#1B263B', dark: true },
    business: { primary: '#002050', accent: '#BF8813', sidebar: '#FFF8F0' },
    formateur: { primary: '#2D3561', accent: '#C84B31', sidebar: '#F5F5F5' },
  };
  const c = colors[templateId] || colors.classique;
  const isAts = templateId === 'moderne_ats';
  const isDark = c.dark;

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : '';

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      fontSize: '9px',
      background: '#fff',
      display: 'flex',
      minHeight: '842px',
      transform: 'scale(0.75)',
      transformOrigin: 'top left',
      width: '133%',
    }}>
      {!isAts && (
        <div style={{
          width: '180px', minWidth: '180px',
          background: isDark ? '#1B263B' : c.sidebar,
          padding: '20px 14px',
          color: isDark ? '#fff' : '#374151',
        }}>
          {withPhoto && (
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              {cvData.photo_url ? (
                <img src={cvData.photo_url} style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  objectFit: 'cover', border: `2px solid ${c.accent}`
                }} alt="" />
              ) : (
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  background: c.primary, display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px', fontWeight: 900, color: 'white',
                  margin: '0 auto',
                }}>
                  {(cvData.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
              )}
            </div>
          )}

          {/* Contact */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '8px', fontWeight: 700, color: isDark ? '#aaa' : c.primary, letterSpacing: '0.12em', textTransform: 'uppercase', borderBottom: `1px solid ${c.accent}`, paddingBottom: '3px', marginBottom: '8px' }}>
              Contact
            </div>
            {cvData.contact.email && <div style={{ marginBottom: '4px', wordBreak: 'break-all' }}>📧 {cvData.contact.email}</div>}
            {cvData.contact.phone && <div style={{ marginBottom: '4px' }}>📞 {cvData.contact.phone}</div>}
            {cvData.contact.location && <div style={{ marginBottom: '4px' }}>📍 {cvData.contact.location}</div>}
            {cvData.contact.linkedin && <div style={{ marginBottom: '4px', color: c.accent }}>🔗 LinkedIn</div>}
          </div>

          {/* Compétences */}
          {cvData.skills.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '8px', fontWeight: 700, color: isDark ? '#aaa' : c.primary, letterSpacing: '0.12em', textTransform: 'uppercase', borderBottom: `1px solid ${c.accent}`, paddingBottom: '3px', marginBottom: '8px' }}>
                Compétences
              </div>
              {cvData.skills.map(s => (
                <div key={s.id} style={{ marginBottom: '6px' }}>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  {!isAts && s.level > 0 && (
                    <div style={{ background: '#e0e0e0', borderRadius: '3px', height: '3px', marginTop: '2px' }}>
                      <div style={{ background: c.accent, borderRadius: '3px', height: '3px', width: `${s.level}%` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Langues */}
          {cvData.languages.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '8px', fontWeight: 700, color: isDark ? '#aaa' : c.primary, letterSpacing: '0.12em', textTransform: 'uppercase', borderBottom: `1px solid ${c.accent}`, paddingBottom: '3px', marginBottom: '8px' }}>
                Langues
              </div>
              {cvData.languages.map(l => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600 }}>{l.name}</span>
                  <span style={{ color: c.accent }}>{l.level}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, padding: isAts ? '30px' : '20px 22px' }}>
        {/* Header */}
        <div style={{ borderBottom: `2px solid ${c.accent}`, paddingBottom: '10px', marginBottom: '16px' }}>
          <div style={{ fontSize: '20px', fontWeight: 900, color: c.primary, lineHeight: 1.1 }}>
            {cvData.name || 'Votre Nom'}
          </div>
          <div style={{ fontSize: '11px', color: c.accent, fontWeight: 600, marginTop: '3px' }}>
            {cvData.title || 'Titre professionnel'}
          </div>
          {isAts && (
            <div style={{ fontSize: '8px', color: '#6B7280', marginTop: '6px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {cvData.contact.email && <span>{cvData.contact.email}</span>}
              {cvData.contact.phone && <span>{cvData.contact.phone}</span>}
              {cvData.contact.location && <span>{cvData.contact.location}</span>}
            </div>
          )}
        </div>

        {/* Résumé */}
        {cvData.summary && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: c.primary, letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: `1px solid ${c.accent}`, paddingBottom: '3px', marginBottom: '8px' }}>
              Profil
            </div>
            <p style={{ color: '#374151', lineHeight: 1.6, textAlign: 'justify' }}>{cvData.summary}</p>
          </div>
        )}

        {/* Expériences */}
        {cvData.experiences.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: c.primary, letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: `1px solid ${c.accent}`, paddingBottom: '3px', marginBottom: '8px' }}>
              Expériences
            </div>
            {cvData.experiences.map(exp => (
              <div key={exp.id} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: c.primary }}>{exp.position}</div>
                    <div style={{ color: c.accent, fontWeight: 600 }}>{exp.company}</div>
                  </div>
                  <div style={{ color: '#6B7280', textAlign: 'right', whiteSpace: 'nowrap', fontSize: '8px' }}>
                    {fmtDate(exp.start_date)} — {exp.current ? 'Présent' : fmtDate(exp.end_date || '')}
                  </div>
                </div>
                {exp.description && <p style={{ color: '#374151', lineHeight: 1.5, marginTop: '3px' }}>{exp.description}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Formations Omnia */}
        {cvData.omnia_formations.filter(f => f.show).length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: c.primary, letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: `1px solid ${c.accent}`, paddingBottom: '3px', marginBottom: '8px' }}>
              Formations Omnia Academy
            </div>
            {cvData.omnia_formations.filter(f => f.show).map(f => (
              <div key={f.id} style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, color: c.primary }}>{f.title}</div>
                  <div style={{ color: c.accent }}>Omnia Global Academy{f.cpd_accredited ? ' · CPD' : ''}</div>
                </div>
                <div style={{ color: '#6B7280', fontSize: '8px' }}>{fmtDate(f.completed_at)}</div>
              </div>
            ))}
          </div>
        )}

        {/* ATS : compétences en ligne */}
        {isAts && cvData.skills.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: c.primary, letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: `1px solid ${c.accent}`, paddingBottom: '3px', marginBottom: '8px' }}>
              Compétences
            </div>
            <div style={{ color: '#374151', lineHeight: 1.8 }}>
              {cvData.skills.map(s => s.name).join(' • ')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── WIZARD STEPS ─────────────────────────────────────────
function Step1({ data, onChange, settings }: { data: CvData; onChange: (d: CvData) => void; settings: any }) {
  const inputCls = 'w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:border-[#002050]';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#002050' }}>Nom complet *</label>
          <input className={inputCls} value={data.name}
            onChange={e => onChange({ ...data, name: e.target.value })}
            placeholder="Amadou Coulibaly" style={{ borderColor: '#E4E7EC' }} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#002050' }}>Titre professionnel *</label>
          <input className={inputCls} value={data.title}
            onChange={e => onChange({ ...data, title: e.target.value })}
            placeholder="Développeur Full Stack" style={{ borderColor: '#E4E7EC' }} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#002050' }}>Résumé professionnel</label>
        <textarea className={inputCls} rows={4} value={data.summary}
          onChange={e => onChange({ ...data, summary: e.target.value })}
          placeholder="Décrivez votre profil en 3-4 lignes..."
          style={{ borderColor: '#E4E7EC', resize: 'vertical' }} />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#002050' }}>Objectif professionnel (optionnel)</label>
        <input className={inputCls} value={data.objective || ''}
          onChange={e => onChange({ ...data, objective: e.target.value })}
          placeholder="Ex: Rejoindre une startup innovante..."
          style={{ borderColor: '#E4E7EC' }} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#002050' }}>Email *</label>
          <input className={inputCls} type="email" value={data.contact.email}
            onChange={e => onChange({ ...data, contact: { ...data.contact, email: e.target.value } })}
            placeholder="votre@email.com" style={{ borderColor: '#E4E7EC' }} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#002050' }}>Téléphone</label>
          <input className={inputCls} value={data.contact.phone}
            onChange={e => onChange({ ...data, contact: { ...data.contact, phone: e.target.value } })}
            placeholder="+223 70 00 00 00" style={{ borderColor: '#E4E7EC' }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#002050' }}>Ville / Pays</label>
          <input className={inputCls} value={data.contact.location}
            onChange={e => onChange({ ...data, contact: { ...data.contact, location: e.target.value } })}
            placeholder="Bamako, Mali" style={{ borderColor: '#E4E7EC' }} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#002050' }}>LinkedIn (optionnel)</label>
          <input className={inputCls} value={data.contact.linkedin || ''}
            onChange={e => onChange({ ...data, contact: { ...data.contact, linkedin: e.target.value } })}
            placeholder="linkedin.com/in/..." style={{ borderColor: '#E4E7EC' }} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#002050' }}>Portfolio / Site web (optionnel)</label>
        <input className={inputCls} value={data.contact.portfolio || ''}
          onChange={e => onChange({ ...data, contact: { ...data.contact, portfolio: e.target.value } })}
          placeholder="https://monportfolio.com" style={{ borderColor: '#E4E7EC' }} />
      </div>

      {settings?.cv_allow_photo !== 'false' && (
        <div className="p-4 rounded-xl border" style={{ borderColor: '#E4E7EC', backgroundColor: '#FFFBF0' }}>
          <div className="flex items-start gap-3">
            <AlertCircle size={16} style={{ color: '#BF8813', flexShrink: 0, marginTop: 2 }} />
            <p className="text-xs" style={{ color: '#7C5A00' }}>
              {settings?.cv_photo_warning_fr || "L'ajout d'une photo est facultatif. Dans certains pays ou secteurs, un CV sans photo peut être recommandé pour réduire les risques de discrimination."}
            </p>
          </div>
          <div className="mt-3">
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#002050' }}>
              URL de votre photo (optionnel)
            </label>
            <input className={inputCls} value={data.photo_url || ''}
              onChange={e => onChange({ ...data, photo_url: e.target.value })}
              placeholder="https://... (lien vers votre photo)"
              style={{ borderColor: '#E4E7EC' }} />
          </div>
        </div>
      )}
    </div>
  );
}

function Step2({ data, onChange, completedCourses, certificates }: {
  data: CvData; onChange: (d: CvData) => void;
  completedCourses: any[]; certificates: any[];
}) {
  function toggleFormation(course: any) {
    const exists = data.omnia_formations.find(f => f.course_id === course.id);
    if (exists) {
      onChange({ ...data, omnia_formations: data.omnia_formations.filter(f => f.course_id !== course.id) });
    } else {
      const cert = certificates.find(c => c.course_id === course.id);
      onChange({
        ...data,
        omnia_formations: [...data.omnia_formations, {
          id: uid(), course_id: course.id, title: course.title,
          category: course.category, completed_at: cert?.issued_at || new Date().toISOString(),
          cpd_accredited: course.cpd_accredited || false,
          cpd_hours: course.cpd_hours,
          certificate_id: cert?.omnia_certificate_id,
          verify_url: cert ? `https://omniaglobalacademy.com/verify/${cert.omnia_certificate_id}` : undefined,
          show: true,
        }]
      });
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: '#6B7280' }}>
        Sélectionnez les formations et certificats Omnia à afficher sur votre CV.
      </p>

      {completedCourses.length === 0 ? (
        <div className="text-center py-8 rounded-xl border" style={{ borderColor: '#E4E7EC' }}>
          <GraduationCap size={32} style={{ color: '#E4E7EC' }} className="mx-auto mb-3" />
          <p style={{ color: '#6B7280' }}>Aucune formation terminée pour l'instant</p>
          <a href="/catalogue" className="text-sm font-medium mt-2 block" style={{ color: '#BF8813' }}>
            Découvrir le catalogue →
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {completedCourses.map((course: any) => {
            const selected = data.omnia_formations.find(f => f.course_id === course.id);
            const cert = certificates.find(c => c.course_id === course.id);
            return (
              <div key={course.id}
                className="flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all"
                style={{
                  borderColor: selected ? '#002050' : '#E4E7EC',
                  backgroundColor: selected ? 'rgba(0,32,80,0.04)' : 'white'
                }}
                onClick={() => toggleFormation(course)}>
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded flex items-center justify-center border-2 ${selected ? 'bg-[#002050] border-[#002050]' : 'border-gray-300'}`}>
                    {selected && <Check size={12} color="white" />}
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: '#002050' }}>{course.title}</div>
                    <div className="text-xs" style={{ color: '#6B7280' }}>
                      {course.category}
                      {course.cpd_accredited && <span className="ml-2 font-semibold" style={{ color: '#BF8813' }}>• CPD</span>}
                      {cert && <span className="ml-2" style={{ color: '#1E7A52' }}>• Certifié ✓</span>}
                    </div>
                  </div>
                </div>
                {selected && (
                  <label className="flex items-center gap-2 text-xs" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.show}
                      onChange={e => onChange({
                        ...data,
                        omnia_formations: data.omnia_formations.map(f =>
                          f.course_id === course.id ? { ...f, show: e.target.checked } : f
                        )
                      })}
                      style={{ accentColor: '#002050' }} />
                    <span style={{ color: '#6B7280' }}>Afficher</span>
                  </label>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Step3({ data, onChange }: { data: CvData; onChange: (d: CvData) => void }) {
  const inputCls = 'w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:border-[#002050]';
  const addExp = () => onChange({
    ...data, experiences: [...data.experiences, {
      id: uid(), position: '', company: '', start_date: '', current: false, description: '',
    }]
  });
  const updateExp = (id: string, field: string, value: any) => onChange({
    ...data, experiences: data.experiences.map(e => e.id === id ? { ...e, [field]: value } : e)
  });
  const removeExp = (id: string) => onChange({
    ...data, experiences: data.experiences.filter(e => e.id !== id)
  });

  const addEdu = () => onChange({
    ...data, education: [...data.education, { id: uid(), degree: '', school: '', year: '' }]
  });
  const updateEdu = (id: string, field: string, value: any) => onChange({
    ...data, education: data.education.map(e => e.id === id ? { ...e, [field]: value } : e)
  });
  const removeEdu = (id: string) => onChange({
    ...data, education: data.education.filter(e => e.id !== id)
  });

  return (
    <div className="space-y-6">
      {/* Expériences */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold" style={{ color: '#002050' }}>Expériences professionnelles</h3>
          <button onClick={addExp}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#002050' }}>
            <Plus size={14} /> Ajouter
          </button>
        </div>
        {data.experiences.map(exp => (
          <div key={exp.id} className="p-4 rounded-xl border mb-3" style={{ borderColor: '#E4E7EC' }}>
            <div className="flex justify-end mb-2">
              <button onClick={() => removeExp(exp.id)}>
                <X size={14} style={{ color: '#DC2626' }} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Poste *</label>
                <input className={inputCls} value={exp.position}
                  onChange={e => updateExp(exp.id, 'position', e.target.value)}
                  placeholder="Développeur Web" style={{ borderColor: '#E4E7EC' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Entreprise *</label>
                <input className={inputCls} value={exp.company}
                  onChange={e => updateExp(exp.id, 'company', e.target.value)}
                  placeholder="Nom de l'entreprise" style={{ borderColor: '#E4E7EC' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Date début</label>
                <input className={inputCls} type="month" value={exp.start_date}
                  onChange={e => updateExp(exp.id, 'start_date', e.target.value)}
                  style={{ borderColor: '#E4E7EC' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Date fin</label>
                <input className={inputCls} type="month" value={exp.end_date || ''}
                  disabled={exp.current}
                  onChange={e => updateExp(exp.id, 'end_date', e.target.value)}
                  style={{ borderColor: '#E4E7EC' }} />
                <label className="flex items-center gap-1.5 mt-1 text-xs cursor-pointer">
                  <input type="checkbox" checked={exp.current}
                    onChange={e => updateExp(exp.id, 'current', e.target.checked)}
                    style={{ accentColor: '#002050' }} />
                  <span style={{ color: '#6B7280' }}>Poste actuel</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Description</label>
              <textarea className={inputCls} rows={3} value={exp.description}
                onChange={e => updateExp(exp.id, 'description', e.target.value)}
                placeholder="Décrivez vos missions et réalisations..."
                style={{ borderColor: '#E4E7EC', resize: 'vertical' }} />
            </div>
          </div>
        ))}
        {data.experiences.length === 0 && (
          <div className="text-center py-6 rounded-xl border border-dashed" style={{ borderColor: '#E4E7EC' }}>
            <p className="text-sm" style={{ color: '#9CA3AF' }}>Aucune expérience ajoutée</p>
          </div>
        )}
      </div>

      {/* Formation académique */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold" style={{ color: '#002050' }}>Formation académique</h3>
          <button onClick={addEdu}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#002050' }}>
            <Plus size={14} /> Ajouter
          </button>
        </div>
        {data.education.map(edu => (
          <div key={edu.id} className="p-4 rounded-xl border mb-3" style={{ borderColor: '#E4E7EC' }}>
            <div className="flex justify-end mb-2">
              <button onClick={() => removeEdu(edu.id)}>
                <X size={14} style={{ color: '#DC2626' }} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Diplôme *</label>
                <input className={inputCls} value={edu.degree}
                  onChange={e => updateEdu(edu.id, 'degree', e.target.value)}
                  placeholder="Licence Informatique" style={{ borderColor: '#E4E7EC' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>École *</label>
                <input className={inputCls} value={edu.school}
                  onChange={e => updateEdu(edu.id, 'school', e.target.value)}
                  placeholder="Université de Bamako" style={{ borderColor: '#E4E7EC' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Année</label>
                <input className={inputCls} value={edu.year}
                  onChange={e => updateEdu(edu.id, 'year', e.target.value)}
                  placeholder="2022" style={{ borderColor: '#E4E7EC' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Step4({ data, onChange }: { data: CvData; onChange: (d: CvData) => void }) {
  const inputCls = 'w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:border-[#002050]';
  const LANG_LEVELS = ['Notions', 'Intermédiaire', 'Courant', 'Bilingue', 'Langue maternelle'];

  const addSkill = () => onChange({
    ...data, skills: [...data.skills, { id: uid(), name: '', level: 75 }]
  });
  const addLang = () => onChange({
    ...data, languages: [...data.languages, { id: uid(), name: '', level: 'Intermédiaire' }]
  });
  const addCert = () => onChange({
    ...data, certifications_external: [...data.certifications_external, { id: uid(), name: '', issuer: '', year: '' }]
  });
  const addProject = () => onChange({
    ...data, projects: [...data.projects, { id: uid(), name: '', description: '', technologies: '' }]
  });

  return (
    <div className="space-y-6">
      {/* Compétences */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold" style={{ color: '#002050' }}>Compétences</h3>
          <button onClick={addSkill}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#002050' }}>
            <Plus size={14} /> Ajouter
          </button>
        </div>
        <div className="space-y-2">
          {data.skills.map(s => (
            <div key={s.id} className="flex items-center gap-3">
              <input className={`${inputCls} flex-1`} value={s.name}
                onChange={e => onChange({ ...data, skills: data.skills.map(sk => sk.id === s.id ? { ...sk, name: e.target.value } : sk) })}
                placeholder="Ex: JavaScript, Excel, Management..."
                style={{ borderColor: '#E4E7EC' }} />
              <input type="range" min={0} max={100} value={s.level}
                onChange={e => onChange({ ...data, skills: data.skills.map(sk => sk.id === s.id ? { ...sk, level: parseInt(e.target.value) } : sk) })}
                className="w-24" style={{ accentColor: '#002050' }} />
              <span className="text-xs w-8 text-right" style={{ color: '#6B7280' }}>{s.level}%</span>
              <button onClick={() => onChange({ ...data, skills: data.skills.filter(sk => sk.id !== s.id) })}>
                <X size={14} style={{ color: '#DC2626' }} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Langues */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold" style={{ color: '#002050' }}>Langues</h3>
          <button onClick={addLang}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#002050' }}>
            <Plus size={14} /> Ajouter
          </button>
        </div>
        <div className="space-y-2">
          {data.languages.map(l => (
            <div key={l.id} className="flex items-center gap-3">
              <input className={`${inputCls} flex-1`} value={l.name}
                onChange={e => onChange({ ...data, languages: data.languages.map(la => la.id === l.id ? { ...la, name: e.target.value } : la) })}
                placeholder="Ex: Français, Anglais, Bambara..."
                style={{ borderColor: '#E4E7EC' }} />
              <select className="px-3 py-2.5 border rounded-lg text-sm"
                style={{ borderColor: '#E4E7EC' }}
                value={l.level}
                onChange={e => onChange({ ...data, languages: data.languages.map(la => la.id === l.id ? { ...la, level: e.target.value } : la) })}>
                {LANG_LEVELS.map(lv => <option key={lv} value={lv}>{lv}</option>)}
              </select>
              <button onClick={() => onChange({ ...data, languages: data.languages.filter(la => la.id !== l.id) })}>
                <X size={14} style={{ color: '#DC2626' }} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Certifications externes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold" style={{ color: '#002050' }}>Certifications externes</h3>
          <button onClick={addCert}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#002050' }}>
            <Plus size={14} /> Ajouter
          </button>
        </div>
        <div className="space-y-2">
          {data.certifications_external.map(c => (
            <div key={c.id} className="flex items-center gap-3">
              <input className={`${inputCls} flex-1`} value={c.name}
                onChange={e => onChange({ ...data, certifications_external: data.certifications_external.map(ce => ce.id === c.id ? { ...ce, name: e.target.value } : ce) })}
                placeholder="Ex: AWS Certified, PMP, CISSP..."
                style={{ borderColor: '#E4E7EC' }} />
              <input className={inputCls} value={c.issuer}
                onChange={e => onChange({ ...data, certifications_external: data.certifications_external.map(ce => ce.id === c.id ? { ...ce, issuer: e.target.value } : ce) })}
                placeholder="Organisme" style={{ borderColor: '#E4E7EC', width: '140px' }} />
              <input className={inputCls} value={c.year}
                onChange={e => onChange({ ...data, certifications_external: data.certifications_external.map(ce => ce.id === c.id ? { ...ce, year: e.target.value } : ce) })}
                placeholder="2024" style={{ borderColor: '#E4E7EC', width: '80px' }} />
              <button onClick={() => onChange({ ...data, certifications_external: data.certifications_external.filter(ce => ce.id !== c.id) })}>
                <X size={14} style={{ color: '#DC2626' }} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Projets */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold" style={{ color: '#002050' }}>Projets personnels</h3>
          <button onClick={addProject}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#002050' }}>
            <Plus size={14} /> Ajouter
          </button>
        </div>
        <div className="space-y-3">
          {data.projects.map(p => (
            <div key={p.id} className="p-4 rounded-xl border" style={{ borderColor: '#E4E7EC' }}>
              <div className="flex justify-end mb-2">
                <button onClick={() => onChange({ ...data, projects: data.projects.filter(pr => pr.id !== p.id) })}>
                  <X size={14} style={{ color: '#DC2626' }} />
                </button>
              </div>
              <div className="space-y-2">
                <input className={inputCls} value={p.name}
                  onChange={e => onChange({ ...data, projects: data.projects.map(pr => pr.id === p.id ? { ...pr, name: e.target.value } : pr) })}
                  placeholder="Nom du projet" style={{ borderColor: '#E4E7EC' }} />
                <textarea className={inputCls} rows={2} value={p.description}
                  onChange={e => onChange({ ...data, projects: data.projects.map(pr => pr.id === p.id ? { ...pr, description: e.target.value } : pr) })}
                  placeholder="Description du projet..." style={{ borderColor: '#E4E7EC', resize: 'vertical' }} />
                <input className={inputCls} value={p.technologies || ''}
                  onChange={e => onChange({ ...data, projects: data.projects.map(pr => pr.id === p.id ? { ...pr, technologies: e.target.value } : pr) })}
                  placeholder="Technologies utilisées (React, Python...)" style={{ borderColor: '#E4E7EC' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Centres d'intérêt */}
      <div>
        <h3 className="font-semibold mb-3" style={{ color: '#002050' }}>Centres d'intérêt (optionnel)</h3>
        <input className={inputCls}
          value={Array.isArray(data.interests) ? data.interests.join(', ') : data.interests}
          onChange={e => onChange({ ...data, interests: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
          placeholder="Sport, Lecture, Voyages, Musique..."
          style={{ borderColor: '#E4E7EC' }} />
      </div>
    </div>
  );
}

function Step5({ data, onChange, templateId, setTemplateId, withPhoto, setWithPhoto }: {
  data: CvData; onChange: (d: CvData) => void;
  templateId: string; setTemplateId: (t: string) => void;
  withPhoto: boolean; setWithPhoto: (v: boolean) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Photo option */}
      <div className="flex items-center justify-between p-4 rounded-xl border" style={{ borderColor: '#E4E7EC' }}>
        <div>
          <div className="font-semibold" style={{ color: '#002050' }}>CV avec photo</div>
          <div className="text-xs mt-1" style={{ color: '#6B7280' }}>
            Version sans photo recommandée par défaut
          </div>
        </div>
        <input type="checkbox" checked={withPhoto}
          onChange={e => setWithPhoto(e.target.checked)}
          style={{ accentColor: '#002050', width: '18px', height: '18px' }} />
      </div>

      {/* Templates */}
      <div>
        <h3 className="font-semibold mb-4" style={{ color: '#002050' }}>Choisissez votre modèle</h3>
        <div className="grid grid-cols-2 gap-3">
          {TEMPLATES.map(t => {
            const Icon = t.icon;
            const selected = templateId === t.id;
            return (
              <div key={t.id}
                className="p-4 rounded-xl border cursor-pointer transition-all"
                style={{
                  borderColor: selected ? '#002050' : '#E4E7EC',
                  backgroundColor: selected ? 'rgba(0,32,80,0.04)' : 'white',
                  borderWidth: selected ? 2 : 1,
                }}
                onClick={() => setTemplateId(t.id)}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center`}
                    style={{ backgroundColor: selected ? '#002050' : '#F8F9FA' }}>
                    <Icon size={20} color={selected ? '#BF8813' : '#6B7280'} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm" style={{ color: '#002050' }}>{t.name}</span>
                      {t.ats && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                          style={{ backgroundColor: '#E4F1EA', color: '#1E7A52' }}>ATS</span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{t.desc}</p>
                  </div>
                  {selected && <Check size={16} style={{ color: '#002050' }} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── AI PANEL ─────────────────────────────────────────────
function AiPanel({ onResult }: { onResult: (text: string, action: string) => void }) {
  const [action, setAction] = useState('improve_summary');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const ACTIONS = [
    { id: 'improve_summary', label: '✨ Améliorer le résumé' },
    { id: 'rewrite_experience', label: '📝 Reformuler une expérience' },
    { id: 'make_professional', label: '💼 Rendre plus professionnel' },
    { id: 'fix_grammar', label: '✏️ Corriger les fautes' },
    { id: 'shorten_text', label: '✂️ Raccourcir le texte' },
    { id: 'improve_project', label: '🚀 Améliorer un projet' },
    { id: 'suggest_title', label: '🎯 Proposer un titre' },
    { id: 'suggest_skills', label: '💡 Suggérer des compétences' },
  ];

  async function runAi() {
    if (!text.trim()) return;
    setLoading(true);
    setResult('');
    try {
      const token = localStorage.getItem('omnia_session_token');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/cv-ai-assist`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, text }),
      });
      const data = await res.json();
      setResult(data.result || '');
    } catch {
      setResult('Erreur lors de la génération IA.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={16} style={{ color: '#BF8813' }} />
        <span className="font-semibold text-sm" style={{ color: '#002050' }}>Assistant IA</span>
      </div>

      <select value={action} onChange={e => setAction(e.target.value)}
        className="w-full px-3 py-2.5 border rounded-lg text-sm"
        style={{ borderColor: '#E4E7EC' }}>
        {ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
      </select>

      <textarea value={text} onChange={e => setText(e.target.value)}
        rows={4} placeholder="Collez le texte à améliorer..."
        className="w-full px-3 py-2.5 border rounded-lg text-sm resize-none"
        style={{ borderColor: '#E4E7EC' }} />

      <div className="p-3 rounded-lg text-xs" style={{ backgroundColor: '#FFFBF0', color: '#7C5A00' }}>
        ⚠️ L'IA améliore uniquement vos textes. Elle n'invente jamais de diplôme, expérience ou compétence.
      </div>

      <button onClick={runAi} disabled={loading || !text.trim()}
        className="w-full py-2.5 rounded-lg font-semibold text-white text-sm disabled:opacity-50"
        style={{ backgroundColor: '#002050' }}>
        {loading ? '⏳ Génération...' : '✨ Améliorer avec l\'IA'}
      </button>

      {result && (
        <div className="space-y-2">
          <div className="p-3 rounded-lg border text-sm" style={{ borderColor: '#E4E7EC', backgroundColor: '#F8F9FA' }}>
            <p style={{ color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{result}</p>
          </div>
          <button
            onClick={() => onResult(result, action)}
            className="w-full py-2 rounded-lg text-sm font-medium border"
            style={{ borderColor: '#1E7A52', color: '#1E7A52' }}>
            ✓ Copier le résultat
          </button>
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────
export default function DashboardCvBuilder() {
  const [view, setView] = useState<'list' | 'wizard' | 'editor'>('list');
  const [cvs, setCvs] = useState<any[]>([]);
  const [tokens, setTokens] = useState(0);
  const [completedCourses, setCompletedCourses] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [currentCvId, setCurrentCvId] = useState<string | null>(null);
  const [cvData, setCvData] = useState<CvData>(EMPTY_CV);
  const [templateId, setTemplateId] = useState('classique');
  const [withPhoto, setWithPhoto] = useState(false);
  const [cvTitle, setCvTitle] = useState('Mon CV');
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [toast, setToast] = useState('');
  const [aiResult, setAiResult] = useState('');

  const TOTAL_STEPS = 5;
  const STEP_LABELS = ['Informations', 'Formations Omnia', 'Expériences', 'Compétences', 'Modèle'];

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const token = localStorage.getItem('omnia_session_token');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/cv-builder-list`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setCvs(data.cvs || []);
      setTokens(data.tokens ?? 0);
      setCompletedCourses(data.completed_courses || []);
      setCertificates(data.certificates || []);

      const settingsRes = await fetch(`${SUPABASE_URL}/functions/v1/site-settings-public`);
      const s = await settingsRes.json();
      setSettings(s);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function saveCV() {
    setSaving(true);
    try {
      const token = localStorage.getItem('omnia_session_token');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/cv-builder-save`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cv_id: currentCvId,
          title: cvTitle,
          template_id: templateId,
          with_photo: withPhoto,
          cv_data: cvData,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentCvId(data.cv_id);
        showToast('✓ CV sauvegardé');
        loadData();
      }
    } catch (err) {
      showToast('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  async function downloadPdf() {
    if (!currentCvId) {
      await saveCV();
    }
    setDownloading(true);
    try {
      const token = localStorage.getItem('omnia_session_token');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/cv-builder-generate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cv_id: currentCvId }),
      });
      const data = await res.json();

      if (data.error === 'INSUFFICIENT_TOKENS') {
        showToast('❌ Jetons insuffisants. Achetez une formation pour en obtenir.');
        return;
      }

      if (data.pdf_url) {
        window.open(data.pdf_url, '_blank');
        setTokens(data.tokens_remaining ?? tokens);
        if (data.token_consumed) {
          showToast(`✓ PDF téléchargé — ${data.tokens_remaining} jeton(s) restant(s)`);
        } else {
          showToast('✓ PDF téléchargé (contenu inchangé — jeton conservé)');
        }
      } else if (data.html) {
        const blob = new Blob([data.html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${cvTitle}.html`;
        a.click();
        showToast('✓ CV exporté en HTML (utilisez Ctrl+P pour imprimer en PDF)');
      }
    } catch (err) {
      showToast('Erreur lors du téléchargement');
    } finally {
      setDownloading(false);
    }
  }

  async function deleteCv(cvId: string) {
    if (!confirm('Supprimer ce CV ?')) return;
    const token = localStorage.getItem('omnia_session_token');
    await fetch(`${SUPABASE_URL}/functions/v1/cv-builder-delete`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cv_id: cvId }),
    });
    loadData();
    showToast('CV supprimé');
  }

  async function duplicateCv(cvId: string) {
    const token = localStorage.getItem('omnia_session_token');
    const res = await fetch(`${SUPABASE_URL}/functions/v1/cv-builder-duplicate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cv_id: cvId }),
    });
    const data = await res.json();
    if (data.success) {
      loadData();
      showToast(`✓ "${data.title}" créé`);
    }
  }

  function openNewCv() {
    setCvData(EMPTY_CV);
    setCurrentCvId(null);
    setCvTitle('Mon CV');
    setTemplateId('classique');
    setWithPhoto(false);
    setStep(1);
    setView('wizard');
  }

  function openEditCv(cv: any) {
    setCvData(cv.cv_data || EMPTY_CV);
    setCurrentCvId(cv.id);
    setCvTitle(cv.title);
    setTemplateId(cv.template_id);
    setWithPhoto(cv.with_photo);
    setStep(1);
    setView('wizard');
  }

  // ── LIST VIEW ─────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium text-white shadow-lg"
            style={{ backgroundColor: '#002050' }}>
            {toast}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>CV Builder IA</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
              Créez des CV professionnels avec l'aide de l'intelligence artificielle
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl border"
              style={{ borderColor: '#BF8813', backgroundColor: 'rgba(191,136,19,0.05)' }}>
              <Coins size={16} style={{ color: '#BF8813' }} />
              <span className="font-bold" style={{ color: '#BF8813' }}>{tokens}</span>
              <span className="text-xs" style={{ color: '#6B7280' }}>jeton(s)</span>
            </div>
            <button onClick={openNewCv}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white"
              style={{ backgroundColor: '#002050' }}>
              <Plus size={18} />
              Nouveau CV
            </button>
          </div>
        </div>

        <div className="p-4 rounded-xl border text-sm" style={{ borderColor: '#E4E7EC', backgroundColor: '#F8F9FA' }}>
          <div className="flex items-start gap-3">
            <Coins size={16} style={{ color: '#BF8813', flexShrink: 0, marginTop: 2 }} />
            <div>
              <span className="font-semibold" style={{ color: '#002050' }}>Système de jetons : </span>
              <span style={{ color: '#6B7280' }}>
                La saisie et l'aperçu sont gratuits. 1 jeton est consommé à chaque nouveau téléchargement PDF.
                Le réenregistrement est gratuit si le contenu est inchangé.
                Vous recevez {settings.cv_tokens_inscription || '1'} jeton à l'inscription
                et {settings.cv_tokens_per_purchase || '1'} jeton par formation achetée.
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 rounded-full animate-spin"
              style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : cvs.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border-2 border-dashed" style={{ borderColor: '#E4E7EC' }}>
            <FileText size={48} style={{ color: '#E4E7EC' }} className="mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#002050' }}>
              Aucun CV créé
            </h3>
            <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
              Créez votre premier CV professionnel en quelques minutes
            </p>
            <button onClick={openNewCv}
              className="px-6 py-3 rounded-xl font-semibold text-white"
              style={{ backgroundColor: '#002050' }}>
              Créer mon premier CV
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {cvs.map(cv => {
              const tmpl = TEMPLATES.find(t => t.id === cv.template_id);
              const Icon = tmpl?.icon || FileText;
              return (
                <div key={cv.id} className="bg-white rounded-2xl border p-5 hover:shadow-md transition-shadow"
                  style={{ borderColor: '#E4E7EC' }}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: 'rgba(0,32,80,0.08)' }}>
                        <Icon size={20} style={{ color: '#002050' }} />
                      </div>
                      <div>
                        <div className="font-semibold" style={{ color: '#002050' }}>{cv.title}</div>
                        <div className="text-xs" style={{ color: '#6B7280' }}>
                          {tmpl?.name || cv.template_id}
                          {cv.with_photo ? ' · Avec photo' : ' · Sans photo'}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs mb-4" style={{ color: '#9CA3AF' }}>
                    Modifié le {new Date(cv.updated_at).toLocaleDateString('fr-FR')}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEditCv(cv)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
                      style={{ backgroundColor: '#002050', color: 'white' }}>
                      <Edit2 size={13} /> Modifier
                    </button>
                    <button onClick={() => duplicateCv(cv.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border"
                      style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
                      <Copy size={13} /> Dupliquer
                    </button>
                    <button onClick={() => deleteCv(cv.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
                      style={{ color: '#DC2626' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
            <div
              className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-8 cursor-pointer hover:border-[#002050] transition-colors"
              style={{ borderColor: '#E4E7EC' }}
              onClick={openNewCv}>
              <Plus size={24} style={{ color: '#9CA3AF' }} className="mb-2" />
              <span className="text-sm font-medium" style={{ color: '#9CA3AF' }}>Nouveau CV</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── WIZARD VIEW ───────────────────────────────────────────
  return (
    <div className="flex h-screen" style={{ backgroundColor: '#F8F9FA' }}>
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium text-white shadow-lg"
          style={{ backgroundColor: '#002050' }}>
          {toast}
        </div>
      )}

      {/* Left panel : form */}
      <div className="flex flex-col" style={{ width: showAi ? '35%' : showPreview ? '45%' : '55%', transition: 'width 0.3s' }}>
        {/* Header */}
        <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E7EC' }}>
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setView('list')} className="flex items-center gap-2 text-sm"
              style={{ color: '#6B7280' }}>
              <ChevronLeft size={16} /> Mes CVs
            </button>
            <div className="flex items-center gap-2">
              <Coins size={14} style={{ color: '#BF8813' }} />
              <span className="text-sm font-bold" style={{ color: '#BF8813' }}>{tokens} jeton(s)</span>
            </div>
          </div>
          <input
            className="text-lg font-bold bg-transparent border-none outline-none w-full"
            style={{ color: '#002050' }}
            value={cvTitle}
            onChange={e => setCvTitle(e.target.value)}
            placeholder="Titre du CV"
          />
          {/* Steps */}
          <div className="flex items-center gap-1 mt-3">
            {STEP_LABELS.map((label, i) => {
              const n = i + 1;
              const active = n === step;
              const done = n < step;
              return (
                <button key={n} onClick={() => setStep(n)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all"
                  style={{
                    backgroundColor: active ? '#002050' : done ? 'rgba(0,32,80,0.08)' : 'transparent',
                    color: active ? 'white' : done ? '#002050' : '#9CA3AF',
                  }}>
                  {done ? <Check size={10} /> : null}
                  {n}. {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && <Step1 data={cvData} onChange={setCvData} settings={settings} />}
          {step === 2 && <Step2 data={cvData} onChange={setCvData} completedCourses={completedCourses} certificates={certificates} />}
          {step === 3 && <Step3 data={cvData} onChange={setCvData} />}
          {step === 4 && <Step4 data={cvData} onChange={setCvData} />}
          {step === 5 && (
            <Step5 data={cvData} onChange={setCvData}
              templateId={templateId} setTemplateId={setTemplateId}
              withPhoto={withPhoto} setWithPhoto={setWithPhoto} />
          )}
        </div>

        {/* Footer nav */}
        <div className="bg-white border-t px-6 py-4 flex items-center justify-between" style={{ borderColor: '#E4E7EC' }}>
          <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border font-medium text-sm disabled:opacity-40"
            style={{ borderColor: '#E4E7EC', color: '#374151' }}>
            <ChevronLeft size={16} /> Précédent
          </button>

          <div className="flex gap-2">
            <button onClick={() => setShowAi(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border"
              style={{ borderColor: showAi ? '#BF8813' : '#E4E7EC', color: showAi ? '#BF8813' : '#6B7280',
                backgroundColor: showAi ? 'rgba(191,136,19,0.05)' : 'white' }}>
              <Sparkles size={14} /> IA
            </button>
            <button onClick={() => setShowPreview(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border"
              style={{ borderColor: showPreview ? '#002050' : '#E4E7EC', color: showPreview ? '#002050' : '#6B7280',
                backgroundColor: showPreview ? 'rgba(0,32,80,0.05)' : 'white' }}>
              <Eye size={14} /> Aperçu
            </button>
            <button onClick={saveCV} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border disabled:opacity-50"
              style={{ borderColor: '#E4E7EC', color: '#374151' }}>
              {saving ? '⏳' : '💾'} Sauvegarder
            </button>
            <button onClick={downloadPdf} disabled={downloading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: '#BF8813' }}>
              <Download size={14} />
              {downloading ? 'Génération...' : `PDF (${tokens} jeton${tokens !== 1 ? 's' : ''})`}
            </button>
          </div>

          <button onClick={() => step === TOTAL_STEPS ? saveCV() : setStep(s => Math.min(TOTAL_STEPS, s + 1))}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm text-white"
            style={{ backgroundColor: '#002050' }}>
            {step === TOTAL_STEPS ? 'Terminer' : 'Suivant'} <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* AI Panel */}
      {showAi && (
        <div className="bg-white border-l overflow-y-auto p-5" style={{ width: '25%', borderColor: '#E4E7EC' }}>
          <AiPanel onResult={(text, action) => {
            setAiResult(text);
            showToast('✓ Résultat copié dans le presse-papier');
            navigator.clipboard?.writeText(text);
          }} />
        </div>
      )}

      {/* Preview Panel */}
      {showPreview && (
        <div className="bg-white border-l overflow-hidden flex flex-col" style={{ flex: 1, borderColor: '#E4E7EC' }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: '#E4E7EC' }}>
            <span className="text-sm font-semibold" style={{ color: '#002050' }}>
              Aperçu — {TEMPLATES.find(t => t.id === templateId)?.name}
            </span>
            <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#E4F1EA', color: '#1E7A52' }}>
              Gratuit
            </span>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div style={{ overflow: 'hidden', borderRadius: '8px', border: '1px solid #E4E7EC' }}>
              <CvPreview cvData={cvData} templateId={templateId} withPhoto={withPhoto} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
