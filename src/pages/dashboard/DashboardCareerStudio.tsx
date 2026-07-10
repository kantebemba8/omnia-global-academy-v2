import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  Briefcase,
  Calendar,
  Download,
  Edit3,
  FileText,
  Mail,
  Plus,
  Sparkles,
  Star,
  Target,
  Trash2,
} from 'lucide-react';
import { CareerDocType, CareerDocumentSummary, CV_TEMPLATES_META, LM_TEMPLATES_META, OMNIA_BLUE, OMNIA_GOLD } from '../../lib/careerStudioData';
import { deleteCareerDocument, listCareerDocuments } from '../../lib/careerStudioApi';

function cardClass(extra = '') {
  return `rounded-2xl border border-slate-200 bg-white shadow-sm ${extra}`;
}

function formatDate(date?: string) {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return date;
  }
}

export default function DashboardCareerStudio() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<CareerDocType>('cv');
  const [documents, setDocuments] = useState<CareerDocumentSummary[]>([]);
  const [tokens, setTokens] = useState(0);
  const [loading, setLoading] = useState(true);
  const [remoteMode, setRemoteMode] = useState(false);

  const templates = activeTab === 'cv' ? CV_TEMPLATES_META : LM_TEMPLATES_META;
  const visibleDocuments = useMemo(() => documents.filter(doc => doc.doc_type === activeTab), [documents, activeTab]);

  async function load() {
    setLoading(true);
    const data = await listCareerDocuments(activeTab);
    setDocuments(data.documents);
    setTokens(data.tokens);
    setRemoteMode(data.remote);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [activeTab]);

  function createDocument(type: CareerDocType, templateKey?: string) {
    navigate(`/dashboard/career-studio/editor/new?type=${type}&template=${templateKey || (type === 'cv' ? 'classic_pro' : 'lm_classic_pro')}`);
  }

  async function removeDocument(doc: CareerDocumentSummary) {
    if (!confirm(`Supprimer "${doc.title}" ?`)) return;
    await deleteCareerDocument(doc.doc_type, doc.id);
    await load();
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-6 py-6">
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#bf8813]/25 bg-[#bf8813]/10 px-3 py-1.5 text-xs font-semibold text-[#bf8813]">
            <Sparkles className="h-4 w-4" /> Omnia Career
          </div>
          <h1 className="text-2xl font-semibold text-[#002050]">Career Studio</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Créez vos CV et lettres de motivation avec les modèles Omnia déjà validés, un aperçu en direct et une sauvegarde automatique.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            {tokens} jeton(s) CV · {remoteMode ? 'Supabase' : 'mode local'}
          </div>
          <button onClick={() => createDocument('lm')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#002050] hover:bg-slate-50">
            <Mail className="h-4 w-4" /> Nouvelle LM
          </button>
          <button onClick={() => createDocument('cv')} className="inline-flex items-center gap-2 rounded-xl bg-[#002050] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            <Plus className="h-4 w-4" /> Nouveau CV
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard icon={FileText} label="CV créés" value={documents.filter(d => d.doc_type === 'cv').length} caption="documents enregistrés" />
        <MetricCard icon={Mail} label="Lettres créées" value={documents.filter(d => d.doc_type === 'lm').length} caption="lettres enregistrées" />
        <MetricCard icon={Award} label="Modèles CV" value={CV_TEMPLATES_META.length} caption="templates disponibles" />
        <MetricCard icon={Target} label="Modèles LM" value={LM_TEMPLATES_META.length} caption="templates disponibles" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className={cardClass('p-5')}>
          <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
              <button onClick={() => setActiveTab('cv')} className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === 'cv' ? 'bg-[#002050] text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}>CV Builder</button>
              <button onClick={() => setActiveTab('lm')} className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === 'lm' ? 'bg-[#002050] text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}>Lettres de motivation</button>
            </div>
            <button onClick={() => createDocument(activeTab)} className="inline-flex items-center gap-2 rounded-xl bg-[#bf8813] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              <Plus className="h-4 w-4" /> Créer {activeTab === 'cv' ? 'un CV' : 'une lettre'}
            </button>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-500">Chargement...</div>
          ) : visibleDocuments.length ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {visibleDocuments.map(doc => (
                <div key={doc.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#002050]/8 text-[#002050]">
                        {doc.doc_type === 'cv' ? <FileText className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#002050]">{doc.title}</h3>
                        <p className="mt-1 text-xs text-slate-500">{doc.doc_type === 'cv' ? 'CV' : 'Lettre'} · {formatDate(doc.updated_at)}</p>
                      </div>
                    </div>
                    {doc.is_primary && <span className="rounded-full bg-green-50 px-2 py-1 text-[11px] font-bold text-green-700">Principal</span>}
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-600">
                    <div className="rounded-xl bg-slate-50 p-2"><span className="block text-slate-400">Score</span><strong>{doc.ats_score ?? 0}/100</strong></div>
                    <div className="rounded-xl bg-slate-50 p-2"><span className="block text-slate-400">Modèle</span><strong>{doc.template_key}</strong></div>
                    <div className="rounded-xl bg-slate-50 p-2"><span className="block text-slate-400">Statut</span><strong>Brouillon</strong></div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => navigate(`/dashboard/career-studio/editor/${doc.id}?type=${doc.doc_type}`)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#002050] px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
                      <Edit3 className="h-4 w-4" /> Modifier
                    </button>
                    <button onClick={() => removeDocument(doc)} className="rounded-xl border border-red-100 px-3 py-2 text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center">
              <FileText className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold text-[#002050]">Aucun document pour le moment</h3>
              <p className="mt-2 text-sm text-slate-500">Commencez avec un modèle Omnia.</p>
              <button onClick={() => createDocument(activeTab)} className="mt-5 rounded-xl bg-[#002050] px-4 py-2 text-sm font-semibold text-white">Créer maintenant</button>
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <div className={cardClass('p-5')}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#002050]">Modèles recommandés</h2>
              <span className="text-xs font-semibold text-slate-500">{templates.length}</span>
            </div>
            <div className="space-y-3">
              {templates.slice(0, 6).map(template => (
                <button key={template.template_key} onClick={() => createDocument(activeTab, template.template_key)} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-3 text-left transition hover:bg-slate-50">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#002050]/8 text-[#002050]">
                    {activeTab === 'cv' ? <FileText className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[#002050]">{template.name_fr}</div>
                    <div className="truncate text-xs text-slate-500">{template.description_fr}</div>
                  </div>
                  {template.is_free ? <span className="text-xs font-bold text-green-600">Gratuit</span> : <Star className="h-4 w-4 text-[#bf8813]" />}
                </button>
              ))}
            </div>
          </div>

          <div className={cardClass('p-5')}>
            <h2 className="text-lg font-semibold text-[#002050]">Prochaine étape</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Le téléchargement PDF est maintenant activé : le CV consomme 1 jeton, la lettre est gratuite dans cette étape. La prochaine étape peut activer l’IA réelle.
            </p>
            <div className="mt-4 rounded-2xl bg-[#bf8813]/10 p-4 text-sm font-semibold text-[#8a620d]">
              Les documents restent sauvegardés dans Supabase si les tables et edge functions sont déployées, sinon en local pour test.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, caption }: { icon: any; label: string; value: number; caption: string }) {
  return (
    <div className={cardClass('p-5')}>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#002050]/8 text-[#002050]">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="text-2xl font-semibold text-[#002050]">{value}</p>
          <p className="text-xs text-slate-400">{caption}</p>
        </div>
      </div>
    </div>
  );
}
