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
// 11. PHOTO ELEGANT
// Photo ronde large, sidebar élégante, style commercial
// ══════════════════════════════════════════════════════════
export function PhotoElegant({ data, design }: { data: DocData; design: DesignOptions }) {
  const c = design.colors;
  const fs = design.font_size_body;
  const navy = c.primary || '#1E3A5F';
  const blue = c.accent || '#4A7FC1';

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily: 'Arial, sans-serif', fontSize: fs, background: '#fff', display: 'flex' }}>
      {/* Sidebar élégante */}
      <div style={{ width: 230, minWidth: 230, background: '#F0F4F8', padding: '32px 18px', borderRight: `4px solid ${navy}` }}>
        {/* Grande photo */}
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ width: 100, height: 100, borderRadius: '50%', border: `4px solid ${navy}`, overflow: 'hidden', margin: '0 auto', background: `${navy}20` }}>
            <Avatar name={data.name} photoUrl={data.photo_url} size={92} shape="round" />
          </div>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: navy, lineHeight: 1.2 }}>{data.name || 'Votre Nom'}</div>
          <div style={{ fontSize: 8, color: blue, marginTop: 4, fontWeight: 600, letterSpacing: '0.08em' }}>{data.title || 'Responsable Commercial(e)'}</div>
          <div style={{ width: 40, height: 2, background: navy, margin: '8px auto 0', borderRadius: 1 }} />
        </div>

        <ElegantSide title="Contact" navy={navy} blue={blue}>
          {data.contact.email && <ElegantItem icon="✉" text={data.contact.email} />}
          {data.contact.phone && <ElegantItem icon="☎" text={data.contact.phone} />}
          {data.contact.location && <ElegantItem icon="⊙" text={data.contact.location} />}
          {data.contact.linkedin && <ElegantItem icon="in" text="LinkedIn" isLink blue={blue} />}
          {data.contact.portfolio && <ElegantItem icon="🌐" text="Portfolio" isLink blue={blue} />}
        </ElegantSide>

        {data.skills.length > 0 && (
          <ElegantSide title="Compétences" navy={navy} blue={blue}>
            {data.skills.map(s => (
              <div key={s.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 2 }}>
                  <span style={{ color: '#374151', fontWeight: 600 }}>{s.name}</span>
                </div>
                <div style={{ display: 'flex', gap: 2 }}>
                  {[1, 2, 3, 4, 5].map(dot => (
                    <div key={dot} style={{ flex: 1, height: 4, borderRadius: 2, background: (s.level / 100 * 5) >= dot ? navy : '#D1D5DB' }} />
                  ))}
                </div>
              </div>
            ))}
          </ElegantSide>
        )}

        {data.languages.length > 0 && (
          <ElegantSide title="Langues" navy={navy} blue={blue}>
            {data.languages.map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 5 }}>
                <span style={{ fontWeight: 600, color: '#374151' }}>{l.name}</span>
                <span style={{ color: blue }}>{l.level}</span>
              </div>
            ))}
          </ElegantSide>
        )}

        {data.interests.length > 0 && (
          <ElegantSide title="Intérêts" navy={navy} blue={blue}>
            <div style={{ fontSize: 8, color: '#6B7280', lineHeight: 1.7 }}>{Array.isArray(data.interests) ? data.interests.join(' · ') : data.interests}</div>
          </ElegantSide>
        )}
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: '32px 24px' }}>
        {data.summary && <ElegantMain title="À propos" navy={navy} blue={blue} fs={fs}><p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing }}>{data.summary}</p></ElegantMain>}
        {data.experiences.length > 0 && (
          <ElegantMain title="Expérience professionnelle" navy={navy} blue={blue} fs={fs}>
            {data.experiences.map(exp => (
              <div key={exp.id} style={{ marginBottom: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div><div style={{ fontSize: fs + 1, fontWeight: 700, color: navy }}>{exp.position}</div><div style={{ fontSize: fs, color: blue, fontWeight: 600 }}>{exp.company}{exp.location ? ` · ${exp.location}` : ''}</div></div>
                  <div style={{ fontSize: 8, background: navy, color: 'white', padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>{fmtDate(exp.start_date)} — {exp.current ? 'Présent' : fmtDate(exp.end_date || '')}</div>
                </div>
                {exp.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.6, marginTop: 3 }}>{exp.description}</p>}
              </div>
            ))}
          </ElegantMain>
        )}
        {data.education.length > 0 && (
          <ElegantMain title="Formation" navy={navy} blue={blue} fs={fs}>
            {data.education.map(edu => (
              <div key={edu.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div><div style={{ fontSize: fs, fontWeight: 700, color: navy }}>{edu.degree}</div><div style={{ fontSize: fs - 1, color: blue }}>{edu.school}</div></div>
                <div style={{ fontSize: 8, color: '#9CA3AF' }}>{edu.year}</div>
              </div>
            ))}
          </ElegantMain>
        )}
        {data.omnia_formations.filter(f => f.show).length > 0 && (
          <ElegantMain title="Certifications Omnia" navy={navy} blue={blue} fs={fs}>
            {data.omnia_formations.filter(f => f.show).map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <div><div style={{ fontSize: fs, fontWeight: 700, color: navy }}>{f.title}</div><div style={{ fontSize: 7, color: blue }}>Omnia Global Academy</div></div>
                <div style={{ fontSize: 8, color: '#9CA3AF' }}>{fmtDate(f.completed_at)}</div>
              </div>
            ))}
          </ElegantMain>
        )}
        {data.certifications_external.length > 0 && (
          <ElegantMain title="Certifications" navy={navy} blue={blue} fs={fs}>
            {data.certifications_external.map(cert => (
              <div key={cert.id} style={{ marginBottom: 7, fontSize: 8 }}>
                <span style={{ fontWeight: 700, color: navy }}>{cert.name}</span> · <span style={{ color: blue }}>{cert.issuer}</span> · <span style={{ color: '#9CA3AF' }}>{cert.year}</span>
              </div>
            ))}
          </ElegantMain>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 12. YOUNG GRADUATE
// Vert dynamique, accent sur formation et projets
// ══════════════════════════════════════════════════════════
export function YoungGraduate({ data, design }: { data: DocData; design: DesignOptions }) {
  const c = design.colors;
  const fs = design.font_size_body;
  const green = c.primary || '#047857';
  const lime = c.accent || '#10B981';

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily: 'Arial, sans-serif', fontSize: fs, background: '#fff' }}>
      {/* Header vert */}
      <div style={{ background: green, padding: '24px 32px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, background: `${lime}30`, borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -30, right: 80, width: 80, height: 80, background: `${lime}20`, borderRadius: '50%' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, position: 'relative', zIndex: 1 }}>
          {design.photo_enabled && <Avatar name={data.name} photoUrl={data.photo_url} size={70} shape="round" borderColor={lime} />}
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'white' }}>{data.name || 'Votre Nom'}</div>
            <div style={{ fontSize: 10, color: lime, fontWeight: 700, marginTop: 3 }}>{data.title || 'Jeune Diplômé(e)'}</div>
            <div style={{ display: 'flex', gap: 14, marginTop: 7, flexWrap: 'wrap' }}>
              {data.contact.email && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>✉ {data.contact.email}</span>}
              {data.contact.phone && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>☎ {data.contact.phone}</span>}
              {data.contact.location && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)' }}>⊙ {data.contact.location}</span>}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex' }}>
        {/* Sidebar */}
        <div style={{ width: 200, background: '#ECFDF5', padding: '18px 14px', borderRight: `2px solid ${lime}40` }}>
          {data.skills.length > 0 && (
            <YGSection title="Compétences" green={green} lime={lime}>
              {data.skills.map(s => (
                <div key={s.id} style={{ marginBottom: 7 }}>
                  <div style={{ fontSize: 8, color: '#374151', fontWeight: 600, marginBottom: 2 }}>{s.name}</div>
                  <div style={{ background: '#D1FAE5', borderRadius: 10, height: 4 }}>
                    <div style={{ background: green, borderRadius: 10, height: 4, width: `${s.level}%` }} />
                  </div>
                </div>
              ))}
            </YGSection>
          )}
          {data.languages.length > 0 && (
            <YGSection title="Langues" green={green} lime={lime}>
              {data.languages.map(l => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 5 }}>
                  <span style={{ fontWeight: 600, color: '#374151' }}>{l.name}</span>
                  <span style={{ color: green, fontWeight: 600 }}>{l.level}</span>
                </div>
              ))}
            </YGSection>
          )}
          {data.certifications_external.length > 0 && (
            <YGSection title="Certifications" green={green} lime={lime}>
              {data.certifications_external.map(cert => (
                <div key={cert.id} style={{ marginBottom: 6, fontSize: 8 }}>
                  <div style={{ fontWeight: 700, color: green }}>{cert.name}</div>
                  <div style={{ color: '#6B7280' }}>{cert.issuer} · {cert.year}</div>
                </div>
              ))}
            </YGSection>
          )}
          {data.interests.length > 0 && (
            <YGSection title="Intérêts" green={green} lime={lime}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {(Array.isArray(data.interests) ? data.interests : [data.interests]).map((interest, i) => (
                  <span key={i} style={{ fontSize: 7, padding: '2px 6px', background: `${green}15`, color: green, borderRadius: 8, fontWeight: 600 }}>{interest}</span>
                ))}
              </div>
            </YGSection>
          )}
        </div>

        {/* Main */}
        <div style={{ flex: 1, padding: '18px 22px' }}>
          {data.summary && <YGMain title="À propos" green={green} lime={lime} fs={fs}><p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing }}>{data.summary}</p></YGMain>}
          {data.education.length > 0 && (
            <YGMain title="Formation" green={green} lime={lime} fs={fs}>
              {data.education.map(edu => (
                <div key={edu.id} style={{ marginBottom: 10, paddingLeft: 10, borderLeft: `3px solid ${lime}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: fs, fontWeight: 700, color: green }}>{edu.degree}</div>
                    <div style={{ fontSize: 8, color: '#9CA3AF' }}>{edu.year}</div>
                  </div>
                  <div style={{ fontSize: fs - 1, color: '#374151' }}>{edu.school}{edu.location ? ` · ${edu.location}` : ''}</div>
                </div>
              ))}
            </YGMain>
          )}
          {data.experiences.length > 0 && (
            <YGMain title="Expériences & Stages" green={green} lime={lime} fs={fs}>
              {data.experiences.map(exp => (
                <div key={exp.id} style={{ marginBottom: 12, paddingLeft: 10, borderLeft: `3px solid ${green}40` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: fs, fontWeight: 700, color: green }}>{exp.position}</div>
                    <div style={{ fontSize: 8, color: '#9CA3AF' }}>{fmtDate(exp.start_date)} — {exp.current ? 'Présent' : fmtDate(exp.end_date || '')}</div>
                  </div>
                  <div style={{ fontSize: fs - 1, color: lime, fontWeight: 600 }}>{exp.company}</div>
                  {exp.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.6, marginTop: 2 }}>{exp.description}</p>}
                </div>
              ))}
            </YGMain>
          )}
          {data.projects.length > 0 && (
            <YGMain title="Projets académiques" green={green} lime={lime} fs={fs}>
              {data.projects.map(p => (
                <div key={p.id} style={{ marginBottom: 10, padding: '7px 10px', background: '#ECFDF5', borderRadius: 6 }}>
                  <div style={{ fontSize: fs, fontWeight: 700, color: green }}>{p.name}</div>
                  {p.technologies && <div style={{ fontSize: 7, color: lime, marginBottom: 2 }}>{p.technologies}</div>}
                  {p.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.5 }}>{p.description}</p>}
                </div>
              ))}
            </YGMain>
          )}
          {data.omnia_formations.filter(f => f.show).length > 0 && (
            <YGMain title="Certifications Omnia" green={green} lime={lime} fs={fs}>
              {data.omnia_formations.filter(f => f.show).map(f => (
                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                  <div><div style={{ fontSize: fs, fontWeight: 700, color: green }}>{f.title}</div><div style={{ fontSize: 7, color: lime }}>Omnia Global Academy</div></div>
                  <div style={{ fontSize: 8, color: '#9CA3AF' }}>{fmtDate(f.completed_at)}</div>
                </div>
              ))}
            </YGMain>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 13. INTERNSHIP READY
// Court, clair, objectif pro en haut, bleu ciel
// ══════════════════════════════════════════════════════════
export function InternshipReady({ data, design }: { data: DocData; design: DesignOptions }) {
  const c = design.colors;
  const fs = design.font_size_body;
  const blue = c.primary || '#0369A1';
  const sky = c.accent || '#38BDF8';

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily: 'Arial, sans-serif', fontSize: fs, background: '#fff', padding: '32px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 20, paddingBottom: 16, borderBottom: `3px solid ${blue}` }}>
        {design.photo_enabled && (
          <div style={{ flexShrink: 0 }}>
            <Avatar name={data.name} photoUrl={data.photo_url} size={75} shape="round" borderColor={sky} />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: blue }}>{data.name || 'Votre Nom'}</div>
          <div style={{ fontSize: 11, color: sky, fontWeight: 700, marginTop: 3, letterSpacing: '0.05em' }}>{data.title || 'À la recherche d\'un stage'}</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
            {data.contact.email && <span style={{ fontSize: 8, color: '#6B7280' }}>✉ {data.contact.email}</span>}
            {data.contact.phone && <span style={{ fontSize: 8, color: '#6B7280' }}>☎ {data.contact.phone}</span>}
            {data.contact.location && <span style={{ fontSize: 8, color: '#6B7280' }}>⊙ {data.contact.location}</span>}
            {data.contact.linkedin && <span style={{ fontSize: 8, color: sky }}>in LinkedIn</span>}
          </div>
        </div>
      </div>

      {/* Objectif en évidence */}
      {data.summary && (
        <div style={{ padding: '12px 16px', background: `${blue}08`, borderLeft: `4px solid ${sky}`, borderRadius: 4, marginBottom: 18 }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: blue, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>Objectif professionnel</div>
          <p style={{ fontSize: fs, color: '#374151', lineHeight: 1.65 }}>{data.summary}</p>
        </div>
      )}

      {/* 2 colonnes */}
      <div style={{ display: 'flex', gap: 28 }}>
        <div style={{ flex: 1 }}>
          {data.education.length > 0 && (
            <IRSection title="Formation" blue={blue} sky={sky} fs={fs}>
              {data.education.map(edu => (
                <div key={edu.id} style={{ marginBottom: 10, paddingLeft: 10, borderLeft: `2px solid ${sky}` }}>
                  <div style={{ fontSize: fs, fontWeight: 700, color: blue }}>{edu.degree}</div>
                  <div style={{ fontSize: fs - 1, color: '#374151' }}>{edu.school}{edu.location ? ` · ${edu.location}` : ''}</div>
                  <div style={{ fontSize: 8, color: '#9CA3AF' }}>{edu.year}</div>
                </div>
              ))}
            </IRSection>
          )}
          {data.experiences.length > 0 && (
            <IRSection title="Expériences / Stages" blue={blue} sky={sky} fs={fs}>
              {data.experiences.map(exp => (
                <div key={exp.id} style={{ marginBottom: 10, paddingLeft: 10, borderLeft: `2px solid ${blue}40` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: fs, fontWeight: 700, color: blue }}>{exp.position}</div>
                    <div style={{ fontSize: 8, color: '#9CA3AF' }}>{fmtDate(exp.start_date)} — {exp.current ? 'Présent' : fmtDate(exp.end_date || '')}</div>
                  </div>
                  <div style={{ fontSize: fs - 1, color: sky, fontWeight: 600 }}>{exp.company}</div>
                  {exp.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.6, marginTop: 2 }}>{exp.description}</p>}
                </div>
              ))}
            </IRSection>
          )}
          {data.projects.length > 0 && (
            <IRSection title="Projets académiques" blue={blue} sky={sky} fs={fs}>
              {data.projects.map(p => (
                <div key={p.id} style={{ marginBottom: 9, paddingLeft: 10, borderLeft: `2px solid ${sky}60` }}>
                  <div style={{ fontSize: fs, fontWeight: 700, color: blue }}>{p.name}</div>
                  {p.technologies && <div style={{ fontSize: 7, color: sky }}>{p.technologies}</div>}
                  {p.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.5, marginTop: 2 }}>{p.description}</p>}
                </div>
              ))}
            </IRSection>
          )}
        </div>

        <div style={{ width: 180 }}>
          {data.skills.length > 0 && (
            <IRSection title="Compétences" blue={blue} sky={sky} fs={fs}>
              {data.skills.map(s => (
                <div key={s.id} style={{ marginBottom: 7 }}>
                  <div style={{ fontSize: 8, color: '#374151', fontWeight: 600, marginBottom: 2 }}>{s.name}</div>
                  <div style={{ background: '#E0F2FE', borderRadius: 3, height: 3 }}>
                    <div style={{ background: blue, borderRadius: 3, height: 3, width: `${s.level}%` }} />
                  </div>
                </div>
              ))}
            </IRSection>
          )}
          {data.languages.length > 0 && (
            <IRSection title="Langues" blue={blue} sky={sky} fs={fs}>
              {data.languages.map(l => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 5 }}>
                  <span style={{ fontWeight: 600, color: '#374151' }}>{l.name}</span>
                  <span style={{ color: sky }}>{l.level}</span>
                </div>
              ))}
            </IRSection>
          )}
          {data.omnia_formations.filter(f => f.show).length > 0 && (
            <IRSection title="Certifications Omnia" blue={blue} sky={sky} fs={fs}>
              {data.omnia_formations.filter(f => f.show).map(f => (
                <div key={f.id} style={{ marginBottom: 7 }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: blue }}>{f.title}</div>
                  <div style={{ fontSize: 7, color: sky }}>Omnia · {fmtDate(f.completed_at)}</div>
                </div>
              ))}
            </IRSection>
          )}
          {data.interests.length > 0 && (
            <IRSection title="Intérêts" blue={blue} sky={sky} fs={fs}>
              <div style={{ fontSize: 8, color: '#6B7280', lineHeight: 1.7 }}>{Array.isArray(data.interests) ? data.interests.join(' · ') : data.interests}</div>
            </IRSection>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 14. INTERNATIONAL CV
// Bleu marine et or, adapté Europe/Afrique/International
// ══════════════════════════════════════════════════════════
export function InternationalCv({ data, design }: { data: DocData; design: DesignOptions }) {
  const c = design.colors;
  const fs = design.font_size_body;
  const navy = c.primary || '#002050';
  const gold = c.accent || '#BF8813';

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily: 'Arial, sans-serif', fontSize: fs, background: '#fff', display: 'flex' }}>
      {/* Sidebar internationale */}
      <div style={{ width: 220, minWidth: 220, background: '#F0F4F8', padding: '28px 16px', borderRight: `1px solid #E4E7EC` }}>
        {design.photo_enabled && (
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <Avatar name={data.name} photoUrl={data.photo_url} size={85} shape="round" borderColor={gold} />
          </div>
        )}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: navy }}>{data.name || 'Votre Nom'}</div>
          <div style={{ fontSize: 8, color: gold, marginTop: 3, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{data.title || 'International Business'}</div>
        </div>

        <IntlSection title="Coordonnées" navy={navy} gold={gold}>
          {data.contact.email && <div style={{ fontSize: 8, color: '#374151', marginBottom: 5, wordBreak: 'break-all' }}>✉ {data.contact.email}</div>}
          {data.contact.phone && <div style={{ fontSize: 8, color: '#374151', marginBottom: 5 }}>☎ {data.contact.phone}</div>}
          {data.contact.location && <div style={{ fontSize: 8, color: '#374151', marginBottom: 5 }}>⊙ {data.contact.location}</div>}
          {data.contact.linkedin && <div style={{ fontSize: 8, color: gold, marginBottom: 5 }}>in LinkedIn</div>}
          {data.contact.portfolio && <div style={{ fontSize: 8, color: gold }}>🌐 Portfolio</div>}
        </IntlSection>

        {data.languages.length > 0 && (
          <IntlSection title="Langues" navy={navy} gold={gold}>
            {data.languages.map(l => (
              <div key={l.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: 700, color: navy }}>{l.name}</span>
                  <span style={{ color: gold, fontSize: 7 }}>{l.level}</span>
                </div>
                <div style={{ background: '#E4E7EC', borderRadius: 10, height: 3 }}>
                  <div style={{ background: gold, borderRadius: 10, height: 3, width: l.level === 'Bilingue' || l.level === 'Langue maternelle' ? '100%' : l.level === 'Courant' ? '80%' : l.level === 'Avancé' ? '65%' : '40%' }} />
                </div>
              </div>
            ))}
          </IntlSection>
        )}

        {data.skills.length > 0 && (
          <IntlSection title="Compétences clés" navy={navy} gold={gold}>
            {data.skills.map(s => (
              <div key={s.id} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 8, color: '#374151', fontWeight: 600, marginBottom: 2 }}>{s.name}</div>
                <div style={{ background: '#E4E7EC', borderRadius: 3, height: 3 }}>
                  <div style={{ background: navy, borderRadius: 3, height: 3, width: `${s.level}%` }} />
                </div>
              </div>
            ))}
          </IntlSection>
        )}

        {data.certifications_external.length > 0 && (
          <IntlSection title="Certifications" navy={navy} gold={gold}>
            {data.certifications_external.map(cert => (
              <div key={cert.id} style={{ marginBottom: 6, fontSize: 8 }}>
                <div style={{ fontWeight: 700, color: navy }}>{cert.name}</div>
                <div style={{ color: gold }}>{cert.issuer} · {cert.year}</div>
              </div>
            ))}
          </IntlSection>
        )}
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: '28px 24px' }}>
        <div style={{ marginBottom: 20, paddingBottom: 14, borderBottom: `2px solid ${gold}` }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: navy }}>{data.name || 'Votre Nom'}</div>
          <div style={{ fontSize: 10, color: gold, fontWeight: 700, marginTop: 4, letterSpacing: '0.06em' }}>{data.title || 'International Business Manager'}</div>
          {data.contact.location && <div style={{ fontSize: 8, color: '#9CA3AF', marginTop: 3 }}>⊙ {data.contact.location}</div>}
        </div>

        {data.summary && <IntlMain title="Professional Summary" navy={navy} gold={gold} fs={fs}><p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, fontStyle: 'italic' }}>{data.summary}</p></IntlMain>}
        {data.experiences.length > 0 && (
          <IntlMain title="Expérience internationale" navy={navy} gold={gold} fs={fs}>
            {data.experiences.map(exp => (
              <div key={exp.id} style={{ marginBottom: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div><div style={{ fontSize: fs + 1, fontWeight: 700, color: navy }}>{exp.position}</div><div style={{ fontSize: fs, color: gold, fontWeight: 600 }}>{exp.company}{exp.location ? ` · ${exp.location}` : ''}</div></div>
                  <div style={{ fontSize: 8, color: '#9CA3AF', whiteSpace: 'nowrap', border: `1px solid #E4E7EC`, padding: '2px 7px', borderRadius: 10 }}>{fmtDate(exp.start_date)} — {exp.current ? 'Présent' : fmtDate(exp.end_date || '')}</div>
                </div>
                {exp.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.6, marginTop: 3 }}>{exp.description}</p>}
              </div>
            ))}
          </IntlMain>
        )}
        {data.omnia_formations.filter(f => f.show).length > 0 && (
          <IntlMain title="Formations Omnia Global Academy" navy={navy} gold={gold} fs={fs}>
            {data.omnia_formations.filter(f => f.show).map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div><div style={{ fontSize: fs, fontWeight: 700, color: navy }}>{f.title}</div><div style={{ fontSize: 7, color: gold }}>Omnia Global Academy{f.cpd_accredited ? ' · Formation reconnue' : ''}</div></div>
                <div style={{ fontSize: 8, color: '#9CA3AF' }}>{fmtDate(f.completed_at)}</div>
              </div>
            ))}
          </IntlMain>
        )}
        {data.education.length > 0 && (
          <IntlMain title="Formation académique" navy={navy} gold={gold} fs={fs}>
            {data.education.map(edu => (
              <div key={edu.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div><div style={{ fontSize: fs, fontWeight: 700, color: navy }}>{edu.degree}</div><div style={{ fontSize: fs - 1, color: '#374151' }}>{edu.school}{edu.location ? ` · ${edu.location}` : ''}</div></div>
                <div style={{ fontSize: 8, color: '#9CA3AF' }}>{edu.year}</div>
              </div>
            ))}
          </IntlMain>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 15. QHSE PROFESSIONAL
// Vert industriel, sections normes ISO, style HSE/RSE
// ══════════════════════════════════════════════════════════
export function QhseProfessional({ data, design }: { data: DocData; design: DesignOptions }) {
  const c = design.colors;
  const fs = design.font_size_body;
  const forest = c.primary || '#1B4332';
  const sage = c.accent || '#52B788';

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily: 'Arial, sans-serif', fontSize: fs, background: '#fff', display: 'flex' }}>
      {/* Sidebar QHSE */}
      <div style={{ width: 220, minWidth: 220, background: '#D8F3DC', padding: '28px 16px', borderRight: `3px solid ${forest}` }}>
        {design.photo_enabled && (
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <Avatar name={data.name} photoUrl={data.photo_url} size={80} shape="round" borderColor={forest} />
          </div>
        )}
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: forest }}>{data.name || 'Votre Nom'}</div>
          <div style={{ fontSize: 8, color: '#1B4332', marginTop: 3, fontWeight: 600 }}>{data.title || 'Responsable QHSE'}</div>
          <div style={{ width: 30, height: 2, background: sage, margin: '7px auto 0', borderRadius: 1 }} />
        </div>

        <QSection title="Contact" forest={forest} sage={sage}>
          {data.contact.email && <div style={{ fontSize: 8, color: '#374151', marginBottom: 5, wordBreak: 'break-all' }}>✉ {data.contact.email}</div>}
          {data.contact.phone && <div style={{ fontSize: 8, color: '#374151', marginBottom: 5 }}>☎ {data.contact.phone}</div>}
          {data.contact.location && <div style={{ fontSize: 8, color: '#374151', marginBottom: 5 }}>⊙ {data.contact.location}</div>}
          {data.contact.linkedin && <div style={{ fontSize: 8, color: forest }}>in LinkedIn</div>}
        </QSection>

        {data.certifications_external.length > 0 && (
          <QSection title="Certifications & Normes" forest={forest} sage={sage}>
            {data.certifications_external.map(cert => (
              <div key={cert.id} style={{ marginBottom: 7, padding: '5px 8px', background: `${forest}10`, borderRadius: 5, borderLeft: `3px solid ${sage}` }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: forest }}>{cert.name}</div>
                <div style={{ fontSize: 7, color: '#6B7280' }}>{cert.issuer} · {cert.year}</div>
              </div>
            ))}
          </QSection>
        )}

        {data.skills.length > 0 && (
          <QSection title="Compétences techniques" forest={forest} sage={sage}>
            {data.skills.map(s => (
              <div key={s.id} style={{ marginBottom: 7 }}>
                <div style={{ fontSize: 8, color: '#374151', fontWeight: 600, marginBottom: 2 }}>{s.name}</div>
                <div style={{ background: '#B7E4C7', borderRadius: 3, height: 4 }}>
                  <div style={{ background: forest, borderRadius: 3, height: 4, width: `${s.level}%` }} />
                </div>
              </div>
            ))}
          </QSection>
        )}

        {data.languages.length > 0 && (
          <QSection title="Langues" forest={forest} sage={sage}>
            {data.languages.map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 5 }}>
                <span style={{ fontWeight: 600, color: '#374151' }}>{l.name}</span>
                <span style={{ color: forest, fontWeight: 600 }}>{l.level}</span>
              </div>
            ))}
          </QSection>
        )}
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: '28px 24px' }}>
        <div style={{ marginBottom: 20, borderBottom: `2px solid ${sage}`, paddingBottom: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: forest }}>{data.name || 'Votre Nom'}</div>
          <div style={{ fontSize: 10, color: sage, fontWeight: 700, marginTop: 3, letterSpacing: '0.05em' }}>{data.title || 'Responsable QHSE'}</div>
          {data.contact.location && <div style={{ fontSize: 8, color: '#9CA3AF', marginTop: 3 }}>⊙ {data.contact.location}</div>}
        </div>

        {data.summary && <QMain title="Profil professionnel" forest={forest} sage={sage} fs={fs}><p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing }}>{data.summary}</p></QMain>}
        {data.experiences.length > 0 && (
          <QMain title="Expérience professionnelle" forest={forest} sage={sage} fs={fs}>
            {data.experiences.map(exp => (
              <div key={exp.id} style={{ marginBottom: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div><div style={{ fontSize: fs + 1, fontWeight: 700, color: forest }}>{exp.position}</div><div style={{ fontSize: fs, color: sage, fontWeight: 600 }}>{exp.company}{exp.location ? ` · ${exp.location}` : ''}</div></div>
                  <div style={{ fontSize: 8, color: '#9CA3AF', whiteSpace: 'nowrap', border: `1px solid ${sage}`, padding: '2px 7px', borderRadius: 10 }}>{fmtDate(exp.start_date)} — {exp.current ? 'Présent' : fmtDate(exp.end_date || '')}</div>
                </div>
                {exp.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.6, marginTop: 3 }}>{exp.description}</p>}
              </div>
            ))}
          </QMain>
        )}
        {data.omnia_formations.filter(f => f.show).length > 0 && (
          <QMain title="Formations Omnia Global Academy" forest={forest} sage={sage} fs={fs}>
            {data.omnia_formations.filter(f => f.show).map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <div><div style={{ fontSize: fs, fontWeight: 700, color: forest }}>{f.title}</div><div style={{ fontSize: 7, color: sage }}>Omnia Global Academy{f.cpd_accredited ? ' · Formation reconnue' : ''}</div></div>
                <div style={{ fontSize: 8, color: '#9CA3AF' }}>{fmtDate(f.completed_at)}</div>
              </div>
            ))}
          </QMain>
        )}
        {data.education.length > 0 && (
          <QMain title="Formation académique" forest={forest} sage={sage} fs={fs}>
            {data.education.map(edu => (
              <div key={edu.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div><div style={{ fontSize: fs, fontWeight: 700, color: forest }}>{edu.degree}</div><div style={{ fontSize: fs - 1, color: '#374151' }}>{edu.school}</div></div>
                <div style={{ fontSize: 8, color: '#9CA3AF' }}>{edu.year}</div>
              </div>
            ))}
          </QMain>
        )}
        {data.projects.length > 0 && (
          <QMain title="Projets & Réalisations QHSE" forest={forest} sage={sage} fs={fs}>
            {data.projects.map(p => (
              <div key={p.id} style={{ marginBottom: 10, paddingLeft: 10, borderLeft: `3px solid ${sage}` }}>
                <div style={{ fontSize: fs, fontWeight: 700, color: forest }}>{p.name}</div>
                {p.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.5, marginTop: 2 }}>{p.description}</p>}
              </div>
            ))}
          </QMain>
        )}
      </div>
    </div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────
function ElegantSide({ title, navy, blue, children }: { title: string; navy: string; blue: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: navy, textTransform: 'uppercase', letterSpacing: '0.12em', borderBottom: `2px solid ${blue}`, paddingBottom: 4, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function ElegantItem({ icon, text, blue, isLink }: { icon: string; text: string; blue?: string; isLink?: boolean }) {
  return <div style={{ fontSize: 8, color: isLink ? blue || '#4A7FC1' : '#374151', marginBottom: 5, display: 'flex', gap: 5, wordBreak: 'break-all' }}><span>{icon}</span>{text}</div>;
}
function ElegantMain({ title, navy, blue, fs, children }: { title: string; navy: string; blue: string; fs: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: fs - 1, fontWeight: 700, color: navy, textTransform: 'uppercase', letterSpacing: '0.1em', borderLeft: `3px solid ${blue}`, paddingLeft: 8, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function YGSection({ title, green, lime, children }: { title: string; green: string; lime: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: green, textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: `2px solid ${lime}`, paddingBottom: 4, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function YGMain({ title, green, lime, fs, children }: { title: string; green: string; lime: string; fs: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: fs - 1, fontWeight: 700, color: green, textTransform: 'uppercase', letterSpacing: '0.1em', background: `${lime}20`, padding: '3px 8px', borderRadius: 4, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function IRSection({ title, blue, sky, fs, children }: { title: string; blue: string; sky: string; fs: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: fs - 1, fontWeight: 700, color: blue, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: sky }} />{title}
      </div>
      {children}
    </div>
  );
}
function IntlSection({ title, navy, gold, children }: { title: string; navy: string; gold: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: navy, textTransform: 'uppercase', letterSpacing: '0.12em', borderBottom: `1px solid ${gold}`, paddingBottom: 4, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function IntlMain({ title, navy, gold, fs, children }: { title: string; navy: string; gold: string; fs: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: fs - 1, fontWeight: 700, color: navy, textTransform: 'uppercase', letterSpacing: '0.1em', borderLeft: `3px solid ${gold}`, paddingLeft: 8, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function QSection({ title, forest, sage, children }: { title: string; forest: string; sage: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: forest, textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: `2px solid ${sage}`, paddingBottom: 4, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function QMain({ title, forest, sage, fs, children }: { title: string; forest: string; sage: string; fs: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: fs - 1, fontWeight: 700, color: forest, textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: `1px solid ${sage}`, paddingBottom: 3, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

export const CV_TEMPLATE_MAP_11_15: Record<string, React.ComponentType<{ data: DocData; design: DesignOptions }>> = {
  photo_elegant: PhotoElegant,
  young_graduate: YoungGraduate,
  internship_ready: InternshipReady,
  international_cv: InternationalCv,
  qhse_professional: QhseProfessional,
};
