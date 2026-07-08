import React from 'react';

// ─── TYPES ───────────────────────────────────────────────
export interface DocData {
  name: string;
  title: string;
  objective?: string;
  summary: string;
  photo_url?: string;
  contact: { email: string; phone: string; location: string; linkedin?: string; portfolio?: string; };
  experiences: Array<{ id: string; position: string; company: string; location?: string; start_date: string; end_date?: string; current: boolean; description: string; }>;
  education: Array<{ id: string; degree: string; school: string; location?: string; year: string; }>;
  omnia_formations: Array<{ id: string; title: string; completed_at: string; cpd_accredited: boolean; certificate_id?: string; show: boolean; }>;
  skills: Array<{ id: string; name: string; level: number; }>;
  languages: Array<{ id: string; name: string; level: string; }>;
  certifications_external: Array<{ id: string; name: string; issuer: string; year: string; }>;
  projects: Array<{ id: string; name: string; description: string; technologies?: string; }>;
  interests: string[];
  references?: string;
}

export interface DesignOptions {
  colors: { primary: string; accent: string; sidebar: string; text: string; background: string; };
  font: string;
  font_size_body: number;
  font_size_title: number;
  line_spacing: number;
  photo_enabled: boolean;
  photo_shape: 'round' | 'square' | 'rectangle';
  pages: 1 | 2;
}

function fmtDate(s: string) {
  if (!s) return '';
  try { return new Date(s).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }); }
  catch { return s; }
}

function Avatar({ name, photoUrl, size, shape, borderColor }: { name: string; photoUrl?: string; size: number; shape: 'round' | 'square' | 'rectangle'; borderColor?: string; }) {
  const radius = shape === 'round' ? '50%' : shape === 'square' ? '8px' : '4px';
  const initials = (name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return photoUrl ? (
    <img src={photoUrl} style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', border: borderColor ? `3px solid ${borderColor}` : 'none', display: 'block' }} alt="" />
  ) : (
    <div style={{ width: size, height: size, borderRadius: radius, background: borderColor || '#002050', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.3, fontWeight: 900, color: 'white' }}>
      {initials}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 1. CLASSIC PRO
// Style sobre et professionnel, sidebar grise, titres bleu foncé
// ══════════════════════════════════════════════════════════
export function ClassicPro({ data, design }: { data: DocData; design: DesignOptions }) {
  const c = design.colors;
  const fs = design.font_size_body;
  const fontFamily = design.font === 'georgia' ? 'Georgia, serif' : 'Arial, sans-serif';

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily, fontSize: fs, background: '#fff', display: 'flex' }}>
      {/* Sidebar */}
      <div style={{ width: 210, minWidth: 210, background: c.sidebar || '#F0F4F8', padding: '32px 16px' }}>
        {design.photo_enabled && (
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <Avatar name={data.name} photoUrl={data.photo_url} size={80} shape={design.photo_shape} borderColor={c.accent} />
          </div>
        )}
        {/* Contact */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: c.primary, letterSpacing: '0.12em', textTransform: 'uppercase', borderBottom: `2px solid ${c.accent}`, paddingBottom: 4, marginBottom: 10 }}>Contact</div>
          {data.contact.email && <div style={{ fontSize: 8, color: '#374151', marginBottom: 5, display: 'flex', gap: 5, alignItems: 'flex-start' }}><span style={{ color: c.accent }}>✉</span><span style={{ wordBreak: 'break-all' }}>{data.contact.email}</span></div>}
          {data.contact.phone && <div style={{ fontSize: 8, color: '#374151', marginBottom: 5, display: 'flex', gap: 5 }}><span style={{ color: c.accent }}>☎</span>{data.contact.phone}</div>}
          {data.contact.location && <div style={{ fontSize: 8, color: '#374151', marginBottom: 5, display: 'flex', gap: 5 }}><span style={{ color: c.accent }}>⊙</span>{data.contact.location}</div>}
          {data.contact.linkedin && <div style={{ fontSize: 8, color: c.accent, marginBottom: 5 }}>in LinkedIn</div>}
          {data.contact.portfolio && <div style={{ fontSize: 8, color: c.accent, marginBottom: 5 }}>🌐 Portfolio</div>}
        </div>
        {/* Compétences */}
        {data.skills.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: c.primary, letterSpacing: '0.12em', textTransform: 'uppercase', borderBottom: `2px solid ${c.accent}`, paddingBottom: 4, marginBottom: 10 }}>Compétences</div>
            {data.skills.map(s => (
              <div key={s.id} style={{ marginBottom: 7 }}>
                <div style={{ fontSize: 8, color: '#374151', marginBottom: 2, display: 'flex', justifyContent: 'space-between' }}><span>{s.name}</span><span style={{ color: c.accent }}>{s.level}%</span></div>
                <div style={{ background: '#E4E7EC', borderRadius: 3, height: 3 }}><div style={{ background: c.accent, borderRadius: 3, height: 3, width: `${s.level}%` }} /></div>
              </div>
            ))}
          </div>
        )}
        {/* Langues */}
        {data.languages.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: c.primary, letterSpacing: '0.12em', textTransform: 'uppercase', borderBottom: `2px solid ${c.accent}`, paddingBottom: 4, marginBottom: 10 }}>Langues</div>
            {data.languages.map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 8 }}>
                <span style={{ fontWeight: 600, color: '#374151' }}>{l.name}</span>
                <span style={{ color: c.accent }}>{l.level}</span>
              </div>
            ))}
          </div>
        )}
        {/* Certifications */}
        {data.certifications_external.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: c.primary, letterSpacing: '0.12em', textTransform: 'uppercase', borderBottom: `2px solid ${c.accent}`, paddingBottom: 4, marginBottom: 10 }}>Certifications</div>
            {data.certifications_external.map(cert => (
              <div key={cert.id} style={{ marginBottom: 7, fontSize: 8 }}>
                <div style={{ fontWeight: 600, color: '#374151' }}>{cert.name}</div>
                <div style={{ color: c.accent }}>{cert.issuer} · {cert.year}</div>
              </div>
            ))}
          </div>
        )}
        {/* Intérêts */}
        {data.interests.length > 0 && (
          <div>
            <div style={{ fontSize: 8, fontWeight: 700, color: c.primary, letterSpacing: '0.12em', textTransform: 'uppercase', borderBottom: `2px solid ${c.accent}`, paddingBottom: 4, marginBottom: 10 }}>Intérêts</div>
            <div style={{ fontSize: 8, color: '#6B7280', lineHeight: 1.6 }}>{Array.isArray(data.interests) ? data.interests.join(' · ') : data.interests}</div>
          </div>
        )}
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: '32px 24px' }}>
        <div style={{ marginBottom: 20, borderBottom: `3px solid ${c.primary}`, paddingBottom: 14 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: c.primary, lineHeight: 1.1 }}>{data.name || 'Votre Nom'}</div>
          <div style={{ fontSize: 12, color: c.accent, fontWeight: 600, marginTop: 4, letterSpacing: '0.05em' }}>{data.title || 'Titre professionnel'}</div>
          {data.objective && <div style={{ fontSize: 8, color: '#9CA3AF', marginTop: 5, fontStyle: 'italic' }}>{data.objective}</div>}
        </div>
        {data.summary && (
          <Section title="Profil professionnel" primary={c.primary} accent={c.accent} fs={fs}>
            <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, textAlign: 'justify' }}>{data.summary}</p>
          </Section>
        )}
        {data.experiences.length > 0 && (
          <Section title="Expériences professionnelles" primary={c.primary} accent={c.accent} fs={fs}>
            {data.experiences.map(exp => (
              <div key={exp.id} style={{ marginBottom: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div><div style={{ fontSize: fs + 1, fontWeight: 700, color: c.primary }}>{exp.position}</div><div style={{ fontSize: fs, color: c.accent, fontWeight: 600 }}>{exp.company}{exp.location ? ` · ${exp.location}` : ''}</div></div>
                  <div style={{ fontSize: 8, color: '#9CA3AF', whiteSpace: 'nowrap', background: '#F0F4F8', padding: '2px 8px', borderRadius: 10 }}>{fmtDate(exp.start_date)} — {exp.current ? 'Présent' : fmtDate(exp.end_date || '')}</div>
                </div>
                {exp.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.6, marginTop: 3 }}>{exp.description}</p>}
              </div>
            ))}
          </Section>
        )}
        {data.omnia_formations.filter(f => f.show).length > 0 && (
          <Section title="Formations Omnia Global Academy" primary={c.primary} accent={c.accent} fs={fs}>
            {data.omnia_formations.filter(f => f.show).map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <div><div style={{ fontSize: fs, fontWeight: 700, color: c.primary }}>{f.title}</div><div style={{ fontSize: fs - 1, color: c.accent }}>Omnia Global Academy{f.cpd_accredited ? ' · CPD' : ''}</div></div>
                <div style={{ fontSize: 8, color: '#9CA3AF' }}>{fmtDate(f.completed_at)}</div>
              </div>
            ))}
          </Section>
        )}
        {data.education.length > 0 && (
          <Section title="Formation académique" primary={c.primary} accent={c.accent} fs={fs}>
            {data.education.map(edu => (
              <div key={edu.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div><div style={{ fontSize: fs, fontWeight: 700, color: c.primary }}>{edu.degree}</div><div style={{ fontSize: fs - 1, color: '#374151' }}>{edu.school}{edu.location ? ` · ${edu.location}` : ''}</div></div>
                <div style={{ fontSize: 8, color: '#9CA3AF' }}>{edu.year}</div>
              </div>
            ))}
          </Section>
        )}
        {data.projects.length > 0 && (
          <Section title="Projets" primary={c.primary} accent={c.accent} fs={fs}>
            {data.projects.map(p => (
              <div key={p.id} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: fs, fontWeight: 700, color: c.primary }}>{p.name}</div>
                {p.technologies && <div style={{ fontSize: fs - 1, color: c.accent }}>{p.technologies}</div>}
                {p.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.6, marginTop: 2 }}>{p.description}</p>}
              </div>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 2. MODERN STUDENT
// Design jeune, rose/violet, photo ronde, sections encadrées
// ══════════════════════════════════════════════════════════
export function ModernStudent({ data, design }: { data: DocData; design: DesignOptions }) {
  const c = design.colors;
  const fs = design.font_size_body;
  const fontFamily = design.font === 'georgia' ? 'Georgia, serif' : 'Arial, sans-serif';

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily, fontSize: fs, background: '#fff' }}>
      {/* Header avec photo centrale */}
      <div style={{ background: `linear-gradient(135deg, ${c.primary} 0%, ${c.accent} 100%)`, padding: '28px 32px', display: 'flex', alignItems: 'center', gap: 20 }}>
        {design.photo_enabled && (
          <div style={{ flexShrink: 0 }}>
            <Avatar name={data.name} photoUrl={data.photo_url} size={80} shape="round" borderColor="rgba(255,255,255,0.4)" />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'white', lineHeight: 1.1 }}>{data.name || 'Votre Nom'}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: 600, marginTop: 3, letterSpacing: '0.05em' }}>{data.title || 'Étudiant(e)'}</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
            {data.contact.email && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)' }}>✉ {data.contact.email}</span>}
            {data.contact.phone && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)' }}>☎ {data.contact.phone}</span>}
            {data.contact.location && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)' }}>⊙ {data.contact.location}</span>}
          </div>
        </div>
      </div>

      {/* Corps */}
      <div style={{ display: 'flex', padding: '20px 24px', gap: 20 }}>
        {/* Colonne gauche */}
        <div style={{ width: 200, minWidth: 200 }}>
          {data.summary && (
            <ModernBox title="À propos de moi" accent={c.accent} primary={c.primary}>
              <p style={{ fontSize: fs, color: '#374151', lineHeight: 1.6 }}>{data.summary}</p>
            </ModernBox>
          )}
          {data.skills.length > 0 && (
            <ModernBox title="Compétences" accent={c.accent} primary={c.primary}>
              {data.skills.map(s => (
                <div key={s.id} style={{ marginBottom: 7 }}>
                  <div style={{ fontSize: 8, color: '#374151', marginBottom: 2, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ background: '#F3F4F6', borderRadius: 10, height: 4 }}>
                    <div style={{ background: `linear-gradient(to right, ${c.primary}, ${c.accent})`, borderRadius: 10, height: 4, width: `${s.level}%` }} />
                  </div>
                </div>
              ))}
            </ModernBox>
          )}
          {data.languages.length > 0 && (
            <ModernBox title="Langues" accent={c.accent} primary={c.primary}>
              {data.languages.map(l => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 5 }}>
                  <span style={{ fontWeight: 600, color: '#374151' }}>{l.name}</span>
                  <span style={{ color: c.accent, fontWeight: 600 }}>{l.level}</span>
                </div>
              ))}
            </ModernBox>
          )}
          {data.interests.length > 0 && (
            <ModernBox title="Centres d'intérêt" accent={c.accent} primary={c.primary}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(Array.isArray(data.interests) ? data.interests : [data.interests]).map((interest, i) => (
                  <span key={i} style={{ fontSize: 7, padding: '2px 7px', background: `${c.accent}20`, color: c.accent, borderRadius: 10, fontWeight: 600 }}>{interest}</span>
                ))}
              </div>
            </ModernBox>
          )}
        </div>

        {/* Colonne droite */}
        <div style={{ flex: 1 }}>
          {data.education.length > 0 && (
            <ModernBox title="Formation" accent={c.accent} primary={c.primary}>
              {data.education.map(edu => (
                <div key={edu.id} style={{ marginBottom: 10, paddingLeft: 10, borderLeft: `2px solid ${c.accent}` }}>
                  <div style={{ fontSize: fs, fontWeight: 700, color: c.primary }}>{edu.degree}</div>
                  <div style={{ fontSize: fs - 1, color: c.accent, fontWeight: 600 }}>{edu.school}</div>
                  <div style={{ fontSize: 8, color: '#9CA3AF' }}>{edu.year}</div>
                </div>
              ))}
            </ModernBox>
          )}
          {data.experiences.length > 0 && (
            <ModernBox title="Expériences professionnelles" accent={c.accent} primary={c.primary}>
              {data.experiences.map(exp => (
                <div key={exp.id} style={{ marginBottom: 12, paddingLeft: 10, borderLeft: `2px solid ${c.primary}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: fs, fontWeight: 700, color: c.primary }}>{exp.position}</div>
                    <div style={{ fontSize: 8, color: '#9CA3AF' }}>{fmtDate(exp.start_date)} — {exp.current ? 'Présent' : fmtDate(exp.end_date || '')}</div>
                  </div>
                  <div style={{ fontSize: fs - 1, color: c.accent, fontWeight: 600 }}>{exp.company}</div>
                  {exp.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.6, marginTop: 3 }}>{exp.description}</p>}
                </div>
              ))}
            </ModernBox>
          )}
          {data.projects.length > 0 && (
            <ModernBox title="Projets académiques" accent={c.accent} primary={c.primary}>
              {data.projects.map(p => (
                <div key={p.id} style={{ marginBottom: 10, paddingLeft: 10, borderLeft: `2px solid ${c.accent}` }}>
                  <div style={{ fontSize: fs, fontWeight: 700, color: c.primary }}>{p.name}</div>
                  {p.technologies && <div style={{ fontSize: 7, color: c.accent, marginBottom: 2 }}>{p.technologies}</div>}
                  {p.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.5 }}>{p.description}</p>}
                </div>
              ))}
            </ModernBox>
          )}
          {data.omnia_formations.filter(f => f.show).length > 0 && (
            <ModernBox title="Certifications Omnia" accent={c.accent} primary={c.primary}>
              {data.omnia_formations.filter(f => f.show).map(f => (
                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                  <div><div style={{ fontSize: fs, fontWeight: 700, color: c.primary }}>{f.title}</div><div style={{ fontSize: 7, color: c.accent }}>Omnia Global Academy</div></div>
                  <div style={{ fontSize: 8, color: '#9CA3AF' }}>{fmtDate(f.completed_at)}</div>
                </div>
              ))}
            </ModernBox>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 3. CORPORATE BLUE
// Bleu marine très sérieux, header sombre, structure classique
// ══════════════════════════════════════════════════════════
export function CorporateBlue({ data, design }: { data: DocData; design: DesignOptions }) {
  const c = design.colors;
  const fs = design.font_size_body;
  const fontFamily = 'Arial, sans-serif';

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily, fontSize: fs, background: '#fff' }}>
      {/* Header bleu foncé */}
      <div style={{ background: c.primary, padding: '0' }}>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {design.photo_enabled && (
            <div style={{ background: `${c.accent}30`, width: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <Avatar name={data.name} photoUrl={data.photo_url} size={90} shape={design.photo_shape} borderColor="rgba(255,255,255,0.3)" />
            </div>
          )}
          <div style={{ flex: 1, padding: '24px 28px' }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: 'white', letterSpacing: '0.02em' }}>{data.name || 'Votre Nom'}</div>
            <div style={{ fontSize: 11, color: c.accent, fontWeight: 700, marginTop: 4, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{data.title || 'Titre professionnel'}</div>
            <div style={{ height: 2, background: c.accent, width: 60, margin: '10px 0' }} />
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {data.contact.email && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)' }}>✉ {data.contact.email}</span>}
              {data.contact.phone && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)' }}>☎ {data.contact.phone}</span>}
              {data.contact.location && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)' }}>⊙ {data.contact.location}</span>}
              {data.contact.linkedin && <span style={{ fontSize: 8, color: c.accent }}>in LinkedIn</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Corps 2 colonnes */}
      <div style={{ display: 'flex' }}>
        {/* Sidebar */}
        <div style={{ width: 200, background: '#F0F4F8', padding: '20px 16px', borderRight: `3px solid ${c.primary}` }}>
          {data.skills.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: c.primary, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, borderBottom: `1px solid ${c.accent}`, paddingBottom: 4 }}>Compétences</div>
              {data.skills.map(s => (
                <div key={s.id} style={{ marginBottom: 7 }}>
                  <div style={{ fontSize: 8, color: '#374151', fontWeight: 600, marginBottom: 2 }}>{s.name}</div>
                  <div style={{ background: '#D1D5DB', borderRadius: 2, height: 4 }}><div style={{ background: c.primary, borderRadius: 2, height: 4, width: `${s.level}%` }} /></div>
                </div>
              ))}
            </div>
          )}
          {data.languages.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: c.primary, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, borderBottom: `1px solid ${c.accent}`, paddingBottom: 4 }}>Langues</div>
              {data.languages.map(l => (
                <div key={l.id} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8 }}>
                    <span style={{ fontWeight: 600, color: '#374151' }}>{l.name}</span>
                    <span style={{ color: c.accent }}>{l.level}</span>
                  </div>
                  <div style={{ background: '#D1D5DB', borderRadius: 10, height: 3, marginTop: 2 }}>
                    <div style={{ background: c.accent, borderRadius: 10, height: 3, width: l.level === 'Bilingue' || l.level === 'Langue maternelle' ? '100%' : l.level === 'Courant' ? '80%' : l.level === 'Avancé' ? '65%' : '40%' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {data.certifications_external.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: c.primary, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, borderBottom: `1px solid ${c.accent}`, paddingBottom: 4 }}>Certifications</div>
              {data.certifications_external.map(cert => (
                <div key={cert.id} style={{ marginBottom: 7, fontSize: 8 }}>
                  <div style={{ fontWeight: 600, color: c.primary }}>{cert.name}</div>
                  <div style={{ color: '#6B7280' }}>{cert.issuer} · {cert.year}</div>
                </div>
              ))}
            </div>
          )}
          {data.interests.length > 0 && (
            <div>
              <div style={{ fontSize: 8, fontWeight: 700, color: c.primary, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, borderBottom: `1px solid ${c.accent}`, paddingBottom: 4 }}>Intérêts</div>
              <div style={{ fontSize: 8, color: '#6B7280', lineHeight: 1.7 }}>{Array.isArray(data.interests) ? data.interests.join(' · ') : data.interests}</div>
            </div>
          )}
        </div>

        {/* Main */}
        <div style={{ flex: 1, padding: '20px 24px' }}>
          {data.summary && (
            <CorpSection title="Profil" primary={c.primary} accent={c.accent} fs={fs}>
              <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, textAlign: 'justify' }}>{data.summary}</p>
            </CorpSection>
          )}
          {data.experiences.length > 0 && (
            <CorpSection title="Expérience professionnelle" primary={c.primary} accent={c.accent} fs={fs}>
              {data.experiences.map(exp => (
                <div key={exp.id} style={{ marginBottom: 13, paddingLeft: 10, borderLeft: `3px solid ${c.accent}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: fs, fontWeight: 700, color: c.primary }}>{exp.position}</div>
                    <div style={{ fontSize: 8, color: 'white', background: c.primary, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>{fmtDate(exp.start_date)} — {exp.current ? 'Présent' : fmtDate(exp.end_date || '')}</div>
                  </div>
                  <div style={{ fontSize: fs, color: c.accent, fontWeight: 600 }}>{exp.company}{exp.location ? ` | ${exp.location}` : ''}</div>
                  {exp.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.6, marginTop: 3 }}>{exp.description}</p>}
                </div>
              ))}
            </CorpSection>
          )}
          {data.education.length > 0 && (
            <CorpSection title="Formation" primary={c.primary} accent={c.accent} fs={fs}>
              {data.education.map(edu => (
                <div key={edu.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div><div style={{ fontSize: fs, fontWeight: 700, color: c.primary }}>{edu.degree}</div><div style={{ fontSize: fs - 1, color: c.accent }}>{edu.school}</div></div>
                  <div style={{ fontSize: 8, color: '#9CA3AF' }}>{edu.year}</div>
                </div>
              ))}
            </CorpSection>
          )}
          {data.omnia_formations.filter(f => f.show).length > 0 && (
            <CorpSection title="Formations Omnia" primary={c.primary} accent={c.accent} fs={fs}>
              {data.omnia_formations.filter(f => f.show).map(f => (
                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                  <div><div style={{ fontSize: fs, fontWeight: 700, color: c.primary }}>{f.title}</div><div style={{ fontSize: 7, color: c.accent }}>Omnia Global Academy</div></div>
                  <div style={{ fontSize: 8, color: '#9CA3AF' }}>{fmtDate(f.completed_at)}</div>
                </div>
              ))}
            </CorpSection>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 4. MINIMAL LUXE
// Beaucoup d'espace blanc, typographie fine, lignes minimalistes
// ══════════════════════════════════════════════════════════
export function MinimalLuxe({ data, design }: { data: DocData; design: DesignOptions }) {
  const c = design.colors;
  const fs = design.font_size_body;
  const fontFamily = design.font === 'georgia' ? 'Georgia, serif' : 'Arial, sans-serif';

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily, fontSize: fs, background: '#fff', padding: '40px 50px' }}>
      {/* Header minimaliste */}
      <div style={{ marginBottom: 32, textAlign: 'left' }}>
        {design.photo_enabled && (
          <div style={{ float: 'right', marginLeft: 20 }}>
            <Avatar name={data.name} photoUrl={data.photo_url} size={80} shape="square" borderColor="#E4E7EC" />
          </div>
        )}
        <div style={{ fontSize: 32, fontWeight: 900, color: '#212121', letterSpacing: '-0.02em', lineHeight: 1 }}>{(data.name || 'Votre Nom').toUpperCase()}</div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6, letterSpacing: '0.2em', textTransform: 'uppercase' }}>{data.title || 'Titre professionnel'}</div>
        <div style={{ height: 1, background: '#212121', marginTop: 16, clear: 'both' }} />
        <div style={{ display: 'flex', gap: 24, marginTop: 10, flexWrap: 'wrap' }}>
          {data.contact.email && <span style={{ fontSize: 8, color: '#9CA3AF' }}>{data.contact.email}</span>}
          {data.contact.phone && <span style={{ fontSize: 8, color: '#9CA3AF' }}>{data.contact.phone}</span>}
          {data.contact.location && <span style={{ fontSize: 8, color: '#9CA3AF' }}>{data.contact.location}</span>}
          {data.contact.linkedin && <span style={{ fontSize: 8, color: '#9CA3AF' }}>LinkedIn</span>}
        </div>
      </div>

      {/* 2 colonnes */}
      <div style={{ display: 'flex', gap: 40 }}>
        {/* Gauche : expériences */}
        <div style={{ flex: 2 }}>
          {data.summary && (
            <LuxeSection title="Profil">
              <p style={{ fontSize: fs, color: '#374151', lineHeight: 1.8, fontStyle: 'italic' }}>{data.summary}</p>
            </LuxeSection>
          )}
          {data.experiences.length > 0 && (
            <LuxeSection title="Expérience">
              {data.experiences.map(exp => (
                <div key={exp.id} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ fontSize: fs + 1, fontWeight: 700, color: '#212121' }}>{exp.position}</div>
                    <div style={{ fontSize: 8, color: '#9CA3AF' }}>{fmtDate(exp.start_date)} — {exp.current ? 'Présent' : fmtDate(exp.end_date || '')}</div>
                  </div>
                  <div style={{ fontSize: fs, color: '#9CA3AF', fontStyle: 'italic', marginBottom: 3 }}>{exp.company}{exp.location ? `, ${exp.location}` : ''}</div>
                  {exp.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.7 }}>{exp.description}</p>}
                </div>
              ))}
            </LuxeSection>
          )}
          {data.education.length > 0 && (
            <LuxeSection title="Formation">
              {data.education.map(edu => (
                <div key={edu.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: fs, fontWeight: 700, color: '#212121' }}>{edu.degree}</div>
                    <div style={{ fontSize: 8, color: '#9CA3AF' }}>{edu.year}</div>
                  </div>
                  <div style={{ fontSize: fs - 1, color: '#9CA3AF', fontStyle: 'italic' }}>{edu.school}</div>
                </div>
              ))}
            </LuxeSection>
          )}
          {data.projects.length > 0 && (
            <LuxeSection title="Projets">
              {data.projects.map(p => (
                <div key={p.id} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: fs, fontWeight: 700, color: '#212121' }}>{p.name}</div>
                  {p.technologies && <div style={{ fontSize: 8, color: '#9CA3AF', fontStyle: 'italic' }}>{p.technologies}</div>}
                  {p.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.6 }}>{p.description}</p>}
                </div>
              ))}
            </LuxeSection>
          )}
        </div>

        {/* Droite : compétences, langues */}
        <div style={{ flex: 1 }}>
          {data.skills.length > 0 && (
            <LuxeSection title="Compétences">
              {data.skills.map(s => (
                <div key={s.id} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 2 }}>
                    <span style={{ color: '#374151' }}>{s.name}</span>
                    <span style={{ color: '#9CA3AF' }}>{s.level}%</span>
                  </div>
                  <div style={{ background: '#F3F4F6', height: 1 }}><div style={{ background: '#212121', height: 1, width: `${s.level}%` }} /></div>
                </div>
              ))}
            </LuxeSection>
          )}
          {data.languages.length > 0 && (
            <LuxeSection title="Langues">
              {data.languages.map(l => (
                <div key={l.id} style={{ marginBottom: 6, fontSize: 8 }}>
                  <div style={{ fontWeight: 600, color: '#212121' }}>{l.name}</div>
                  <div style={{ color: '#9CA3AF', fontStyle: 'italic' }}>{l.level}</div>
                </div>
              ))}
            </LuxeSection>
          )}
          {data.certifications_external.length > 0 && (
            <LuxeSection title="Certifications">
              {data.certifications_external.map(cert => (
                <div key={cert.id} style={{ marginBottom: 8, fontSize: 8 }}>
                  <div style={{ fontWeight: 600, color: '#212121' }}>{cert.name}</div>
                  <div style={{ color: '#9CA3AF' }}>{cert.issuer} · {cert.year}</div>
                </div>
              ))}
            </LuxeSection>
          )}
          {data.interests.length > 0 && (
            <LuxeSection title="Intérêts">
              <div style={{ fontSize: 8, color: '#9CA3AF', lineHeight: 1.8 }}>{Array.isArray(data.interests) ? data.interests.join(' / ') : data.interests}</div>
            </LuxeSection>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 5. AFRICA GOLD
// Sidebar noire, accents dorés, style Afrique digitale premium
// ══════════════════════════════════════════════════════════
export function AfricaGold({ data, design }: { data: DocData; design: DesignOptions }) {
  const c = design.colors;
  const fs = design.font_size_body;
  const fontFamily = 'Arial, sans-serif';
  const sidebarBg = c.primary || '#0D1B2A';
  const gold = c.accent || '#BF8813';

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily, fontSize: fs, background: '#fff', display: 'flex' }}>
      {/* Sidebar noire premium */}
      <div style={{ width: 230, minWidth: 230, background: sidebarBg, padding: '32px 18px', position: 'relative', overflow: 'hidden' }}>
        {/* Décoration géométrique */}
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, border: `2px solid ${gold}20`, borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: 40, left: -20, width: 100, height: 100, border: `1px solid ${gold}15`, borderRadius: '50%' }} />

        {/* Photo */}
        {design.photo_enabled && (
          <div style={{ textAlign: 'center', marginBottom: 16, position: 'relative', zIndex: 1 }}>
            <Avatar name={data.name} photoUrl={data.photo_url} size={85} shape="round" borderColor={gold} />
          </div>
        )}

        {/* Nom */}
        <div style={{ textAlign: 'center', marginBottom: 20, position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: 'white', lineHeight: 1.2 }}>{data.name || 'Votre Nom'}</div>
          <div style={{ fontSize: 8, color: gold, marginTop: 4, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{data.title || ''}</div>
          <div style={{ width: 40, height: 2, background: gold, margin: '8px auto 0' }} />
        </div>

        {/* Sections sidebar */}
        <GoldSection title="Contact" gold={gold}>
          {data.contact.email && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', marginBottom: 5, wordBreak: 'break-all' }}>✉ {data.contact.email}</div>}
          {data.contact.phone && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', marginBottom: 5 }}>☎ {data.contact.phone}</div>}
          {data.contact.location && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', marginBottom: 5 }}>⊙ {data.contact.location}</div>}
          {data.contact.linkedin && <div style={{ fontSize: 8, color: gold }}>in LinkedIn</div>}
        </GoldSection>

        {data.skills.length > 0 && (
          <GoldSection title="Compétences" gold={gold}>
            {data.skills.map(s => (
              <div key={s.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 2 }}>
                  <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{s.name}</span>
                  <span style={{ color: gold }}>{s.level}%</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 3, height: 3 }}>
                  <div style={{ background: `linear-gradient(to right, ${gold}, ${gold}CC)`, borderRadius: 3, height: 3, width: `${s.level}%` }} />
                </div>
              </div>
            ))}
          </GoldSection>
        )}

        {data.languages.length > 0 && (
          <GoldSection title="Langues" gold={gold}>
            {data.languages.map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 8 }}>
                <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{l.name}</span>
                <span style={{ color: gold }}>{l.level}</span>
              </div>
            ))}
          </GoldSection>
        )}

        {data.certifications_external.length > 0 && (
          <GoldSection title="Certifications" gold={gold}>
            {data.certifications_external.map(cert => (
              <div key={cert.id} style={{ marginBottom: 7, fontSize: 8 }}>
                <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{cert.name}</div>
                <div style={{ color: gold }}>{cert.issuer} · {cert.year}</div>
              </div>
            ))}
          </GoldSection>
        )}
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: '32px 24px', background: '#fff' }}>
        {/* Titre en haut du main */}
        <div style={{ marginBottom: 22, paddingBottom: 14, borderBottom: `3px solid ${gold}` }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: sidebarBg, lineHeight: 1.1 }}>{data.name || 'Votre Nom'}</div>
          <div style={{ fontSize: 11, color: gold, fontWeight: 700, marginTop: 4, letterSpacing: '0.06em' }}>{data.title || 'Expert en Transformation Digitale'}</div>
          {data.contact.location && <div style={{ fontSize: 8, color: '#9CA3AF', marginTop: 4 }}>⊙ {data.contact.location}</div>}
        </div>

        {data.summary && (
          <GoldMainSection title="À propos" sidebarBg={sidebarBg} gold={gold} fs={fs}>
            <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing }}>{data.summary}</p>
          </GoldMainSection>
        )}

        {data.experiences.length > 0 && (
          <GoldMainSection title="Expérience professionnelle" sidebarBg={sidebarBg} gold={gold} fs={fs}>
            {data.experiences.map(exp => (
              <div key={exp.id} style={{ marginBottom: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: fs + 1, fontWeight: 700, color: sidebarBg }}>{exp.position}</div>
                    <div style={{ fontSize: fs, color: gold, fontWeight: 600 }}>{exp.company}{exp.location ? ` · ${exp.location}` : ''}</div>
                  </div>
                  <div style={{ fontSize: 8, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{fmtDate(exp.start_date)} — {exp.current ? 'Présent' : fmtDate(exp.end_date || '')}</div>
                </div>
                {exp.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.6, marginTop: 3 }}>{exp.description}</p>}
              </div>
            ))}
          </GoldMainSection>
        )}

        {data.omnia_formations.filter(f => f.show).length > 0 && (
          <GoldMainSection title="Formations Omnia Global Academy" sidebarBg={sidebarBg} gold={gold} fs={fs}>
            {data.omnia_formations.filter(f => f.show).map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: fs, fontWeight: 700, color: sidebarBg }}>{f.title}</div>
                  <div style={{ fontSize: 7, color: gold }}>Omnia Global Academy{f.cpd_accredited ? ' · CPD' : ''}</div>
                  {f.certificate_id && <div style={{ fontSize: 7, color: '#9CA3AF' }}>Cert. {f.certificate_id}</div>}
                </div>
                <div style={{ fontSize: 8, color: '#9CA3AF' }}>{fmtDate(f.completed_at)}</div>
              </div>
            ))}
          </GoldMainSection>
        )}

        {data.education.length > 0 && (
          <GoldMainSection title="Formation académique" sidebarBg={sidebarBg} gold={gold} fs={fs}>
            {data.education.map(edu => (
              <div key={edu.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: fs, fontWeight: 700, color: sidebarBg }}>{edu.degree}</div>
                  <div style={{ fontSize: fs - 1, color: '#374151' }}>{edu.school}</div>
                </div>
                <div style={{ fontSize: 8, color: '#9CA3AF' }}>{edu.year}</div>
              </div>
            ))}
          </GoldMainSection>
        )}
      </div>
    </div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────
function Section({ title, primary, accent, fs, children }: { title: string; primary: string; accent: string; fs: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: fs - 1, fontWeight: 700, color: primary, textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: `2px solid ${accent}`, paddingBottom: 3, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function CorpSection({ title, primary, accent, fs, children }: { title: string; primary: string; accent: string; fs: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: fs, fontWeight: 700, color: primary, textTransform: 'uppercase', letterSpacing: '0.1em', background: `${accent}20`, padding: '3px 8px', marginBottom: 10, borderLeft: `3px solid ${accent}` }}>{title}</div>
      {children}
    </div>
  );
}
function LuxeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#212121', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}
function ModernBox({ title, accent, primary, children }: { title: string; accent: string; primary: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14, padding: '10px 12px', background: '#F9FAFB', borderRadius: 8, border: `1px solid #E4E7EC` }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: primary, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ width: 12, height: 2, background: accent, borderRadius: 1 }} />{title}
      </div>
      {children}
    </div>
  );
}
function GoldSection({ title, gold, children }: { title: string; gold: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: gold, letterSpacing: '0.15em', textTransform: 'uppercase', borderBottom: `1px solid ${gold}40`, paddingBottom: 4, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function GoldMainSection({ title, sidebarBg, gold, fs, children }: { title: string; sidebarBg: string; gold: string; fs: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: fs - 1, fontWeight: 700, color: sidebarBg, textTransform: 'uppercase', letterSpacing: '0.1em', borderLeft: `3px solid ${gold}`, paddingLeft: 8, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

// ─── MAP TEMPLATE KEY → COMPOSANT ────────────────────────
import { CV_TEMPLATE_MAP_6_10 } from './CvTemplates_6_10';
import { CV_TEMPLATE_MAP_11_15 } from './CvTemplates_11_15';

export const CV_TEMPLATE_MAP: Record<string, React.ComponentType<{ data: DocData; design: DesignOptions }>> = {
  classic_pro: ClassicPro,
  modern_student: ModernStudent,
  corporate_blue: CorporateBlue,
  minimal_luxe: MinimalLuxe,
  africa_gold: AfricaGold,
  ...CV_TEMPLATE_MAP_6_10,
  ...CV_TEMPLATE_MAP_11_15,
};
export function CvPreview({ templateKey, data, design }: { templateKey: string; data: DocData; design: DesignOptions }) {
  const Component = CV_TEMPLATE_MAP[templateKey] || ClassicPro;
  return <Component data={data} design={design} />;
}
