import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

const BLUE = '#002050';
const GOLD = '#BF8813';

type SessionItem = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
};

function toLocalDateTimeParts(value?: string | null) {
  if (!value) return { date: '', time: '' };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };

  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function toIso(date: string, time: string) {
  if (!date || !time) return null;
  const value = new Date(`${date}T${time}:00`);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

export default function OmniaLiveStudioPlanning() {
  const { liveId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [deliveryType, setDeliveryType] = useState('single_live');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  );
  const [maxParticipants, setMaxParticipants] = useState('');
  const [minimumParticipants, setMinimumParticipants] = useState('');
  const [waitingRoomMinutes, setWaitingRoomMinutes] = useState(30);
  const [allowLateRegistration, setAllowLateRegistration] = useState(false);

  const [sessions, setSessions] = useState<SessionItem[]>([
    { title: 'Session 1', date: '', startTime: '', endTime: '' },
  ]);

  useEffect(() => {
    if (!liveId) return;

    liveApi('studio_get', {}, { event_id: liveId })
      .then((data) => {
        const event = data?.event;
        if (!event) throw new Error('Brouillon introuvable');

        setDeliveryType(event.delivery_type || 'single_live');
        setTimezone(event.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
        setDurationMinutes(Number(event.duration_minutes || 60));
        setMaxParticipants(event.max_participants == null ? '' : String(event.max_participants));
        setMinimumParticipants(
          event.minimum_participants == null ? '' : String(event.minimum_participants),
        );
        setWaitingRoomMinutes(Number(event.waiting_room_minutes ?? 30));
        setAllowLateRegistration(Boolean(event.allow_late_registration));

        const main = toLocalDateTimeParts(event.starts_at);
        setDate(main.date);
        setStartTime(main.time);

        if (Array.isArray(data.sessions) && data.sessions.length) {
          setSessions(
            data.sessions.map((session: any, index: number) => {
              const start = toLocalDateTimeParts(session.starts_at);
              const end = toLocalDateTimeParts(session.ends_at);
              return {
                title: session.title || `Session ${index + 1}`,
                date: start.date,
                startTime: start.time,
                endTime: end.time,
              };
            }),
          );
        }
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : 'Impossible de charger cette étape.');
      })
      .finally(() => setLoading(false));
  }, [liveId]);

  const isSynchronousTraining = deliveryType === 'synchronous_training';

  const estimatedEnd = useMemo(() => {
    if (!date || !startTime || !durationMinutes) return '';
    const start = new Date(`${date}T${startTime}:00`);
    if (Number.isNaN(start.getTime())) return '';
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    return end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [date, startTime, durationMinutes]);

  function updateSession(index: number, key: keyof SessionItem, value: string) {
    setSessions((current) =>
      current.map((session, i) => (i === index ? { ...session, [key]: value } : session)),
    );
  }

  function addSession() {
    setSessions((current) => [
      ...current,
      {
        title: `Session ${current.length + 1}`,
        date: '',
        startTime: '',
        endTime: '',
      },
    ]);
  }

  function removeSession(index: number) {
    setSessions((current) => {
      const next = current.filter((_, i) => i !== index);
      return next.length
        ? next.map((item, i) => ({ ...item, title: item.title || `Session ${i + 1}` }))
        : [{ title: 'Session 1', date: '', startTime: '', endTime: '' }];
    });
  }

  async function save(goNext = false) {
    if (!liveId) return;

    if (!timezone.trim()) {
      setMessage('Le fuseau horaire est obligatoire.');
      return;
    }

    if (!isSynchronousTraining && deliveryType !== 'recorded_video' && (!date || !startTime)) {
      setMessage('La date et l’heure de début sont obligatoires.');
      return;
    }

    if (isSynchronousTraining) {
      const invalid = sessions.some((s) => !s.date || !s.startTime);
      if (invalid) {
        setMessage('Chaque session doit avoir une date et une heure de début.');
        return;
      }

      const normalized = sessions.map((s, index) => ({
        index,
        start: toIso(s.date, s.startTime),
        end: s.endTime ? toIso(s.date, s.endTime) : null,
      }));

      if (normalized.some((s) => !s.start)) {
        setMessage('Une date ou une heure de session est invalide.');
        return;
      }

      for (const item of normalized) {
        if (item.end && item.start && new Date(item.end).getTime() <= new Date(item.start).getTime()) {
          setMessage(`L’heure de fin de la session ${item.index + 1} doit être postérieure à son heure de début.`);
          return;
        }
      }

      const ordered = [...normalized].sort((a,b)=>new Date(a.start as string).getTime()-new Date(b.start as string).getTime());
      for (let i=1;i<ordered.length;i++) {
        const previousEnd = ordered[i-1].end || ordered[i-1].start;
        if (previousEnd && new Date(ordered[i].start as string).getTime() < new Date(previousEnd as string).getTime()) {
          setMessage('Deux sessions se chevauchent. Corrigez les horaires avant de continuer.');
          return;
        }
      }
    }

    const maxP = maxParticipants ? Number(maxParticipants) : null;
    const minP = minimumParticipants ? Number(minimumParticipants) : null;
    if (maxP !== null && minP !== null && minP > maxP) {
      setMessage('Le minimum de participants ne peut pas dépasser le maximum autorisé.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      await liveApi('update_draft', {
        method: 'POST',
        body: JSON.stringify({
          event_id: liveId,
          starts_at:
            deliveryType === 'recorded_video'
              ? null
              : isSynchronousTraining
                ? toIso(sessions[0]?.date || '', sessions[0]?.startTime || '')
                : toIso(date, startTime),
          timezone,
          duration_minutes:
            deliveryType === 'recorded_video' || isSynchronousTraining
              ? null
              : Number(durationMinutes),
          max_participants: maxParticipants ? Number(maxParticipants) : null,
          minimum_participants: minimumParticipants ? Number(minimumParticipants) : null,
          waiting_room_minutes: waitingRoomMinutes,
          allow_late_registration: allowLateRegistration,
        }),
      });

      if (isSynchronousTraining) {
        await liveApi('save_sessions', {
          method: 'POST',
          body: JSON.stringify({
            event_id: liveId,
            sessions: sessions.map((session) => ({
              title: session.title.trim() || 'Session',
              starts_at: toIso(session.date, session.startTime),
              ends_at: session.endTime ? toIso(session.date, session.endTime) : null,
              timezone,
            })),
          }),
        });
      }

      if (goNext) {
        navigate(`/omnia-live/studio/${liveId}/tarification`);
      } else {
        setMessage('Étape 3 enregistrée.');
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
            Studio Omnia Live · Étape 3 sur 7
          </div>
          <h1 className="mt-2 text-3xl font-black" style={{ color: BLUE }}>
            Planification et sessions
          </h1>
        </div>

        <div className="space-y-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div>
            <label className="mb-2 block font-bold" style={{ color: BLUE }}>
              Fuseau horaire
            </label>
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 md:max-w-xl"
              placeholder="Africa/Bamako"
            />
            <p className="mt-2 text-sm text-slate-500">
              L’heure sera convertie automatiquement pour chaque participant selon son pays.
            </p>
          </div>

          {!isSynchronousTraining && deliveryType !== 'recorded_video' && (
            <div className="grid gap-5 md:grid-cols-3">
              <div>
                <label className="mb-2 block font-bold" style={{ color: BLUE }}>Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block font-bold" style={{ color: BLUE }}>Heure de début</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block font-bold" style={{ color: BLUE }}>Durée prévue</label>
                <input
                  type="number"
                  min={15}
                  step={15}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value || 60))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
                {estimatedEnd && (
                  <p className="mt-2 text-sm text-slate-500">Fin estimée : {estimatedEnd}</p>
                )}
              </div>
            </div>
          )}

          {isSynchronousTraining && (
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: BLUE }}>Sessions de la formation</h2>
                  <p className="text-sm text-slate-500">
                    Une seule inscription donne accès au programme complet.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addSession}
                  className="rounded-xl px-4 py-2 font-bold text-white"
                  style={{ background: GOLD }}
                >
                  + Ajouter une session
                </button>
              </div>

              <div className="space-y-4">
                {sessions.map((session, index) => (
                  <div key={index} className="rounded-2xl border border-slate-200 p-4">
                    <div className="grid gap-4 md:grid-cols-4">
                      <input
                        value={session.title}
                        onChange={(e) => updateSession(index, 'title', e.target.value)}
                        className="rounded-xl border border-slate-300 px-3 py-3"
                        placeholder={`Session ${index + 1}`}
                      />
                      <input
                        type="date"
                        value={session.date}
                        onChange={(e) => updateSession(index, 'date', e.target.value)}
                        className="rounded-xl border border-slate-300 px-3 py-3"
                      />
                      <input
                        type="time"
                        value={session.startTime}
                        onChange={(e) => updateSession(index, 'startTime', e.target.value)}
                        className="rounded-xl border border-slate-300 px-3 py-3"
                      />
                      <input
                        type="time"
                        value={session.endTime}
                        onChange={(e) => updateSession(index, 'endTime', e.target.value)}
                        className="rounded-xl border border-slate-300 px-3 py-3"
                        title="Heure de fin facultative"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSession(index)}
                      className="mt-3 text-sm font-semibold text-red-600"
                    >
                      Retirer cette session
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {deliveryType !== 'recorded_video' && (
            <>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block font-bold" style={{ color: BLUE }}>
                    Nombre maximum de participants
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                    placeholder="Laisser vide selon capacité autorisée"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-bold" style={{ color: BLUE }}>
                    Minimum souhaité de participants
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={minimumParticipants}
                    onChange={(e) => setMinimumParticipants(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                    placeholder="Facultatif"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Si le seuil n’est pas atteint, l’annulation n’est jamais automatique : maintien,
                    report ou annulation restent soumis au workflow validé.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block font-bold" style={{ color: BLUE }}>
                    Ouverture de la salle d’attente
                  </label>
                  <select
                    value={waitingRoomMinutes}
                    onChange={(e) => setWaitingRoomMinutes(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  >
                    <option value={0}>À l’ouverture manuelle</option>
                    <option value={15}>15 min avant</option>
                    <option value={30}>30 min avant</option>
                    <option value={45}>45 min avant</option>
                    <option value={60}>60 min avant</option>
                  </select>
                </div>

                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
                  <input
                    type="checkbox"
                    checked={allowLateRegistration}
                    onChange={(e) => setAllowLateRegistration(e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-bold" style={{ color: BLUE }}>
                      Autoriser les inscriptions après le début
                    </span>
                    <span className="mt-1 block text-sm text-slate-500">
                      L’accès reste soumis au paiement ou au droit d’accès applicable.
                    </span>
                  </span>
                </label>
              </div>
            </>
          )}

          {deliveryType === 'recorded_video' && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              Une vidéo préenregistrée n’a pas besoin de date de direct. La durée et le média seront
              gérés dans l’étape dédiée aux ressources et médias.
            </div>
          )}

          {message && (
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</div>
          )}

          <div className="flex flex-wrap justify-between gap-3 border-t pt-6">
            <button
              type="button"
              onClick={() => navigate(`/omnia-live/studio/${liveId}/presentation`)}
              className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700"
            >
              ← Étape 2
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
