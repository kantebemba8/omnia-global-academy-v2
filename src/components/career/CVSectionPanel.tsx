import { useState } from 'react';
import {
  ChevronDown, ChevronUp, Eye, EyeOff, Plus, Trash2, GripVertical
} from 'lucide-react';
import type { CVSection } from './CVBuilderEditor';

const SECTION_LABELS: Record<string, string> = {
  profile: 'Profil',
  skills: 'Compétences',
  experiences: 'Expériences',
  education: 'Formation',
  certifications: 'Certifications',
  languages: 'Langues',
  interests: 'Centres d\'intérêt',
};

const AVAILABLE_SECTIONS = Object.keys(SECTION_LABELS);

interface Props {
  sections: CVSection[];
  activeSection: string | null;
  onSelect: (type: string) => void;
  onToggleVisible: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: (type: string) => void;
}

export function CVSectionPanel({ sections, activeSection, onSelect, onToggleVisible, onDelete, onAdd }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const existingTypes = sections.map(s => s.section_type);
  const addableSections = AVAILABLE_SECTIONS.filter(t => !existingTypes.includes(t));

  return (
    <div className="flex flex-col h-full">
      <div className="mb-3">
        <h2 className="text-base font-semibold" style={{ color: '#002050' }}>Sections du CV</h2>
        <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>Cliquez sur une section pour la modifier.</p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {sections.sort((a, b) => a.position - b.position).map(section => (
          <div key={section.id}
            className="flex items-center gap-2 rounded-xl border p-3 cursor-pointer transition-all"
            style={{
              borderColor: activeSection === section.section_type ? '#002050' : '#E5E7EB',
              background: activeSection === section.section_type ? 'rgba(0,32,80,0.04)' : 'white',
            }}
            onClick={() => onSelect(section.section_type)}>
            <GripVertical size={14} className="text-slate-300 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: '#002050' }}>
                {SECTION_LABELS[section.section_type] || section.title || section.section_type}
              </div>
              {!section.is_visible && (
                <div className="text-xs" style={{ color: '#9CA3AF' }}>Masquée</div>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {section.section_type !== 'profile' && (
                <button type="button"
                  onClick={e => { e.stopPropagation(); onToggleVisible(section.id); }}
                  className="p-1 rounded hover:bg-gray-100">
                  {section.is_visible
                    ? <Eye size={13} style={{ color: '#9CA3AF' }} />
                    : <EyeOff size={13} style={{ color: '#9CA3AF' }} />}
                </button>
              )}
              {section.section_type !== 'profile' && (
                <button type="button"
                  onClick={e => { e.stopPropagation(); onDelete(section.id); }}
                  className="p-1 rounded hover:bg-red-50">
                  <Trash2 size={13} style={{ color: '#DC2626' }} />
                </button>
              )}
              {activeSection === section.section_type
                ? <ChevronUp size={13} style={{ color: '#002050' }} />
                : <ChevronDown size={13} style={{ color: '#9CA3AF' }} />}
            </div>
          </div>
        ))}
      </div>

      {/* Ajouter une section */}
      {addableSections.length > 0 && (
        <div className="mt-3 border-t pt-3" style={{ borderColor: '#E5E7EB' }}>
          {showAdd ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold mb-2" style={{ color: '#002050' }}>Ajouter une section</p>
              {addableSections.map(type => (
                <button key={type} type="button"
                  onClick={() => { onAdd(type); setShowAdd(false); }}
                  className="w-full text-left text-sm px-3 py-2 rounded-xl border transition hover:shadow-sm"
                  style={{ borderColor: '#E5E7EB', color: '#374151' }}>
                  + {SECTION_LABELS[type]}
                </button>
              ))}
              <button type="button" onClick={() => setShowAdd(false)}
                className="w-full text-xs text-center mt-1" style={{ color: '#9CA3AF' }}>
                Annuler
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setShowAdd(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-2 text-sm font-medium transition hover:bg-slate-50"
              style={{ borderColor: '#002050', color: '#002050' }}>
              <Plus size={14} /> Ajouter une section
            </button>
          )}
        </div>
      )}
    </div>
  );
}
