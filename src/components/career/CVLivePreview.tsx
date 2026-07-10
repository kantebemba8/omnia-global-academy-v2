import type { CVData } from './CVBuilderEditor';

export function CVLivePreview({ data, themeColor }: { data: CVData; themeColor: string }) {
  const profile = data.sections.find(s => s.section_type === 'profile')?.content_json as any || {};
  const skills = (data.sections.find(s => s.section_type === 'skills')?.content_json as any)?.items || [];
  const experiences = (data.sections.find(s => s.section_type === 'experiences')?.content_json as any)?.items || [];
  const education = (data.sections.find(s => s.section_type === 'education')?.content_json as any)?.items || [];
  const certifications = (data.sections.find(s => s.section_type === 'certifications')?.content_json as any)?.items || [];
  const languages = (data.sections.find(s => s.section_type === 'languages')?.content_json as any)?.items || [];
  const interests = (data.sections.find(s => s.section_type === 'interests')?.content_json as any)?.items || [];

  return (
    <div className="mx-auto w-full max-w-[700px] overflow-hidden rounded-2xl shadow-xl" style={{ fontFamily: 'Inter, Arial, sans-serif', background: 'white' }}>
      <div className="flex min-h-[900px]">
        {/* Sidebar */}
        <div className="w-[200px] flex-shrink-0 p-5" style={{ background: themeColor, color: 'white' }}>
          {/* Photo placeholder */}
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/30 bg-white/10 text-xl font-bold">
            {(profile.fullName || 'LA').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>

          {/* Contact */}
          <div className="mb-5 space-y-1 text-[10px]">
            {profile.email && <div className="truncate opacity-90">✉ {profile.email}</div>}
            {profile.phone && <div className="opacity-90">☎ {profile.phone}</div>}
            {profile.location && <div className="opacity-90">📍 {profile.location}</div>}
            {profile.linkedin && <div className="truncate opacity-80">🔗 {profile.linkedin}</div>}
          </div>

          {/* Compétences */}
          {skills.length > 0 && (
            <div className="mb-5">
              <div className="mb-2 text-[9px] font-bold uppercase tracking-widest opacity-70">Compétences</div>
              <div className="space-y-1">
                {skills.slice(0, 10).map((s: string, i: number) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="h-1 flex-1 rounded-full bg-white/20">
                      <div className="h-full rounded-full bg-white/80" style={{ width: `${70 + (i % 3) * 10}%` }} />
                    </div>
                    <span className="text-[9px] opacity-90">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Langues */}
          {languages.length > 0 && (
            <div className="mb-5">
              <div className="mb-2 text-[9px] font-bold uppercase tracking-widest opacity-70">Langues</div>
              {languages.map((l: any, i: number) => (
                <div key={i} className="mb-1 text-[9px]">
                  <span className="font-semibold">{l.language}</span>
                  <span className="ml-1 opacity-70">— {l.level}</span>
                </div>
              ))}
            </div>
          )}

          {/* Centres d'intérêt */}
          {interests.length > 0 && (
            <div>
              <div className="mb-2 text-[9px] font-bold uppercase tracking-widest opacity-70">Intérêts</div>
              <div className="flex flex-wrap gap-1">
                {interests.map((item: string, i: number) => (
                  <span key={i} className="rounded px-1.5 py-0.5 text-[8px]" style={{ background: 'rgba(255,255,255,0.15)' }}>{item}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Corps principal */}
        <div className="flex-1 p-6">
          {/* En-tête */}
          <div className="mb-5 border-b pb-4" style={{ borderColor: '#E5E7EB' }}>
            <h1 className="text-xl font-bold" style={{ color: themeColor }}>
              {profile.fullName || 'Votre Nom'}
            </h1>
            <div className="text-sm font-medium" style={{ color: '#bf8813' }}>
              {profile.jobTitle || 'Titre professionnel'}
            </div>
            {profile.summary && (
              <p className="mt-2 text-[11px] leading-relaxed" style={{ color: '#374151' }}>
                {profile.summary}
              </p>
            )}
          </div>

          {/* Expériences */}
          {experiences.length > 0 && (
            <div className="mb-5">
              <SectionTitle color={themeColor}>Expériences professionnelles</SectionTitle>
              {experiences.map((exp: any, i: number) => (
                <div key={i} className="mb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[11px] font-bold" style={{ color: '#002050' }}>{exp.jobTitle}</div>
                      <div className="text-[10px] font-medium" style={{ color: '#bf8813' }}>{exp.company}{exp.location ? ` — ${exp.location}` : ''}</div>
                    </div>
                    <div className="text-[9px]" style={{ color: '#9CA3AF' }}>
                      {exp.startDate}{exp.endDate ? ` — ${exp.endDate}` : ''}
                    </div>
                  </div>
                  {exp.description && Array.isArray(exp.description) && (
                    <ul className="mt-1 space-y-0.5">
                      {exp.description.map((d: string, j: number) => (
                        <li key={j} className="flex items-start gap-1 text-[10px]" style={{ color: '#374151' }}>
                          <span className="mt-0.5 flex-shrink-0" style={{ color: themeColor }}>•</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Formation */}
          {education.length > 0 && (
            <div className="mb-5">
              <SectionTitle color={themeColor}>Formation académique</SectionTitle>
              {education.map((edu: any, i: number) => (
                <div key={i} className="mb-2 flex items-start justify-between">
                  <div>
                    <div className="text-[11px] font-bold" style={{ color: '#002050' }}>{edu.degree}</div>
                    <div className="text-[10px]" style={{ color: '#6B7280' }}>{edu.school}{edu.location ? ` — ${edu.location}` : ''}</div>
                  </div>
                  <div className="text-[9px]" style={{ color: '#9CA3AF' }}>
                    {edu.startDate}{edu.endDate ? ` — ${edu.endDate}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Certifications */}
          {certifications.length > 0 && (
            <div>
              <SectionTitle color={themeColor}>Certifications</SectionTitle>
              {certifications.map((cert: any, i: number) => (
                <div key={i} className="mb-1 flex items-center justify-between text-[10px]">
                  <span className="font-medium" style={{ color: '#002050' }}>{cert.title}</span>
                  <span style={{ color: '#9CA3AF' }}>{cert.issuer} {cert.date ? `— ${cert.date}` : ''}</span>
                </div>
              ))}
            </div>
          )}

          {/* Placeholder si vide */}
          {!profile.fullName && experiences.length === 0 && (
            <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed text-sm" style={{ borderColor: '#E5E7EB', color: '#9CA3AF' }}>
              Remplissez les sections pour voir l'aperçu de votre CV
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <div className="h-0.5 w-4 rounded" style={{ background: color }} />
      <h2 className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>{children}</h2>
      <div className="h-0.5 flex-1 rounded" style={{ background: '#E5E7EB' }} />
    </div>
  );
}
