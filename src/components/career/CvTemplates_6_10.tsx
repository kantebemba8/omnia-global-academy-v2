import React from 'react';
import { DocData, DesignOptions } from './CvTemplates';

function fmtDate(s: string) {
  if (!s) return '';
  try { return new Date(s).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }); }
  catch { return s; }
}

function Avatar({ name, photoUrl, size, shape, borderColor }: { name: string; photoUrl?: string; size: number; shape: 'round' | 'square' | 'rectangle'; borderColor?: string }) {
  const radius = shape === 'round' ? '50%' : shape === 'square' ? '8px' : '4px';
  const initials = (name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return photoUrl ? (
    <img src={photoUrl} style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', border: borderColor ? `3px solid ${borderColor}` : 'none', display: 'block' }} alt="" />
  ) : (
    <div style={{ width: size, height: size, borderRadius: radius, background: borderColor || '#002050', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.3, fontWeight: 900, color: 'white' }}>{initials}</div>
  );
}

// ══════════════════════════════════════════════════════════
// 6. TECH FUTURE
// Sidebar bleu nuit, accents cyan, style digital/data science
// ══════════════════════════════════════════════════════════
export function TechFuture({ data, design }: { data: DocData; design: DesignOptions }) {
  const c = design.colors;
  const fs = design.font_size_body;
  const bg = c.primary || '#0D1B2A';
  const cyan = c.accent || '#00B4D8';

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily: 'Arial, sans-serif', fontSize: fs, background: '#fff', display: 'flex' }}>
      {/* Sidebar tech */}
      <div style={{ width: 220, minWidth: 220, background: bg, padding: '28px 16px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: `${cyan}15`, borderRadius: '0 0 0 100%' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: 60, height: 60, background: `${cyan}10`, borderRadius: '0 100% 0 0' }} />

        {design.photo_enabled && (
          <div style={{ textAlign: 'center', marginBottom: 14, position: 'relative', zIndex: 1 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', border: `2px solid ${cyan}`, margin: '0 auto', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${cyan}20` }}>
              <Avatar name={data.name} photoUrl={data.photo_url} size={76} shape="round" />
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: 18, position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: 'white' }}>{data.name || 'Votre Nom'}</div>
          <div style={{ fontSize: 8, color: cyan, marginTop: 3, letterSpacing: '0.08em' }}>{data.title || 'Data Scientist'}</div>
        </div>

        {/* Contact tech style */}
        <TechSection title="Contact" cyan={cyan}>
          {data.contact.email && <TechItem icon="@" text={data.contact.email} cyan={cyan} />}
          {data.contact.phone && <TechItem icon="☎" text={data.contact.phone} cyan={cyan} />}
          {data.contact.location && <TechItem icon="⊙" text={data.contact.location} cyan={cyan} />}
          {data.contact.linkedin && <TechItem icon="in" text="LinkedIn" cyan={cyan} isLink />}
          {data.contact.portfolio && <TechItem icon="🌐" text="Portfolio" cyan={cyan} isLink />}
        </TechSection>

        {data.skills.length > 0 && (
          <TechSection title="Compétences" cyan={cyan}>
            {data.skills.map(s => (
              <div key={s.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 3 }}>
                  <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{s.name}</span>
                  <span style={{ color: cyan, fontSize: 7 }}>{s.level}%</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 2, height: 3 }}>
                  <div style={{ background: `linear-gradient(to right, ${cyan}, ${cyan}88)`, borderRadius: 2, height: 3, width: `${s.level}%` }} />
                </div>
              </div>
            ))}
          </TechSection>
        )}

        {data.languages.length > 0 && (
          <TechSection title="Langues" cyan={cyan}>
            {data.languages.map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 5 }}>
                <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{l.name}</span>
                <span style={{ color: cyan }}>{l.level}</span>
              </div>
            ))}
          </TechSection>
        )}

        {data.certifications_external.length > 0 && (
          <TechSection title="Certifications" cyan={cyan}>
            {data.certifications_external.map(cert => (
              <div key={cert.id} style={{ marginBottom: 7, fontSize: 8 }}>
                <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{cert.name}</div>
                <div style={{ color: cyan }}>{cert.issuer} · {cert.year}</div>
              </div>
            ))}
          </TechSection>
        )}
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: '28px 24px' }}>
        <div style={{ marginBottom: 20, borderBottom: `2px solid ${cyan}`, paddingBottom: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: bg }}>{data.name || 'Votre Nom'}</div>
          <div style={{ fontSize: 10, color: cyan, fontWeight: 700, marginTop: 3, letterSpacing: '0.05em' }}>{data.title || 'Data Scientist'}</div>
        </div>
        {data.summary && <TechMainSection title="À propos" bg={bg} cyan={cyan} fs={fs}><p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing }}>{data.summary}</p></TechMainSection>}
        {data.experiences.length > 0 && (
          <TechMainSection title="Expérience professionnelle" bg={bg} cyan={cyan} fs={fs}>
            {data.experiences.map(exp => (
              <div key={exp.id} style={{ marginBottom: 12, paddingLeft: 10, borderLeft: `2px solid ${cyan}40` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: fs, fontWeight: 700, color: bg }}>{exp.position}</div>
                  <div style={{ fontSize: 8, color: '#9CA3AF' }}>{fmtDate(exp.start_date)} — {exp.current ? 'Présent' : fmtDate(exp.end_date || '')}</div>
                </div>
                <div style={{ fontSize: fs - 1, color: cyan, fontWeight: 600 }}>{exp.company}{exp.location ? ` · ${exp.location}` : ''}</div>
                {exp.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.6, marginTop: 2 }}>{exp.description}</p>}
              </div>
            ))}
          </TechMainSection>
        )}
        {data.projects.length > 0 && (
          <TechMainSection title="Projets" bg={bg} cyan={cyan} fs={fs}>
            {data.projects.map(p => (
              <div key={p.id} style={{ marginBottom: 10, padding: '8px 10px', background: '#F8FAFF', borderRadius: 6, border: `1px solid ${cyan}20` }}>
                <div style={{ fontSize: fs, fontWeight: 700, color: bg }}>{p.name}</div>
                {p.technologies && <div style={{ fontSize: 7, color: cyan, marginBottom: 2 }}>{p.technologies}</div>}
                {p.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.5 }}>{p.description}</p>}
              </div>
            ))}
          </TechMainSection>
        )}
        {data.education.length > 0 && (
          <TechMainSection title="Formation" bg={bg} cyan={cyan} fs={fs}>
            {data.education.map(edu => (
              <div key={edu.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <div><div style={{ fontSize: fs, fontWeight: 700, color: bg }}>{edu.degree}</div><div style={{ fontSize: fs - 1, color: cyan }}>{edu.school}</div></div>
                <div style={{ fontSize: 8, color: '#9CA3AF' }}>{edu.year}</div>
              </div>
            ))}
          </TechMainSection>
        )}
        {data.omnia_formations.filter(f => f.show).length > 0 && (
          <TechMainSection title="Certifications Omnia" bg={bg} cyan={cyan} fs={fs}>
            {data.omnia_formations.filter(f => f.show).map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <div><div style={{ fontSize: fs, fontWeight: 700, color: bg }}>{f.title}</div><div style={{ fontSize: 7, color: cyan }}>Omnia Global Academy{f.cpd_accredited ? ' · CPD' : ''}</div></div>
                <div style={{ fontSize: 8, color: '#9CA3AF' }}>{fmtDate(f.completed_at)}</div>
              </div>
            ))}
          </TechMainSection>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 7. CYBER SECURITY CV
// Fond sombre, vert néon, blocs techniques
// ══════════════════════════════════════════════════════════
export function CyberSecurity({ data, design }: { data: DocData; design: DesignOptions }) {
  const c = design.colors;
  const fs = design.font_size_body;
  const darkBg = c.primary || '#0D1117';
  const green = c.accent || '#00FF41';
  const sidebarBg = '#161B22';

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily: 'monospace, Arial', fontSize: fs, background: darkBg, display: 'flex' }}>
      {/* Sidebar cyber */}
      <div style={{ width: 220, minWidth: 220, background: sidebarBg, padding: '28px 14px', borderRight: `1px solid ${green}30` }}>
        {design.photo_enabled && (
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ width: 80, height: 80, border: `2px solid ${green}`, margin: '0 auto', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Avatar name={data.name} photoUrl={data.photo_url} size={76} shape="square" />
            </div>
          </div>
        )}
        <div style={{ marginBottom: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: green, fontFamily: 'monospace' }}>{data.name || 'Votre Nom'}</div>
          <div style={{ fontSize: 8, color: 'rgba(0,255,65,0.6)', marginTop: 3 }}>{data.title || 'Analyste en Cybersécurité'}</div>
        </div>

        <CyberSection title="Contact" green={green}>
          {data.contact.email && <div style={{ fontSize: 7, color: '#C9D1D9', marginBottom: 5, wordBreak: 'break-all' }}>&gt; {data.contact.email}</div>}
          {data.contact.phone && <div style={{ fontSize: 7, color: '#C9D1D9', marginBottom: 5 }}>&gt; {data.contact.phone}</div>}
          {data.contact.location && <div style={{ fontSize: 7, color: '#C9D1D9', marginBottom: 5 }}>&gt; {data.contact.location}</div>}
        </CyberSection>

        {data.skills.length > 0 && (
          <CyberSection title="Compétences techniques" green={green}>
            {data.skills.map(s => (
              <div key={s.id} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 7, color: '#C9D1D9', marginBottom: 2, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{s.name}</span><span style={{ color: green }}>{s.level}%</span>
                </div>
                <div style={{ background: 'rgba(0,255,65,0.1)', height: 2 }}>
                  <div style={{ background: green, height: 2, width: `${s.level}%` }} />
                </div>
              </div>
            ))}
          </CyberSection>
        )}

        {data.certifications_external.length > 0 && (
          <CyberSection title="Certifications" green={green}>
            {data.certifications_external.map(cert => (
              <div key={cert.id} style={{ marginBottom: 6, fontSize: 7 }}>
                <div style={{ color: green, fontWeight: 700 }}>{cert.name}</div>
                <div style={{ color: '#8B949E' }}>{cert.issuer} · {cert.year}</div>
              </div>
            ))}
          </CyberSection>
        )}

        {data.languages.length > 0 && (
          <CyberSection title="Langues" green={green}>
            {data.languages.map(l => (
              <div key={l.id} style={{ fontSize: 7, color: '#C9D1D9', marginBottom: 4 }}>
                <span style={{ color: green }}>&gt;</span> {l.name} — {l.level}
              </div>
            ))}
          </CyberSection>
        )}
      </div>

      {/* Main cyber */}
      <div style={{ flex: 1, padding: '28px 22px', background: darkBg }}>
        <div style={{ marginBottom: 20, borderBottom: `1px solid ${green}40`, paddingBottom: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'white', fontFamily: 'monospace' }}>{data.name || 'Votre Nom'}</div>
          <div style={{ fontSize: 9, color: green, marginTop: 3, fontFamily: 'monospace' }}>// {data.title || 'Analyste en Cybersécurité'}</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
            {data.contact.email && <span style={{ fontSize: 7, color: '#8B949E' }}>{data.contact.email}</span>}
            {data.contact.location && <span style={{ fontSize: 7, color: '#8B949E' }}>{data.contact.location}</span>}
          </div>
        </div>

        {data.summary && <CyberMainSection title="profil" green={green} fs={fs}><p style={{ fontSize: fs, color: '#C9D1D9', lineHeight: design.line_spacing }}>{data.summary}</p></CyberMainSection>}
        {data.experiences.length > 0 && (
          <CyberMainSection title="expérience" green={green} fs={fs}>
            {data.experiences.map(exp => (
              <div key={exp.id} style={{ marginBottom: 12, padding: '8px', background: 'rgba(0,255,65,0.03)', border: `1px solid ${green}20`, borderRadius: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: fs, fontWeight: 700, color: 'white' }}>{exp.position}</div>
                  <div style={{ fontSize: 7, color: '#8B949E' }}>{fmtDate(exp.start_date)} — {exp.current ? 'Présent' : fmtDate(exp.end_date || '')}</div>
                </div>
                <div style={{ fontSize: fs - 1, color: green }}>{exp.company}</div>
                {exp.description && <p style={{ fontSize: fs - 1, color: '#8B949E', lineHeight: 1.6, marginTop: 2 }}>{exp.description}</p>}
              </div>
            ))}
          </CyberMainSection>
        )}
        {data.projects.length > 0 && (
          <CyberMainSection title="labs & projets" green={green} fs={fs}>
            {data.projects.map(p => (
              <div key={p.id} style={{ marginBottom: 8, padding: '6px 8px', background: 'rgba(0,255,65,0.05)', borderLeft: `2px solid ${green}` }}>
                <div style={{ fontSize: fs, fontWeight: 700, color: green }}>{p.name}</div>
                {p.technologies && <div style={{ fontSize: 7, color: '#8B949E', fontFamily: 'monospace' }}>stack: {p.technologies}</div>}
                {p.description && <p style={{ fontSize: fs - 1, color: '#C9D1D9', lineHeight: 1.5, marginTop: 2 }}>{p.description}</p>}
              </div>
            ))}
          </CyberMainSection>
        )}
        {data.education.length > 0 && (
          <CyberMainSection title="formation" green={green} fs={fs}>
            {data.education.map(edu => (
              <div key={edu.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <div><div style={{ fontSize: fs, color: 'white', fontWeight: 600 }}>{edu.degree}</div><div style={{ fontSize: fs - 1, color: '#8B949E' }}>{edu.school}</div></div>
                <div style={{ fontSize: 7, color: '#8B949E' }}>{edu.year}</div>
              </div>
            ))}
          </CyberMainSection>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 8. DATA ANALYST CV
// Clair et analytique, graphiques de compétences, sections data
// ══════════════════════════════════════════════════════════
export function DataAnalyst({ data, design }: { data: DocData; design: DesignOptions }) {
  const c = design.colors;
  const fs = design.font_size_body;
  const blue = c.primary || '#003153';
  const sky = c.accent || '#0EA5E9';

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily: 'Arial, sans-serif', fontSize: fs, background: '#fff' }}>
      {/* Header */}
      <div style={{ background: blue, padding: '22px 32px', display: 'flex', alignItems: 'center', gap: 20 }}>
        {design.photo_enabled && <Avatar name={data.name} photoUrl={data.photo_url} size={75} shape="round" borderColor="rgba(255,255,255,0.3)" />}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'white' }}>{data.name || 'Votre Nom'}</div>
          <div style={{ fontSize: 10, color: sky, fontWeight: 700, marginTop: 3, letterSpacing: '0.05em' }}>{data.title || 'Data Analyst'}</div>
          <div style={{ display: 'flex', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
            {data.contact.email && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)' }}>✉ {data.contact.email}</span>}
            {data.contact.phone && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)' }}>☎ {data.contact.phone}</span>}
            {data.contact.location && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)' }}>⊙ {data.contact.location}</span>}
            {data.contact.linkedin && <span style={{ fontSize: 8, color: sky }}>in LinkedIn</span>}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex' }}>
        {/* Sidebar */}
        <div style={{ width: 210, background: '#F0F9FF', padding: '18px 14px', borderRight: `2px solid ${sky}30` }}>
          {data.skills.length > 0 && (
            <DataSection title="Outils & Technologies" blue={blue} sky={sky}>
              {data.skills.map(s => (
                <div key={s.id} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 2 }}>
                    <span style={{ color: '#374151', fontWeight: 600 }}>{s.name}</span>
                    <span style={{ color: sky, fontSize: 7 }}>{s.level}%</span>
                  </div>
                  <div style={{ background: '#E0F2FE', borderRadius: 3, height: 4 }}>
                    <div style={{ background: `linear-gradient(to right, ${blue}, ${sky})`, borderRadius: 3, height: 4, width: `${s.level}%` }} />
                  </div>
                </div>
              ))}
            </DataSection>
          )}
          {data.languages.length > 0 && (
            <DataSection title="Langues" blue={blue} sky={sky}>
              {data.languages.map(l => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 5 }}>
                  <span style={{ fontWeight: 600, color: '#374151' }}>{l.name}</span>
                  <span style={{ color: sky }}>{l.level}</span>
                </div>
              ))}
            </DataSection>
          )}
          {data.certifications_external.length > 0 && (
            <DataSection title="Certifications" blue={blue} sky={sky}>
              {data.certifications_external.map(cert => (
                <div key={cert.id} style={{ marginBottom: 7, fontSize: 8 }}>
                  <div style={{ fontWeight: 700, color: blue }}>{cert.name}</div>
                  <div style={{ color: sky }}>{cert.issuer} · {cert.year}</div>
                </div>
              ))}
            </DataSection>
          )}
          {data.interests.length > 0 && (
            <DataSection title="Intérêts" blue={blue} sky={sky}>
              <div style={{ fontSize: 8, color: '#6B7280', lineHeight: 1.7 }}>{Array.isArray(data.interests) ? data.interests.join(' · ') : data.interests}</div>
            </DataSection>
          )}
        </div>

        {/* Main */}
        <div style={{ flex: 1, padding: '18px 22px' }}>
          {data.summary && <DataMainSection title="À propos" blue={blue} sky={sky} fs={fs}><p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing }}>{data.summary}</p></DataMainSection>}
          {data.experiences.length > 0 && (
            <DataMainSection title="Expérience professionnelle" blue={blue} sky={sky} fs={fs}>
              {data.experiences.map(exp => (
                <div key={exp.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div><div style={{ fontSize: fs, fontWeight: 700, color: blue }}>{exp.position}</div><div style={{ fontSize: fs - 1, color: sky, fontWeight: 600 }}>{exp.company}{exp.location ? ` · ${exp.location}` : ''}</div></div>
                    <div style={{ fontSize: 7, color: 'white', background: blue, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>{fmtDate(exp.start_date)} — {exp.current ? 'Présent' : fmtDate(exp.end_date || '')}</div>
                  </div>
                  {exp.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.6, marginTop: 3 }}>{exp.description}</p>}
                </div>
              ))}
            </DataMainSection>
          )}
          {data.projects.length > 0 && (
            <DataMainSection title="Projets Data" blue={blue} sky={sky} fs={fs}>
              {data.projects.map(p => (
                <div key={p.id} style={{ marginBottom: 10, padding: '8px 10px', background: '#F0F9FF', borderRadius: 6, borderLeft: `3px solid ${sky}` }}>
                  <div style={{ fontSize: fs, fontWeight: 700, color: blue }}>{p.name}</div>
                  {p.technologies && <div style={{ fontSize: 7, color: sky, marginBottom: 2 }}>Outils : {p.technologies}</div>}
                  {p.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.5 }}>{p.description}</p>}
                </div>
              ))}
            </DataMainSection>
          )}
          {data.education.length > 0 && (
            <DataMainSection title="Formation" blue={blue} sky={sky} fs={fs}>
              {data.education.map(edu => (
                <div key={edu.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div><div style={{ fontSize: fs, fontWeight: 700, color: blue }}>{edu.degree}</div><div style={{ fontSize: fs - 1, color: sky }}>{edu.school}</div></div>
                  <div style={{ fontSize: 8, color: '#9CA3AF' }}>{edu.year}</div>
                </div>
              ))}
            </DataMainSection>
          )}
          {data.omnia_formations.filter(f => f.show).length > 0 && (
            <DataMainSection title="Certifications Omnia" blue={blue} sky={sky} fs={fs}>
              {data.omnia_formations.filter(f => f.show).map(f => (
                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                  <div><div style={{ fontSize: fs, fontWeight: 700, color: blue }}>{f.title}</div><div style={{ fontSize: 7, color: sky }}>Omnia Global Academy</div></div>
                  <div style={{ fontSize: 8, color: '#9CA3AF' }}>{fmtDate(f.completed_at)}</div>
                </div>
              ))}
            </DataMainSection>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 9. CREATIVE DIGITAL
// Formes géométriques colorées, mise en page dynamique
// ══════════════════════════════════════════════════════════
export function CreativeDigital({ data, design }: { data: DocData; design: DesignOptions }) {
  const c = design.colors;
  const fs = design.font_size_body;
  const purple = c.primary || '#7C3AED';
  const orange = c.accent || '#F59E0B';

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily: 'Arial, sans-serif', fontSize: fs, background: '#fff', position: 'relative', overflow: 'hidden' }}>
      {/* Décorations géométriques */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: 200, height: 200, background: `linear-gradient(135deg, ${orange}30, ${purple}20)`, borderRadius: '0 0 0 100%' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: 150, height: 150, background: `${purple}10`, borderRadius: '0 100% 0 0' }} />

      {/* Header créatif */}
      <div style={{ padding: '28px 32px 20px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
          {design.photo_enabled && (
            <div style={{ flexShrink: 0, position: 'relative' }}>
              <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', background: `linear-gradient(135deg, ${purple}, ${orange})` }} />
              <Avatar name={data.name} photoUrl={data.photo_url} size={80} shape="round" />
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#1a1a1a', lineHeight: 1.1 }}>{data.name || 'Votre Nom'}</div>
            <div style={{ fontSize: 11, color: purple, fontWeight: 700, marginTop: 4, letterSpacing: '0.05em' }}>{data.title || 'Chargée de Communication'}</div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
              {data.contact.email && <span style={{ fontSize: 8, color: '#6B7280' }}>✉ {data.contact.email}</span>}
              {data.contact.phone && <span style={{ fontSize: 8, color: '#6B7280' }}>☎ {data.contact.phone}</span>}
              {data.contact.location && <span style={{ fontSize: 8, color: '#6B7280' }}>⊙ {data.contact.location}</span>}
              {data.contact.linkedin && <span style={{ fontSize: 8, color: purple }}>in LinkedIn</span>}
            </div>
          </div>
        </div>
        <div style={{ height: 3, background: `linear-gradient(to right, ${purple}, ${orange}, transparent)`, marginTop: 16, borderRadius: 2 }} />
      </div>

      {/* Corps */}
      <div style={{ display: 'flex', padding: '0 32px 28px', gap: 24, position: 'relative', zIndex: 1 }}>
        {/* Gauche */}
        <div style={{ width: 200 }}>
          {data.summary && (
            <CreativeBox title="À propos" purple={purple} orange={orange}>
              <p style={{ fontSize: fs, color: '#374151', lineHeight: 1.6 }}>{data.summary}</p>
            </CreativeBox>
          )}
          {data.skills.length > 0 && (
            <CreativeBox title="Compétences" purple={purple} orange={orange}>
              {data.skills.map(s => (
                <div key={s.id} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 8, fontWeight: 600, color: '#374151', marginBottom: 3 }}>{s.name}</div>
                  <div style={{ background: '#F3F4F6', borderRadius: 10, height: 5 }}>
                    <div style={{ background: `linear-gradient(to right, ${purple}, ${orange})`, borderRadius: 10, height: 5, width: `${s.level}%` }} />
                  </div>
                </div>
              ))}
            </CreativeBox>
          )}
          {data.languages.length > 0 && (
            <CreativeBox title="Langues" purple={purple} orange={orange}>
              {data.languages.map(l => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 5 }}>
                  <span style={{ fontWeight: 600, color: '#374151' }}>{l.name}</span>
                  <span style={{ color: purple, fontWeight: 600 }}>{l.level}</span>
                </div>
              ))}
            </CreativeBox>
          )}
          {data.interests.length > 0 && (
            <CreativeBox title="Intérêts" purple={purple} orange={orange}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(Array.isArray(data.interests) ? data.interests : [data.interests]).map((interest, i) => (
                  <span key={i} style={{ fontSize: 7, padding: '2px 8px', background: `${purple}15`, color: purple, borderRadius: 10, fontWeight: 600 }}>{interest}</span>
                ))}
              </div>
            </CreativeBox>
          )}
        </div>

        {/* Droite */}
        <div style={{ flex: 1 }}>
          {data.experiences.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: purple, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <div style={{ width: 20, height: 3, background: `linear-gradient(to right, ${purple}, ${orange})`, borderRadius: 2 }} />Expérience
              </div>
              {data.experiences.map(exp => (
                <div key={exp.id} style={{ marginBottom: 12, paddingLeft: 12, borderLeft: `3px solid ${orange}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: fs, fontWeight: 700, color: '#1a1a1a' }}>{exp.position}</div>
                    <div style={{ fontSize: 7, color: 'white', background: purple, padding: '2px 7px', borderRadius: 10 }}>{fmtDate(exp.start_date)} — {exp.current ? 'Présent' : fmtDate(exp.end_date || '')}</div>
                  </div>
                  <div style={{ fontSize: fs - 1, color: orange, fontWeight: 600 }}>{exp.company}</div>
                  {exp.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.6, marginTop: 2 }}>{exp.description}</p>}
                </div>
              ))}
            </div>
          )}
          {data.education.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: purple, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <div style={{ width: 20, height: 3, background: `linear-gradient(to right, ${purple}, ${orange})`, borderRadius: 2 }} />Formation
              </div>
              {data.education.map(edu => (
                <div key={edu.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, paddingLeft: 12, borderLeft: `3px solid ${purple}40` }}>
                  <div><div style={{ fontSize: fs, fontWeight: 700, color: '#1a1a1a' }}>{edu.degree}</div><div style={{ fontSize: fs - 1, color: purple }}>{edu.school}</div></div>
                  <div style={{ fontSize: 8, color: '#9CA3AF' }}>{edu.year}</div>
                </div>
              ))}
            </div>
          )}
          {data.projects.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: purple, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <div style={{ width: 20, height: 3, background: `linear-gradient(to right, ${purple}, ${orange})`, borderRadius: 2 }} />Projets & Réalisations
              </div>
              {data.projects.map(p => (
                <div key={p.id} style={{ marginBottom: 10, padding: '8px 10px', background: `${purple}08`, borderRadius: 8 }}>
                  <div style={{ fontSize: fs, fontWeight: 700, color: purple }}>{p.name}</div>
                  {p.technologies && <div style={{ fontSize: 7, color: orange, marginBottom: 2 }}>{p.technologies}</div>}
                  {p.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.5 }}>{p.description}</p>}
                </div>
              ))}
            </div>
          )}
          {data.certifications_external.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: purple, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <div style={{ width: 20, height: 3, background: `linear-gradient(to right, ${purple}, ${orange})`, borderRadius: 2 }} />Certifications
              </div>
              {data.certifications_external.map(cert => (
                <div key={cert.id} style={{ marginBottom: 7, fontSize: 8 }}>
                  <span style={{ fontWeight: 700, color: '#1a1a1a' }}>{cert.name}</span> · <span style={{ color: orange }}>{cert.issuer}</span> · <span style={{ color: '#9CA3AF' }}>{cert.year}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 10. NO PHOTO ATS
// Ultra simple, compatible ATS, sans colonnes, texte pur
// ══════════════════════════════════════════════════════════
export function NoPhotoAts({ data, design }: { data: DocData; design: DesignOptions }) {
  const c = design.colors;
  const fs = design.font_size_body;
  const dark = c.primary || '#374151';
  const accent = c.accent || '#374151';

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily: 'Arial, sans-serif', fontSize: fs, background: '#fff', padding: '40px 50px' }}>
      {/* Header ATS */}
      <div style={{ textAlign: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: `2px solid ${dark}` }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: dark }}>{(data.name || 'Votre Nom').toUpperCase()}</div>
        <div style={{ fontSize: 11, color: '#374151', marginTop: 4 }}>{data.title || 'Titre professionnel'}</div>
        <div style={{ fontSize: 8, color: '#6B7280', marginTop: 6 }}>
          {[data.contact.email, data.contact.phone, data.contact.location, data.contact.linkedin ? 'LinkedIn' : ''].filter(Boolean).join(' | ')}
        </div>
      </div>

      {data.summary && (
        <AtsSection title="PROFIL">
          <p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing }}>{data.summary}</p>
        </AtsSection>
      )}

      {data.experiences.length > 0 && (
        <AtsSection title="EXPÉRIENCE PROFESSIONNELLE">
          {data.experiences.map(exp => (
            <div key={exp.id} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontSize: fs, fontWeight: 700, color: dark }}>{exp.position} — {exp.company}{exp.location ? `, ${exp.location}` : ''}</div>
                <div style={{ fontSize: 8, color: '#6B7280' }}>{fmtDate(exp.start_date)} — {exp.current ? 'Présent' : fmtDate(exp.end_date || '')}</div>
              </div>
              {exp.description && <p style={{ fontSize: fs, color: '#374151', lineHeight: 1.6, marginTop: 3 }}>{exp.description}</p>}
            </div>
          ))}
        </AtsSection>
      )}

      {data.omnia_formations.filter(f => f.show).length > 0 && (
        <AtsSection title="FORMATIONS OMNIA GLOBAL ACADEMY">
          {data.omnia_formations.filter(f => f.show).map(f => (
            <div key={f.id} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontSize: fs, color: '#374151' }}>{f.title} — Omnia Global Academy{f.cpd_accredited ? ' (CPD)' : ''}</div>
                <div style={{ fontSize: 8, color: '#6B7280' }}>{fmtDate(f.completed_at)}</div>
              </div>
              {f.certificate_id && <div style={{ fontSize: 7, color: '#9CA3AF' }}>Certificat : {f.certificate_id}</div>}
            </div>
          ))}
        </AtsSection>
      )}

      {data.education.length > 0 && (
        <AtsSection title="FORMATION ACADÉMIQUE">
          {data.education.map(edu => (
            <div key={edu.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: fs, color: '#374151' }}>{edu.degree} — {edu.school}{edu.location ? `, ${edu.location}` : ''}</div>
              <div style={{ fontSize: 8, color: '#6B7280' }}>{edu.year}</div>
            </div>
          ))}
        </AtsSection>
      )}

      {data.skills.length > 0 && (
        <AtsSection title="COMPÉTENCES">
          <p style={{ fontSize: fs, color: '#374151', lineHeight: 1.7 }}>{data.skills.map(s => s.name).join(' · ')}</p>
        </AtsSection>
      )}

      {data.languages.length > 0 && (
        <AtsSection title="LANGUES">
          <p style={{ fontSize: fs, color: '#374151' }}>{data.languages.map(l => `${l.name} (${l.level})`).join(' · ')}</p>
        </AtsSection>
      )}

      {data.certifications_external.length > 0 && (
        <AtsSection title="CERTIFICATIONS">
          {data.certifications_external.map(cert => (
            <div key={cert.id} style={{ fontSize: fs, color: '#374151', marginBottom: 4 }}>
              {cert.name} — {cert.issuer} ({cert.year})
            </div>
          ))}
        </AtsSection>
      )}

      {data.interests.length > 0 && (
        <AtsSection title="CENTRES D'INTÉRÊT">
          <p style={{ fontSize: fs, color: '#374151' }}>{Array.isArray(data.interests) ? data.interests.join(' · ') : data.interests}</p>
        </AtsSection>
      )}
    </div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────
function TechSection({ title, cyan, children }: { title: string; cyan: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 7, fontWeight: 700, color: cyan, letterSpacing: '0.15em', textTransform: 'uppercase', borderBottom: `1px solid ${cyan}30`, paddingBottom: 3, marginBottom: 8, fontFamily: 'monospace' }}>{title}</div>
      {children}
    </div>
  );
}
function TechItem({ icon, text, cyan, isLink }: { icon: string; text: string; cyan: string; isLink?: boolean }) {
  return <div style={{ fontSize: 8, color: isLink ? cyan : '#C9D1D9', marginBottom: 4, display: 'flex', gap: 5, wordBreak: 'break-all' }}><span style={{ color: cyan }}>{icon}</span>{text}</div>;
}
function TechMainSection({ title, bg, cyan, fs, children }: { title: string; bg: string; cyan: string; fs: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: fs - 1, fontWeight: 700, color: bg, textTransform: 'uppercase', letterSpacing: '0.1em', borderLeft: `3px solid ${cyan}`, paddingLeft: 8, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function CyberSection({ title, green, children }: { title: string; green: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 7, color: green, fontFamily: 'monospace', marginBottom: 6 }}>// {title.toUpperCase()}</div>
      {children}
    </div>
  );
}
function CyberMainSection({ title, green, fs, children }: { title: string; green: string; fs: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: fs - 1, fontWeight: 700, color: green, fontFamily: 'monospace', borderBottom: `1px solid ${green}30`, paddingBottom: 4, marginBottom: 10 }}>/** {title.toUpperCase()} */</div>
      {children}
    </div>
  );
}
function DataSection({ title, blue, sky, children }: { title: string; blue: string; sky: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: blue, textTransform: 'uppercase', letterSpacing: '0.1em', borderLeft: `3px solid ${sky}`, paddingLeft: 6, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}
function DataMainSection({ title, blue, sky, fs, children }: { title: string; blue: string; sky: string; fs: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: fs - 1, fontWeight: 700, color: blue, textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: `2px solid ${sky}`, paddingBottom: 3, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function CreativeBox({ title, purple, orange, children }: { title: string; purple: string; orange: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 10, border: `1px solid ${purple}20`, background: `${purple}05` }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: purple, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: orange }} />{title}
      </div>
      {children}
    </div>
  );
}
function AtsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '2px solid #374151', paddingBottom: 3, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

export const CV_TEMPLATE_MAP_6_10: Record<string, React.ComponentType<{ data: DocData; design: DesignOptions }>> = {
  tech_future: TechFuture,
  cyber_security: CyberSecurity,
  data_analyst: DataAnalyst,
  creative_digital: CreativeDigital,
  no_photo_ats: NoPhotoAts,
};
