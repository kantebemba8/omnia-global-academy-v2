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
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : '';

  const Avatar = ({ size = 64, primary = '#002050', accent = '#BF8813' }) => (
    withPhoto && cvData.photo_url ? (
      <img src={cvData.photo_url} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${accent}` }} alt="" />
    ) : withPhoto ? (
      <div style={{ width: size, height: size, borderRadius: '50%', background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.3, fontWeight: 900, color: 'white' }}>
        {(cvData.name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
      </div>
    ) : null
  );

  if (templateId === 'classique') {
    const p = '#002050', a = '#BF8813';
    return (
      <div style={{ fontFamily: 'Georgia, serif', fontSize: '9px', background: '#fff', display: 'flex', width: '794px', minHeight: '1123px', transform: 'scale(0.55)', transformOrigin: 'top left', marginBottom: '-500px' }}>
        <div style={{ width: '200px', minWidth: '200px', background: '#F8F9FA', padding: '28px 16px', borderRight: `3px solid ${a}` }}>
          {withPhoto && <div style={{ textAlign: 'center', marginBottom: '20px' }}><Avatar size={72} primary={p} accent={a} /></div>}
          <div style={{ fontSize: '8px', fontWeight: 700, color: p, letterSpacing: '0.15em', textTransform: 'uppercase', borderBottom: `2px solid ${a}`, paddingBottom: '4px', marginBottom: '10px' }}>Contact</div>
          {cvData.contact.email && <div style={{ marginBottom: '5px', wordBreak: 'break-all', color: '#374151' }}>✉ {cvData.contact.email}</div>}
          {cvData.contact.phone && <div style={{ marginBottom: '5px', color: '#374151' }}>☎ {cvData.contact.phone}</div>}
          {cvData.contact.location && <div style={{ marginBottom: '5px', color: '#374151' }}>⊙ {cvData.contact.location}</div>}
          {cvData.contact.linkedin && <div style={{ marginBottom: '5px', color: a }}>in LinkedIn</div>}
          {cvData.skills.length > 0 && <>
            <div style={{ fontSize: '8px', fontWeight: 700, color: p, letterSpacing: '0.15em', textTransform: 'uppercase', borderBottom: `2px solid ${a}`, paddingBottom: '4px', marginBottom: '10px', marginTop: '18px' }}>Compétences</div>
            {cvData.skills.map(s => (
              <div key={s.id} style={{ marginBottom: '7px' }}>
                <div style={{ fontWeight: 600, color: '#374151' }}>{s.name}</div>
                <div style={{ background: '#ddd', borderRadius: '3px', height: '3px', marginTop: '2px' }}>
                  <div style={{ background: a, borderRadius: '3px', height: '3px', width: `${s.level}%` }} />
                </div>
              </div>
            ))}
          </>}
          {cvData.languages.length > 0 && <>
            <div style={{ fontSize: '8px', fontWeight: 700, color: p, letterSpacing: '0.15em', textTransform: 'uppercase', borderBottom: `2px solid ${a}`, paddingBottom: '4px', marginBottom: '10px', marginTop: '18px' }}>Langues</div>
            {cvData.languages.map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ fontWeight: 600, color: '#374151' }}>{l.name}</span>
                <span style={{ color: a, fontSize: '8px' }}>{l.level}</span>
              </div>
            ))}
          </>}
        </div>
        <div style={{ flex: 1, padding: '28px 24px' }}>
          <div style={{ borderBottom: `3px solid ${p}`, paddingBottom: '12px', marginBottom: '18px' }}>
            <div style={{ fontSize: '26px', fontWeight: 900, color: p, fontFamily: 'Georgia, serif' }}>{cvData.name || 'Votre Nom'}</div>
            <div style={{ fontSize: '13px', color: a, fontWeight: 600, letterSpacing: '0.05em', marginTop: '3px' }}>{cvData.title || 'Titre professionnel'}</div>
          </div>
          {cvData.summary && <><div style={{ fontSize: '9px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.12em', borderBottom: `1px solid ${a}`, paddingBottom: '3px', marginBottom: '8px' }}>Profil</div><p style={{ color: '#374151', lineHeight: 1.7, textAlign: 'justify', marginBottom: '16px' }}>{cvData.summary}</p></>}
          {cvData.experiences.length > 0 && <>
            <div style={{ fontSize: '9px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.12em', borderBottom: `1px solid ${a}`, paddingBottom: '3px', marginBottom: '10px' }}>Expériences</div>
            {cvData.experiences.map(e => (
              <div key={e.id} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div><div style={{ fontWeight: 700, color: p }}>{e.position}</div><div style={{ color: a, fontWeight: 600 }}>{e.company}</div></div>
                  <div style={{ color: '#6B7280', fontSize: '8px', textAlign: 'right' }}>{fmtDate(e.start_date)} — {e.current ? 'Présent' : fmtDate(e.end_date || '')}</div>
                </div>
                {e.description && <p style={{ color: '#374151', lineHeight: 1.5, marginTop: '4px' }}>{e.description}</p>}
              </div>
            ))}
          </>}
          {cvData.omnia_formations.filter(f => f.show).length > 0 && <>
            <div style={{ fontSize: '9px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.12em', borderBottom: `1px solid ${a}`, paddingBottom: '3px', marginBottom: '10px' }}>Formations Omnia</div>
            {cvData.omnia_formations.filter(f => f.show).map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
                <div><div style={{ fontWeight: 700, color: p }}>{f.title}</div><div style={{ color: a }}>Omnia Academy{f.cpd_accredited ? ' · CPD' : ''}</div></div>
                <div style={{ color: '#6B7280', fontSize: '8px' }}>{fmtDate(f.completed_at)}</div>
              </div>
            ))}
          </>}
        </div>
      </div>
    );
  }

  if (templateId === 'moderne_ats') {
    const p = '#1A1A2E', a = '#E94560';
    return (
      <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '9px', background: '#fff', width: '794px', minHeight: '1123px', padding: '40px', transform: 'scale(0.55)', transformOrigin: 'top left', marginBottom: '-500px' }}>
        <div style={{ borderBottom: `4px solid ${a}`, paddingBottom: '14px', marginBottom: '20px' }}>
          <div style={{ fontSize: '28px', fontWeight: 900, color: p }}>{cvData.name || 'Votre Nom'}</div>
          <div style={{ fontSize: '13px', color: a, fontWeight: 700, marginTop: '3px' }}>{cvData.title || 'Titre professionnel'}</div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '8px', fontSize: '8px', color: '#6B7280' }}>
            {cvData.contact.email && <span>✉ {cvData.contact.email}</span>}
            {cvData.contact.phone && <span>☎ {cvData.contact.phone}</span>}
            {cvData.contact.location && <span>⊙ {cvData.contact.location}</span>}
            {cvData.contact.linkedin && <span>in LinkedIn</span>}
          </div>
        </div>
        {cvData.summary && <><div style={{ fontSize: '10px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>PROFIL PROFESSIONNEL</div><p style={{ color: '#374151', lineHeight: 1.7, marginBottom: '18px' }}>{cvData.summary}</p></>}
        {cvData.experiences.length > 0 && <>
          <div style={{ fontSize: '10px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.1em', borderLeft: `4px solid ${a}`, paddingLeft: '8px', marginBottom: '12px' }}>EXPÉRIENCES PROFESSIONNELLES</div>
          {cvData.experiences.map(e => (
            <div key={e.id} style={{ marginBottom: '14px', paddingLeft: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div><div style={{ fontWeight: 700, color: p, fontSize: '10px' }}>{e.position}</div><div style={{ color: a, fontWeight: 600 }}>{e.company}</div></div>
                <div style={{ color: '#6B7280', fontSize: '8px' }}>{fmtDate(e.start_date)} — {e.current ? 'Présent' : fmtDate(e.end_date || '')}</div>
              </div>
              {e.description && <p style={{ color: '#374151', lineHeight: 1.5, marginTop: '4px' }}>{e.description}</p>}
            </div>
          ))}
        </>}
        {cvData.skills.length > 0 && <>
          <div style={{ fontSize: '10px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.1em', borderLeft: `4px solid ${a}`, paddingLeft: '8px', marginBottom: '10px' }}>COMPÉTENCES</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '18px' }}>
            {cvData.skills.map(s => (
              <span key={s.id} style={{ padding: '3px 10px', border: `1px solid ${a}`, borderRadius: '3px', fontSize: '8px', color: p, fontWeight: 600 }}>{s.name}</span>
            ))}
          </div>
        </>}
        {cvData.languages.length > 0 && <>
          <div style={{ fontSize: '10px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.1em', borderLeft: `4px solid ${a}`, paddingLeft: '8px', marginBottom: '10px' }}>LANGUES</div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '18px' }}>
            {cvData.languages.map(l => <span key={l.id} style={{ fontSize: '9px', color: '#374151' }}><b>{l.name}</b> — {l.level}</span>)}
          </div>
        </>}
        {cvData.omnia_formations.filter(f => f.show).length > 0 && <>
          <div style={{ fontSize: '10px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.1em', borderLeft: `4px solid ${a}`, paddingLeft: '8px', marginBottom: '10px' }}>FORMATIONS OMNIA ACADEMY</div>
          {cvData.omnia_formations.filter(f => f.show).map(f => (
            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, color: p }}>{f.title}{f.cpd_accredited ? ' (CPD)' : ''}</span>
              <span style={{ color: '#6B7280', fontSize: '8px' }}>{fmtDate(f.completed_at)}</span>
            </div>
          ))}
        </>}
      </div>
    );
  }

  if (templateId === 'etudiant') {
    const p = '#002050', a = '#BF8813';
    return (
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '9px', background: '#fff', width: '794px', minHeight: '1123px', transform: 'scale(0.55)', transformOrigin: 'top left', marginBottom: '-500px' }}>
        <div style={{ background: p, padding: '28px 32px', color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {withPhoto && <div style={{ flexShrink: 0 }}><Avatar size={72} primary={a} accent={a} /></div>}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '0.02em' }}>{cvData.name || 'Votre Nom'}</div>
              <div style={{ fontSize: '13px', color: a, fontWeight: 600, marginTop: '4px' }}>{cvData.title || 'Titre professionnel'}</div>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginTop: '10px', fontSize: '8px', color: 'rgba(255,255,255,0.75)' }}>
                {cvData.contact.email && <span>✉ {cvData.contact.email}</span>}
                {cvData.contact.phone && <span>☎ {cvData.contact.phone}</span>}
                {cvData.contact.location && <span>⊙ {cvData.contact.location}</span>}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flex: 1 }}>
          <div style={{ flex: 1, padding: '24px' }}>
            {cvData.summary && <><div style={{ fontSize: '9px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.12em', background: `linear-gradient(to right, ${a}22, transparent)`, padding: '4px 8px', marginBottom: '8px' }}>Objectif professionnel</div><p style={{ color: '#374151', lineHeight: 1.7, marginBottom: '16px' }}>{cvData.summary}</p></>}
            {cvData.experiences.length > 0 && <>
              <div style={{ fontSize: '9px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.12em', background: `linear-gradient(to right, ${a}22, transparent)`, padding: '4px 8px', marginBottom: '10px' }}>Expériences & Stages</div>
              {cvData.experiences.map(e => (
                <div key={e.id} style={{ marginBottom: '12px', borderLeft: `3px solid ${a}`, paddingLeft: '10px' }}>
                  <div style={{ fontWeight: 700, color: p }}>{e.position}</div>
                  <div style={{ color: a }}>{e.company} · {fmtDate(e.start_date)} — {e.current ? 'Présent' : fmtDate(e.end_date || '')}</div>
                  {e.description && <p style={{ color: '#374151', marginTop: '3px', lineHeight: 1.5 }}>{e.description}</p>}
                </div>
              ))}
            </>}
            {cvData.omnia_formations.filter(f => f.show).length > 0 && <>
              <div style={{ fontSize: '9px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.12em', background: `linear-gradient(to right, ${a}22, transparent)`, padding: '4px 8px', marginBottom: '10px' }}>Formations Omnia</div>
              {cvData.omnia_formations.filter(f => f.show).map(f => (
                <div key={f.id} style={{ marginBottom: '7px', borderLeft: `3px solid ${a}`, paddingLeft: '10px' }}>
                  <div style={{ fontWeight: 700, color: p }}>{f.title}</div>
                  <div style={{ color: a }}>Omnia Academy{f.cpd_accredited ? ' · CPD' : ''} · {fmtDate(f.completed_at)}</div>
                </div>
              ))}
            </>}
          </div>
          <div style={{ width: '190px', minWidth: '190px', background: '#EEF2FF', padding: '24px 16px' }}>
            {cvData.education.length > 0 && <>
              <div style={{ fontSize: '8px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.12em', borderBottom: `2px solid ${a}`, paddingBottom: '4px', marginBottom: '10px' }}>Formation</div>
              {cvData.education.map(e => <div key={e.id} style={{ marginBottom: '10px' }}><div style={{ fontWeight: 700, color: p }}>{e.degree}</div><div style={{ color: '#374151' }}>{e.school}</div><div style={{ color: '#6B7280', fontSize: '8px' }}>{e.year}</div></div>)}
            </>}
            {cvData.skills.length > 0 && <>
              <div style={{ fontSize: '8px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.12em', borderBottom: `2px solid ${a}`, paddingBottom: '4px', marginBottom: '10px', marginTop: '16px' }}>Compétences</div>
              {cvData.skills.map(s => <div key={s.id} style={{ marginBottom: '6px' }}><div style={{ color: '#374151', fontWeight: 600 }}>{s.name}</div><div style={{ background: '#ddd', borderRadius: '3px', height: '3px', marginTop: '2px' }}><div style={{ background: a, borderRadius: '3px', height: '3px', width: `${s.level}%` }} /></div></div>)}
            </>}
            {cvData.languages.length > 0 && <>
              <div style={{ fontSize: '8px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.12em', borderBottom: `2px solid ${a}`, paddingBottom: '4px', marginBottom: '10px', marginTop: '16px' }}>Langues</div>
              {cvData.languages.map(l => <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}><span style={{ fontWeight: 600, color: '#374151' }}>{l.name}</span><span style={{ color: a, fontSize: '8px' }}>{l.level}</span></div>)}
            </>}
          </div>
        </div>
      </div>
    );
  }

  if (templateId === 'it_digital') {
    const p = '#00B4D8', a = '#00B4D8', bg = '#0D1B2A', bg2 = '#1B263B';
    return (
      <div style={{ fontFamily: 'Courier New, monospace', fontSize: '9px', background: bg, color: '#E0E0E0', display: 'flex', width: '794px', minHeight: '1123px', transform: 'scale(0.55)', transformOrigin: 'top left', marginBottom: '-500px' }}>
        <div style={{ width: '200px', minWidth: '200px', background: bg2, padding: '28px 16px', borderRight: `2px solid ${a}` }}>
          {withPhoto && <div style={{ textAlign: 'center', marginBottom: '20px' }}><Avatar size={72} primary={a} accent={a} /></div>}
          <div style={{ fontSize: '8px', fontWeight: 700, color: a, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '10px', fontFamily: 'Courier New' }}>// Contact</div>
          {cvData.contact.email && <div style={{ marginBottom: '5px', fontSize: '8px', color: '#aaa', wordBreak: 'break-all' }}>{cvData.contact.email}</div>}
          {cvData.contact.phone && <div style={{ marginBottom: '5px', fontSize: '8px', color: '#aaa' }}>{cvData.contact.phone}</div>}
          {cvData.contact.location && <div style={{ marginBottom: '5px', fontSize: '8px', color: '#aaa' }}>{cvData.contact.location}</div>}
          {cvData.contact.linkedin && <div style={{ marginBottom: '5px', fontSize: '8px', color: a }}>LinkedIn</div>}
          {cvData.skills.length > 0 && <>
            <div style={{ fontSize: '8px', fontWeight: 700, color: a, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '10px', marginTop: '20px', fontFamily: 'Courier New' }}>// Skills</div>
            {cvData.skills.map(s => <div key={s.id} style={{ marginBottom: '6px' }}><div style={{ color: '#E0E0E0', fontWeight: 600 }}>{s.name}</div><div style={{ background: '#333', borderRadius: '2px', height: '3px', marginTop: '2px' }}><div style={{ background: a, borderRadius: '2px', height: '3px', width: `${s.level}%` }} /></div></div>)}
          </>}
          {cvData.languages.length > 0 && <>
            <div style={{ fontSize: '8px', fontWeight: 700, color: a, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '10px', marginTop: '20px', fontFamily: 'Courier New' }}>// Languages</div>
            {cvData.languages.map(l => <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}><span style={{ color: '#E0E0E0' }}>{l.name}</span><span style={{ color: a, fontSize: '8px' }}>{l.level}</span></div>)}
          </>}
        </div>
        <div style={{ flex: 1, padding: '28px 24px' }}>
          <div style={{ borderBottom: `2px solid ${a}`, paddingBottom: '12px', marginBottom: '18px' }}>
            <div style={{ fontSize: '24px', fontWeight: 900, color: a, fontFamily: 'Courier New' }}>{cvData.name || 'Votre Nom'}</div>
            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '3px' }}>{`> ${cvData.title || 'Titre professionnel'}`}</div>
          </div>
          {cvData.summary && <><div style={{ fontSize: '8px', fontWeight: 700, color: a, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '6px', fontFamily: 'Courier New' }}>// README.md</div><p style={{ color: '#ccc', lineHeight: 1.7, marginBottom: '16px' }}>{cvData.summary}</p></>}
          {cvData.experiences.length > 0 && <>
            <div style={{ fontSize: '8px', fontWeight: 700, color: a, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '10px', fontFamily: 'Courier New' }}>// Experience.json</div>
            {cvData.experiences.map(e => (
              <div key={e.id} style={{ marginBottom: '12px', background: '#ffffff08', padding: '10px', borderRadius: '4px', borderLeft: `2px solid ${a}` }}>
                <div style={{ fontWeight: 700, color: '#E0E0E0' }}>{e.position}</div>
                <div style={{ color: a }}>{e.company} | {fmtDate(e.start_date)} → {e.current ? 'now' : fmtDate(e.end_date || '')}</div>
                {e.description && <p style={{ color: '#aaa', lineHeight: 1.5, marginTop: '4px' }}>{e.description}</p>}
              </div>
            ))}
          </>}
          {cvData.projects.length > 0 && <>
            <div style={{ fontSize: '8px', fontWeight: 700, color: a, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '10px', fontFamily: 'Courier New' }}>// Projects</div>
            {cvData.projects.map(pr => <div key={pr.id} style={{ marginBottom: '10px', background: '#ffffff08', padding: '10px', borderRadius: '4px' }}><div style={{ fontWeight: 700, color: '#E0E0E0' }}>{pr.name}</div>{pr.technologies && <div style={{ color: a, fontSize: '8px', marginTop: '2px' }}>{pr.technologies}</div>}{pr.description && <p style={{ color: '#aaa', lineHeight: 1.5, marginTop: '3px' }}>{pr.description}</p>}</div>)}
          </>}
          {cvData.omnia_formations.filter(f => f.show).length > 0 && <>
            <div style={{ fontSize: '8px', fontWeight: 700, color: a, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '10px', fontFamily: 'Courier New' }}>// Certifications</div>
            {cvData.omnia_formations.filter(f => f.show).map(f => <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}><span style={{ color: '#E0E0E0' }}>{f.title}{f.cpd_accredited ? ' [CPD]' : ''}</span><span style={{ color: '#aaa', fontSize: '8px' }}>{fmtDate(f.completed_at)}</span></div>)}
          </>}
        </div>
      </div>
    );
  }

  if (templateId === 'business') {
    const p = '#002050', a = '#BF8813';
    return (
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '9px', background: '#fff', width: '794px', minHeight: '1123px', transform: 'scale(0.55)', transformOrigin: 'top left', marginBottom: '-500px' }}>
        <div style={{ background: `linear-gradient(135deg, ${p} 0%, #003580 100%)`, padding: '32px', display: 'flex', alignItems: 'center', gap: '24px' }}>
          {withPhoto && <Avatar size={80} primary={a} accent={a} />}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '28px', fontWeight: 900, color: 'white', letterSpacing: '0.02em' }}>{cvData.name || 'Votre Nom'}</div>
            <div style={{ fontSize: '14px', color: a, fontWeight: 700, marginTop: '4px', letterSpacing: '0.05em' }}>{cvData.title || 'Titre professionnel'}</div>
          </div>
          <div style={{ textAlign: 'right', color: 'rgba(255,255,255,0.75)', fontSize: '8px' }}>
            {cvData.contact.email && <div style={{ marginBottom: '4px' }}>{cvData.contact.email}</div>}
            {cvData.contact.phone && <div style={{ marginBottom: '4px' }}>{cvData.contact.phone}</div>}
            {cvData.contact.location && <div style={{ marginBottom: '4px' }}>{cvData.contact.location}</div>}
            {cvData.contact.linkedin && <div style={{ color: a }}>LinkedIn</div>}
          </div>
        </div>
        <div style={{ display: 'flex', flex: 1 }}>
          <div style={{ flex: 1, padding: '24px' }}>
            {cvData.summary && <><div style={{ fontSize: '10px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.12em', borderLeft: `4px solid ${a}`, paddingLeft: '8px', marginBottom: '8px' }}>Profil exécutif</div><p style={{ color: '#374151', lineHeight: 1.7, marginBottom: '18px', textAlign: 'justify' }}>{cvData.summary}</p></>}
            {cvData.experiences.length > 0 && <>
              <div style={{ fontSize: '10px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.12em', borderLeft: `4px solid ${a}`, paddingLeft: '8px', marginBottom: '12px' }}>Parcours professionnel</div>
              {cvData.experiences.map(e => (
                <div key={e.id} style={{ marginBottom: '14px', paddingLeft: '12px', borderLeft: `1px solid #ddd` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div><div style={{ fontWeight: 700, color: p, fontSize: '10px' }}>{e.position}</div><div style={{ color: a, fontWeight: 600 }}>{e.company}</div></div>
                    <div style={{ background: p, color: 'white', fontSize: '7px', padding: '2px 8px', borderRadius: '10px', whiteSpace: 'nowrap' }}>{fmtDate(e.start_date)} — {e.current ? 'Présent' : fmtDate(e.end_date || '')}</div>
                  </div>
                  {e.description && <p style={{ color: '#374151', lineHeight: 1.5, marginTop: '5px' }}>{e.description}</p>}
                </div>
              ))}
            </>}
            {cvData.omnia_formations.filter(f => f.show).length > 0 && <>
              <div style={{ fontSize: '10px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.12em', borderLeft: `4px solid ${a}`, paddingLeft: '8px', marginBottom: '10px' }}>Formations certifiées</div>
              {cvData.omnia_formations.filter(f => f.show).map(f => <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px', paddingLeft: '12px' }}><div><div style={{ fontWeight: 700, color: p }}>{f.title}</div><div style={{ color: a }}>Omnia Academy{f.cpd_accredited ? ' · CPD' : ''}</div></div><div style={{ color: '#6B7280', fontSize: '8px' }}>{fmtDate(f.completed_at)}</div></div>)}
            </>}
          </div>
          <div style={{ width: '190px', minWidth: '190px', background: '#FFF8F0', padding: '24px 16px', borderLeft: `3px solid ${a}` }}>
            {cvData.skills.length > 0 && <>
              <div style={{ fontSize: '8px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.12em', borderBottom: `2px solid ${a}`, paddingBottom: '4px', marginBottom: '10px' }}>Expertises</div>
              {cvData.skills.map(s => <div key={s.id} style={{ marginBottom: '7px' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: 600, color: p }}>{s.name}</span></div><div style={{ background: '#ddd', borderRadius: '3px', height: '3px', marginTop: '2px' }}><div style={{ background: a, borderRadius: '3px', height: '3px', width: `${s.level}%` }} /></div></div>)}
            </>}
            {cvData.languages.length > 0 && <>
              <div style={{ fontSize: '8px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.12em', borderBottom: `2px solid ${a}`, paddingBottom: '4px', marginBottom: '10px', marginTop: '18px' }}>Langues</div>
              {cvData.languages.map(l => <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}><span style={{ fontWeight: 600, color: p }}>{l.name}</span><span style={{ color: a, fontSize: '8px' }}>{l.level}</span></div>)}
            </>}
            {cvData.education.length > 0 && <>
              <div style={{ fontSize: '8px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.12em', borderBottom: `2px solid ${a}`, paddingBottom: '4px', marginBottom: '10px', marginTop: '18px' }}>Formation</div>
              {cvData.education.map(e => <div key={e.id} style={{ marginBottom: '8px' }}><div style={{ fontWeight: 700, color: p }}>{e.degree}</div><div style={{ color: '#374151' }}>{e.school}</div><div style={{ color: '#6B7280', fontSize: '8px' }}>{e.year}</div></div>)}
            </>}
          </div>
        </div>
      </div>
    );
  }

  if (templateId === 'qse') {
    const p = '#1B4332', a = '#52B788', bg = '#D8F3DC';
    return (
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '9px', background: '#fff', display: 'flex', width: '794px', minHeight: '1123px', transform: 'scale(0.55)', transformOrigin: 'top left', marginBottom: '-500px' }}>
        <div style={{ width: '200px', minWidth: '200px', background: p, padding: '28px 16px', color: 'white' }}>
          {withPhoto && <div style={{ textAlign: 'center', marginBottom: '20px', padding: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', display: 'inline-flex' }}><Avatar size={68} primary={a} accent={a} /></div>}
          <div style={{ fontSize: '10px', fontWeight: 700, color: a, letterSpacing: '0.15em', textTransform: 'uppercase', borderBottom: `1px solid ${a}30`, paddingBottom: '4px', marginBottom: '10px' }}>Contact</div>
          {cvData.contact.email && <div style={{ marginBottom: '5px', fontSize: '8px', color: 'rgba(255,255,255,0.8)', wordBreak: 'break-all' }}>✉ {cvData.contact.email}</div>}
          {cvData.contact.phone && <div style={{ marginBottom: '5px', fontSize: '8px', color: 'rgba(255,255,255,0.8)' }}>☎ {cvData.contact.phone}</div>}
          {cvData.contact.location && <div style={{ marginBottom: '5px', fontSize: '8px', color: 'rgba(255,255,255,0.8)' }}>⊙ {cvData.contact.location}</div>}
          {cvData.skills.length > 0 && <>
            <div style={{ fontSize: '10px', fontWeight: 700, color: a, letterSpacing: '0.15em', textTransform: 'uppercase', borderBottom: `1px solid ${a}30`, paddingBottom: '4px', marginBottom: '10px', marginTop: '20px' }}>Compétences</div>
            {cvData.skills.map(s => <div key={s.id} style={{ marginBottom: '6px' }}><div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{s.name}</div><div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '3px', height: '3px', marginTop: '2px' }}><div style={{ background: a, borderRadius: '3px', height: '3px', width: `${s.level}%` }} /></div></div>)}
          </>}
          {cvData.certifications_external.length > 0 && <>
            <div style={{ fontSize: '10px', fontWeight: 700, color: a, letterSpacing: '0.15em', textTransform: 'uppercase', borderBottom: `1px solid ${a}30`, paddingBottom: '4px', marginBottom: '10px', marginTop: '20px' }}>Certifications</div>
            {cvData.certifications_external.map(c => <div key={c.id} style={{ marginBottom: '7px' }}><div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{c.name}</div><div style={{ color: a, fontSize: '8px' }}>{c.issuer} {c.year}</div></div>)}
          </>}
        </div>
        <div style={{ flex: 1, padding: '28px 24px' }}>
          <div style={{ background: bg, padding: '16px 20px', borderRadius: '8px', marginBottom: '18px' }}>
            <div style={{ fontSize: '22px', fontWeight: 900, color: p }}>{cvData.name || 'Votre Nom'}</div>
            <div style={{ fontSize: '12px', color: a, fontWeight: 700, marginTop: '3px' }}>{cvData.title || 'Titre QSE / HSE'}</div>
          </div>
          {cvData.summary && <><div style={{ fontSize: '9px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.12em', background: bg, padding: '3px 8px', borderLeft: `3px solid ${a}`, marginBottom: '8px' }}>Profil QSE</div><p style={{ color: '#374151', lineHeight: 1.7, marginBottom: '16px' }}>{cvData.summary}</p></>}
          {cvData.experiences.length > 0 && <>
            <div style={{ fontSize: '9px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.12em', background: bg, padding: '3px 8px', borderLeft: `3px solid ${a}`, marginBottom: '10px' }}>Expériences HSE/QSE</div>
            {cvData.experiences.map(e => (
              <div key={e.id} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div><div style={{ fontWeight: 700, color: p }}>{e.position}</div><div style={{ color: a, fontWeight: 600 }}>{e.company}</div></div>
                  <div style={{ color: '#6B7280', fontSize: '8px' }}>{fmtDate(e.start_date)} — {e.current ? 'Présent' : fmtDate(e.end_date || '')}</div>
                </div>
                {e.description && <p style={{ color: '#374151', lineHeight: 1.5, marginTop: '4px' }}>{e.description}</p>}
              </div>
            ))}
          </>}
          {cvData.omnia_formations.filter(f => f.show).length > 0 && <>
            <div style={{ fontSize: '9px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.12em', background: bg, padding: '3px 8px', borderLeft: `3px solid ${a}`, marginBottom: '10px' }}>Formations</div>
            {cvData.omnia_formations.filter(f => f.show).map(f => <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}><div><div style={{ fontWeight: 700, color: p }}>{f.title}</div><div style={{ color: a }}>Omnia Academy{f.cpd_accredited ? ' · CPD' : ''}</div></div><div style={{ color: '#6B7280', fontSize: '8px' }}>{fmtDate(f.completed_at)}</div></div>)}
          </>}
        </div>
      </div>
    );
  }

  if (templateId === 'international') {
    const p = '#002050', a = '#BF8813';
    return (
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '9px', background: '#fff', width: '794px', minHeight: '1123px', transform: 'scale(0.55)', transformOrigin: 'top left', marginBottom: '-500px' }}>
        <div style={{ padding: '28px 32px', borderBottom: `3px solid ${a}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: p }}>{cvData.name || 'Votre Nom'}</div>
            <div style={{ fontSize: '13px', color: a, fontWeight: 600, marginTop: '4px' }}>{cvData.title || 'Titre professionnel'}</div>
            {cvData.objective && <div style={{ fontSize: '9px', color: '#6B7280', marginTop: '6px', fontStyle: 'italic', maxWidth: '400px' }}>{cvData.objective}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            {withPhoto && <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'flex-end' }}><Avatar size={64} primary={p} accent={a} /></div>}
            <div style={{ fontSize: '8px', color: '#6B7280', lineHeight: 1.8 }}>
              {cvData.contact.email && <div>{cvData.contact.email}</div>}
              {cvData.contact.phone && <div>{cvData.contact.phone}</div>}
              {cvData.contact.location && <div>{cvData.contact.location}</div>}
              {cvData.contact.linkedin && <div style={{ color: a }}>LinkedIn</div>}
              {cvData.contact.portfolio && <div style={{ color: a }}>Portfolio</div>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1, padding: '24px 32px' }}>
            {cvData.summary && <><div style={{ fontSize: '10px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '8px' }}>Professional Summary</div><p style={{ color: '#374151', lineHeight: 1.7, marginBottom: '18px', textAlign: 'justify' }}>{cvData.summary}</p></>}
            {cvData.experiences.length > 0 && <>
              <div style={{ fontSize: '10px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '12px', paddingBottom: '4px', borderBottom: `1px solid #E4E7EC` }}>Professional Experience</div>
              {cvData.experiences.map(e => (
                <div key={e.id} style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div><div style={{ fontWeight: 700, color: p, fontSize: '10px' }}>{e.position}</div><div style={{ color: a }}>{e.company}{e.location ? `, ${e.location}` : ''}</div></div>
                    <div style={{ color: '#6B7280', fontSize: '8px', fontStyle: 'italic', whiteSpace: 'nowrap' }}>{fmtDate(e.start_date)} – {e.current ? 'Present' : fmtDate(e.end_date || '')}</div>
                  </div>
                  {e.description && <p style={{ color: '#374151', lineHeight: 1.5, marginTop: '4px' }}>{e.description}</p>}
                </div>
              ))}
            </>}
            {cvData.omnia_formations.filter(f => f.show).length > 0 && <>
              <div style={{ fontSize: '10px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '10px', paddingBottom: '4px', borderBottom: `1px solid #E4E7EC` }}>Training & Certifications</div>
              {cvData.omnia_formations.filter(f => f.show).map(f => <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}><div><div style={{ fontWeight: 700, color: p }}>{f.title}</div><div style={{ color: a }}>Omnia Global Academy{f.cpd_accredited ? ' · CPD Certified' : ''}</div></div><div style={{ color: '#6B7280', fontSize: '8px' }}>{fmtDate(f.completed_at)}</div></div>)}
            </>}
          </div>
          <div style={{ width: '185px', minWidth: '185px', background: '#F0F4F8', padding: '24px 16px', borderLeft: `1px solid #E4E7EC` }}>
            {cvData.education.length > 0 && <>
              <div style={{ fontSize: '8px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '10px', borderBottom: `2px solid ${a}`, paddingBottom: '4px' }}>Education</div>
              {cvData.education.map(e => <div key={e.id} style={{ marginBottom: '10px' }}><div style={{ fontWeight: 700, color: p }}>{e.degree}</div><div style={{ color: '#374151' }}>{e.school}</div><div style={{ color: a, fontSize: '8px', fontStyle: 'italic' }}>{e.year}</div></div>)}
            </>}
            {cvData.skills.length > 0 && <>
              <div style={{ fontSize: '8px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '10px', borderBottom: `2px solid ${a}`, paddingBottom: '4px', marginTop: '18px' }}>Core Skills</div>
              {cvData.skills.map(s => <div key={s.id} style={{ marginBottom: '6px' }}><div style={{ fontWeight: 600, color: '#374151' }}>{s.name}</div><div style={{ background: '#ddd', borderRadius: '3px', height: '3px', marginTop: '2px' }}><div style={{ background: a, borderRadius: '3px', height: '3px', width: `${s.level}%` }} /></div></div>)}
            </>}
            {cvData.languages.length > 0 && <>
              <div style={{ fontSize: '8px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '10px', borderBottom: `2px solid ${a}`, paddingBottom: '4px', marginTop: '18px' }}>Languages</div>
              {cvData.languages.map(l => <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}><span style={{ fontWeight: 600, color: p }}>{l.name}</span><span style={{ color: a, fontSize: '8px' }}>{l.level}</span></div>)}
            </>}
          </div>
        </div>
      </div>
    );
  }

  if (templateId === 'formateur') {
    const p = '#2D3561', a = '#C84B31';
    return (
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '9px', background: '#fff', display: 'flex', width: '794px', minHeight: '1123px', transform: 'scale(0.55)', transformOrigin: 'top left', marginBottom: '-500px' }}>
        <div style={{ width: '200px', minWidth: '200px', background: '#F5F5F5', padding: '28px 16px', borderRight: `4px solid ${p}` }}>
          {withPhoto && <div style={{ textAlign: 'center', marginBottom: '20px' }}><Avatar size={72} primary={p} accent={a} /></div>}
          <div style={{ fontSize: '8px', fontWeight: 700, color: p, letterSpacing: '0.15em', textTransform: 'uppercase', borderBottom: `2px solid ${a}`, paddingBottom: '4px', marginBottom: '10px' }}>Contact</div>
          {cvData.contact.email && <div style={{ marginBottom: '5px', color: '#374151', wordBreak: 'break-all' }}>✉ {cvData.contact.email}</div>}
          {cvData.contact.phone && <div style={{ marginBottom: '5px', color: '#374151' }}>☎ {cvData.contact.phone}</div>}
          {cvData.contact.location && <div style={{ marginBottom: '5px', color: '#374151' }}>⊙ {cvData.contact.location}</div>}
          {cvData.skills.length > 0 && <>
            <div style={{ fontSize: '8px', fontWeight: 700, color: p, letterSpacing: '0.15em', textTransform: 'uppercase', borderBottom: `2px solid ${a}`, paddingBottom: '4px', marginBottom: '10px', marginTop: '20px' }}>Domaines d'expertise</div>
            {cvData.skills.map(s => <div key={s.id} style={{ marginBottom: '6px', padding: '4px 8px', background: `${p}10`, borderLeft: `2px solid ${a}`, color: p, fontWeight: 600 }}>{s.name}</div>)}
          </>}
          {cvData.languages.length > 0 && <>
            <div style={{ fontSize: '8px', fontWeight: 700, color: p, letterSpacing: '0.15em', textTransform: 'uppercase', borderBottom: `2px solid ${a}`, paddingBottom: '4px', marginBottom: '10px', marginTop: '20px' }}>Langues d'enseignement</div>
            {cvData.languages.map(l => <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}><span style={{ fontWeight: 600, color: p }}>{l.name}</span><span style={{ color: a, fontSize: '8px' }}>{l.level}</span></div>)}
          </>}
          {cvData.certifications_external.length > 0 && <>
            <div style={{ fontSize: '8px', fontWeight: 700, color: p, letterSpacing: '0.15em', textTransform: 'uppercase', borderBottom: `2px solid ${a}`, paddingBottom: '4px', marginBottom: '10px', marginTop: '20px' }}>Accréditations</div>
            {cvData.certifications_external.map(c => <div key={c.id} style={{ marginBottom: '7px' }}><div style={{ fontWeight: 600, color: p }}>{c.name}</div><div style={{ color: '#6B7280', fontSize: '8px' }}>{c.issuer} · {c.year}</div></div>)}
          </>}
        </div>
        <div style={{ flex: 1, padding: '28px 24px' }}>
          <div style={{ background: p, padding: '16px 20px', borderRadius: '6px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '22px', fontWeight: 900, color: 'white' }}>{cvData.name || 'Votre Nom'}</div>
              <div style={{ fontSize: '12px', color: a, fontWeight: 700, marginTop: '3px' }}>{cvData.title || 'Formateur / Enseignant'}</div>
            </div>
          </div>
          {cvData.summary && <><div style={{ fontSize: '9px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.12em', borderLeft: `4px solid ${a}`, paddingLeft: '8px', marginBottom: '8px' }}>Philosophie pédagogique</div><p style={{ color: '#374151', lineHeight: 1.7, marginBottom: '16px', fontStyle: 'italic' }}>"{cvData.summary}"</p></>}
          {cvData.experiences.length > 0 && <>
            <div style={{ fontSize: '9px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.12em', borderLeft: `4px solid ${a}`, paddingLeft: '8px', marginBottom: '10px' }}>Expériences pédagogiques</div>
            {cvData.experiences.map(e => (
              <div key={e.id} style={{ marginBottom: '12px', padding: '10px', background: '#F5F5F5', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div><div style={{ fontWeight: 700, color: p }}>{e.position}</div><div style={{ color: a, fontWeight: 600 }}>{e.company}</div></div>
                  <div style={{ color: '#6B7280', fontSize: '8px' }}>{fmtDate(e.start_date)} — {e.current ? 'Présent' : fmtDate(e.end_date || '')}</div>
                </div>
                {e.description && <p style={{ color: '#374151', lineHeight: 1.5, marginTop: '4px' }}>{e.description}</p>}
              </div>
            ))}
          </>}
          {cvData.omnia_formations.filter(f => f.show).length > 0 && <>
            <div style={{ fontSize: '9px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.12em', borderLeft: `4px solid ${a}`, paddingLeft: '8px', marginBottom: '10px' }}>Formations & Certifications</div>
            {cvData.omnia_formations.filter(f => f.show).map(f => <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px', padding: '6px 10px', background: '#F5F5F5', borderRadius: '4px' }}><div><div style={{ fontWeight: 700, color: p }}>{f.title}</div><div style={{ color: a }}>Omnia Academy{f.cpd_accredited ? ' · CPD Certifié' : ''}</div></div><div style={{ color: '#6B7280', fontSize: '8px' }}>{fmtDate(f.completed_at)}</div></div>)}
          </>}
          {cvData.education.length > 0 && <>
            <div style={{ fontSize: '9px', fontWeight: 700, color: p, textTransform: 'uppercase', letterSpacing: '0.12em', borderLeft: `4px solid ${a}`, paddingLeft: '8px', marginBottom: '10px' }}>Formation académique</div>
            {cvData.education.map(e => <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}><div><div style={{ fontWeight: 700, color: p }}>{e.degree}</div><div style={{ color: '#374151' }}>{e.school}</div></div><div style={{ color: '#6B7280', fontSize: '8px' }}>{e.year}</div></div>)}
          </>}
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '9px', background: '#fff', display: 'flex', width: '794px', minHeight: '1123px', transform: 'scale(0.55)', transformOrigin: 'top left', marginBottom: '-500px' }}>
      <div style={{ width: '200px', background: '#F8F9FA', padding: '28px 16px' }}>
        <div style={{ fontWeight: 700, color: '#002050', marginBottom: '10px' }}>Contact</div>
        {cvData.contact.email && <div style={{ marginBottom: '5px', color: '#374151' }}>{cvData.contact.email}</div>}
        {cvData.contact.phone && <div style={{ marginBottom: '5px', color: '#374151' }}>{cvData.contact.phone}</div>}
      </div>
      <div style={{ flex: 1, padding: '28px 24px' }}>
        <div style={{ fontSize: '22px', fontWeight: 900, color: '#002050', marginBottom: '4px' }}>{cvData.name || 'Votre Nom'}</div>
        <div style={{ color: '#BF8813' }}>{cvData.title || 'Titre professionnel'}</div>
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
          <input className={inputCls} value={data.name} onChange={e => onChange({ ...data, name: e.target.value })} placeholder="Amadou Coulibaly" style={{ borderColor: '#E4E7EC' }} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#002050' }}>Titre professionnel *</label>
          <input className={inputCls} value={data.title} onChange={e => onChange({ ...data, title: e.target.value })} placeholder="Développeur Full Stack" style={{ borderColor: '#E4E7EC' }} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#002050' }}>Résumé professionnel</label>
        <textarea className={inputCls} rows={4} value={data.summary} onChange={e => onChange({ ...data, summary: e.target.value })} placeholder="Décrivez votre profil en 3-4 lignes..." style={{ borderColor: '#E4E7EC', resize: 'vertical' }} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#002050' }}>Objectif professionnel (optionnel)</label>
        <input className={inputCls} value={data.objective || ''} onChange={e => onChange({ ...data, objective: e.target.value })} placeholder="Ex: Rejoindre une startup innovante..." style={{ borderColor: '#E4E7EC' }} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#002050' }}>Email *</label>
          <input className={inputCls} type="email" value={data.contact.email} onChange={e => onChange({ ...data, contact: { ...data.contact, email: e.target.value } })} placeholder="votre@email.com" style={{ borderColor: '#E4E7EC' }} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#002050' }}>Téléphone</label>
          <input className={inputCls} value={data.contact.phone} onChange={e => onChange({ ...data, contact: { ...data.contact, phone: e.target.value } })} placeholder="+223 70 00 00 00" style={{ borderColor: '#E4E7EC' }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#002050' }}>Ville / Pays</label>
          <input className={inputCls} value={data.contact.location} onChange={e => onChange({ ...data, contact: { ...data.contact, location: e.target.value } })} placeholder="Bamako, Mali" style={{ borderColor: '#E4E7EC' }} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#002050' }}>LinkedIn (optionnel)</label>
          <input className={inputCls} value={data.contact.linkedin || ''} onChange={e => onChange({ ...data, contact: { ...data.contact, linkedin: e.target.value } })} placeholder="linkedin.com/in/..." style={{ borderColor: '#E4E7EC' }} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#002050' }}>Portfolio / Site web (optionnel)</label>
        <input className={inputCls} value={data.contact.portfolio || ''} onChange={e => onChange({ ...data, contact: { ...data.contact, portfolio: e.target.value } })} placeholder="https://monportfolio.com" style={{ borderColor: '#E4E7EC' }} />
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
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#002050' }}>URL de votre photo (optionnel)</label>
            <input className={inputCls} value={data.photo_url || ''} onChange={e => onChange({ ...data, photo_url: e.target.value })} placeholder="https://... (lien vers votre photo)" style={{ borderColor: '#E4E7EC' }} />
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
          cpd_accredited: course.cpd_accredited || false, cpd_hours: course.cpd_hours,
          certificate_id: cert?.omnia_certificate_id,
          verify_url: cert ? `https://omniaglobalacademy.com/verify/${cert.omnia_certificate_id}` : undefined,
          show: true,
        }]
      });
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: '#6B7280' }}>Sélectionnez les formations et certificats Omnia à afficher sur votre CV.</p>
      {completedCourses.length === 0 ? (
        <div className="text-center py-8 rounded-xl border" style={{ borderColor: '#E4E7EC' }}>
          <GraduationCap size={32} style={{ color: '#E4E7EC' }} className="mx-auto mb-3" />
          <p style={{ color: '#6B7280' }}>Aucune formation terminée pour l'instant</p>
          <a href="/catalogue" className="text-sm font-medium mt-2 block" style={{ color: '#BF8813' }}>Découvrir le catalogue →</a>
        </div>
      ) : (
        <div className="space-y-3">
          {completedCourses.map((course: any) => {
            const selected = data.omnia_formations.find(f => f.course_id === course.id);
            const cert = certificates.find(c => c.course_id === course.id);
            return (
              <div key={course.id}
                className="flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all"
                style={{ borderColor: selected ? '#002050' : '#E4E7EC', backgroundColor: selected ? 'rgba(0,32,80,0.04)' : 'white' }}
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
                      onChange={e => onChange({ ...data, omnia_formations: data.omnia_formations.map(f => f.course_id === course.id ? { ...f, show: e.target.checked } : f) })}
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
  const addExp = () => onChange({ ...data, experiences: [...data.experiences, { id: uid(), position: '', company: '', start_date: '', current: false, description: '' }] });
  const updateExp = (id: string, field: string, value: any) => onChange({ ...data, experiences: data.experiences.map(e => e.id === id ? { ...e, [field]: value } : e) });
  const removeExp = (id: string) => onChange({ ...data, experiences: data.experiences.filter(e => e.id !== id) });
  const addEdu = () => onChange({ ...data, education: [...data.education, { id: uid(), degree: '', school: '', year: '' }] });
  const updateEdu = (id: string, field: string, value: any) => onChange({ ...data, education: data.education.map(e => e.id === id ? { ...e, [field]: value } : e) });
  const removeEdu = (id: string) => onChange({ ...data, education: data.education.filter(e => e.id !== id) });

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold" style={{ color: '#002050' }}>Expériences professionnelles</h3>
          <button onClick={addExp} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#002050' }}><Plus size={14} /> Ajouter</button>
        </div>
        {data.experiences.map(exp => (
          <div key={exp.id} className="p-4 rounded-xl border mb-3" style={{ borderColor: '#E4E7EC' }}>
            <div className="flex justify-end mb-2"><button onClick={() => removeExp(exp.id)}><X size={14} style={{ color: '#DC2626' }} /></button></div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Poste *</label><input className={inputCls} value={exp.position} onChange={e => updateExp(exp.id, 'position', e.target.value)} placeholder="Développeur Web" style={{ borderColor: '#E4E7EC' }} /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Entreprise *</label><input className={inputCls} value={exp.company} onChange={e => updateExp(exp.id, 'company', e.target.value)} placeholder="Nom de l'entreprise" style={{ borderColor: '#E4E7EC' }} /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Date début</label><input className={inputCls} type="month" value={exp.start_date} onChange={e => updateExp(exp.id, 'start_date', e.target.value)} style={{ borderColor: '#E4E7EC' }} /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Date fin</label><input className={inputCls} type="month" value={exp.end_date || ''} disabled={exp.current} onChange={e => updateExp(exp.id, 'end_date', e.target.value)} style={{ borderColor: '#E4E7EC' }} /><label className="flex items-center gap-1.5 mt-1 text-xs cursor-pointer"><input type="checkbox" checked={exp.current} onChange={e => updateExp(exp.id, 'current', e.target.checked)} style={{ accentColor: '#002050' }} /><span style={{ color: '#6B7280' }}>Poste actuel</span></label></div>
            </div>
            <div><label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Description</label><textarea className={inputCls} rows={3} value={exp.description} onChange={e => updateExp(exp.id, 'description', e.target.value)} placeholder="Décrivez vos missions et réalisations..." style={{ borderColor: '#E4E7EC', resize: 'vertical' }} /></div>
          </div>
        ))}
        {data.experiences.length === 0 && <div className="text-center py-6 rounded-xl border border-dashed" style={{ borderColor: '#E4E7EC' }}><p className="text-sm" style={{ color: '#9CA3AF' }}>Aucune expérience ajoutée</p></div>}
      </div>
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold" style={{ color: '#002050' }}>Formation académique</h3>
          <button onClick={addEdu} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#002050' }}><Plus size={14} /> Ajouter</button>
        </div>
        {data.education.map(edu => (
          <div key={edu.id} className="p-4 rounded-xl border mb-3" style={{ borderColor: '#E4E7EC' }}>
            <div className="flex justify-end mb-2"><button onClick={() => removeEdu(edu.id)}><X size={14} style={{ color: '#DC2626' }} /></button></div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Diplôme *</label><input className={inputCls} value={edu.degree} onChange={e => updateEdu(edu.id, 'degree', e.target.value)} placeholder="Licence Informatique" style={{ borderColor: '#E4E7EC' }} /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>École *</label><input className={inputCls} value={edu.school} onChange={e => updateEdu(edu.id, 'school', e.target.value)} placeholder="Université de Bamako" style={{ borderColor: '#E4E7EC' }} /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Année</label><input className={inputCls} value={edu.year} onChange={e => updateEdu(edu.id, 'year', e.target.value)} placeholder="2022" style={{ borderColor: '#E4E7EC' }} /></div>
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
  const addSkill = () => onChange({ ...data, skills: [...data.skills, { id: uid(), name: '', level: 75 }] });
  const addLang = () => onChange({ ...data, languages: [...data.languages, { id: uid(), name: '', level: 'Intermédiaire' }] });
  const addCert = () => onChange({ ...data, certifications_external: [...data.certifications_external, { id: uid(), name: '', issuer: '', year: '' }] });
  const addProject = () => onChange({ ...data, projects: [...data.projects, { id: uid(), name: '', description: '', technologies: '' }] });

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold" style={{ color: '#002050' }}>Compétences</h3>
          <button onClick={addSkill} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#002050' }}><Plus size={14} /> Ajouter</button>
        </div>
        <div className="space-y-2">
          {data.skills.map(s => (
            <div key={s.id} className="flex items-center gap-3">
              <input className={`${inputCls} flex-1`} value={s.name} onChange={e => onChange({ ...data, skills: data.skills.map(sk => sk.id === s.id ? { ...sk, name: e.target.value } : sk) })} placeholder="Ex: JavaScript, Excel, Management..." style={{ borderColor: '#E4E7EC' }} />
              <input type="range" min={0} max={100} value={s.level} onChange={e => onChange({ ...data, skills: data.skills.map(sk => sk.id === s.id ? { ...sk, level: parseInt(e.target.value) } : sk) })} className="w-24" style={{ accentColor: '#002050' }} />
              <span className="text-xs w-8 text-right" style={{ color: '#6B7280' }}>{s.level}%</span>
              <button onClick={() => onChange({ ...data, skills: data.skills.filter(sk => sk.id !== s.id) })}><X size={14} style={{ color: '#DC2626' }} /></button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold" style={{ color: '#002050' }}>Langues</h3>
          <button onClick={addLang} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#002050' }}><Plus size={14} /> Ajouter</button>
        </div>
        <div className="space-y-2">
          {data.languages.map(l => (
            <div key={l.id} className="flex items-center gap-3">
              <input className={`${inputCls} flex-1`} value={l.name} onChange={e => onChange({ ...data, languages: data.languages.map(la => la.id === l.id ? { ...la, name: e.target.value } : la) })} placeholder="Ex: Français, Anglais, Bambara..." style={{ borderColor: '#E4E7EC' }} />
              <select className="px-3 py-2.5 border rounded-lg text-sm" style={{ borderColor: '#E4E7EC' }} value={l.level} onChange={e => onChange({ ...data, languages: data.languages.map(la => la.id === l.id ? { ...la, level: e.target.value } : la) })}>
                {LANG_LEVELS.map(lv => <option key={lv} value={lv}>{lv}</option>)}
              </select>
              <button onClick={() => onChange({ ...data, languages: data.languages.filter(la => la.id !== l.id) })}><X size={14} style={{ color: '#DC2626' }} /></button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold" style={{ color: '#002050' }}>Certifications externes</h3>
          <button onClick={addCert} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#002050' }}><Plus size={14} /> Ajouter</button>
        </div>
        <div className="space-y-2">
          {data.certifications_external.map(c => (
            <div key={c.id} className="flex items-center gap-3">
              <input className={`${inputCls} flex-1`} value={c.name} onChange={e => onChange({ ...data, certifications_external: data.certifications_external.map(ce => ce.id === c.id ? { ...ce, name: e.target.value } : ce) })} placeholder="Ex: AWS Certified, PMP, CISSP..." style={{ borderColor: '#E4E7EC' }} />
              <input className={inputCls} value={c.issuer} onChange={e => onChange({ ...data, certifications_external: data.certifications_external.map(ce => ce.id === c.id ? { ...ce, issuer: e.target.value } : ce) })} placeholder="Organisme" style={{ borderColor: '#E4E7EC', width: '140px' }} />
              <input className={inputCls} value={c.year} onChange={e => onChange({ ...data, certifications_external: data.certifications_external.map(ce => ce.id === c.id ? { ...ce, year: e.target.value } : ce) })} placeholder="2024" style={{ borderColor: '#E4E7EC', width: '80px' }} />
              <button onClick={() => onChange({ ...data, certifications_external: data.certifications_external.filter(ce => ce.id !== c.id) })}><X size={14} style={{ color: '#DC2626' }} /></button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold" style={{ color: '#002050' }}>Projets personnels</h3>
          <button onClick={addProject} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#002050' }}><Plus size={14} /> Ajouter</button>
        </div>
        <div className="space-y-3">
          {data.projects.map(p => (
            <div key={p.id} className="p-4 rounded-xl border" style={{ borderColor: '#E4E7EC' }}>
              <div className="flex justify-end mb-2"><button onClick={() => onChange({ ...data, projects: data.projects.filter(pr => pr.id !== p.id) })}><X size={14} style={{ color: '#DC2626' }} /></button></div>
              <div className="space-y-2">
                <input className={inputCls} value={p.name} onChange={e => onChange({ ...data, projects: data.projects.map(pr => pr.id === p.id ? { ...pr, name: e.target.value } : pr) })} placeholder="Nom du projet" style={{ borderColor: '#E4E7EC' }} />
                <textarea className={inputCls} rows={2} value={p.description} onChange={e => onChange({ ...data, projects: data.projects.map(pr => pr.id === p.id ? { ...pr, description: e.target.value } : pr) })} placeholder="Description du projet..." style={{ borderColor: '#E4E7EC', resize: 'vertical' }} />
                <input className={inputCls} value={p.technologies || ''} onChange={e => onChange({ ...data, projects: data.projects.map(pr => pr.id === p.id ? { ...pr, technologies: e.target.value } : pr) })} placeholder="Technologies utilisées (React, Python...)" style={{ borderColor: '#E4E7EC' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-semibold mb-3" style={{ color: '#002050' }}>Centres d'intérêt (optionnel)</h3>
        <input className={inputCls} value={Array.isArray(data.interests) ? data.interests.join(', ') : data.interests} onChange={e => onChange({ ...data, interests: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="Sport, Lecture, Voyages, Musique..." style={{ borderColor: '#E4E7EC' }} />
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
      <div className="flex items-center justify-between p-4 rounded-xl border" style={{ borderColor: '#E4E7EC' }}>
        <div>
          <div className="font-semibold" style={{ color: '#002050' }}>CV avec photo</div>
          <div className="text-xs mt-1" style={{ color: '#6B7280' }}>Version sans photo recommandée par défaut</div>
        </div>
        <input type="checkbox" checked={withPhoto} onChange={e => setWithPhoto(e.target.checked)} style={{ accentColor: '#002050', width: '18px', height: '18px' }} />
      </div>
      <div>
        <h3 className="font-semibold mb-4" style={{ color: '#002050' }}>Choisissez votre modèle</h3>
        <div className="grid grid-cols-2 gap-3">
          {TEMPLATES.map(t => {
            const Icon = t.icon;
            const selected = templateId === t.id;
            return (
              <div key={t.id} className="p-4 rounded-xl border cursor-pointer transition-all"
                style={{ borderColor: selected ? '#002050' : '#E4E7EC', backgroundColor: selected ? 'rgba(0,32,80,0.04)' : 'white', borderWidth: selected ? 2 : 1 }}
                onClick={() => setTemplateId(t.id)}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: selected ? '#002050' : '#F8F9FA' }}>
                    <Icon size={20} color={selected ? '#BF8813' : '#6B7280'} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm" style={{ color: '#002050' }}>{t.name}</span>
                      {t.ats && <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: '#E4F1EA', color: '#1E7A52' }}>ATS</span>}
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
      <select value={action} onChange={e => setAction(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm" style={{ borderColor: '#E4E7EC' }}>
        {ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
      </select>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={4} placeholder="Collez le texte à améliorer..." className="w-full px-3 py-2.5 border rounded-lg text-sm resize-none" style={{ borderColor: '#E4E7EC' }} />
      <div className="p-3 rounded-lg text-xs" style={{ backgroundColor: '#FFFBF0', color: '#7C5A00' }}>
        ⚠️ L'IA améliore uniquement vos textes. Elle n'invente jamais de diplôme, expérience ou compétence.
      </div>
      <button onClick={runAi} disabled={loading || !text.trim()} className="w-full py-2.5 rounded-lg font-semibold text-white text-sm disabled:opacity-50" style={{ backgroundColor: '#002050' }}>
        {loading ? '⏳ Génération...' : "✨ Améliorer avec l'IA"}
      </button>
      {result && (
        <div className="space-y-2">
          <div className="p-3 rounded-lg border text-sm" style={{ borderColor: '#E4E7EC', backgroundColor: '#F8F9FA' }}>
            <p style={{ color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{result}</p>
          </div>
          <button onClick={() => onResult(result, action)} className="w-full py-2 rounded-lg text-sm font-medium border" style={{ borderColor: '#1E7A52', color: '#1E7A52' }}>
            ✓ Copier le résultat
          </button>
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────
export default function DashboardCvBuilder() {
  const navigate = useNavigate();
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
        body: JSON.stringify({ cv_id: currentCvId, title: cvTitle, template_id: templateId, with_photo: withPhoto, cv_data: cvData }),
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

  async function downloadPdfById(cvId: string) {
    if (downloading) return;
    setDownloading(true);
    try {
      const token = localStorage.getItem('omnia_session_token');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/cv-builder-generate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cv_id: cvId }),
      });

      const contentType = res.headers.get('Content-Type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data.error === 'INSUFFICIENT_TOKENS') {
          showToast('❌ Jetons insuffisants. Achetez une formation pour en obtenir.');
          return;
        }
        showToast('❌ Erreur lors de la génération du PDF.');
        return;
      }

      if (!res.ok) {
        showToast('❌ Erreur serveur lors de la génération du PDF.');
        return;
      }

      const pdfBlob = await res.blob();
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cv-omnia-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const tokensRemaining = parseInt(res.headers.get('X-Tokens-Remaining') || String(tokens - 1));
      const tokenConsumed = res.headers.get('X-Token-Consumed') === 'true';
      setTokens(tokensRemaining);

      if (tokenConsumed) {
        showToast(`✓ PDF téléchargé — ${tokensRemaining} jeton(s) restant(s)`);
      } else {
        showToast('✓ PDF téléchargé (contenu inchangé — jeton conservé)');
      }
    } catch (err) {
      showToast('❌ Erreur lors du téléchargement');
    } finally {
      setDownloading(false);
    }
  }

  async function downloadPdf() {
    if (!currentCvId) {
      await saveCV();
    }
    if (currentCvId) await downloadPdfById(currentCvId);
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
          <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium text-white shadow-lg" style={{ backgroundColor: '#002050' }}>
            {toast}
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-sm mb-2" style={{ color: '#6B7280' }}>
              <ChevronLeft size={16} /> Retour au tableau de bord
            </button>
            <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>CV Builder IA</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Créez des CV professionnels avec l'aide de l'intelligence artificielle</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl border" style={{ borderColor: '#BF8813', backgroundColor: 'rgba(191,136,19,0.05)' }}>
              <Coins size={16} style={{ color: '#BF8813' }} />
              <span className="font-bold" style={{ color: '#BF8813' }}>{tokens}</span>
              <span className="text-xs" style={{ color: '#6B7280' }}>jeton(s)</span>
            </div>
            <button onClick={openNewCv} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white" style={{ backgroundColor: '#002050' }}>
              <Plus size={18} /> Nouveau CV
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
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : cvs.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border-2 border-dashed" style={{ borderColor: '#E4E7EC' }}>
            <FileText size={48} style={{ color: '#E4E7EC' }} className="mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#002050' }}>Aucun CV créé</h3>
            <p className="text-sm mb-6" style={{ color: '#6B7280' }}>Créez votre premier CV professionnel en quelques minutes</p>
            <button onClick={openNewCv} className="px-6 py-3 rounded-xl font-semibold text-white" style={{ backgroundColor: '#002050' }}>Créer mon premier CV</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {cvs.map(cv => {
              const tmpl = TEMPLATES.find(t => t.id === cv.template_id);
              const Icon = tmpl?.icon || FileText;
              return (
                <div key={cv.id} className="bg-white rounded-2xl border p-5 hover:shadow-md transition-shadow" style={{ borderColor: '#E4E7EC' }}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(0,32,80,0.08)' }}>
                        <Icon size={20} style={{ color: '#002050' }} />
                      </div>
                      <div>
                        <div className="font-semibold" style={{ color: '#002050' }}>{cv.title}</div>
                        <div className="text-xs" style={{ color: '#6B7280' }}>{tmpl?.name || cv.template_id}{cv.with_photo ? ' · Avec photo' : ' · Sans photo'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs mb-4" style={{ color: '#9CA3AF' }}>Modifié le {new Date(cv.updated_at).toLocaleDateString('fr-FR')}</div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => openEditCv(cv)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ backgroundColor: '#002050', color: 'white' }}>
                      <Edit2 size={13} /> Modifier
                    </button>
                    <button onClick={() => duplicateCv(cv.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border" style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
                      <Copy size={13} /> Dupliquer
                    </button>
                    <button onClick={() => downloadPdfById(cv.id)} disabled={downloading || tokens < 1} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50" style={{ backgroundColor: '#BF8813', color: 'white' }}>
                      <Download size={13} /> {downloading ? '...' : 'PDF'}
                    </button>
                    <button onClick={() => deleteCv(cv.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ color: '#DC2626' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
            <div className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-8 cursor-pointer hover:border-[#002050] transition-colors" style={{ borderColor: '#E4E7EC' }} onClick={openNewCv}>
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
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium text-white shadow-lg" style={{ backgroundColor: '#002050' }}>
          {toast}
        </div>
      )}

      <div className="flex flex-col" style={{ width: showAi ? '35%' : showPreview ? '45%' : '55%', transition: 'width 0.3s' }}>
        <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E7EC' }}>
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setView('list')} className="flex items-center gap-2 text-sm" style={{ color: '#6B7280' }}>
              <ChevronLeft size={16} /> Mes CVs
            </button>
            <div className="flex items-center gap-2">
              <Coins size={14} style={{ color: '#BF8813' }} />
              <span className="text-sm font-bold" style={{ color: '#BF8813' }}>{tokens} jeton(s)</span>
            </div>
          </div>
          <input className="text-lg font-bold bg-transparent border-none outline-none w-full" style={{ color: '#002050' }} value={cvTitle} onChange={e => setCvTitle(e.target.value)} placeholder="Titre du CV" />
          <div className="flex items-center gap-1 mt-3">
            {STEP_LABELS.map((label, i) => {
              const n = i + 1;
              const active = n === step;
              const done = n < step;
              return (
                <button key={n} onClick={() => setStep(n)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all"
                  style={{ backgroundColor: active ? '#002050' : done ? 'rgba(0,32,80,0.08)' : 'transparent', color: active ? 'white' : done ? '#002050' : '#9CA3AF' }}>
                  {done ? <Check size={10} /> : null}{n}. {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && <Step1 data={cvData} onChange={setCvData} settings={settings} />}
          {step === 2 && <Step2 data={cvData} onChange={setCvData} completedCourses={completedCourses} certificates={certificates} />}
          {step === 3 && <Step3 data={cvData} onChange={setCvData} />}
          {step === 4 && <Step4 data={cvData} onChange={setCvData} />}
          {step === 5 && <Step5 data={cvData} onChange={setCvData} templateId={templateId} setTemplateId={setTemplateId} withPhoto={withPhoto} setWithPhoto={setWithPhoto} />}
        </div>

        <div className="bg-white border-t px-6 py-4 flex items-center justify-between" style={{ borderColor: '#E4E7EC' }}>
          <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border font-medium text-sm disabled:opacity-40" style={{ borderColor: '#E4E7EC', color: '#374151' }}>
            <ChevronLeft size={16} /> Précédent
          </button>
          <div className="flex gap-2">
            <button onClick={() => setShowAi(v => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border"
              style={{ borderColor: showAi ? '#BF8813' : '#E4E7EC', color: showAi ? '#BF8813' : '#6B7280', backgroundColor: showAi ? 'rgba(191,136,19,0.05)' : 'white' }}>
              <Sparkles size={14} /> IA
            </button>
            <button onClick={() => setShowPreview(v => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border"
              style={{ borderColor: showPreview ? '#002050' : '#E4E7EC', color: showPreview ? '#002050' : '#6B7280', backgroundColor: showPreview ? 'rgba(0,32,80,0.05)' : 'white' }}>
              <Eye size={14} /> Aperçu
            </button>
            <button onClick={saveCV} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border disabled:opacity-50" style={{ borderColor: '#E4E7EC', color: '#374151' }}>
              {saving ? '⏳' : '💾'} Sauvegarder
            </button>
            <button onClick={downloadPdf} disabled={downloading} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: '#BF8813' }}>
              <Download size={14} />
              {downloading ? 'Génération...' : `PDF (${tokens} jeton${tokens !== 1 ? 's' : ''})`}
            </button>
          </div>
          <button onClick={() => step === TOTAL_STEPS ? saveCV() : setStep(s => Math.min(TOTAL_STEPS, s + 1))} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm text-white" style={{ backgroundColor: '#002050' }}>
            {step === TOTAL_STEPS ? 'Terminer' : 'Suivant'} <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {showAi && (
        <div className="bg-white border-l overflow-y-auto p-5" style={{ width: '25%', borderColor: '#E4E7EC' }}>
          <AiPanel onResult={(text, action) => {
            setAiResult(text);
            showToast('✓ Résultat copié dans le presse-papier');
            navigator.clipboard?.writeText(text);
          }} />
        </div>
      )}

      {showPreview && (
        <div className="bg-white border-l overflow-hidden flex flex-col" style={{ flex: 1, borderColor: '#E4E7EC' }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: '#E4E7EC' }}>
            <span className="text-sm font-semibold" style={{ color: '#002050' }}>Aperçu — {TEMPLATES.find(t => t.id === templateId)?.name}</span>
            <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#E4F1EA', color: '#1E7A52' }}>Gratuit</span>
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
