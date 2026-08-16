import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

export default function OmniaLivePropose() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const organizerScope = searchParams.get('scope') === 'structure' ? 'structure' : 'personal';
  const [title, setTitle] = useState('');
  const [type, setType] = useState('masterclass');
  const [deliveryType, setDeliveryType] = useState('single_live');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setMessage('');
    setSaving(true);
    try {
      const data = await liveApi('create_draft', {
        method: 'POST',
        body: JSON.stringify({ title, event_type: type, delivery_type: deliveryType, organizer_scope: organizerScope }),
      });
      setMessage('Brouillon Omnia Live créé avec succès.');
      if (data?.event?.id) navigate(`/omnia-live/studio/${data.event.id}`);
    } catch (e: any) {
      const raw = String(e?.message || '');
      setMessage(raw.includes('ORGANIZER_PERMISSION_REQUIRED')
        ? 'La création personnelle de Lives est réservée aux Organisateurs Omnia Live validés.'
        : raw.includes('STRUCTURE_LIVE_PERMISSION_REQUIRED')
          ? 'Votre compte ne dispose pas de la délégation Omnia Live de cette Structure.'
          : raw || 'Impossible de créer le brouillon.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <OmniaLiveLayout>
      <section className="mx-auto max-w-3xl px-4 py-12 md:px-8">
        <h1 className="text-3xl font-black" style={{ color: '#002050' }}>{organizerScope === 'structure' ? 'Programmer un Live de la Structure' : 'Proposer un contenu Omnia Live'}</h1>
        <p className="mt-3 text-slate-600">{organizerScope === 'structure' ? 'Ce brouillon sera porté par votre Structure. Les Lives internes ou privés utilisent la délégation Structure. Un événement public ou payant exige aussi un Organisateur Omnia Live validé.' : 'La création personnelle est réservée aux Organisateurs Omnia Live validés. Aucun contenu ne sera publié avant validation de l’Administration Omnia et, pour un contenu payant, acceptation des conditions commerciales.'}</p>
        {organizerScope !== 'structure' && <p className="mt-3 text-sm text-slate-500">Vous êtes professeur ou expert sans accès Organisateur ? <Link className="font-bold text-[#5C55C8]" to="/omnia-live/organisateur/candidature">Demander l’accès Organisateur</Link>.</p>}
        <div className="mt-8 space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
          <label className="block">
            <span className="text-sm font-bold">Titre</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" placeholder="Titre du Live ou de la formation" />
          </label>
          <label className="block">
            <span className="text-sm font-bold">Mode</span>
            <select value={deliveryType} onChange={(e) => setDeliveryType(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3">
              <option value="single_live">Événement Live unique</option>
              <option value="synchronous_training">Formation synchrone / classe online</option>
              <option value="recorded_video">Vidéo / masterclass préenregistrée</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-bold">Format</span>
            <select value={type} onChange={(e) => setType(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3">
              <option value="class_live">Classe Live</option>
              <option value="masterclass">Masterclass</option>
              <option value="workshop">Atelier</option>
              <option value="webinar">Webinaire</option>
              <option value="conference">Conférence / Table ronde</option>
              <option value="event">Événement</option>
            </select>
          </label>
          <button onClick={submit} disabled={!title.trim() || saving} className="rounded-xl px-5 py-3 font-bold text-white disabled:opacity-50" style={{ background: '#002050' }}>
            {saving ? 'Création...' : 'Créer le brouillon'}
          </button>
          {message && <p className="text-sm text-slate-600">{message}</p>}
        </div>
      </section>
    </OmniaLiveLayout>
  );
}
