import { Award, CheckCircle2, Database, GraduationCap, User } from 'lucide-react';
import type { DocData } from './CvTemplates';
import type { LmData } from './LmTemplates';
import type { CareerDocType } from '../../lib/careerStudioData';
import {
  buildEvidenceFromSource,
  getCareerMeta,
  mergeEvidence,
  withCareerMeta,
  type CareerSourceProfile,
} from '../../lib/careerBuilderV2';

type Props = {
  docType: CareerDocType;
  data: DocData | LmData;
  source: CareerSourceProfile;
  onChange: (data: DocData | LmData) => void;
};

function formatDate(value?: string) {
  if (!value) return '';
  try { return new Date(value).toLocaleDateString('fr-FR'); } catch { return value; }
}

export default function CareerSourcePanel({ docType, data, source, onChange }: Props) {
  const meta = getCareerMeta(data, docType);
  const availableEvidence = buildEvidenceFromSource(source);
  const selectedIds = new Set(meta.evidence.filter(item => item.selected).map(item => item.id));

  function importIdentity() {
    const user = source.user || {};
    if (docType === 'cv') {
      const cv = data as DocData;
      onChange({
        ...cv,
        name: cv.name || user.full_name || '',
        contact: {
          ...cv.contact,
          email: cv.contact?.email || user.email || '',
          phone: cv.contact?.phone || user.phone || '',
          location: cv.contact?.location || user.location || '',
        },
      });
      return;
    }
    const lm = data as LmData;
    onChange({
      ...lm,
      sender: {
        ...lm.sender,
        name: lm.sender?.name || user.full_name || '',
        email: lm.sender?.email || user.email || '',
        phone: lm.sender?.phone || user.phone || '',
        address: lm.sender?.address || user.location || '',
        city: lm.sender?.city || user.location || '',
      },
      signature: lm.signature || user.full_name || '',
    });
  }

  function importAllEvidence() {
    const merged = mergeEvidence(meta.evidence, availableEvidence.map(item => ({ ...item, selected: true })));
    let nextData: DocData | LmData = withCareerMeta(data, docType, { ...meta, evidence: merged });
    if (docType === 'cv') {
      const cv = nextData as DocData;
      const existingFormationIds = new Set((cv.omnia_formations || []).map(item => item.id));
      const formations = (source.completed_formations || []).map((item, index) => ({
        id: String(item.course_id || `omnia_${index}`),
        title: item.courses?.title || 'Formation Omnia',
        completed_at: item.completed_at || '',
        cpd_accredited: false,
        show: true,
      })).filter(item => !existingFormationIds.has(item.id));
      const existingCertificateIds = new Set((cv.certifications_external || []).map(item => item.id));
      const certificates = (source.certificates || []).map((item, index) => ({
        id: String(item.id || `cert_${index}`),
        name: item.courses?.title || 'Certificat Omnia',
        issuer: 'Omnia Global Academy',
        year: item.issued_at ? new Date(item.issued_at).getFullYear().toString() : '',
      })).filter(item => !existingCertificateIds.has(item.id));
      nextData = {
        ...cv,
        omnia_formations: [...(cv.omnia_formations || []), ...formations],
        certifications_external: [...(cv.certifications_external || []), ...certificates],
      };
    }
    onChange(nextData);
  }

  function toggleEvidence(id: string) {
    const evidence = mergeEvidence(meta.evidence, availableEvidence).map(item => item.id === id ? { ...item, selected: !item.selected } : item);
    onChange(withCareerMeta(data, docType, { ...meta, evidence }));
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#002050]/8 px-3 py-1 text-xs font-bold text-[#002050]">
            <Database className="h-3.5 w-3.5" /> Source Omnia
          </div>
          <h3 className="mt-3 text-lg font-semibold text-[#002050]">Profil et preuves vérifiées</h3>
          <p className="mt-1 text-sm leading-5 text-slate-600">Importez uniquement les informations que vous souhaitez utiliser. Rien n’est ajouté sans votre action.</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#002050] text-white"><User className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-[#002050]">{source.user?.full_name || 'Profil Omnia'}</div>
            <div className="truncate text-xs text-slate-500">{source.user?.email || 'Coordonnées disponibles après connexion'}</div>
          </div>
          <button type="button" onClick={importIdentity} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#002050] hover:bg-slate-50">Importer</button>
        </div>
        {typeof source.user?.profile_completion === 'number' && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[11px] font-semibold text-slate-500"><span>Profil complété</span><span>{source.user.profile_completion}%</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-[#bf8813]" style={{ width: `${Math.max(0, Math.min(100, source.user.profile_completion))}%` }} /></div>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[#002050]">Preuves disponibles</div>
          <div className="text-xs text-slate-500">Formations et certificats réellement présents dans Omnia.</div>
        </div>
        {availableEvidence.length > 0 && <button type="button" onClick={importAllEvidence} className="rounded-lg bg-[#002050] px-3 py-2 text-xs font-semibold text-white">Tout importer</button>}
      </div>

      <div className="mt-3 space-y-2">
        {!availableEvidence.length && (
          <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs leading-5 text-slate-500">Aucune formation terminée ou certification vérifiée n’est disponible pour le moment.</div>
        )}
        {availableEvidence.map(item => {
          const selected = selectedIds.has(item.id) || meta.evidence.find(e => e.id === item.id)?.selected;
          const Icon = item.type === 'certificate' ? Award : GraduationCap;
          return (
            <button key={item.id} type="button" onClick={() => toggleEvidence(item.id)} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${selected ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-green-600 text-white' : 'bg-slate-100 text-[#002050]'}`}><Icon className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[#002050]">{item.title}</div>
                <div className="mt-1 text-xs text-slate-500">{item.issuer}{item.issued_at ? ` · ${formatDate(item.issued_at)}` : ''}</div>
                <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-green-700"><CheckCircle2 className="h-3 w-3" /> Vérifié par Omnia</div>
              </div>
              <span className={`mt-1 h-4 w-4 rounded-full border ${selected ? 'border-green-600 bg-green-600 shadow-[inset_0_0_0_3px_white]' : 'border-slate-300'}`} />
            </button>
          );
        })}
      </div>

      {meta.evidence.length > 0 && (
        <div className="mt-4 rounded-xl bg-[#bf8813]/10 p-3 text-xs leading-5 text-slate-700">
          <strong className="text-[#002050]">{meta.evidence.filter(item => item.selected).length} preuve(s) sélectionnée(s).</strong> Elles servent à distinguer les compétences déclarées des compétences réellement documentées.
        </div>
      )}
    </div>
  );
}
