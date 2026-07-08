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
// 16. BUSINESS MANAGER
// Sidebar navy + or, résultats chiffrés, leadership
// ══════════════════════════════════════════════════════════
export function BusinessManager({ data, design }: { data: DocData; design: DesignOptions }) {
  const c = design.colors;
  const fs = design.font_size_body;
  const navy = c.primary || '#1E3A5F';
  const gold = c.accent || '#BF8813';

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily: 'Arial, sans-serif', fontSize: fs, background: '#fff', display: 'flex' }}>
      {/* Sidebar navy */}
      <div style={{ width: 225, minWidth: 225, background: navy, padding: '28px 16px' }}>
        {design.photo_enabled && (
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <Avatar name={data.name} photoUrl={data.photo_url} size={82} shape="round" borderColor={gold} />
          </div>
        )}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: 'white', lineHeight: 1.2 }}>{data.name || 'Votre Nom'}</div>
          <div style={{ fontSize: 8, color: gold, marginTop: 4, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{data.title || 'Business Manager'}</div>
          <div style={{ width: 40, height: 1, background: `${gold}60`, margin: '10px auto' }} />
        </div>

        <BMSide title="Contact" navy={navy} gold={gold}>
          {data.contact.email && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', marginBottom: 5, wordBreak: 'break-all' }}>✉ {data.contact.email}</div>}
          {data.contact.phone && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', marginBottom: 5 }}>☎ {data.contact.phone}</div>}
          {data.contact.location && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', marginBottom: 5 }}>⊙ {data.contact.location}</div>}
          {data.contact.linkedin && <div style={{ fontSize: 8, color: gold }}>in LinkedIn</div>}
        </BMSide>

        {data.skills.length > 0 && (
          <BMSide title="Compétences" navy={navy} gold={gold}>
            {data.skills.map(s => (
              <div key={s.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 2 }}>
                  <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{s.name}</span>
                  <span style={{ color: gold, fontSize: 7 }}>{s.level}%</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 3, height: 3 }}>
                  <div style={{ background: gold, borderRadius: 3, height: 3, width: `${s.level}%` }} />
                </div>
              </div>
            ))}
          </BMSide>
        )}

        {data.languages.length > 0 && (
          <BMSide title="Langues" navy={navy} gold={gold}>
            {data.languages.map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 5 }}>
                <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{l.name}</span>
                <span style={{ color: gold }}>{l.level}</span>
              </div>
            ))}
          </BMSide>
        )}

        {data.certifications_external.length > 0 && (
          <BMSide title="Certifications" navy={navy} gold={gold}>
            {data.certifications_external.map(cert => (
              <div key={cert.id} style={{ marginBottom: 6, fontSize: 8 }}>
                <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{cert.name}</div>
                <div style={{ color: gold }}>{cert.issuer} · {cert.year}</div>
              </div>
            ))}
          </BMSide>
        )}

        {data.interests.length > 0 && (
          <BMSide title="Intérêts" navy={navy} gold={gold}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>{Array.isArray(data.interests) ? data.interests.join(' · ') : data.interests}</div>
          </BMSide>
        )}
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: '28px 24px' }}>
        <div style={{ marginBottom: 20, paddingBottom: 14 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: navy, lineHeight: 1.1 }}>{data.name || 'Votre Nom'}</div>
          <div style={{ fontSize: 11, color: gold, fontWeight: 700, marginTop: 4, letterSpacing: '0.05em' }}>{data.title || 'Business Manager'}</div>
          <div style={{ height: 3, background: `linear-gradient(to right, ${navy}, ${gold}, transparent)`, marginTop: 10, borderRadius: 2 }} />
        </div>

        {data.summary && <BMMain title="À propos" navy={navy} gold={gold} fs={fs}><p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing }}>{data.summary}</p></BMMain>}

        {data.experiences.length > 0 && (
          <BMMain title="Expérience professionnelle" navy={navy} gold={gold} fs={fs}>
            {data.experiences.map(exp => (
              <div key={exp.id} style={{ marginBottom: 13, paddingLeft: 10, borderLeft: `3px solid ${gold}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: fs + 1, fontWeight: 700, color: navy }}>{exp.position}</div>
                    <div style={{ fontSize: fs, color: gold, fontWeight: 600 }}>{exp.company}{exp.location ? ` · ${exp.location}` : ''}</div>
                  </div>
                  <div style={{ fontSize: 8, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{fmtDate(exp.start_date)} — {exp.current ? 'Présent' : fmtDate(exp.end_date || '')}</div>
                </div>
                {exp.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.6, marginTop: 3 }}>{exp.description}</p>}
              </div>
            ))}
          </BMMain>
        )}

        {data.omnia_formations.filter(f => f.show).length > 0 && (
          <BMMain title="Formations Omnia Global Academy" navy={navy} gold={gold} fs={fs}>
            {data.omnia_formations.filter(f => f.show).map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <div><div style={{ fontSize: fs, fontWeight: 700, color: navy }}>{f.title}</div><div style={{ fontSize: 7, color: gold }}>Omnia Global Academy{f.cpd_accredited ? ' · CPD' : ''}</div></div>
                <div style={{ fontSize: 8, color: '#9CA3AF' }}>{fmtDate(f.completed_at)}</div>
              </div>
            ))}
          </BMMain>
        )}

        {data.education.length > 0 && (
          <BMMain title="Formation académique" navy={navy} gold={gold} fs={fs}>
            {data.education.map(edu => (
              <div key={edu.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div><div style={{ fontSize: fs, fontWeight: 700, color: navy }}>{edu.degree}</div><div style={{ fontSize: fs - 1, color: '#374151' }}>{edu.school}</div></div>
                <div style={{ fontSize: 8, color: '#9CA3AF' }}>{edu.year}</div>
              </div>
            ))}
          </BMMain>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 17. HOSPITALITY PREMIUM
// Tons chauds dorés, élégant, hôtellerie restauration
// ══════════════════════════════════════════════════════════
export function HospitalityPremium({ data, design }: { data: DocData; design: DesignOptions }) {
  const c = design.colors;
  const fs = design.font_size_body;
  const brown = c.primary || '#78350F';
  const amber = c.accent || '#D97706';

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily: 'Georgia, serif', fontSize: fs, background: '#FFFBEB' }}>
      {/* Header élégant */}
      <div style={{ background: brown, padding: '28px 36px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 160, height: '100%', background: `${amber}20` }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, position: 'relative', zIndex: 1 }}>
          {design.photo_enabled && (
            <div style={{ flexShrink: 0 }}>
              <div style={{ width: 85, height: 85, borderRadius: '50%', border: `3px solid ${amber}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Avatar name={data.name} photoUrl={data.photo_url} size={79} shape="round" />
              </div>
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: 'white', fontFamily: 'Georgia, serif' }}>{data.name || 'Votre Nom'}</div>
            <div style={{ fontSize: 10, color: amber, fontWeight: 600, marginTop: 4, letterSpacing: '0.08em', fontFamily: 'Arial, sans-serif' }}>{data.title || 'Responsable Hôtelière'}</div>
            <div style={{ display: 'flex', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
              {data.contact.email && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', fontFamily: 'Arial, sans-serif' }}>✉ {data.contact.email}</span>}
              {data.contact.phone && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', fontFamily: 'Arial, sans-serif' }}>☎ {data.contact.phone}</span>}
              {data.contact.location && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', fontFamily: 'Arial, sans-serif' }}>⊙ {data.contact.location}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Corps */}
      <div style={{ display: 'flex' }}>
        {/* Sidebar chaude */}
        <div style={{ width: 210, background: '#FEF3C7', padding: '20px 16px', borderRight: `2px solid ${amber}40` }}>
          {data.skills.length > 0 && (
            <HospSection title="Compétences" brown={brown} amber={amber}>
              {data.skills.map(s => (
                <div key={s.id} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 2, fontFamily: 'Arial, sans-serif' }}>
                    <span style={{ color: '#374151', fontWeight: 600 }}>{s.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {[1, 2, 3, 4, 5].map(dot => (
                      <div key={dot} style={{ flex: 1, height: 4, borderRadius: 2, background: (s.level / 100 * 5) >= dot ? amber : '#E5E7EB' }} />
                    ))}
                  </div>
                </div>
              ))}
            </HospSection>
          )}
          {data.languages.length > 0 && (
            <HospSection title="Langues" brown={brown} amber={amber}>
              {data.languages.map(l => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 5, fontFamily: 'Arial, sans-serif' }}>
                  <span style={{ fontWeight: 600, color: '#374151' }}>{l.name}</span>
                  <span style={{ color: amber, fontWeight: 600 }}>{l.level}</span>
                </div>
              ))}
            </HospSection>
          )}
          {data.certifications_external.length > 0 && (
            <HospSection title="Certifications" brown={brown} amber={amber}>
              {data.certifications_external.map(cert => (
                <div key={cert.id} style={{ marginBottom: 7, fontSize: 8, fontFamily: 'Arial, sans-serif' }}>
                  <div style={{ fontWeight: 700, color: brown }}>{cert.name}</div>
                  <div style={{ color: '#6B7280' }}>{cert.issuer} · {cert.year}</div>
                </div>
              ))}
            </HospSection>
          )}
          {data.interests.length > 0 && (
            <HospSection title="Intérêts" brown={brown} amber={amber}>
              <div style={{ fontSize: 8, color: '#6B7280', lineHeight: 1.7, fontFamily: 'Arial, sans-serif' }}>{Array.isArray(data.interests) ? data.interests.join(' · ') : data.interests}</div>
            </HospSection>
          )}
        </div>

        {/* Main */}
        <div style={{ flex: 1, padding: '20px 24px', fontFamily: 'Arial, sans-serif' }}>
          {data.summary && <HospMain title="Profil" brown={brown} amber={amber} fs={fs}><p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing }}>{data.summary}</p></HospMain>}
          {data.experiences.length > 0 && (
            <HospMain title="Expérience professionnelle" brown={brown} amber={amber} fs={fs}>
              {data.experiences.map(exp => (
                <div key={exp.id} style={{ marginBottom: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div><div style={{ fontSize: fs + 1, fontWeight: 700, color: brown }}>{exp.position}</div><div style={{ fontSize: fs, color: amber, fontWeight: 600 }}>{exp.company}{exp.location ? ` · ${exp.location}` : ''}</div></div>
                    <div style={{ fontSize: 8, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{fmtDate(exp.start_date)} — {exp.current ? 'Présent' : fmtDate(exp.end_date || '')}</div>
                  </div>
                  {exp.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.6, marginTop: 3 }}>{exp.description}</p>}
                </div>
              ))}
            </HospMain>
          )}
          {data.education.length > 0 && (
            <HospMain title="Formation" brown={brown} amber={amber} fs={fs}>
              {data.education.map(edu => (
                <div key={edu.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div><div style={{ fontSize: fs, fontWeight: 700, color: brown }}>{edu.degree}</div><div style={{ fontSize: fs - 1, color: '#374151' }}>{edu.school}</div></div>
                  <div style={{ fontSize: 8, color: '#9CA3AF' }}>{edu.year}</div>
                </div>
              ))}
            </HospMain>
          )}
          {data.omnia_formations.filter(f => f.show).length > 0 && (
            <HospMain title="Certifications Omnia" brown={brown} amber={amber} fs={fs}>
              {data.omnia_formations.filter(f => f.show).map(f => (
                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                  <div><div style={{ fontSize: fs, fontWeight: 700, color: brown }}>{f.title}</div><div style={{ fontSize: 7, color: amber }}>Omnia Global Academy</div></div>
                  <div style={{ fontSize: 8, color: '#9CA3AF' }}>{fmtDate(f.completed_at)}</div>
                </div>
              ))}
            </HospMain>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 18. ACADEMIC CV
// Sobre et académique, publications, cours enseignés
// ══════════════════════════════════════════════════════════
export function AcademicCv({ data, design }: { data: DocData; design: DesignOptions }) {
  const c = design.colors;
  const fs = design.font_size_body;
  const indigo = c.primary || '#1E3A5F';
  const violet = c.accent || '#6366F1';

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily: 'Georgia, serif', fontSize: fs, background: '#fff', padding: '36px 44px' }}>
      {/* Header académique */}
      <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: `2px solid ${indigo}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
          {design.photo_enabled && (
            <Avatar name={data.name} photoUrl={data.photo_url} size={75} shape="square" borderColor="#E4E7EC" />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: indigo, fontFamily: 'Georgia, serif' }}>{data.name || 'Votre Nom'}</div>
            <div style={{ fontSize: 11, color: violet, fontWeight: 600, marginTop: 4, fontFamily: 'Arial, sans-serif', letterSpacing: '0.03em' }}>{data.title || 'Enseignant-Chercheur'}</div>
            <div style={{ display: 'flex', gap: 20, marginTop: 8, flexWrap: 'wrap' }}>
              {data.contact.email && <span style={{ fontSize: 8, color: '#6B7280', fontFamily: 'Arial, sans-serif' }}>✉ {data.contact.email}</span>}
              {data.contact.phone && <span style={{ fontSize: 8, color: '#6B7280', fontFamily: 'Arial, sans-serif' }}>☎ {data.contact.phone}</span>}
              {data.contact.location && <span style={{ fontSize: 8, color: '#6B7280', fontFamily: 'Arial, sans-serif' }}>⊙ {data.contact.location}</span>}
              {data.contact.linkedin && <span style={{ fontSize: 8, color: violet, fontFamily: 'Arial, sans-serif' }}>in LinkedIn</span>}
              {data.contact.portfolio && <span style={{ fontSize: 8, color: violet, fontFamily: 'Arial, sans-serif' }}>🌐 Portfolio</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Corps 2 colonnes */}
      <div style={{ display: 'flex', gap: 32 }}>
        {/* Colonne principale */}
        <div style={{ flex: 2 }}>
          {data.summary && <AcadSection title="Résumé" indigo={indigo} violet={violet} fs={fs}><p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>{data.summary}</p></AcadSection>}
          {data.experiences.length > 0 && (
            <AcadSection title="Expérience académique" indigo={indigo} violet={violet} fs={fs}>
              {data.experiences.map(exp => (
                <div key={exp.id} style={{ marginBottom: 14, fontFamily: 'Arial, sans-serif' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: fs, fontWeight: 700, color: indigo }}>{exp.position}</div>
                    <div style={{ fontSize: 8, color: '#9CA3AF' }}>{fmtDate(exp.start_date)} — {exp.current ? 'Présent' : fmtDate(exp.end_date || '')}</div>
                  </div>
                  <div style={{ fontSize: fs - 1, color: violet, fontStyle: 'italic' }}>{exp.company}{exp.location ? `, ${exp.location}` : ''}</div>
                  {exp.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.7, marginTop: 3 }}>{exp.description}</p>}
                </div>
              ))}
            </AcadSection>
          )}
          {data.education.length > 0 && (
            <AcadSection title="Formation" indigo={indigo} violet={violet} fs={fs}>
              {data.education.map(edu => (
                <div key={edu.id} style={{ marginBottom: 10, fontFamily: 'Arial, sans-serif' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: fs, fontWeight: 700, color: indigo }}>{edu.degree}</div>
                    <div style={{ fontSize: 8, color: '#9CA3AF' }}>{edu.year}</div>
                  </div>
                  <div style={{ fontSize: fs - 1, color: violet, fontStyle: 'italic' }}>{edu.school}{edu.location ? `, ${edu.location}` : ''}</div>
                </div>
              ))}
            </AcadSection>
          )}
          {data.projects.length > 0 && (
            <AcadSection title="Publications & Recherches" indigo={indigo} violet={violet} fs={fs}>
              {data.projects.map(p => (
                <div key={p.id} style={{ marginBottom: 10, fontFamily: 'Arial, sans-serif' }}>
                  <div style={{ fontSize: fs, fontWeight: 700, color: indigo }}>{p.name}</div>
                  {p.technologies && <div style={{ fontSize: fs - 1, color: violet, fontStyle: 'italic' }}>{p.technologies}</div>}
                  {p.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.6, marginTop: 2 }}>{p.description}</p>}
                </div>
              ))}
            </AcadSection>
          )}
          {data.omnia_formations.filter(f => f.show).length > 0 && (
            <AcadSection title="Formations Omnia Global Academy" indigo={indigo} violet={violet} fs={fs}>
              {data.omnia_formations.filter(f => f.show).map(f => (
                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7, fontFamily: 'Arial, sans-serif' }}>
                  <div><div style={{ fontSize: fs, fontWeight: 700, color: indigo }}>{f.title}</div><div style={{ fontSize: 7, color: violet }}>Omnia Global Academy{f.cpd_accredited ? ' · CPD' : ''}</div></div>
                  <div style={{ fontSize: 8, color: '#9CA3AF' }}>{fmtDate(f.completed_at)}</div>
                </div>
              ))}
            </AcadSection>
          )}
        </div>

        {/* Colonne secondaire */}
        <div style={{ flex: 1 }}>
          {data.skills.length > 0 && (
            <AcadSection title="Domaines de compétence" indigo={indigo} violet={violet} fs={fs}>
              {data.skills.map(s => (
                <div key={s.id} style={{ marginBottom: 6, fontSize: 8, fontFamily: 'Arial, sans-serif' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: '#374151', fontWeight: 600 }}>{s.name}</span>
                  </div>
                  <div style={{ background: '#EEF2FF', borderRadius: 3, height: 3 }}>
                    <div style={{ background: violet, borderRadius: 3, height: 3, width: `${s.level}%` }} />
                  </div>
                </div>
              ))}
            </AcadSection>
          )}
          {data.languages.length > 0 && (
            <AcadSection title="Langues" indigo={indigo} violet={violet} fs={fs}>
              {data.languages.map(l => (
                <div key={l.id} style={{ marginBottom: 6, fontSize: 8, fontFamily: 'Arial, sans-serif' }}>
                  <div style={{ fontWeight: 700, color: indigo }}>{l.name}</div>
                  <div style={{ color: violet, fontStyle: 'italic' }}>{l.level}</div>
                </div>
              ))}
            </AcadSection>
          )}
          {data.certifications_external.length > 0 && (
            <AcadSection title="Certifications" indigo={indigo} violet={violet} fs={fs}>
              {data.certifications_external.map(cert => (
                <div key={cert.id} style={{ marginBottom: 7, fontSize: 8, fontFamily: 'Arial, sans-serif' }}>
                  <div style={{ fontWeight: 700, color: indigo }}>{cert.name}</div>
                  <div style={{ color: violet }}>{cert.issuer} · {cert.year}</div>
                </div>
              ))}
            </AcadSection>
          )}
          {data.interests.length > 0 && (
            <AcadSection title="Intérêts de recherche" indigo={indigo} violet={violet} fs={fs}>
              <div style={{ fontSize: 8, color: '#6B7280', lineHeight: 1.7, fontFamily: 'Arial, sans-serif' }}>{Array.isArray(data.interests) ? data.interests.join(' · ') : data.interests}</div>
            </AcadSection>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 19. FREELANCER PORTFOLIO
// Sidebar sombre, projets mis en avant, liens et réalisations
// ══════════════════════════════════════════════════════════
export function FreelancerPortfolio({ data, design }: { data: DocData; design: DesignOptions }) {
  const c = design.colors;
  const fs = design.font_size_body;
  const dark = c.primary || '#0F172A';
  const amber = c.accent || '#F59E0B';

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily: 'Arial, sans-serif', fontSize: fs, background: '#fff', display: 'flex' }}>
      {/* Sidebar sombre */}
      <div style={{ width: 225, minWidth: 225, background: dark, padding: '28px 16px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 100, height: 100, background: `${amber}10`, borderRadius: '0 0 0 100%' }} />
        <div style={{ position: 'absolute', bottom: 60, left: -20, width: 80, height: 80, background: `${amber}08`, borderRadius: '50%' }} />

        {design.photo_enabled && (
          <div style={{ textAlign: 'center', marginBottom: 14, position: 'relative', zIndex: 1 }}>
            <div style={{ width: 82, height: 82, borderRadius: '50%', border: `3px solid ${amber}`, overflow: 'hidden', margin: '0 auto' }}>
              <Avatar name={data.name} photoUrl={data.photo_url} size={76} shape="round" />
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: 20, position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: 'white' }}>{data.name || 'Votre Nom'}</div>
          <div style={{ fontSize: 8, color: amber, marginTop: 3, letterSpacing: '0.08em' }}>{data.title || 'Développeur Web Freelance'}</div>
        </div>

        <FLSide title="Contact" dark={dark} amber={amber}>
          {data.contact.email && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', marginBottom: 5, wordBreak: 'break-all' }}>✉ {data.contact.email}</div>}
          {data.contact.phone && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', marginBottom: 5 }}>☎ {data.contact.phone}</div>}
          {data.contact.location && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', marginBottom: 5 }}>⊙ {data.contact.location}</div>}
          {data.contact.linkedin && <div style={{ fontSize: 8, color: amber, marginBottom: 4 }}>in LinkedIn</div>}
          {data.contact.portfolio && <div style={{ fontSize: 8, color: amber }}>🌐 Portfolio</div>}
        </FLSide>

        {data.skills.length > 0 && (
          <FLSide title="Technologies" dark={dark} amber={amber}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {data.skills.map(s => (
                <span key={s.id} style={{ fontSize: 7, padding: '2px 7px', background: `${amber}20`, color: amber, borderRadius: 4, fontWeight: 600 }}>{s.name}</span>
              ))}
            </div>
          </FLSide>
        )}

        {data.languages.length > 0 && (
          <FLSide title="Langues" dark={dark} amber={amber}>
            {data.languages.map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 5 }}>
                <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{l.name}</span>
                <span style={{ color: amber }}>{l.level}</span>
              </div>
            ))}
          </FLSide>
        )}

        {data.certifications_external.length > 0 && (
          <FLSide title="Certifications" dark={dark} amber={amber}>
            {data.certifications_external.map(cert => (
              <div key={cert.id} style={{ marginBottom: 6, fontSize: 8 }}>
                <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{cert.name}</div>
                <div style={{ color: amber }}>{cert.issuer} · {cert.year}</div>
              </div>
            ))}
          </FLSide>
        )}
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: '28px 24px' }}>
        <div style={{ marginBottom: 20, paddingBottom: 14, borderBottom: `3px solid ${amber}` }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: dark }}>{data.name || 'Votre Nom'}</div>
          <div style={{ fontSize: 10, color: amber, fontWeight: 700, marginTop: 3 }}>{data.title || 'Développeur Web Freelance'}</div>
        </div>

        {data.summary && <FLMain title="À propos" dark={dark} amber={amber} fs={fs}><p style={{ fontSize: fs, color: '#374151', lineHeight: design.line_spacing }}>{data.summary}</p></FLMain>}

        {data.projects.length > 0 && (
          <FLMain title="Réalisations & Projets" dark={dark} amber={amber} fs={fs}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {data.projects.map(p => (
                <div key={p.id} style={{ padding: '8px 10px', background: '#F8FAFC', borderRadius: 6, border: `1px solid #E4E7EC`, borderTop: `2px solid ${amber}` }}>
                  <div style={{ fontSize: fs, fontWeight: 700, color: dark }}>{p.name}</div>
                  {p.technologies && <div style={{ fontSize: 7, color: amber, marginBottom: 2 }}>{p.technologies}</div>}
                  {p.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.5, marginTop: 2 }}>{p.description}</p>}
                </div>
              ))}
            </div>
          </FLMain>
        )}

        {data.experiences.length > 0 && (
          <FLMain title="Expérience" dark={dark} amber={amber} fs={fs}>
            {data.experiences.map(exp => (
              <div key={exp.id} style={{ marginBottom: 12, paddingLeft: 10, borderLeft: `2px solid ${amber}60` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: fs, fontWeight: 700, color: dark }}>{exp.position}</div>
                  <div style={{ fontSize: 8, color: '#9CA3AF' }}>{fmtDate(exp.start_date)} — {exp.current ? 'Présent' : fmtDate(exp.end_date || '')}</div>
                </div>
                <div style={{ fontSize: fs - 1, color: amber, fontWeight: 600 }}>{exp.company}</div>
                {exp.description && <p style={{ fontSize: fs - 1, color: '#6B7280', lineHeight: 1.5, marginTop: 2 }}>{exp.description}</p>}
              </div>
            ))}
          </FLMain>
        )}

        {data.education.length > 0 && (
          <FLMain title="Formation" dark={dark} amber={amber} fs={fs}>
            {data.education.map(edu => (
              <div key={edu.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <div><div style={{ fontSize: fs, fontWeight: 700, color: dark }}>{edu.degree}</div><div style={{ fontSize: fs - 1, color: '#6B7280' }}>{edu.school}</div></div>
                <div style={{ fontSize: 8, color: '#9CA3AF' }}>{edu.year}</div>
              </div>
            ))}
          </FLMain>
        )}

        {data.omnia_formations.filter(f => f.show).length > 0 && (
          <FLMain title="Certifications Omnia" dark={dark} amber={amber} fs={fs}>
            {data.omnia_formations.filter(f => f.show).map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <div><div style={{ fontSize: fs, fontWeight: 700, color: dark }}>{f.title}</div><div style={{ fontSize: 7, color: amber }}>Omnia Global Academy</div></div>
                <div style={{ fontSize: 8, color: '#9CA3AF' }}>{fmtDate(f.completed_at)}</div>
              </div>
            ))}
          </FLMain>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// 20. EXECUTIVE ONE PAGE
// Fond doré premium, une page, profil fort, leadership
// ══════════════════════════════════════════════════════════
export function ExecutiveOnePage({ data, design }: { data: DocData; design: DesignOptions }) {
  const c = design.colors;
  const fs = design.font_size_body;
  const dark = c.primary || '#0D1B2A';
  const gold = c.accent || '#BF8813';

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily: 'Arial, sans-serif', fontSize: fs, background: dark, display: 'flex' }}>
      {/* Sidebar dorée */}
      <div style={{ width: 230, minWidth: 230, background: `${gold}15`, padding: '32px 18px', borderRight: `2px solid ${gold}40`, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: gold }} />

        {design.photo_enabled && (
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ width: 85, height: 85, borderRadius: '50%', border: `3px solid ${gold}`, overflow: 'hidden', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${gold}20` }}>
              <Avatar name={data.name} photoUrl={data.photo_url} size={79} shape="round" />
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: 'white', lineHeight: 1.2 }}>{data.name || 'Votre Nom'}</div>
          <div style={{ fontSize: 8, color: gold, marginTop: 4, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{data.title || 'Directeur Général'}</div>
          <div style={{ width: 30, height: 1, background: gold, margin: '10px auto' }} />
        </div>

        <ExecSide title="Contact" gold={gold}>
          {data.contact.email && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.75)', marginBottom: 6, wordBreak: 'break-all' }}>✉ {data.contact.email}</div>}
          {data.contact.phone && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>☎ {data.contact.phone}</div>}
          {data.contact.location && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>⊙ {data.contact.location}</div>}
          {data.contact.linkedin && <div style={{ fontSize: 8, color: gold, marginBottom: 6 }}>in LinkedIn</div>}
        </ExecSide>

        {data.skills.length > 0 && (
          <ExecSide title="Compétences clés" gold={gold}>
            {data.skills.slice(0, 6).map(s => (
              <div key={s.id} style={{ marginBottom: 7 }}>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.9)', fontWeight: 600, marginBottom: 2 }}>{s.name}</div>
                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 2, height: 3 }}>
                  <div style={{ background: gold, borderRadius: 2, height: 3, width: `${s.level}%` }} />
                </div>
              </div>
            ))}
          </ExecSide>
        )}

        {data.languages.length > 0 && (
          <ExecSide title="Langues" gold={gold}>
            {data.languages.map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 5 }}>
                <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{l.name}</span>
                <span style={{ color: gold }}>{l.level}</span>
              </div>
            ))}
          </ExecSide>
        )}

        {data.certifications_external.length > 0 && (
          <ExecSide title="Certifications" gold={gold}>
            {data.certifications_external.map(cert => (
              <div key={cert.id} style={{ marginBottom: 6, fontSize: 8 }}>
                <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{cert.name}</div>
                <div style={{ color: gold }}>{cert.issuer} · {cert.year}</div>
              </div>
            ))}
          </ExecSide>
        )}
      </div>

      {/* Main doré */}
      <div style={{ flex: 1, padding: '32px 26px', background: dark }}>
        <div style={{ marginBottom: 22, paddingBottom: 14, borderBottom: `1px solid ${gold}40` }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'white' }}>{data.name || 'Votre Nom'}</div>
          <div style={{ fontSize: 10, color: gold, fontWeight: 700, marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{data.title || 'Directeur Général'}</div>
        </div>

        {data.summary && (
          <div style={{ marginBottom: 18 }}>
            <ExecMain title="Profil" gold={gold} fs={fs} />
            <p style={{ fontSize: fs, color: 'rgba(255,255,255,0.8)', lineHeight: design.line_spacing }}>{data.summary}</p>
          </div>
        )}

        {data.experiences.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <ExecMain title="Réalisations clés" gold={gold} fs={fs} />
            {data.experiences.map(exp => (
              <div key={exp.id} style={{ marginBottom: 12, paddingLeft: 10, borderLeft: `2px solid ${gold}60` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: fs + 1, fontWeight: 700, color: 'white' }}>{exp.position}</div>
                    <div style={{ fontSize: fs, color: gold, fontWeight: 600 }}>{exp.company}{exp.location ? ` · ${exp.location}` : ''}</div>
                  </div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>{fmtDate(exp.start_date)} — {exp.current ? 'Présent' : fmtDate(exp.end_date || '')}</div>
                </div>
                {exp.description && <p style={{ fontSize: fs - 1, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, marginTop: 3 }}>{exp.description}</p>}
              </div>
            ))}
          </div>
        )}

        {data.omnia_formations.filter(f => f.show).length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <ExecMain title="Formations Omnia Global Academy" gold={gold} fs={fs} />
            {data.omnia_formations.filter(f => f.show).map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <div><div style={{ fontSize: fs, fontWeight: 700, color: 'white' }}>{f.title}</div><div style={{ fontSize: 7, color: gold }}>Omnia Global Academy{f.cpd_accredited ? ' · CPD' : ''}</div></div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>{fmtDate(f.completed_at)}</div>
              </div>
            ))}
          </div>
        )}

        {data.education.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <ExecMain title="Formation" gold={gold} fs={fs} />
            {data.education.map(edu => (
              <div key={edu.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div><div style={{ fontSize: fs, fontWeight: 700, color: 'white' }}>{edu.degree}</div><div style={{ fontSize: fs - 1, color: 'rgba(255,255,255,0.6)' }}>{edu.school}{edu.location ? ` · ${edu.location}` : ''}</div></div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>{edu.year}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────
function BMSide({ title, navy, gold, children }: { title: string; navy: string; gold: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: gold, letterSpacing: '0.15em', textTransform: 'uppercase', borderBottom: `1px solid ${gold}50`, paddingBottom: 4, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function BMMain({ title, navy, gold, fs, children }: { title: string; navy: string; gold: string; fs: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: fs - 1, fontWeight: 700, color: navy, textTransform: 'uppercase', letterSpacing: '0.1em', borderLeft: `3px solid ${gold}`, paddingLeft: 8, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function HospSection({ title, brown, amber, children }: { title: string; brown: string; amber: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: brown, textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: `2px solid ${amber}`, paddingBottom: 4, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function HospMain({ title, brown, amber, fs, children }: { title: string; brown: string; amber: string; fs: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: fs - 1, fontWeight: 700, color: brown, textTransform: 'uppercase', letterSpacing: '0.1em', borderLeft: `3px solid ${amber}`, paddingLeft: 8, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function AcadSection({ title, indigo, violet, fs, children }: { title: string; indigo: string; violet: string; fs: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: fs - 1, fontWeight: 700, color: indigo, fontFamily: 'Georgia, serif', borderBottom: `1px solid ${violet}40`, paddingBottom: 4, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function FLSide({ title, dark, amber, children }: { title: string; dark: string; amber: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: amber, letterSpacing: '0.15em', textTransform: 'uppercase', borderBottom: `1px solid ${amber}30`, paddingBottom: 4, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function FLMain({ title, dark, amber, fs, children }: { title: string; dark: string; amber: string; fs: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: fs - 1, fontWeight: 700, color: dark, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div style={{ width: 16, height: 2, background: amber, borderRadius: 1 }} />{title}
      </div>
      {children}
    </div>
  );
}
function ExecSide({ title, gold, children }: { title: string; gold: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: gold, letterSpacing: '0.15em', textTransform: 'uppercase', borderBottom: `1px solid ${gold}40`, paddingBottom: 4, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function ExecMain({ title, gold, fs }: { title: string; gold: string; fs: number }) {
  return (
    <div style={{ fontSize: fs - 1, fontWeight: 700, color: gold, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 20, height: 1, background: gold }} />{title}<div style={{ flex: 1, height: 1, background: `${gold}30` }} />
    </div>
  );
}

export const CV_TEMPLATE_MAP_16_20: Record<string, React.ComponentType<{ data: DocData; design: DesignOptions }>> = {
  business_manager: BusinessManager,
  hospitality: HospitalityPremium,
  academic_cv: AcademicCv,
  freelancer: FreelancerPortfolio,
  executive_one_page: ExecutiveOnePage,
};
