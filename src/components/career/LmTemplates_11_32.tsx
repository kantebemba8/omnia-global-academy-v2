import React from 'react';
import { LmData, LmDesign } from './LmTemplates_1_10';

function formatDate(d: string) {
  if (!d) return new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return d; }
}

// Composant LM réutilisable avec variantes visuelles
function LmBase({ data, design, variant }: {
  data: LmData;
  design: LmDesign;
  variant: 'sidebar_left' | 'header_color' | 'minimal' | 'border_top' | 'classic';
}) {
  const c = design.colors;
  const fs = design.font_size_body;
  const font = design.font === 'georgia' ? 'Georgia, serif' : 'Arial, sans-serif';

  const bodyContent = (
    <>
      <div style={{ fontSize: fs, color: '#374151', marginBottom: 16 }}>{data.salutation || 'Madame, Monsieur,'}</div>
      {data.intro && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.intro}</p>}
      {data.motivation && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.motivation}</p>}
      {data.skills_paragraph && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.skills_paragraph}</p>}
      {data.company_link && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.company_link}</p>}
      {data.availability && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.availability}</p>}
      <div style={{ fontSize: fs, color: '#374151', marginTop: 20, marginBottom: 40 }}>{data.closing || "Dans l'attente de votre retour, je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées."}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: c.primary, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>{data.signature || data.sender?.name}</div>
    </>
  );

  if (variant === 'sidebar_left') {
    return (
      <div style={{ width: 794, minHeight: 1123, fontFamily: font, fontSize: fs, background: '#fff', display: 'flex' }}>
        <div style={{ width: 170, minWidth: 170, background: c.primary, padding: '32px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: 'white', marginBottom: 6, lineHeight: 1.3 }}>{data.sender?.name || 'Votre Nom'}</div>
          <div style={{ width: 20, height: 2, background: c.accent, marginBottom: 20 }} />
          <div style={{ fontSize: 7, color: c.accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Contact</div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.75)', marginBottom: 4, wordBreak: 'break-all' }}>{data.sender?.email}</div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}>{data.sender?.phone}</div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.75)', marginBottom: 20 }}>{data.sender?.address}</div>
          <div style={{ fontSize: 7, color: c.accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Date</div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.75)' }}>{data.sender?.city}</div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.75)', marginTop: 3 }}>{formatDate(data.sender?.date)}</div>
        </div>
        <div style={{ flex: 1, padding: '32px 28px' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#374151' }}>{data.recipient?.name || 'À l\'attention du Recruteur'}</div>
            <div style={{ fontSize: 9, color: '#6B7280' }}>{data.recipient?.company}</div>
            <div style={{ fontSize: 9, color: '#6B7280' }}>{data.recipient?.address}</div>
          </div>
          {data.subject && <div style={{ marginBottom: 18, borderLeft: `3px solid ${c.accent}`, paddingLeft: 10, fontSize: 9 }}><span style={{ fontWeight: 700, color: c.primary }}>Objet : </span><span style={{ color: '#374151' }}>{data.subject}</span></div>}
          {bodyContent}
        </div>
      </div>
    );
  }

  if (variant === 'header_color') {
    return (
      <div style={{ width: 794, minHeight: 1123, fontFamily: font, fontSize: fs, background: '#fff' }}>
        <div style={{ background: c.primary, padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: 'white' }}>{data.sender?.name || 'Votre Nom'}</div>
            <div style={{ fontSize: 8, color: c.accent, marginTop: 2 }}>{data.sender?.email} · {data.sender?.phone}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 8, color: 'rgba(255,255,255,0.7)' }}>
            <div>{data.sender?.city}, le {formatDate(data.sender?.date)}</div>
          </div>
        </div>
        <div style={{ padding: '32px 48px' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#374151' }}>{data.recipient?.name || 'À l\'attention du Recruteur'}</div>
            <div style={{ fontSize: 9, color: '#6B7280' }}>{data.recipient?.company}</div>
            <div style={{ fontSize: 9, color: '#6B7280' }}>{data.recipient?.address}</div>
          </div>
          {data.subject && <div style={{ marginBottom: 18, fontSize: 9 }}><span style={{ fontWeight: 700, color: c.primary }}>Objet : </span><span style={{ color: '#374151', fontStyle: 'italic' }}>{data.subject}</span></div>}
          {bodyContent}
        </div>
      </div>
    );
  }

  if (variant === 'border_top') {
    return (
      <div style={{ width: 794, minHeight: 1123, fontFamily: font, fontSize: fs, background: '#fff' }}>
        <div style={{ height: 5, background: `linear-gradient(to right, ${c.primary}, ${c.accent})` }} />
        <div style={{ padding: '36px 52px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28, paddingBottom: 16, borderBottom: `1px solid #E4E7EC` }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: c.primary }}>{data.sender?.name || 'Votre Nom'}</div>
              <div style={{ fontSize: 8, color: '#6B7280', marginTop: 3 }}>{data.sender?.email} · {data.sender?.phone} · {data.sender?.address}</div>
            </div>
            <div style={{ fontSize: 8, color: '#9CA3AF', textAlign: 'right' }}>
              <div>{data.sender?.city}</div>
              <div>{formatDate(data.sender?.date)}</div>
            </div>
          </div>
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#374151' }}>{data.recipient?.name || 'À l\'attention du Recruteur'}</div>
            <div style={{ fontSize: 9, color: '#6B7280' }}>{data.recipient?.company}</div>
            <div style={{ fontSize: 9, color: '#6B7280' }}>{data.recipient?.address}</div>
          </div>
          {data.subject && <div style={{ marginBottom: 20, padding: '6px 12px', background: `${c.accent}10`, borderRadius: 3, fontSize: 9 }}><span style={{ fontWeight: 700, color: c.primary }}>Objet : </span><span style={{ color: '#374151' }}>{data.subject}</span></div>}
          {bodyContent}
        </div>
      </div>
    );
  }

  // classic / minimal
  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily: font, fontSize: fs, background: '#fff', padding: '48px 56px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, color: c.primary }}>{data.sender?.name || 'Votre Nom'}</div>
          <div style={{ fontSize: 8, color: '#6B7280', marginTop: 3 }}>{data.sender?.email}</div>
          <div style={{ fontSize: 8, color: '#6B7280' }}>{data.sender?.phone}</div>
          <div style={{ fontSize: 8, color: '#6B7280' }}>{data.sender?.address}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 8, color: '#9CA3AF' }}>
          <div>{data.sender?.city}, le {formatDate(data.sender?.date)}</div>
        </div>
      </div>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#374151' }}>{data.recipient?.name || 'À l\'attention du Recruteur'}</div>
        <div style={{ fontSize: 9, color: '#6B7280' }}>{data.recipient?.company}</div>
        <div style={{ fontSize: 9, color: '#6B7280' }}>{data.recipient?.address}</div>
      </div>
      {data.subject && <div style={{ marginBottom: 20, fontSize: 9 }}><span style={{ fontWeight: 700, color: c.primary }}>Objet : </span><span style={{ color: '#374151', fontStyle: 'italic' }}>{data.subject}</span></div>}
      <div style={{ height: 2, background: c.accent, width: 50, marginBottom: 20 }} />
      {bodyContent}
    </div>
  );
}

// ── LM 11-20 : assorties aux CV 11-20 ────────────────────
export function LmPhotoElegant({ data, design }: { data: LmData; design: LmDesign }) { return <LmBase data={data} design={design} variant="sidebar_left" />; }
export function LmYoungGraduate({ data, design }: { data: LmData; design: LmDesign }) { return <LmBase data={data} design={design} variant="border_top" />; }
export function LmInternshipReady({ data, design }: { data: LmData; design: LmDesign }) { return <LmBase data={data} design={design} variant="border_top" />; }
export function LmInternational({ data, design }: { data: LmData; design: LmDesign }) { return <LmBase data={data} design={design} variant="sidebar_left" />; }
export function LmQhse({ data, design }: { data: LmData; design: LmDesign }) { return <LmBase data={data} design={design} variant="classic" />; }
export function LmBusinessManager({ data, design }: { data: LmData; design: LmDesign }) { return <LmBase data={data} design={design} variant="sidebar_left" />; }
export function LmHospitality({ data, design }: { data: LmData; design: LmDesign }) { return <LmBase data={data} design={design} variant="header_color" />; }
export function LmAcademic({ data, design }: { data: LmData; design: LmDesign }) { return <LmBase data={data} design={design} variant="classic" />; }
export function LmFreelancer({ data, design }: { data: LmData; design: LmDesign }) { return <LmBase data={data} design={design} variant="sidebar_left" />; }
export function LmExecutive({ data, design }: { data: LmData; design: LmDesign }) { return <LmBase data={data} design={design} variant="sidebar_left" />; }

// ── LM 21-32 : lettres classiques ────────────────────────
export function LmStageSimple({ data, design }: { data: LmData; design: LmDesign }) { return <LmBase data={data} design={design} variant="classic" />; }
export function LmPremierEmploi({ data, design }: { data: LmData; design: LmDesign }) { return <LmBase data={data} design={design} variant="border_top" />; }
export function LmAlternance({ data, design }: { data: LmData; design: LmDesign }) { return <LmBase data={data} design={design} variant="border_top" />; }
export function LmSpontanee({ data, design }: { data: LmData; design: LmDesign }) { return <LmBase data={data} design={design} variant="classic" />; }
export function LmQhseRse({ data, design }: { data: LmData; design: LmDesign }) { return <LmBase data={data} design={design} variant="classic" />; }
export function LmTechData({ data, design }: { data: LmData; design: LmDesign }) { return <LmBase data={data} design={design} variant="header_color" />; }
export function LmHotellerie({ data, design }: { data: LmData; design: LmDesign }) { return <LmBase data={data} design={design} variant="header_color" />; }
export function LmAdministration({ data, design }: { data: LmData; design: LmDesign }) { return <LmBase data={data} design={design} variant="classic" />; }
export function LmFinanceBanque({ data, design }: { data: LmData; design: LmDesign }) { return <LmBase data={data} design={design} variant="sidebar_left" />; }
export function LmInternationale({ data, design }: { data: LmData; design: LmDesign }) { return <LmBase data={data} design={design} variant="sidebar_left" />; }
export function LmCourtePremium({ data, design }: { data: LmData; design: LmDesign }) { return <LmBase data={data} design={design} variant="border_top" />; }
export function LmProClassique({ data, design }: { data: LmData; design: LmDesign }) { return <LmBase data={data} design={design} variant="classic" />; }

export const LM_TEMPLATE_MAP_11_32: Record<string, React.ComponentType<{ data: LmData; design: LmDesign }>> = {
  // Assorties 11-20
  lm_photo_elegant: LmPhotoElegant,
  lm_young_graduate: LmYoungGraduate,
  lm_internship_ready: LmInternshipReady,
  lm_international: LmInternational,
  lm_qhse: LmQhse,
  lm_business_manager: LmBusinessManager,
  lm_hospitality: LmHospitality,
  lm_academic: LmAcademic,
  lm_freelancer: LmFreelancer,
  lm_executive: LmExecutive,
  // Classiques 21-32
  lm_stage_simple: LmStageSimple,
  lm_premier_emploi: LmPremierEmploi,
  lm_alternance: LmAlternance,
  lm_spontanee: LmSpontanee,
  lm_qhse_rse: LmQhseRse,
  lm_tech_data: LmTechData,
  lm_hotellerie: LmHotellerie,
  lm_administration: LmAdministration,
  lm_finance_banque: LmFinanceBanque,
  lm_internationale: LmInternationale,
  lm_courte_premium: LmCourtePremium,
  lm_pro_classique: LmProClassique,
};
