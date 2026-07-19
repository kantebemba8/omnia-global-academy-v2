import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

const BLUE = '#002050';
const GOLD = '#BF8813';

const formats = [
  ['class_live', 'Classe Live'],
  ['masterclass', 'Masterclass'],
  ['workshop', 'Atelier'],
  ['webinar', 'Webinaire'],
  ['conference', 'Conférence / Table ronde'],
  ['event', 'Événement'],
];

const modes = [
  ['single_live', 'Événement Live unique'],
  ['synchronous_training', 'Formation synchrone / Classe Online'],
  ['recorded_video', 'Vidéo / Masterclass préenregistrée'],
];

const visibilities = [
  ['public', 'Public', 'Visible dans le catalogue Omnia Live.'],
  ['private', 'Privé', 'Accessible uniquement aux personnes autorisées.'],
  ['structure', 'Réservé à une Structure', 'Accès réservé aux membres concernés.'],
  ['invitation', 'Sur invitation', 'Accès uniquement via invitation autorisée.'],
  ['training_only', 'Réservé à une formation', 'Accessible uniquement aux inscrits de la formation liée.'],
];

export default function OmniaLiveStudio() {
  const { liveId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [eventType, setEventType] = useState('masterclass');
  const [deliveryType, setDeliveryType] = useState('single_live');
  const [visibility, setVisibility] = useState('public');

  useEffect(() => {
    if (!liveId) return;

    liveApi('studio_get', {}, { event_id: liveId })
      .then((data) => {
        const event = data?.event;
        if (!event) throw new Error('Brouillon introuvable');
        setEventType(event.event_type || 'masterclass');
        setDeliveryType(event.delivery_type || 'single_live');
        setVisibility(event.visibility || 'public');
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : 'Impossible de charger le Studio.');
      })
      .finally(() => setLoading(false));
  }, [liveId]);

  async function save() {
    if (!liveId) return;

    setSaving(true);
    setMessage('');

    try {
      await liveApi('update_draft', {
        method: 'POST',
        body: JSON.stringify({
          event_id: liveId,
          event_type: eventType,
          delivery_type: deliveryType,
          visibility,
        }),
      });

      setMessage('Étape 1 enregistrée.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible d’enregistrer.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <OmniaLiveLayout>
        <div className="mx-auto max-w-6xl px-4 py-12 text-slate-500">Chargement du Studio...</div>
      </OmniaLiveLayout>
    );
  }

  return (
    <OmniaLiveLayout>
      <section className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        <div className="mb-8">
          <div className="text-sm font-bold uppercase tracking-wide" style={{ color: GOLD }}>
            Studio Omnia Live · Étape 1 sur 7
          </div>
          <h1 className="mt-2 text-3xl font-black" style={{ color: BLUE }}>
            Type et visibilité
          </h1>
          <p className="mt-2 text-slate-600">
            Définissez la nature du contenu et les personnes autorisées à y accéder.
          </p>
        </div>

        <div className="space-y-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div>
            <h2 className="text-lg font-bold" style={{ color: BLUE }}>Mode</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {modes.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDeliveryType(value)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    deliveryType === value ? 'shadow-sm' : 'hover:bg-slate-50'
                  }`}
                  style={{
                    borderColor: deliveryType === value ? GOLD : '#E2E8F0',
                    background: deliveryType === value ? '#FFFBF2' : '#FFFFFF',
                  }}
                >
                  <div className="font-bold" style={{ color: BLUE }}>{label}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold" style={{ color: BLUE }}>Format</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {formats.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEventType(value)}
                  className="rounded-2xl border p-4 text-left transition hover:bg-slate-50"
                  style={{
                    borderColor: eventType === value ? GOLD : '#E2E8F0',
                    background: eventType === value ? '#FFFBF2' : '#FFFFFF',
                  }}
                >
                  <div className="font-bold" style={{ color: BLUE }}>{label}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold" style={{ color: BLUE }}>Visibilité</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {visibilities.map(([value, label, description]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setVisibility(value)}
                  className="rounded-2xl border p-4 text-left transition hover:bg-slate-50"
                  style={{
                    borderColor: visibility === value ? GOLD : '#E2E8F0',
                    background: visibility === value ? '#FFFBF2' : '#FFFFFF',
                  }}
                >
                  <div className="font-bold" style={{ color: BLUE }}>{label}</div>
                  <div className="mt-1 text-sm text-slate-500">{description}</div>
                </button>
              ))}
            </div>
          </div>

          {message && (
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</div>
          )}

          <div className="flex flex-wrap justify-between gap-3 border-t pt-6">
            <button
              type="button"
              onClick={() => navigate('/omnia-live/mes-lives')}
              className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700"
            >
              Quitter le Studio
            </button>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-xl px-6 py-3 font-bold text-white disabled:opacity-50"
              style={{ background: BLUE }}
            >
              {saving ? 'Enregistrement...' : 'Enregistrer l’étape 1'}
            </button>
          </div>
        </div>
      </section>
    </OmniaLiveLayout>
  );
}
