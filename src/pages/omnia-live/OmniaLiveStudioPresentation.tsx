import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

const BLUE = '#002050';
const GOLD = '#BF8813';

type Category = {
  id: string;
  name: string;
};

const levels = [
  ['all', 'Tous niveaux'],
  ['beginner', 'Débutant'],
  ['intermediate', 'Intermédiaire'],
  ['advanced', 'Avancé'],
];

export default function OmniaLiveStudioPresentation() {
  const { liveId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);

  const [title, setTitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [longDescription, setLongDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [language, setLanguage] = useState('fr');
  const [level, setLevel] = useState('all');
  const [prerequisites, setPrerequisites] = useState('');
  const [learningOutcomes, setLearningOutcomes] = useState<string[]>(['']);
  const [program, setProgram] = useState<string[]>(['']);

  const [coverMode, setCoverMode] = useState<'url' | 'ai' | 'template'>('template');
  const [coverUrl, setCoverUrl] = useState('');
  const [coverAiPrompt, setCoverAiPrompt] = useState('');
  const [coverTemplateKey, setCoverTemplateKey] = useState('omnia-live-default');

  useEffect(() => {
    if (!liveId) return;

    Promise.all([
      liveApi('studio_get', {}, { event_id: liveId }),
      liveApi('categories'),
    ])
      .then(([studio, categoryData]) => {
        const event = studio?.event;
        if (!event) throw new Error('Brouillon introuvable');

        setTitle(event.title || '');
        setShortDescription(event.short_description || '');
        setLongDescription(event.long_description || '');
        setCategoryId(event.category_id || '');
        setLanguage(event.language || 'fr');
        setLevel(event.level || 'all');
        setPrerequisites(event.prerequisites || '');

        setLearningOutcomes(
          Array.isArray(event.learning_outcomes) && event.learning_outcomes.length
            ? event.learning_outcomes
            : [''],
        );

        setProgram(
          Array.isArray(event.program) && event.program.length
            ? event.program.map((item: unknown) =>
                typeof item === 'string'
                  ? item
                  : (item as { title?: string })?.title || '',
              )
            : [''],
        );

        if (event.cover_url) {
          setCoverMode('url');
          setCoverUrl(event.cover_url);
        } else if (event.cover_ai_prompt) {
          setCoverMode('ai');
          setCoverAiPrompt(event.cover_ai_prompt);
        } else {
          setCoverMode('template');
          setCoverTemplateKey(event.cover_template_key || 'omnia-live-default');
        }

        setCategories(categoryData?.categories || []);
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : 'Impossible de charger cette étape.');
      })
      .finally(() => setLoading(false));
  }, [liveId]);

  const cleanOutcomes = useMemo(
    () => learningOutcomes.map((v) => v.trim()).filter(Boolean),
    [learningOutcomes],
  );

  const cleanProgram = useMemo(
    () => program.map((v) => v.trim()).filter(Boolean),
    [program],
  );

  function updateList(
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string,
  ) {
    setter((current) => current.map((item, i) => (i === index ? value : item)));
  }

  function removeListItem(
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
  ) {
    setter((current) => {
      const next = current.filter((_, i) => i !== index);
      return next.length ? next : [''];
    });
  }

  async function save(goNext = false) {
    if (!liveId) return;

    if (!title.trim() || !shortDescription.trim() || !longDescription.trim() || !categoryId) {
      setMessage('Titre, descriptions et catégorie sont obligatoires.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      await liveApi('update_draft', {
        method: 'POST',
        body: JSON.stringify({
          event_id: liveId,
          title: title.trim(),
          short_description: shortDescription.trim(),
          long_description: longDescription.trim(),
          category_id: categoryId,
          language,
          level,
          prerequisites: prerequisites.trim() || null,
          learning_outcomes: cleanOutcomes,
          program: cleanProgram,
          cover_url: coverMode === 'url' ? coverUrl.trim() || null : null,
          cover_ai_prompt: coverMode === 'ai' ? coverAiPrompt.trim() || null : null,
          cover_template_key: coverMode === 'template' ? coverTemplateKey : null,
          cover_source: coverMode,
        }),
      });

      if (goNext) {
        navigate(`/omnia-live/studio/${liveId}/planification`);
      } else {
        setMessage('Étape 2 enregistrée.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible d’enregistrer.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <OmniaLiveLayout>
        <div className="mx-auto max-w-6xl px-4 py-12 text-slate-500">Chargement...</div>
      </OmniaLiveLayout>
    );
  }

  return (
    <OmniaLiveLayout>
      <section className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        <div className="mb-8">
          <div className="text-sm font-bold uppercase tracking-wide" style={{ color: GOLD }}>
            Studio Omnia Live · Étape 2 sur 7
          </div>
          <h1 className="mt-2 text-3xl font-black" style={{ color: BLUE }}>
            Présentation
          </h1>
        </div>

        <div className="space-y-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div>
            <label className="mb-2 block font-bold" style={{ color: BLUE }}>Titre *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={180}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#BF8813]"
              placeholder="Ex. Comprendre la cybersécurité pour une PME"
            />
          </div>

          <div>
            <label className="mb-2 block font-bold" style={{ color: BLUE }}>Description courte *</label>
            <textarea
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              maxLength={400}
              rows={3}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#BF8813]"
            />
          </div>

          <div>
            <label className="mb-2 block font-bold" style={{ color: BLUE }}>Description complète *</label>
            <textarea
              value={longDescription}
              onChange={(e) => setLongDescription(e.target.value)}
              rows={7}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#BF8813]"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <div>
              <label className="mb-2 block font-bold" style={{ color: BLUE }}>Catégorie *</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="">Choisir...</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block font-bold" style={{ color: BLUE }}>Langue</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="fr">Français</option>
                <option value="en">Anglais</option>
                <option value="es">Espagnol</option>
                <option value="ar">Arabe</option>
                <option value="other">Autre</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block font-bold" style={{ color: BLUE }}>Niveau</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                {levels.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block font-bold" style={{ color: BLUE }}>Ce que les participants vont apprendre</label>
            <div className="space-y-2">
              {learningOutcomes.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    value={item}
                    onChange={(e) => updateList(setLearningOutcomes, index, e.target.value)}
                    className="flex-1 rounded-xl border border-slate-300 px-4 py-3"
                    placeholder={`Objectif ${index + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeListItem(setLearningOutcomes, index)}
                    className="rounded-xl border border-slate-300 px-3"
                  >
                    Retirer
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setLearningOutcomes((current) => [...current, ''])}
              className="mt-3 font-semibold"
              style={{ color: GOLD }}
            >
              + Ajouter un objectif
            </button>
          </div>

          <div>
            <label className="mb-2 block font-bold" style={{ color: BLUE }}>Programme</label>
            <div className="space-y-2">
              {program.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    value={item}
                    onChange={(e) => updateList(setProgram, index, e.target.value)}
                    className="flex-1 rounded-xl border border-slate-300 px-4 py-3"
                    placeholder={`Séquence ${index + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeListItem(setProgram, index)}
                    className="rounded-xl border border-slate-300 px-3"
                  >
                    Retirer
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setProgram((current) => [...current, ''])}
              className="mt-3 font-semibold"
              style={{ color: GOLD }}
            >
              + Ajouter une séquence
            </button>
          </div>

          <div>
            <label className="mb-2 block font-bold" style={{ color: BLUE }}>Prérequis</label>
            <textarea
              value={prerequisites}
              onChange={(e) => setPrerequisites(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
              placeholder="Laissez vide s’il n’y a aucun prérequis."
            />
          </div>

          <div>
            <h2 className="font-bold" style={{ color: BLUE }}>Couverture</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                ['template', 'Modèle Omnia'],
                ['url', 'Image existante'],
                ['ai', 'Préparer une génération IA'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCoverMode(value as 'url' | 'ai' | 'template')}
                  className="rounded-xl border px-4 py-2 font-semibold"
                  style={{
                    borderColor: coverMode === value ? GOLD : '#CBD5E1',
                    color: coverMode === value ? BLUE : '#475569',
                    background: coverMode === value ? '#FFFBF2' : '#FFFFFF',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {coverMode === 'template' && (
              <select
                value={coverTemplateKey}
                onChange={(e) => setCoverTemplateKey(e.target.value)}
                className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 md:max-w-md"
              >
                <option value="omnia-live-default">Omnia Live — Standard</option>
                <option value="omnia-live-professional">Omnia Live — Professionnel</option>
                <option value="omnia-live-institutional">Omnia Live — Institutionnel</option>
              </select>
            )}

            {coverMode === 'url' && (
              <input
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3"
                placeholder="URL sécurisée de l’image de couverture"
              />
            )}

            {coverMode === 'ai' && (
              <textarea
                value={coverAiPrompt}
                onChange={(e) => setCoverAiPrompt(e.target.value)}
                rows={3}
                className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3"
                placeholder="Décrivez la couverture souhaitée. La génération sera exécutée par le service IA Omnia."
              />
            )}
          </div>

          {message && (
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</div>
          )}

          <div className="flex flex-wrap justify-between gap-3 border-t pt-6">
            <button
              type="button"
              onClick={() => navigate(`/omnia-live/studio/${liveId}`)}
              className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700"
            >
              ← Étape 1
            </button>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => save(false)}
                disabled={saving}
                className="rounded-xl border px-5 py-3 font-bold disabled:opacity-50"
                style={{ borderColor: BLUE, color: BLUE }}
              >
                Enregistrer
              </button>

              <button
                type="button"
                onClick={() => save(true)}
                disabled={saving}
                className="rounded-xl px-6 py-3 font-bold text-white disabled:opacity-50"
                style={{ background: BLUE }}
              >
                {saving ? 'Enregistrement...' : 'Continuer →'}
              </button>
            </div>
          </div>
        </div>
      </section>
    </OmniaLiveLayout>
  );
}
