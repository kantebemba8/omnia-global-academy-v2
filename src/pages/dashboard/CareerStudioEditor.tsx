import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Save, Download, Eye, EyeOff,
  Sparkles, Plus, Trash2, X, Check, AlertCircle, Coins,
  User, Briefcase, GraduationCap, Star, Globe, FileText,
  Settings, Palette, Type, Maximize2, Award, Copy,
  RotateCcw, Languages, Target, BarChart3, Lock
} from 'lucide-react';
import { CvPreview } from '../../components/career/CvTemplates';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// ─── TYPES ───────────────────────────────────────────────
interface DocData {
  // Infos personnelles
  name: string;
  title: string;
  objective?: string;
  summary: string;
  photo_url?: string;
  // Contact
  contact: { email: string; phone: string; location: string; linkedin?: string; portfolio?: string; };
  // Sections
  experiences: Array<{ id: string; position: string; company: string; location?: string; start_date: string; end_date?: string; current: boolean; description: string; }>;
  education: Array<{ id: string; degree: string; school: string; location?: string; year: string; }>;
  omnia_formations: Array<{ id: string; course_id: string; title: string; category: string; completed_at: string; cpd_accredited: boolean; cpd_hours?: number; certificate_id?: string; verify_url?: string; show: boolean; }>;
  skills: Array<{ id: string; name: string; level: number; }>;
  languages: Array<{ id: string; name: string; level: string; }>;
  certifications_external: Array<{ id: string; name: string; issuer: string; year: string; }>;
  projects: Array<{ id: string; name: string; description: string; technologies?: string; }>;
  interests: string[];
  references?: string;
  // Pour LM
  sender?: { name: string; address: string; phone: string; email: string; city: string; date: string; };
  recipient?: { name: string; company: string; address: string; };
  subject?: string;
  salutation?: string;
  intro?: string;
  motivation?: string;
  skills_paragraph?: string;
  company_link?: string;
  availability?: string;
  closing?: string;
  signature?: string;
}

interface DesignOptions {
  colors: { primary: string; accent: string; sidebar: string; text: string; background: string; };
  font: string;
  font_size_body: number;
  font_size_title: number;
  line_spacing: number;
  margins: { top: number; right: number; bottom: number; left: number; };
  photo_enabled: boolean;
  photo_shape: 'round' | 'square' | 'rectangle';
  pages: 1 | 2;
  palette: string;
}

interface Template {
  template_key: string;
  name_fr: string;
  is_free: boolean;
  is_ats_compatible: boolean;
  default_colors: { primary: string; accent: string; sidebar: string; text: string; };
  color_variants: Array<{ name: string; colors: Record<string, string>; }>;
  available_fonts: string[];
}

const EMPTY_DOC: DocData = {
  name: '', title: '', summary: '', contact: { email: '', phone: '', location: '' },
  experiences: [], education: [], omnia_formations: [],
  skills: [], languages: [], certifications_external: [], projects: [], interests: [],
};

const EMPTY_DESIGN: DesignOptions = {
  colors: { primary: '#002050', accent: '#BF8813', sidebar: '#F8F9FA', text: '#374151', background: '#FFFFFF' },
  font: 'inter', font_size_body: 9, font_size_title: 11, line_spacing: 1.5,
  margins: { top: 20, right: 20, bottom: 20, left: 20 },
  photo_enabled: false, photo_shape: 'round', pages: 1, palette: 'bleu_professionnel',
};

const PALETTES = [
  { key: 'bleu_professionnel', name: 'Bleu Professionnel', colors: { primary: '#002050', accent: '#BF8813', sidebar: '#F0F4F8', text: '#374151', background: '#FFFFFF' } },
  { key: 'vert_nature', name: 'Vert Nature', colors: { primary: '#1B4332', accent: '#52B788', sidebar: '#D8F3DC', text: '#374151', background: '#FFFFFF' } },
  { key: 'violet_creatif', name: 'Violet Créatif', colors: { primary: '#4A235A', accent: '#C39BD3', sidebar: '#F5EEF8', text: '#374151', background: '#FFFFFF' } },
  { key: 'rouge_dynamique', name: 'Rouge Dynamique', colors: { primary: '#1B1B2F', accent: '#E63946', sidebar: '#F8F9FA', text: '#374151', background: '#FFFFFF' } },
  { key: 'or_premium', name: 'Or Premium', colors: { primary: '#0D1B2A', accent: '#BF8813', sidebar: '#0D1B2A', text: '#E0E0E0', background: '#FFFFFF' } },
  { key: 'teal_moderne', name: 'Teal Moderne', colors: { primary: '#1A3C40', accent: '#4DB6AC', sidebar: '#1A3C40', text: '#E0E0E0', background: '#FFFFFF' } },
  { key: 'rose_elegant', name: 'Rose Élégant', colors: { primary: '#880E4F', accent: '#E91E8C', sidebar: '#FFF5F8', text: '#374151', background: '#FFFFFF' } },
  { key: 'gris_minimaliste', name: 'Gris Minimaliste', colors: { primary: '#37474F', accent: '#607D8B', sidebar: '#F5F7F8', text: '#374151', background: '#FFFFFF' } },
  { key: 'beige_naturel', name: 'Beige Naturel', colors: { primary: '#3E2723', accent: '#795548', sidebar: '#F5F0E8', text: '#374151', background: '#FDFCF8' } },
  { key: 'cyber_dark', name: 'Cyber Dark', colors: { primary: '#0D1117', accent: '#00FF41', sidebar: '#161B22', text: '#C9D1D9', background: '#0D1117' } },
  { key: 'ocean_bleu', name: 'Océan', colors: { primary: '#003153', accent: '#0EA5E9', sidebar: '#F0F9FF', text: '#374151', background: '#FFFFFF' } },
  { key: 'orange_energie', name: 'Orange Énergie', colors: { primary: '#1a1a1a', accent: '#FF6B35', sidebar: '#FFF8F5', text: '#374151', background: '#FFFFFF' } },
];

const FONTS = [
  { key: 'inter', label: 'Inter (Moderne)' },
  { key: 'georgia', label: 'Georgia (Classique)' },
  { key: 'arial', label: 'Arial (Neutre)' },
  { key: 'helvetica', label: 'Helvetica (Pro)' },
];

const LANG_LEVELS = ['Notions', 'Élémentaire', 'Intermédiaire', 'Avancé', 'Courant', 'Bilingue', 'Langue maternelle'];

function uid() { return Math.random().toString(36).slice(2, 9); }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : ''; }

// ─── MINI PREVIEW A4 ─────────────────────────────────────
function A4Preview({ data, design, templateKey }: { data: DocData; design: DesignOptions; templateKey: string; }) {
  const c = design.colors;
  const isDark = ['#0D1B2A', '#1A3C40', '#0D1117'].includes(c.primary);

  return (
    <div style={{
      width: '794px', minHeight: '1123px', fontFamily: design.font === 'georgia' ? 'Georgia, serif' : 'Arial, sans-serif',
      fontSize: `${design.font_size_body}px`, background: c.background || '#fff',
      display: 'flex', position: 'relative',
    }}>
      {/* Sidebar */}
      <div style={{ width: '220px', minWidth: '220px', background: c.sidebar, padding: `${design.margins.top}px 16px`, borderRight: `3px solid ${c.accent}` }}>
        {design.photo_enabled && (
          <div style={{ textAlign: 'center', marginBottom: '18px' }}>
            {data.photo_url ? (
              <img src={data.photo_url} style={{ width: '80px', height: '80px', borderRadius: design.photo_shape === 'round' ? '50%' : design.photo_shape === 'square' ? '8px' : '4px', objectFit: 'cover', border: `3px solid ${c.accent}` }} alt="" />
            ) : (
              <div style={{ width: '80px', height: '80px', borderRadius: design.photo_shape === 'round' ? '50%' : '8px', background: c.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: '28px', fontWeight: 900, color: 'white' }}>
                {(data.name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
              </div>
            )}
          </div>
        )}
        <SidebarSection title="Contact" color={c.accent} textColor={isDark ? '#ccc' : '#374151'}>
          {data.contact.email && <ContactItem icon="✉" text={data.contact.email} />}
          {data.contact.phone && <ContactItem icon="☎" text={data.contact.phone} />}
          {data.contact.location && <ContactItem icon="⊙" text={data.contact.location} />}
          {data.contact.linkedin && <ContactItem icon="in" text="LinkedIn" accent={c.accent} />}
          {data.contact.portfolio && <ContactItem icon="🌐" text="Portfolio" accent={c.accent} />}
        </SidebarSection>
        {data.skills.length > 0 && (
          <SidebarSection title="Compétences" color={c.accent} textColor={isDark ? '#ccc' : '#374151'}>
            {data.skills.map(s => (
              <div key={s.id} style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '8px', fontWeight: 600, color: isDark ? '#ddd' : '#374151', marginBottom: '2px' }}>{s.name}</div>
                <div style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#E4E7EC', borderRadius: '3px', height: '3px' }}>
                  <div style={{ background: c.accent, borderRadius: '3px', height: '3px', width: `${s.level}%` }} />
                </div>
              </div>
            ))}
          </SidebarSection>
        )}
        {data.languages.length > 0 && (
          <SidebarSection title="Langues" color={c.accent} textColor={isDark ? '#ccc' : '#374151'}>
            {data.languages.map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '8px' }}>
                <span style={{ fontWeight: 600, color: isDark ? '#ddd' : '#374151' }}>{l.name}</span>
                <span style={{ color: c.accent }}>{l.level}</span>
              </div>
            ))}
          </SidebarSection>
        )}
        {data.certifications_external.length > 0 && (
          <SidebarSection title="Certifications" color={c.accent} textColor={isDark ? '#ccc' : '#374151'}>
            {data.certifications_external.map(cert => (
              <div key={cert.id} style={{ marginBottom: '7px', fontSize: '8px' }}>
                <div style={{ fontWeight: 600, color: isDark ? '#ddd' : '#374151' }}>{cert.name}</div>
                <div style={{ color: c.accent }}>{cert.issuer} {cert.year}</div>
              </div>
            ))}
          </SidebarSection>
        )}
        {data.interests.length > 0 && (
          <SidebarSection title="Intérêts" color={c.accent} textColor={isDark ? '#ccc' : '#374151'}>
            <div style={{ fontSize: '8px', color: isDark ? '#ccc' : '#6B7280', lineHeight: 1.6 }}>
              {Array.isArray(data.interests) ? data.interests.join(' · ') : data.interests}
            </div>
          </SidebarSection>
        )}
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: `${design.margins.top}px ${design.margins.right}px ${design.margins.bottom}px 20px` }}>
        <div style={{ marginBottom: '18px', borderBottom: `3px solid ${c.accent}`, paddingBottom: '12px' }}>
          <div style={{ fontSize: `${design.font_size_title + 14}px`, fontWeight: 900, color: c.primary, lineHeight: 1.1 }}>
            {data.name || 'Votre Nom'}
          </div>
          <div style={{ fontSize: `${design.font_size_title}px`, color: c.accent, fontWeight: 600, marginTop: '4px', letterSpacing: '0.05em' }}>
            {data.title || 'Titre professionnel'}
          </div>
          {data.objective && <div style={{ fontSize: '8px', color: '#9CA3AF', marginTop: '5px', fontStyle: 'italic' }}>{data.objective}</div>}
        </div>
        {data.summary && (
          <MainSection title="Profil professionnel" primary={c.primary} accent={c.accent}>
            <p style={{ fontSize: '8px', color: '#374151', lineHeight: design.line_spacing, textAlign: 'justify' }}>{data.summary}</p>
          </MainSection>
        )}
        {data.experiences.length > 0 && (
          <MainSection title="Expériences professionnelles" primary={c.primary} accent={c.accent}>
            {data.experiences.map(exp => (
              <div key={exp.id} style={{ marginBottom: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: c.primary }}>{exp.position}</div>
                    <div style={{ fontSize: '9px', color: c.accent, fontWeight: 600 }}>{exp.company}{exp.location ? ` · ${exp.location}` : ''}</div>
                  </div>
                  <div style={{ fontSize: '8px', color: '#9CA3AF', whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {fmtDate(exp.start_date)} — {exp.current ? 'Présent' : fmtDate(exp.end_date || '')}
                  </div>
                </div>
                {exp.description && <p style={{ fontSize: '8px', color: '#6B7280', lineHeight: 1.6, marginTop: '3px' }}>{exp.description}</p>}
              </div>
            ))}
          </MainSection>
        )}
        {data.omnia_formations.filter(f => f.show).length > 0 && (
          <MainSection title="Formations Omnia Global Academy" primary={c.primary} accent={c.accent}>
            {data.omnia_formations.filter(f => f.show).map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: c.primary }}>{f.title}</div>
                  <div style={{ fontSize: '8px', color: c.accent }}>Omnia Global Academy{f.cpd_accredited ? ' · CPD' : ''}</div>
                  {f.certificate_id && <div style={{ fontSize: '7px', color: '#9CA3AF' }}>Cert. {f.certificate_id}</div>}
                </div>
                <div style={{ fontSize: '8px', color: '#9CA3AF' }}>{fmtDate(f.completed_at)}</div>
              </div>
            ))}
          </MainSection>
        )}
        {data.education.length > 0 && (
          <MainSection title="Formation académique" primary={c.primary} accent={c.accent}>
            {data.education.map(edu => (
              <div key={edu.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: c.primary }}>{edu.degree}</div>
                  <div style={{ fontSize: '9px', color: '#374151' }}>{edu.school}{edu.location ? ` · ${edu.location}` : ''}</div>
                </div>
                <div style={{ fontSize: '8px', color: '#9CA3AF' }}>{edu.year}</div>
              </div>
            ))}
          </MainSection>
        )}
        {data.projects.length > 0 && (
          <MainSection title="Projets" primary={c.primary} accent={c.accent}>
            {data.projects.map(p => (
              <div key={p.id} style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: c.primary }}>{p.name}</div>
                {p.technologies && <div style={{ fontSize: '8px', color: c.accent }}>{p.technologies}</div>}
                {p.description && <p style={{ fontSize: '8px', color: '#6B7280', lineHeight: 1.6, marginTop: '2px' }}>{p.description}</p>}
              </div>
            ))}
          </MainSection>
        )}

        {/* Filigrane si prévisualisation gratuite */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%) rotate(-30deg)', fontSize: '32px', fontWeight: 900, color: 'rgba(0,32,80,0.07)', pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap', zIndex: 10 }}>
          APERÇU GRATUIT — OMNIA CAREER STUDIO
        </div>
      </div>
    </div>
  );
}

function SidebarSection({ title, color, textColor, children }: { title: string; color: string; textColor: string; children: React.ReactNode; }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '8px', fontWeight: 700, color, letterSpacing: '0.15em', textTransform: 'uppercase', borderBottom: `1px solid ${color}40`, paddingBottom: '4px', marginBottom: '8px' }}>{title}</div>
      {children}
    </div>
  );
}

function ContactItem({ icon, text, accent }: { icon: string; text: string; accent?: string; }) {
  return (
    <div style={{ fontSize: '8px', marginBottom: '5px', color: accent || '#374151', display: 'flex', alignItems: 'center', gap: '5px', wordBreak: 'break-all' }}>
      <span>{icon}</span><span>{text}</span>
    </div>
  );
}

function MainSection({ title, primary, accent, children }: { title: string; primary: string; accent: string; children: React.ReactNode; }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '9px', fontWeight: 700, color: primary, textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: `1px solid ${accent}`, paddingBottom: '3px', marginBottom: '10px' }}>{title}</div>
      {children}
    </div>
  );
}

// ─── COMPOSANT PRINCIPAL ─────────────────────────────────
export default function CareerStudioEditor() {
  const navigate = useNavigate();
  const { docId } = useParams<{ docId: string }>();
  const [searchParams] = useSearchParams();
  const docType = (searchParams.get('type') || 'cv') as 'cv' | 'lm';
  const templateParam = searchParams.get('template') || 'classic_pro';

  const [docData, setDocData] = useState<DocData>(EMPTY_DOC);
  const [design, setDesign] = useState<DesignOptions>(EMPTY_DESIGN);
  const [title, setTitle] = useState('Mon CV');
  const [currentDocId, setCurrentDocId] = useState<string | null>(docId === 'new' ? null : (docId || null));
  const [templateKey, setTemplateKey] = useState(templateParam);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tokens, setTokens] = useState(0);
  const [tokenConfig, setTokenConfig] = useState<Record<string, number>>({});
  const [completedFormations, setCompletedFormations] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);

  const [step, setStep] = useState(1);
  const [editMode, setEditMode] = useState<'simple' | 'custom' | 'advanced'>('simple');
  const [showPreview, setShowPreview] = useState(true);
  const [showAI, setShowAI] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // AI
  const [aiAction, setAiAction] = useState('improve_summary');
  const [aiText, setAiText] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [offerText, setOfferText] = useState('');
  const [atsResult, setAtsResult] = useState<any>(null);

  const token = () => localStorage.getItem('omnia_session_token') || '';

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast(msg); setToastType(type);
    setTimeout(() => setToast(''), 4000);
  }

  // Charger les données
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Charger templates + jetons + formations
        const res = await fetch(`${SUPABASE_URL}/functions/v1/career-studio-list`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ doc_type: docType }),
        });
        const data = await res.json();
        setTemplates(data.templates || []);
        setTokens(data.user?.cv_tokens ?? 0);
        setTokenConfig(data.token_config || {});
        setCompletedFormations(data.completed_formations || []);
        setCertificates(data.certificates || []);

        // Appliquer les couleurs du template choisi
        const tmpl = (data.templates || []).find((t: Template) => t.template_key === templateParam);
        if (tmpl?.default_colors) {
          setDesign(d => ({ ...d, colors: { ...d.colors, ...tmpl.default_colors } }));
        }

        // Charger document existant si pas "new"
        if (docId && docId !== 'new') {
          const docRes = await fetch(`${SUPABASE_URL}/functions/v1/career-studio-save`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get', document_id: docId }),
          });
          const docData2 = await docRes.json();
          if (docData2.document) {
            setDocData(docData2.document.doc_data || EMPTY_DOC);
            setDesign(d => ({ ...d, ...(docData2.document.design_options || {}) }));
            setTitle(docData2.document.title || 'Mon CV');
            setTemplateKey(docData2.document.template_key || templateParam);
          }
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  // Auto-save
  const autoSave = useCallback(async () => {
    if (!docData.name && !docData.summary) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/career-studio-save`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save', document_id: currentDocId,
          doc_type: docType, title, template_key: templateKey,
          doc_data: docData, design_options: design,
        }),
      });
      const data = await res.json();
      if (data.success && !currentDocId) setCurrentDocId(data.document.id);
    } catch (_) {}
  }, [docData, design, title, templateKey, currentDocId]);

  async function saveManual() {
    setSaving(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/career-studio-save`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save', document_id: currentDocId,
          doc_type: docType, title, template_key: templateKey,
          doc_data: docData, design_options: design,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (!currentDocId) setCurrentDocId(data.document.id);
        showToast('✅ Sauvegardé');
      }
    } catch { showToast('Erreur de sauvegarde', 'error'); }
    finally { setSaving(false); }
  }

  async function downloadPDF() {
    if (!currentDocId) { await saveManual(); }
    setDownloading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/career-studio-generate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: currentDocId }),
      });
      const contentType = res.headers.get('Content-Type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data.error === 'INSUFFICIENT_TOKENS') {
          showToast(`❌ ${tokenConfig.cout_pdf_gratuit || 1} jeton requis. Vous en avez ${tokens}.`, 'error');
          return;
        }
        showToast('❌ Erreur lors de la génération', 'error'); return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `${title.replace(/\s+/g, '-')}-omnia.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const remaining = parseInt(res.headers.get('X-Tokens-Remaining') || String(tokens - 1));
      const consumed = res.headers.get('X-Token-Consumed') === 'true';
      setTokens(remaining);
      showToast(consumed ? `✅ PDF téléchargé — ${remaining} jeton(s) restant(s)` : '✅ PDF téléchargé (contenu inchangé)');
    } catch { showToast('❌ Erreur lors du téléchargement', 'error'); }
    finally { setDownloading(false); }
  }

  async function runAI() {
    if (!aiText.trim() && !offerText.trim()) return;
    setAiLoading(true); setAiResult('');
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/career-studio-ai`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: aiAction, text: aiText, doc_data: docData, offer_text: offerText }),
      });
      const data = await res.json();
      if (data.error === 'INSUFFICIENT_TOKENS') { showToast(`❌ ${data.tokens_required} jeton(s) requis`, 'error'); return; }
      setAiResult(data.result || '');
      if (data.tokens_consumed > 0) setTokens(data.tokens_remaining);
      if (aiAction === 'ats_score') {
        try { setAtsResult(JSON.parse(data.result)); } catch { setAtsResult(null); }
      }
    } catch { showToast('Erreur IA', 'error'); }
    finally { setAiLoading(false); }
  }

  function applyPalette(palette: typeof PALETTES[0]) {
    setDesign(d => ({ ...d, colors: palette.colors, palette: palette.key }));
  }

  function update(field: keyof DocData, value: unknown) { setDocData(d => ({ ...d, [field]: value })); }
  function updateContact(field: string, value: string) { setDocData(d => ({ ...d, contact: { ...d.contact, [field]: value } })); }

  const inputCls = 'w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:border-[#002050] transition-colors';
  const inputStyle = { borderColor: '#E4E7EC' };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: '#F8F9FA' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const STEPS = docType === 'cv'
    ? ['Informations', 'Expériences', 'Formation', 'Compétences', 'Extras', 'Modèle & Design']
    : ['Expéditeur', 'Destinataire', 'Corps de la lettre', 'Modèle & Design'];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F0F2F5' }}>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg border"
          style={{ background: toastType === 'success' ? 'white' : '#FEF2F2', borderColor: toastType === 'success' ? '#E4E7EC' : '#FECACA', color: toastType === 'success' ? '#002050' : '#DC2626' }}>
          {toast}
        </div>
      )}

      {/* ── PANNEAU GAUCHE : Formulaire ──────────────────── */}
      <div className="flex flex-col bg-white border-r" style={{ width: showPreview ? '42%' : '55%', borderColor: '#E4E7EC', transition: 'width 0.3s' }}>

        {/* Header */}
        <div className="border-b px-5 py-3" style={{ borderColor: '#E4E7EC' }}>
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => navigate('/dashboard/career-studio')} className="flex items-center gap-1.5 text-sm" style={{ color: '#6B7280' }}>
              <ChevronLeft size={15} /> Mes documents
            </button>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold" style={{ borderColor: '#BF8813', color: '#BF8813', background: 'rgba(191,136,19,0.05)' }}>
                <Coins size={12} /> {tokens} jeton(s)
              </div>
              <span className="text-xs px-2 py-1 rounded-full font-semibold"
                style={{ background: editMode === 'simple' ? '#EEF2FF' : editMode === 'custom' ? '#FEF3C7' : '#FEE2E2', color: editMode === 'simple' ? '#3730A3' : editMode === 'custom' ? '#92400E' : '#991B1B' }}>
                Mode {editMode === 'simple' ? 'Simple' : editMode === 'custom' ? 'Personnalisé' : 'Avancé'}
              </span>
            </div>
          </div>
          <input value={title} onChange={e => setTitle(e.target.value)}
            className="text-base font-bold bg-transparent border-none outline-none w-full" style={{ color: '#002050' }} />

          {/* Mode selector */}
          <div className="flex gap-1.5 mt-2">
            {(['simple', 'custom', 'advanced'] as const).map(mode => (
              <button key={mode} onClick={() => setEditMode(mode)}
                className="text-xs px-2.5 py-1 rounded-lg font-medium transition-all"
                style={editMode === mode ? { background: '#002050', color: 'white' } : { background: '#F3F4F6', color: '#6B7280' }}>
                {mode === 'simple' ? 'Simple' : mode === 'custom' ? 'Personnalisé' : 'Avancé'}
              </button>
            ))}
          </div>

          {/* Steps */}
          <div className="flex items-center gap-1 mt-2 overflow-x-auto pb-1">
            {STEPS.map((s, i) => {
              const n = i + 1;
              return (
                <button key={n} onClick={() => setStep(n)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0"
                  style={{ background: step === n ? '#002050' : n < step ? 'rgba(0,32,80,0.08)' : 'transparent', color: step === n ? 'white' : n < step ? '#002050' : '#9CA3AF' }}>
                  {n < step && <Check size={9} />}{n}. {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenu de l'étape */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {docType === 'cv' && (
            <>
              {/* Étape 1 : Informations personnelles */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>Nom complet *</label>
                      <input className={inputCls} style={inputStyle} value={docData.name} onChange={e => update('name', e.target.value)} placeholder="Amadou Coulibaly" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>Titre professionnel *</label>
                      <input className={inputCls} style={inputStyle} value={docData.title} onChange={e => update('title', e.target.value)} placeholder="Développeur Full Stack" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>Résumé professionnel</label>
                    <textarea className={inputCls} style={{ ...inputStyle, resize: 'vertical' }} rows={4} value={docData.summary} onChange={e => update('summary', e.target.value)} placeholder="Décrivez votre profil en 3-4 lignes..." />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>Objectif professionnel</label>
                    <input className={inputCls} style={inputStyle} value={docData.objective || ''} onChange={e => update('objective', e.target.value)} placeholder="Ex: Rejoindre une startup innovante..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>Email *</label>
                      <input className={inputCls} style={inputStyle} type="email" value={docData.contact.email} onChange={e => updateContact('email', e.target.value)} placeholder="votre@email.com" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>Téléphone</label>
                      <input className={inputCls} style={inputStyle} value={docData.contact.phone} onChange={e => updateContact('phone', e.target.value)} placeholder="+223 70 00 00 00" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>Ville / Pays</label>
                      <input className={inputCls} style={inputStyle} value={docData.contact.location} onChange={e => updateContact('location', e.target.value)} placeholder="Bamako, Mali" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>LinkedIn</label>
                      <input className={inputCls} style={inputStyle} value={docData.contact.linkedin || ''} onChange={e => updateContact('linkedin', e.target.value)} placeholder="linkedin.com/in/..." />
                    </div>
                  </div>
                  {design.photo_enabled && (
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>URL de votre photo</label>
                      <input className={inputCls} style={inputStyle} value={docData.photo_url || ''} onChange={e => update('photo_url', e.target.value)} placeholder="https://... (lien vers votre photo)" />
                      <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Dans certains pays, un CV sans photo est recommandé.</p>
                    </div>
                  )}
                  {/* Formations Omnia */}
                  {completedFormations.length > 0 && (
                    <div>
                      <label className="block text-xs font-semibold mb-2" style={{ color: '#002050' }}>Formations Omnia terminées</label>
                      <div className="space-y-2">
                        {completedFormations.map((f: any) => {
                          const added = docData.omnia_formations.find(of => of.course_id === f.course_id);
                          const cert = certificates.find(c => c.course_id === f.course_id);
                          return (
                            <div key={f.course_id}
                              className="flex items-center justify-between p-3 rounded-lg border cursor-pointer"
                              style={{ borderColor: added ? '#002050' : '#E4E7EC', background: added ? 'rgba(0,32,80,0.03)' : 'white' }}
                              onClick={() => {
                                if (added) {
                                  update('omnia_formations', docData.omnia_formations.filter(of => of.course_id !== f.course_id));
                                } else {
                                  update('omnia_formations', [...docData.omnia_formations, {
                                    id: uid(), course_id: f.course_id, title: f.courses?.title || '',
                                    category: f.courses?.category || '', completed_at: cert?.issued_at || f.completed_at,
                                    cpd_accredited: false, certificate_id: cert?.omnia_certificate_id,
                                    verify_url: cert ? `https://omniaglobalacademy.com/verify/${cert.omnia_certificate_id}` : undefined, show: true,
                                  }]);
                                }
                              }}>
                              <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${added ? 'border-[#002050] bg-[#002050]' : 'border-gray-300'}`}>
                                  {added && <Check size={10} color="white" />}
                                </div>
                                <div>
                                  <p className="text-xs font-semibold" style={{ color: '#002050' }}>{f.courses?.title || f.course_id}</p>
                                  {cert && <p className="text-xs" style={{ color: '#1E7A52' }}>Certifié ✓</p>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Étape 2 : Expériences */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm" style={{ color: '#002050' }}>Expériences professionnelles</h3>
                    <button onClick={() => update('experiences', [...docData.experiences, { id: uid(), position: '', company: '', start_date: '', current: false, description: '' }])}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#002050' }}>
                      <Plus size={12} /> Ajouter
                    </button>
                  </div>
                  {docData.experiences.map((exp, idx) => (
                    <div key={exp.id} className="p-4 rounded-xl border space-y-3" style={{ borderColor: '#E4E7EC' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold" style={{ color: '#9CA3AF' }}>Expérience {idx + 1}</span>
                        <button onClick={() => update('experiences', docData.experiences.filter(e => e.id !== exp.id))}>
                          <Trash2 size={13} style={{ color: '#DC2626' }} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Poste *</label>
                          <input className={inputCls} style={inputStyle} value={exp.position} onChange={e => update('experiences', docData.experiences.map(ex => ex.id === exp.id ? { ...ex, position: e.target.value } : ex))} placeholder="Développeur Web" /></div>
                        <div><label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Entreprise *</label>
                          <input className={inputCls} style={inputStyle} value={exp.company} onChange={e => update('experiences', docData.experiences.map(ex => ex.id === exp.id ? { ...ex, company: e.target.value } : ex))} placeholder="Nom de l'entreprise" /></div>
                        <div><label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Ville</label>
                          <input className={inputCls} style={inputStyle} value={exp.location || ''} onChange={e => update('experiences', docData.experiences.map(ex => ex.id === exp.id ? { ...ex, location: e.target.value } : ex))} placeholder="Bamako" /></div>
                        <div><label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Date début</label>
                          <input className={inputCls} style={inputStyle} type="month" value={exp.start_date} onChange={e => update('experiences', docData.experiences.map(ex => ex.id === exp.id ? { ...ex, start_date: e.target.value } : ex))} /></div>
                        <div>
                          <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Date fin</label>
                          <input className={inputCls} style={inputStyle} type="month" value={exp.end_date || ''} disabled={exp.current} onChange={e => update('experiences', docData.experiences.map(ex => ex.id === exp.id ? { ...ex, end_date: e.target.value } : ex))} />
                          <label className="flex items-center gap-1.5 mt-1 text-xs cursor-pointer">
                            <input type="checkbox" checked={exp.current} style={{ accentColor: '#002050' }} onChange={e => update('experiences', docData.experiences.map(ex => ex.id === exp.id ? { ...ex, current: e.target.checked } : ex))} />
                            <span style={{ color: '#6B7280' }}>Poste actuel</span>
                          </label>
                        </div>
                      </div>
                      <div><label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Description</label>
                        <textarea className={inputCls} style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={exp.description} onChange={e => update('experiences', docData.experiences.map(ex => ex.id === exp.id ? { ...ex, description: e.target.value } : ex))} placeholder="Décrivez vos missions et réalisations..." /></div>
                    </div>
                  ))}
                  {docData.experiences.length === 0 && (
                    <div className="text-center py-8 rounded-xl border border-dashed" style={{ borderColor: '#E4E7EC' }}>
                      <Briefcase size={28} className="mx-auto mb-2 opacity-20" style={{ color: '#002050' }} />
                      <p className="text-sm" style={{ color: '#9CA3AF' }}>Aucune expérience ajoutée</p>
                    </div>
                  )}
                </div>
              )}

              {/* Étape 3 : Formation */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm" style={{ color: '#002050' }}>Formation académique</h3>
                    <button onClick={() => update('education', [...docData.education, { id: uid(), degree: '', school: '', year: '' }])}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#002050' }}>
                      <Plus size={12} /> Ajouter
                    </button>
                  </div>
                  {docData.education.map((edu, idx) => (
                    <div key={edu.id} className="p-4 rounded-xl border space-y-3" style={{ borderColor: '#E4E7EC' }}>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold" style={{ color: '#9CA3AF' }}>Formation {idx + 1}</span>
                        <button onClick={() => update('education', docData.education.filter(e => e.id !== edu.id))}><Trash2 size={13} style={{ color: '#DC2626' }} /></button>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2"><label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Diplôme *</label>
                          <input className={inputCls} style={inputStyle} value={edu.degree} onChange={e => update('education', docData.education.map(ed => ed.id === edu.id ? { ...ed, degree: e.target.value } : ed))} placeholder="Master Informatique" /></div>
                        <div><label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Année</label>
                          <input className={inputCls} style={inputStyle} value={edu.year} onChange={e => update('education', docData.education.map(ed => ed.id === edu.id ? { ...ed, year: e.target.value } : ed))} placeholder="2022" /></div>
                        <div className="col-span-3"><label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>École / Université *</label>
                          <input className={inputCls} style={inputStyle} value={edu.school} onChange={e => update('education', docData.education.map(ed => ed.id === edu.id ? { ...ed, school: e.target.value } : ed))} placeholder="Université de Bamako" /></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Étape 4 : Compétences */}
              {step === 4 && (
                <div className="space-y-5">
                  {/* Compétences */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-sm" style={{ color: '#002050' }}>Compétences</h3>
                      <button onClick={() => update('skills', [...docData.skills, { id: uid(), name: '', level: 75 }])}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#002050' }}>
                        <Plus size={12} /> Ajouter
                      </button>
                    </div>
                    <div className="space-y-2">
                      {docData.skills.map(s => (
                        <div key={s.id} className="flex items-center gap-3">
                          <input className={`${inputCls} flex-1`} style={inputStyle} value={s.name} onChange={e => update('skills', docData.skills.map(sk => sk.id === s.id ? { ...sk, name: e.target.value } : sk))} placeholder="Ex: JavaScript, Excel, Management..." />
                          <input type="range" min={0} max={100} value={s.level} className="w-20" style={{ accentColor: '#002050' }} onChange={e => update('skills', docData.skills.map(sk => sk.id === s.id ? { ...sk, level: parseInt(e.target.value) } : sk))} />
                          <span className="text-xs w-8 text-right" style={{ color: '#6B7280' }}>{s.level}%</span>
                          <button onClick={() => update('skills', docData.skills.filter(sk => sk.id !== s.id))}><Trash2 size={12} style={{ color: '#DC2626' }} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Langues */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-sm" style={{ color: '#002050' }}>Langues</h3>
                      <button onClick={() => update('languages', [...docData.languages, { id: uid(), name: '', level: 'Courant' }])}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#002050' }}>
                        <Plus size={12} /> Ajouter
                      </button>
                    </div>
                    <div className="space-y-2">
                      {docData.languages.map(l => (
                        <div key={l.id} className="flex items-center gap-3">
                          <input className={`${inputCls} flex-1`} style={inputStyle} value={l.name} onChange={e => update('languages', docData.languages.map(la => la.id === l.id ? { ...la, name: e.target.value } : la))} placeholder="Français, Anglais, Bambara..." />
                          <select className="px-3 py-2.5 border rounded-lg text-sm" style={inputStyle} value={l.level} onChange={e => update('languages', docData.languages.map(la => la.id === l.id ? { ...la, level: e.target.value } : la))}>
                            {LANG_LEVELS.map(lv => <option key={lv} value={lv}>{lv}</option>)}
                          </select>
                          <button onClick={() => update('languages', docData.languages.filter(la => la.id !== l.id))}><Trash2 size={12} style={{ color: '#DC2626' }} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Certifications externes */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-sm" style={{ color: '#002050' }}>Certifications externes</h3>
                      <button onClick={() => update('certifications_external', [...docData.certifications_external, { id: uid(), name: '', issuer: '', year: '' }])}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#002050' }}>
                        <Plus size={12} /> Ajouter
                      </button>
                    </div>
                    <div className="space-y-2">
                      {docData.certifications_external.map(c => (
                        <div key={c.id} className="flex items-center gap-2">
                          <input className={`${inputCls} flex-1`} style={inputStyle} value={c.name} onChange={e => update('certifications_external', docData.certifications_external.map(ce => ce.id === c.id ? { ...ce, name: e.target.value } : ce))} placeholder="AWS Certified, PMP..." />
                          <input className={inputCls} style={{ ...inputStyle, width: '130px' }} value={c.issuer} onChange={e => update('certifications_external', docData.certifications_external.map(ce => ce.id === c.id ? { ...ce, issuer: e.target.value } : ce))} placeholder="Organisme" />
                          <input className={inputCls} style={{ ...inputStyle, width: '75px' }} value={c.year} onChange={e => update('certifications_external', docData.certifications_external.map(ce => ce.id === c.id ? { ...ce, year: e.target.value } : ce))} placeholder="2024" />
                          <button onClick={() => update('certifications_external', docData.certifications_external.filter(ce => ce.id !== c.id))}><Trash2 size={12} style={{ color: '#DC2626' }} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Étape 5 : Extras */}
              {step === 5 && (
                <div className="space-y-5">
                  {/* Projets */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-sm" style={{ color: '#002050' }}>Projets personnels</h3>
                      <button onClick={() => update('projects', [...docData.projects, { id: uid(), name: '', description: '' }])}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#002050' }}>
                        <Plus size={12} /> Ajouter
                      </button>
                    </div>
                    {docData.projects.map((p, idx) => (
                      <div key={p.id} className="p-4 rounded-xl border mb-3 space-y-2" style={{ borderColor: '#E4E7EC' }}>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold" style={{ color: '#9CA3AF' }}>Projet {idx + 1}</span>
                          <button onClick={() => update('projects', docData.projects.filter(pr => pr.id !== p.id))}><Trash2 size={13} style={{ color: '#DC2626' }} /></button>
                        </div>
                        <input className={inputCls} style={inputStyle} value={p.name} onChange={e => update('projects', docData.projects.map(pr => pr.id === p.id ? { ...pr, name: e.target.value } : pr))} placeholder="Nom du projet" />
                        <input className={inputCls} style={inputStyle} value={p.technologies || ''} onChange={e => update('projects', docData.projects.map(pr => pr.id === p.id ? { ...pr, technologies: e.target.value } : pr))} placeholder="Technologies (React, Python...)" />
                        <textarea className={inputCls} style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={p.description} onChange={e => update('projects', docData.projects.map(pr => pr.id === p.id ? { ...pr, description: e.target.value } : pr))} placeholder="Description du projet..." />
                      </div>
                    ))}
                  </div>
                  {/* Centres d'intérêt */}
                  <div>
                    <label className="block text-xs font-bold mb-2" style={{ color: '#002050' }}>Centres d'intérêt</label>
                    <input className={inputCls} style={inputStyle} value={Array.isArray(docData.interests) ? docData.interests.join(', ') : docData.interests} onChange={e => update('interests', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))} placeholder="Sport, Lecture, Voyages, Musique..." />
                  </div>
                  {/* Références */}
                  <div>
                    <label className="block text-xs font-bold mb-2" style={{ color: '#002050' }}>Références</label>
                    <input className={inputCls} style={inputStyle} value={docData.references || ''} onChange={e => update('references', e.target.value)} placeholder="Disponibles sur demande" />
                  </div>
                </div>
              )}

              {/* Étape 6 : Modèle & Design */}
              {step === 6 && (
                <div className="space-y-5">
                  {/* Photo */}
                  <div className="flex items-center justify-between p-4 rounded-xl border" style={{ borderColor: '#E4E7EC' }}>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: '#002050' }}>Photo de profil</p>
                      <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Non recommandé dans certains pays</p>
                    </div>
                    <input type="checkbox" checked={design.photo_enabled} onChange={e => setDesign(d => ({ ...d, photo_enabled: e.target.checked }))} style={{ accentColor: '#002050', width: '18px', height: '18px' }} />
                  </div>
                  {design.photo_enabled && (
                    <div>
                      <label className="block text-xs font-semibold mb-2" style={{ color: '#002050' }}>Forme de la photo</label>
                      <div className="flex gap-2">
                        {(['round', 'square', 'rectangle'] as const).map(shape => (
                          <button key={shape} onClick={() => setDesign(d => ({ ...d, photo_shape: shape }))}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                            style={design.photo_shape === shape ? { background: '#002050', color: 'white', borderColor: '#002050' } : { borderColor: '#E4E7EC', color: '#6B7280' }}>
                            {shape === 'round' ? 'Ronde' : shape === 'square' ? 'Carrée' : 'Rectangle'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Palettes */}
                  <div>
                    <label className="block text-xs font-semibold mb-3" style={{ color: '#002050' }}>Palette de couleurs</label>
                    <div className="grid grid-cols-3 gap-2">
                      {PALETTES.map(p => (
                        <button key={p.key} onClick={() => applyPalette(p)}
                          className="flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all"
                          style={{ borderColor: design.palette === p.key ? '#002050' : '#E4E7EC' }}>
                          <div className="flex gap-0.5 flex-shrink-0">
                            <div className="w-3 h-3 rounded-full" style={{ background: p.colors.primary }} />
                            <div className="w-3 h-3 rounded-full" style={{ background: p.colors.accent }} />
                            <div className="w-3 h-3 rounded-full" style={{ background: p.colors.sidebar }} />
                          </div>
                          <span className="text-xs font-medium truncate" style={{ color: design.palette === p.key ? '#002050' : '#6B7280' }}>{p.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mode avancé : couleurs manuelles, police, marges */}
                  {(editMode === 'custom' || editMode === 'advanced') && (
                    <div className="space-y-4 p-4 rounded-xl border" style={{ borderColor: '#E4E7EC', background: '#F8F9FA' }}>
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>Personnalisation avancée</p>
                      <div className="grid grid-cols-2 gap-3">
                        {(['primary', 'accent', 'sidebar', 'text'] as const).map(colorKey => (
                          <div key={colorKey}>
                            <label className="block text-xs font-medium mb-1 capitalize" style={{ color: '#6B7280' }}>
                              {colorKey === 'primary' ? 'Couleur principale' : colorKey === 'accent' ? 'Couleur accent' : colorKey === 'sidebar' ? 'Fond sidebar' : 'Couleur texte'}
                            </label>
                            <div className="flex items-center gap-2">
                              <input type="color" value={design.colors[colorKey]} onChange={e => setDesign(d => ({ ...d, colors: { ...d.colors, [colorKey]: e.target.value } }))} className="w-8 h-8 rounded border cursor-pointer" style={{ borderColor: '#E4E7EC' }} />
                              <input className={`${inputCls} flex-1`} style={inputStyle} value={design.colors[colorKey]} onChange={e => setDesign(d => ({ ...d, colors: { ...d.colors, [colorKey]: e.target.value } }))} />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Police</label>
                        <select className={inputCls} style={inputStyle} value={design.font} onChange={e => setDesign(d => ({ ...d, font: e.target.value }))}>
                          {FONTS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                        </select>
                      </div>
                      {editMode === 'advanced' && (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Taille texte ({design.font_size_body}px)</label>
                              <input type="range" min={7} max={12} value={design.font_size_body} className="w-full" style={{ accentColor: '#002050' }} onChange={e => setDesign(d => ({ ...d, font_size_body: parseInt(e.target.value) }))} />
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Taille titres ({design.font_size_title}px)</label>
                              <input type="range" min={9} max={16} value={design.font_size_title} className="w-full" style={{ accentColor: '#002050' }} onChange={e => setDesign(d => ({ ...d, font_size_title: parseInt(e.target.value) }))} />
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Interligne ({design.line_spacing})</label>
                              <input type="range" min={1} max={2} step={0.1} value={design.line_spacing} className="w-full" style={{ accentColor: '#002050' }} onChange={e => setDesign(d => ({ ...d, line_spacing: parseFloat(e.target.value) }))} />
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Pages</label>
                              <div className="flex gap-2">
                                {([1, 2] as const).map(p => (
                                  <button key={p} onClick={() => setDesign(d => ({ ...d, pages: p }))}
                                    className="flex-1 py-2 rounded-lg text-xs font-medium border"
                                    style={design.pages === p ? { background: '#002050', color: 'white', borderColor: '#002050' } : { borderColor: '#E4E7EC', color: '#6B7280' }}>
                                    {p} page{p > 1 ? 's' : ''}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Bouton réinitialiser */}
                  <button onClick={() => {
                    const tmpl = templates.find(t => t.template_key === templateKey);
                    if (tmpl?.default_colors) setDesign(d => ({ ...d, colors: { ...EMPTY_DESIGN.colors, ...tmpl.default_colors }, palette: 'bleu_professionnel' }));
                    else setDesign(EMPTY_DESIGN);
                  }}
                    className="flex items-center gap-2 text-sm font-medium" style={{ color: '#6B7280' }}>
                    <RotateCcw size={14} /> Réinitialiser le design
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer : Navigation */}
        <div className="border-t px-5 py-3 flex items-center justify-between" style={{ borderColor: '#E4E7EC' }}>
          <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-medium disabled:opacity-40"
            style={{ borderColor: '#E4E7EC', color: '#374151' }}>
            <ChevronLeft size={15} /> Précédent
          </button>
          <div className="flex gap-2">
            <button onClick={() => setShowAI(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all"
              style={showAI ? { borderColor: '#BF8813', color: '#BF8813', background: 'rgba(191,136,19,0.05)' } : { borderColor: '#E4E7EC', color: '#6B7280' }}>
              <Sparkles size={14} /> IA
            </button>
            <button onClick={() => setShowPreview(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all"
              style={showPreview ? { borderColor: '#002050', color: '#002050', background: 'rgba(0,32,80,0.05)' } : { borderColor: '#E4E7EC', color: '#6B7280' }}>
              {showPreview ? <EyeOff size={14} /> : <Eye size={14} />} Aperçu
            </button>
            <button onClick={saveManual} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border disabled:opacity-50"
              style={{ borderColor: '#E4E7EC', color: '#374151' }}>
              {saving ? '⏳' : <Save size={14} />} Sauvegarder
            </button>
            <button onClick={downloadPDF} disabled={downloading || tokens < (tokenConfig.cout_pdf_gratuit || 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: '#BF8813' }}>
              <Download size={14} />
              {downloading ? 'Génération...' : `PDF (${tokenConfig.cout_pdf_gratuit || 1} jeton)`}
            </button>
          </div>
          <button onClick={() => step === STEPS.length ? saveManual() : setStep(s => Math.min(STEPS.length, s + 1))}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-medium text-sm text-white"
            style={{ background: '#002050' }}>
            {step === STEPS.length ? 'Terminer' : 'Suivant'} <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* ── PANNEAU IA ───────────────────────────────────── */}
      {showAI && (
        <div className="bg-white border-r overflow-y-auto p-5 space-y-4" style={{ width: '28%', borderColor: '#E4E7EC' }}>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} style={{ color: '#BF8813' }} />
            <span className="font-bold text-sm" style={{ color: '#002050' }}>Assistant IA</span>
          </div>

          {/* Sélecteur d'action */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B7280' }}>Action</label>
            <select value={aiAction} onChange={e => { setAiAction(e.target.value); setAiResult(''); setAtsResult(null); }}
              className="w-full px-3 py-2.5 border rounded-lg text-sm" style={{ borderColor: '#E4E7EC' }}>
              <optgroup label="Gratuit">
                <option value="improve_summary">Améliorer le résumé</option>
                <option value="fix_grammar">Corriger les fautes</option>
                <option value="make_professional">Rendre plus professionnel</option>
                <option value="shorten_text">Raccourcir le texte</option>
                <option value="rewrite_experience">Reformuler une expérience</option>
                <option value="improve_project">Améliorer un projet</option>
                <option value="suggest_title">Proposer un titre</option>
                <option value="suggest_skills">Suggérer des compétences</option>
              </optgroup>
              <optgroup label={`Payant (${tokenConfig.cout_cv_ia || 2} jetons)`}>
                <option value="generate_cv">Générer un résumé IA</option>
                <option value="translate">Traduire en anglais</option>
              </optgroup>
              <optgroup label={`Payant (${tokenConfig.cout_lm_ia || 1} jeton)`}>
                <option value="generate_lm">Générer une LM</option>
              </optgroup>
              <optgroup label={`Payant (${tokenConfig.cout_adapter_offre || 2} jetons)`}>
                <option value="adapt_to_offer">Adapter à une offre</option>
              </optgroup>
              <optgroup label={`Payant (${tokenConfig.cout_ats_score || 1} jeton)`}>
                <option value="ats_score">Score ATS</option>
              </optgroup>
            </select>
          </div>

          {/* Champ offre d'emploi */}
          {aiAction === 'adapt_to_offer' && (
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B7280' }}>Offre d'emploi (coller le texte)</label>
              <textarea value={offerText} onChange={e => setOfferText(e.target.value)} rows={5}
                placeholder="Collez ici le texte de l'offre d'emploi..."
                className="w-full px-3 py-2.5 border rounded-lg text-sm resize-none" style={{ borderColor: '#E4E7EC' }} />
            </div>
          )}

          {/* Champ texte libre */}
          {aiAction !== 'ats_score' && aiAction !== 'adapt_to_offer' && (
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B7280' }}>
                {aiAction === 'generate_lm' ? 'Informations pour la LM' : 'Texte à améliorer'}
              </label>
              <textarea value={aiText} onChange={e => setAiText(e.target.value)} rows={4}
                placeholder={aiAction === 'generate_lm' ? "Décrivez le poste visé, vos motivations..." : "Collez le texte à améliorer..."}
                className="w-full px-3 py-2.5 border rounded-lg text-sm resize-none" style={{ borderColor: '#E4E7EC' }} />
            </div>
          )}

          {/* Info coût */}
          <div className="p-3 rounded-lg text-xs" style={{ background: '#FFFBEB', color: '#92400E' }}>
            L'IA améliore vos textes. Elle n'invente jamais de diplôme, expérience ou compétence.
          </div>

          <button onClick={runAI} disabled={aiLoading || (aiAction !== 'ats_score' && aiAction !== 'adapt_to_offer' && !aiText.trim() && !offerText.trim())}
            className="w-full py-2.5 rounded-xl font-semibold text-white text-sm disabled:opacity-50"
            style={{ background: '#002050' }}>
            {aiLoading ? '⏳ Génération...' : 'Lancer l\'IA'}
          </button>

          {/* Score ATS */}
          {atsResult && (
            <div className="space-y-2">
              <p className="font-bold text-sm" style={{ color: '#002050' }}>Score ATS</p>
              <div className="p-3 rounded-xl border text-center mb-2" style={{ borderColor: '#E4E7EC' }}>
                <div className="text-3xl font-black" style={{ color: atsResult.score_global >= 80 ? '#065F46' : atsResult.score_global >= 60 ? '#92400E' : '#991B1B' }}>
                  {atsResult.score_global}%
                </div>
                <p className="text-xs" style={{ color: '#6B7280' }}>Score global</p>
              </div>
              {Object.entries(atsResult).filter(([k]) => k !== 'score_global' && k !== 'conseils').map(([key, val]) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span style={{ color: '#374151' }}>{key.replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full" style={{ background: '#E4E7EC' }}>
                      <div className="h-1.5 rounded-full" style={{ width: `${val}%`, background: Number(val) >= 80 ? '#065F46' : Number(val) >= 60 ? '#BF8813' : '#DC2626' }} />
                    </div>
                    <span className="font-bold w-8 text-right" style={{ color: '#002050' }}>{String(val)}%</span>
                  </div>
                </div>
              ))}
              {atsResult.conseils?.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-bold" style={{ color: '#002050' }}>Recommandations</p>
                  {atsResult.conseils.map((c: string, i: number) => (
                    <p key={i} className="text-xs" style={{ color: '#6B7280' }}>• {c}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Résultat IA */}
          {aiResult && !atsResult && (
            <div className="space-y-2">
              <div className="p-3 rounded-xl border text-sm" style={{ borderColor: '#E4E7EC', background: '#F8F9FA', color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {aiResult}
              </div>
              <button onClick={() => { navigator.clipboard?.writeText(aiResult); showToast('Copié dans le presse-papier'); }}
                className="w-full py-2 rounded-xl text-sm font-medium border" style={{ borderColor: '#1E7A52', color: '#1E7A52' }}>
                Copier le résultat
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── APERÇU A4 ────────────────────────────────────── */}
      {showPreview && (
        <div className="flex-1 bg-white border-l flex flex-col" style={{ borderColor: '#E4E7EC' }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: '#E4E7EC' }}>
            <div>
              <span className="text-sm font-bold" style={{ color: '#002050' }}>Aperçu A4</span>
              <span className="ml-2 text-xs px-2 py-0.5 rounded" style={{ background: '#E4F1EA', color: '#1E7A52' }}>Gratuit</span>
            </div>
            <div className="text-xs" style={{ color: '#9CA3AF' }}>
              Filigrane retiré au téléchargement
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4" style={{ background: '#ECEDEE' }}>
            <div style={{ transform: 'scale(0.55)', transformOrigin: 'top left', width: '794px', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', borderRadius: '4px', overflow: 'hidden', marginBottom: '-500px' }}>
             <CvPreview templateKey={templateKey} data={docData} design={design} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
