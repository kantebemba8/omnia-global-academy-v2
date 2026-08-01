import React from 'react';

// ─── TYPES ───────────────────────────────────────────────
export interface LmData {
  sender: { name: string; address: string; phone: string; email: string; city: string; date: string; };
  recipient: { name: string; company: string; address: string; };
  subject: string;
  salutation: string;
  intro: string;
  motivation: string;
  skills_paragraph: string;
  company_link: string;
  availability: string;
  closing: string;
  signature: string;
  career_meta?: Record<string, unknown>;
  manual_layout?: unknown;
  manual_layouts?: Record<string, unknown>;
}

export interface LmDesign {
  colors: { primary: string; accent: string; sidebar: string; text: string; background: string; };
  font: string;
  font_size_body: number;
  line_spacing: number;
  document_mode?: 'creative' | 'balanced' | 'ats';
  page_format?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  margins?: { top: number; right: number; bottom: number; left: number };
  letter_spacing?: number;
  paragraph_spacing?: number;
  section_spacing?: number;
  density?: 'compact' | 'balanced' | 'spacious';
  page_numbers?: boolean;
  footer_text?: string;
  border_width?: number;
  border_color?: string;
  editor_mode?: 'template' | 'manual';
}

function formatDate(d: string) {
  if (!d) return new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return d; }
}

// ══════════════════════════════════════════════════════════
// 1. LM CLASSIC PRO — sobre, bleu foncé
// ══════════════════════════════════════════════════════════
export function LmClassicPro({ data, design }: { data: LmData; design: LmDesign }) {
  const c = design.colors;
  const fs = design.font_size_body;
  const font = design.font === 'georgia' ? 'Georgia, serif' : 'Arial, sans-serif';

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily: font, fontSize: fs, background: '#fff', padding: '50px 56px' }}>
      {/* En-tête expéditeur */}
      <div style={{ marginBottom: 30 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: c.primary }}>{data.sender?.name || 'Votre Nom'}</div>
        <div style={{ fontSize: 9, color: '#6B7280', marginTop: 3 }}>{data.sender?.address}</div>
        <div style={{ fontSize: 9, color: '#6B7280' }}>{data.sender?.phone} · {data.sender?.email}</div>
        <div style={{ height: 2, background: c.accent, width: 60, marginTop: 10 }} />
      </div>

      {/* Destinataire + date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#374151' }}>{data.recipient?.name || 'Monsieur / Madame le Recruteur'}</div>
          <div style={{ fontSize: 9, color: '#6B7280' }}>{data.recipient?.company}</div>
          <div style={{ fontSize: 9, color: '#6B7280' }}>{data.recipient?.address}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: '#6B7280' }}>{data.sender?.city}, le {formatDate(data.sender?.date)}</div>
        </div>
      </div>

      {/* Objet */}
      {data.subject && (
        <div style={{ marginBottom: 22 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#374151' }}>Objet : </span>
          <span style={{ fontSize: 9, color: '#374151', fontStyle: 'italic' }}>{data.subject}</span>
        </div>
      )}

      {/* Formule d'appel */}
      <div style={{ fontSize: fs, color: '#374151', marginBottom: 16 }}>{data.salutation || 'Madame, Monsieur,'}</div>

      {/* Corps */}
      {data.intro && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.intro}</p>}
      {data.motivation && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.motivation}</p>}
      {data.skills_paragraph && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.skills_paragraph}</p>}
      {data.company_link && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.company_link}</p>}
      {data.availability && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.availability}</p>}

      {/* Formule de politesse */}
      <div style={{ fontSize: fs, color: '#374151', marginTop: 20, marginBottom: 40 }}>{data.closing || "Dans l'attente de votre retour, je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées."}</div>

      {/* Signature */}
      <div style={{ fontSize: 12, fontWeight: 700, color: c.primary, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>{data.signature || data.sender?.name}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 2. LM MODERN STUDENT — dégradé, jeune
// ══════════════════════════════════════════════════════════
export function LmModernStudent({ data, design }: { data: LmData; design: LmDesign }) {
  const c = design.colors;
  const fs = design.font_size_body;

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily: 'Arial, sans-serif', fontSize: fs, background: '#fff' }}>
      {/* Bandeau header */}
      <div style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.accent})`, padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, color: 'white' }}>{data.sender?.name || 'Votre Nom'}</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>{data.sender?.email} · {data.sender?.phone}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)' }}>{data.sender?.city}, le {formatDate(data.sender?.date)}</div>
        </div>
      </div>

      <div style={{ padding: '36px 48px' }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#374151' }}>{data.recipient?.name || 'À l\'attention du Recruteur'}</div>
          <div style={{ fontSize: 9, color: '#6B7280' }}>{data.recipient?.company}</div>
          <div style={{ fontSize: 9, color: '#6B7280' }}>{data.recipient?.address}</div>
        </div>

        {data.subject && (
          <div style={{ padding: '8px 14px', background: `${c.accent}15`, borderLeft: `3px solid ${c.accent}`, marginBottom: 22, borderRadius: 3 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: c.primary }}>Objet : </span>
            <span style={{ fontSize: 9, color: '#374151' }}>{data.subject}</span>
          </div>
        )}

        <div style={{ fontSize: fs, color: '#374151', marginBottom: 16 }}>{data.salutation || 'Madame, Monsieur,'}</div>
        {data.intro && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.intro}</p>}
        {data.motivation && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.motivation}</p>}
        {data.skills_paragraph && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.skills_paragraph}</p>}
        {data.company_link && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.company_link}</p>}
        {data.availability && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.availability}</p>}
        <div style={{ fontSize: fs, color: '#374151', marginTop: 20, marginBottom: 36 }}>{data.closing || "Dans l'attente de votre retour, je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées."}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: c.primary, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>{data.signature || data.sender?.name}</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 3. LM CORPORATE BLUE — marine, sérieux
// ══════════════════════════════════════════════════════════
export function LmCorporateBlue({ data, design }: { data: LmData; design: LmDesign }) {
  const c = design.colors;
  const fs = design.font_size_body;

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily: 'Arial, sans-serif', fontSize: fs, background: '#fff' }}>
      <div style={{ background: c.primary, padding: '20px 40px', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: 'white' }}>{data.sender?.name || 'Votre Nom'}</div>
          <div style={{ fontSize: 8, color: c.accent, marginTop: 2 }}>{data.sender?.email} · {data.sender?.phone}</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{data.sender?.address}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 8, color: 'rgba(255,255,255,0.7)' }}>
          <div>{data.sender?.city}</div>
          <div>{formatDate(data.sender?.date)}</div>
        </div>
      </div>

      <div style={{ padding: '36px 48px' }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#374151' }}>{data.recipient?.name || 'À l\'attention du Recruteur'}</div>
          <div style={{ fontSize: 9, color: '#6B7280' }}>{data.recipient?.company}</div>
          <div style={{ fontSize: 9, color: '#6B7280' }}>{data.recipient?.address}</div>
        </div>

        {data.subject && (
          <div style={{ marginBottom: 22 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: c.primary }}>Objet : </span>
            <span style={{ fontSize: 9, color: '#374151', textDecoration: 'underline' }}>{data.subject}</span>
          </div>
        )}

        <div style={{ fontSize: fs, color: '#374151', marginBottom: 16 }}>{data.salutation || 'Madame, Monsieur,'}</div>
        {data.intro && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.intro}</p>}
        {data.motivation && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.motivation}</p>}
        {data.skills_paragraph && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.skills_paragraph}</p>}
        {data.company_link && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.company_link}</p>}
        {data.availability && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.availability}</p>}
        <div style={{ fontSize: fs, color: '#374151', marginTop: 20, marginBottom: 36 }}>{data.closing || "Dans l'attente de votre retour, je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées."}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: c.primary, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>{data.signature || data.sender?.name}</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 4. LM MINIMAL LUXE — épuré, blanc
// ══════════════════════════════════════════════════════════
export function LmMinimalLuxe({ data, design }: { data: LmData; design: LmDesign }) {
  const fs = design.font_size_body;

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily: design.font === 'georgia' ? 'Georgia, serif' : 'Arial, sans-serif', fontSize: fs, background: '#fff', padding: '60px 70px' }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#212121', letterSpacing: '-0.01em' }}>{data.sender?.name || 'Votre Nom'}</div>
        <div style={{ fontSize: 8, color: '#9CA3AF', marginTop: 4, letterSpacing: '0.1em' }}>{data.sender?.email} · {data.sender?.phone} · {data.sender?.address}</div>
        <div style={{ height: 1, background: '#212121', marginTop: 14 }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 36 }}>
        <div style={{ fontSize: 9, color: '#6B7280', lineHeight: 1.6 }}>
          <div>{data.recipient?.name || 'À l\'attention du Recruteur'}</div>
          <div>{data.recipient?.company}</div>
          <div>{data.recipient?.address}</div>
        </div>
        <div style={{ fontSize: 9, color: '#9CA3AF', textAlign: 'right' }}>
          <div>{data.sender?.city}, le {formatDate(data.sender?.date)}</div>
        </div>
      </div>

      {data.subject && <div style={{ fontSize: 9, color: '#212121', fontWeight: 700, marginBottom: 28, fontStyle: 'italic' }}>Objet : {data.subject}</div>}

      <div style={{ fontSize: fs, color: '#374151', marginBottom: 18 }}>{data.salutation || 'Madame, Monsieur,'}</div>
      {data.intro && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 16, textAlign: 'justify' }}>{data.intro}</p>}
      {data.motivation && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 16, textAlign: 'justify' }}>{data.motivation}</p>}
      {data.skills_paragraph && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 16, textAlign: 'justify' }}>{data.skills_paragraph}</p>}
      {data.company_link && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 16, textAlign: 'justify' }}>{data.company_link}</p>}
      {data.availability && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 16, textAlign: 'justify' }}>{data.availability}</p>}
      <div style={{ fontSize: fs, color: '#374151', marginTop: 24, marginBottom: 48 }}>{data.closing || "Dans l'attente de votre retour, je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées."}</div>
      <div style={{ fontSize: 13, fontWeight: 400, color: '#212121', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>{data.signature || data.sender?.name}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 5. LM AFRICA GOLD — sidebar noire, accents dorés
// ══════════════════════════════════════════════════════════
export function LmAfricaGold({ data, design }: { data: LmData; design: LmDesign }) {
  const c = design.colors;
  const fs = design.font_size_body;
  const dark = c.primary || '#0D1B2A';
  const gold = c.accent || '#BF8813';

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily: 'Arial, sans-serif', fontSize: fs, background: '#fff', display: 'flex' }}>
      {/* Mini sidebar */}
      <div style={{ width: 160, minWidth: 160, background: dark, padding: '36px 14px' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: 'white', lineHeight: 1.3 }}>{data.sender?.name || 'Votre Nom'}</div>
          <div style={{ width: 24, height: 2, background: gold, marginTop: 8 }} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 7, fontWeight: 700, color: gold, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Contact</div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.75)', marginBottom: 5, wordBreak: 'break-all' }}>{data.sender?.email}</div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.75)', marginBottom: 5 }}>{data.sender?.phone}</div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.75)' }}>{data.sender?.address}</div>
        </div>
        <div>
          <div style={{ fontSize: 7, fontWeight: 700, color: gold, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Date</div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.75)' }}>{data.sender?.city}</div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.75)', marginTop: 3 }}>{formatDate(data.sender?.date)}</div>
        </div>
      </div>

      {/* Contenu */}
      <div style={{ flex: 1, padding: '36px 32px' }}>
        <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: `2px solid ${gold}` }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#374151' }}>{data.recipient?.name || 'À l\'attention du Recruteur'}</div>
          <div style={{ fontSize: 9, color: '#6B7280' }}>{data.recipient?.company}</div>
          <div style={{ fontSize: 9, color: '#6B7280' }}>{data.recipient?.address}</div>
        </div>
        {data.subject && (
          <div style={{ marginBottom: 20, padding: '6px 12px', borderLeft: `3px solid ${gold}`, background: `${gold}08` }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: dark }}>Objet : </span>
            <span style={{ fontSize: 9, color: '#374151', fontStyle: 'italic' }}>{data.subject}</span>
          </div>
        )}
        <div style={{ fontSize: fs, color: '#374151', marginBottom: 16 }}>{data.salutation || 'Madame, Monsieur,'}</div>
        {data.intro && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.intro}</p>}
        {data.motivation && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.motivation}</p>}
        {data.skills_paragraph && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.skills_paragraph}</p>}
        {data.company_link && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.company_link}</p>}
        {data.availability && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.availability}</p>}
        <div style={{ fontSize: fs, color: '#374151', marginTop: 20, marginBottom: 36 }}>{data.closing || "Dans l'attente de votre retour, je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées."}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: dark, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>{data.signature || data.sender?.name}</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 6-10. LM Tech/Cyber/Data/Creative/ATS — style neutre
// ══════════════════════════════════════════════════════════
function LmGeneric({ data, design, accentTop, darkHeader }: { data: LmData; design: LmDesign; accentTop?: string; darkHeader?: boolean }) {
  const c = design.colors;
  const fs = design.font_size_body;
  const headerBg = darkHeader ? c.primary : '#F8F9FA';
  const headerText = darkHeader ? 'white' : c.primary;

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily: 'Arial, sans-serif', fontSize: fs, background: '#fff' }}>
      {accentTop && <div style={{ height: 4, background: accentTop }} />}
      <div style={{ background: headerBg, padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, color: headerText }}>{data.sender?.name || 'Votre Nom'}</div>
          <div style={{ fontSize: 8, color: darkHeader ? `${c.accent}` : '#6B7280', marginTop: 2 }}>{data.sender?.email} · {data.sender?.phone}</div>
        </div>
        <div style={{ fontSize: 8, color: darkHeader ? 'rgba(255,255,255,0.7)' : '#9CA3AF', textAlign: 'right' }}>
          <div>{data.sender?.city}</div>
          <div>{formatDate(data.sender?.date)}</div>
        </div>
      </div>

      <div style={{ padding: '32px 48px' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#374151' }}>{data.recipient?.name || 'À l\'attention du Recruteur'}</div>
          <div style={{ fontSize: 9, color: '#6B7280' }}>{data.recipient?.company}</div>
          <div style={{ fontSize: 9, color: '#6B7280' }}>{data.recipient?.address}</div>
        </div>
        {data.subject && (
          <div style={{ marginBottom: 20, borderLeft: `3px solid ${c.accent}`, paddingLeft: 10 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: c.primary }}>Objet : </span>
            <span style={{ fontSize: 9, color: '#374151' }}>{data.subject}</span>
          </div>
        )}
        <div style={{ fontSize: fs, color: '#374151', marginBottom: 16 }}>{data.salutation || 'Madame, Monsieur,'}</div>
        {data.intro && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.intro}</p>}
        {data.motivation && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.motivation}</p>}
        {data.skills_paragraph && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.skills_paragraph}</p>}
        {data.company_link && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.company_link}</p>}
        {data.availability && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.availability}</p>}
        <div style={{ fontSize: fs, color: '#374151', marginTop: 20, marginBottom: 40 }}>{data.closing || "Dans l'attente de votre retour, je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées."}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: c.primary, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>{data.signature || data.sender?.name}</div>
      </div>
    </div>
  );
}

export function LmTechFuture({ data, design }: { data: LmData; design: LmDesign }) {
  return <LmGeneric data={data} design={design} darkHeader accentTop={design.colors.accent} />;
}
export function LmCyberSecurity({ data, design }: { data: LmData; design: LmDesign }) {
  return <LmGeneric data={data} design={design} darkHeader accentTop={design.colors.accent} />;
}
export function LmDataAnalyst({ data, design }: { data: LmData; design: LmDesign }) {
  return <LmGeneric data={data} design={design} accentTop={`linear-gradient(to right, ${design.colors.primary}, ${design.colors.accent})`} />;
}
export function LmCreativeDigital({ data, design }: { data: LmData; design: LmDesign }) {
  return <LmGeneric data={data} design={design} accentTop={`linear-gradient(to right, ${design.colors.primary}, ${design.colors.accent})`} />;
}
export function LmAtsSimple({ data, design }: { data: LmData; design: LmDesign }) {
  const fs = design.font_size_body;
  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily: 'Arial, sans-serif', fontSize: fs, background: '#fff', padding: '50px 60px' }}>
      <div style={{ marginBottom: 30, paddingBottom: 16, borderBottom: '2px solid #374151' }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: '#212121' }}>{data.sender?.name || 'Votre Nom'}</div>
        <div style={{ fontSize: 9, color: '#6B7280', marginTop: 4 }}>{[data.sender?.email, data.sender?.phone, data.sender?.address].filter(Boolean).join(' | ')}</div>
        <div style={{ textAlign: 'right', fontSize: 9, color: '#6B7280', marginTop: 4 }}>{data.sender?.city}, le {formatDate(data.sender?.date)}</div>
      </div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#374151' }}>{data.recipient?.name || 'À l\'attention du Recruteur'}</div>
        <div style={{ fontSize: 9, color: '#6B7280' }}>{data.recipient?.company}</div>
        <div style={{ fontSize: 9, color: '#6B7280' }}>{data.recipient?.address}</div>
      </div>
      {data.subject && <div style={{ fontSize: 9, fontWeight: 700, color: '#212121', marginBottom: 22 }}>Objet : {data.subject}</div>}
      <div style={{ fontSize: fs, color: '#374151', marginBottom: 16 }}>{data.salutation || 'Madame, Monsieur,'}</div>
      {data.intro && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.intro}</p>}
      {data.motivation && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.motivation}</p>}
      {data.skills_paragraph && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.skills_paragraph}</p>}
      {data.company_link && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.company_link}</p>}
      {data.availability && <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, marginBottom: 14, textAlign: 'justify' }}>{data.availability}</p>}
      <div style={{ fontSize: fs, color: '#374151', marginTop: 20, marginBottom: 40 }}>{data.closing || "Dans l'attente de votre retour, je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées."}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#212121' }}>{data.signature || data.sender?.name}</div>
    </div>
  );
}

export const LM_TEMPLATE_MAP_1_10: Record<string, React.ComponentType<{ data: LmData; design: LmDesign }>> = {
  lm_classic_pro: LmClassicPro,
  lm_modern_student: LmModernStudent,
  lm_corporate_blue: LmCorporateBlue,
  lm_minimal_luxe: LmMinimalLuxe,
  lm_africa_gold: LmAfricaGold,
  lm_tech_future: LmTechFuture,
  lm_cyber_security: LmCyberSecurity,
  lm_data_analyst: LmDataAnalyst,
  lm_creative_digital: LmCreativeDigital,
  lm_no_photo_ats: LmAtsSimple,
};
