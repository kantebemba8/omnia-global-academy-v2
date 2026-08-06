import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

const BLUE = '#002050';
const GOLD = '#BF8813';

export default function OmniaLiveStudioPricing() {
  const { liveId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [deliveryType, setDeliveryType] = useState('single_live');
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('XOF');

  const [replayEnabled, setReplayEnabled] = useState(false);
  const [replaySaleEnabled, setReplaySaleEnabled] = useState(false);
  const [replayPrice, setReplayPrice] = useState('');
  const [replayDays, setReplayDays] = useState('');

  const [refundBeforeHours, setRefundBeforeHours] = useState('48');
  const [refundPercent, setRefundPercent] = useState('100');
  const [lateRefundPercent, setLateRefundPercent] = useState('0');
  const [cancellationNote, setCancellationNote] = useState('');

  useEffect(() => {
    if (!liveId) return;

    liveApi('studio_get', {}, { event_id: liveId })
      .then((data) => {
        const event = data?.event;
        if (!event) throw new Error('Brouillon introuvable');

        setDeliveryType(event.delivery_type || 'single_live');

        const amount = Number(event.price_amount || 0);
        setIsFree(amount <= 0);
        setPrice(amount > 0 ? String(amount) : '');
        setCurrency(event.currency || 'XOF');

        setReplayEnabled(Boolean(event.replay_enabled));
        setReplaySaleEnabled(Boolean(event.replay_sale_enabled));
        setReplayPrice(
          event.proposed_replay_price_amount == null
            ? ''
            : String(event.proposed_replay_price_amount),
        );
        setReplayDays(
          event.replay_availability_days == null
            ? ''
            : String(event.replay_availability_days),
        );

        const refund = event.organizer_refund_proposal || {};
        setRefundBeforeHours(String(refund.full_refund_before_hours ?? 48));
        setRefundPercent(String(refund.refund_percent_before_deadline ?? 100));
        setLateRefundPercent(String(refund.refund_percent_after_deadline ?? 0));

        const cancellation = event.organizer_cancellation_proposal || {};
        setCancellationNote(cancellation.note || '');
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : 'Impossible de charger cette étape.');
      })
      .finally(() => setLoading(false));
  }, [liveId]);

  async function save(goNext = false) {
    if (!liveId) return;

    const livePrice = isFree ? 0 : Number(price);

    if (!isFree && (!Number.isFinite(livePrice) || livePrice <= 0)) {
      setMessage('Indiquez un prix proposé valide.');
      return;
    }

    if (
      replaySaleEnabled &&
      (!replayEnabled || !replayPrice || Number(replayPrice) < 0)
    ) {
      setMessage('Indiquez un prix Replay valide.');
      return;
    }

    if (
      !isFree &&
      replaySaleEnabled &&
      Number(replayPrice) >= livePrice
    ) {
      setMessage('Le Replay doit être proposé moins cher que l’accès Live.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      await liveApi('update_draft', {
        method: 'POST',
        body: JSON.stringify({
          event_id: liveId,
          price_amount: livePrice,
          currency,
          replay_enabled: deliveryType === 'recorded_video' ? false : replayEnabled,
          proposed_replay_price_amount:
            replaySaleEnabled && replayEnabled ? Number(replayPrice) : null,
          replay_sale_enabled:
            deliveryType !== 'recorded_video' && replayEnabled && replaySaleEnabled,
          replay_availability_days:
            replayEnabled && replayDays ? Number(replayDays) : null,
          organizer_refund_proposal: {
            full_refund_before_hours: Number(refundBeforeHours || 0),
            refund_percent_before_deadline: Number(refundPercent || 0),
            refund_percent_after_deadline: Number(lateRefundPercent || 0),
            subject_to_super_admin_approval: true,
          },
          organizer_cancellation_proposal: {
            note: cancellationNote.trim() || null,
            admin_validation_required: true,
            cancellation_reason_required: true,
          },
        }),
      });

      if (goNext) {
        navigate(`/omnia-live/studio/${liveId}/intervenants`);
      } else {
        setMessage('Étape 4 enregistrée.');
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
            Studio Omnia Live · Étape 4 sur 7
          </div>
          <h1 className="mt-2 text-3xl font-black" style={{ color: BLUE }}>
            Tarification et Replay
          </h1>
          <p className="mt-2 text-slate-600">
            Vous proposez les conditions. L’Administration Omnia valide les conditions commerciales finales.
          </p>
        </div>

        <div className="space-y-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div>
            <h2 className="text-lg font-bold" style={{ color: BLUE }}>Accès au contenu</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setIsFree(true)}
                className="rounded-2xl border p-5 text-left"
                style={{
                  borderColor: isFree ? GOLD : '#E2E8F0',
                  background: isFree ? '#FFFBF2' : '#FFFFFF',
                }}
              >
                <div className="font-bold" style={{ color: BLUE }}>Gratuit</div>
                <div className="mt-1 text-sm text-slate-500">Aucun paiement participant.</div>
              </button>

              <button
                type="button"
                onClick={() => setIsFree(false)}
                className="rounded-2xl border p-5 text-left"
                style={{
                  borderColor: !isFree ? GOLD : '#E2E8F0',
                  background: !isFree ? '#FFFBF2' : '#FFFFFF',
                }}
              >
                <div className="font-bold" style={{ color: BLUE }}>Payant</div>
                <div className="mt-1 text-sm text-slate-500">
                  Le prix proposé sera examiné avec la commission Omnia.
                </div>
              </button>
            </div>
          </div>

          {!isFree && (
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block font-bold" style={{ color: BLUE }}>Prix proposé</label>
                <input
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block font-bold" style={{ color: BLUE }}>Devise</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                >
                  <option value="XOF">XOF — FCFA</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="USD">USD — Dollar</option>
                  <option value="GBP">GBP — Livre sterling</option>
                </select>
              </div>
            </div>
          )}

          {deliveryType !== 'recorded_video' && (
            <div className="rounded-2xl border border-slate-200 p-5">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={replayEnabled}
                  onChange={(e) => {
                    setReplayEnabled(e.target.checked);
                    if (!e.target.checked) setReplaySaleEnabled(false);
                  }}
                  className="mt-1"
                />
                <span>
                  <span className="block font-bold" style={{ color: BLUE }}>Activer le Replay</span>
                  <span className="text-sm text-slate-500">
                    Les participants ayant payé le Live conservent le droit d’accès prévu au Replay.
                  </span>
                </span>
              </label>

              {replayEnabled && (
                <div className="mt-5 space-y-5 border-t pt-5">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={replaySaleEnabled}
                      onChange={(e) => setReplaySaleEnabled(e.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-bold" style={{ color: BLUE }}>
                        Vendre également le Replay séparément
                      </span>
                      <span className="text-sm text-slate-500">
                        Pour un Live payant, le prix Replay doit être inférieur au prix Live.
                      </span>
                    </span>
                  </label>

                  <div className="grid gap-5 md:grid-cols-2">
                    {replaySaleEnabled && (
                      <div>
                        <label className="mb-2 block font-bold" style={{ color: BLUE }}>
                          Prix Replay proposé
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={replayPrice}
                          onChange={(e) => setReplayPrice(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-4 py-3"
                        />
                      </div>
                    )}

                    <div>
                      <label className="mb-2 block font-bold" style={{ color: BLUE }}>
                        Durée d’accès au Replay
                      </label>
                      <select
                        value={replayDays}
                        onChange={(e) => setReplayDays(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3"
                      >
                        <option value="">Selon la politique validée</option>
                        <option value="7">7 jours</option>
                        <option value="30">30 jours</option>
                        <option value="90">90 jours</option>
                        <option value="180">180 jours</option>
                        <option value="365">1 an</option>
                      </select>
                    </div>
                  </div>

                  {deliveryType === 'synchronous_training' && (
                    <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                      Pour une formation avec sessions Live, les Replays faisant partie du parcours
                      peuvent rester accessibles selon les règles de la formation validées par Omnia.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <h2 className="text-lg font-bold" style={{ color: BLUE }}>
              Proposition de remboursement participant
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Cette proposition sera contrôlée et pourra être modifiée par l’Administration Omnia avant validation.
            </p>

            <div className="mt-4 grid gap-5 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-semibold">Délai avant début (heures)</label>
                <input
                  type="number"
                  min={0}
                  value={refundBeforeHours}
                  onChange={(e) => setRefundBeforeHours(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">Remboursement avant délai (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={refundPercent}
                  onChange={(e) => setRefundPercent(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">Après délai (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={lateRefundPercent}
                  onChange={(e) => setLateRefundPercent(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block font-bold" style={{ color: BLUE }}>
              Conditions particulières proposées en cas d’annulation
            </label>
            <textarea
              value={cancellationNote}
              onChange={(e) => setCancellationNote(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
              placeholder="Facultatif. Toute annulation restera soumise au motif et à la validation de l’Administration Omnia."
            />
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Le prix saisi ici est une proposition. Après examen, l’Administration Omnia fixe les conditions
            commerciales finales et la commission. L’organisateur devra les accepter avant publication.
          </div>

          {message && (
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</div>
          )}

          <div className="flex flex-wrap justify-between gap-3 border-t pt-6">
            <button
              type="button"
              onClick={() => navigate(`/omnia-live/studio/${liveId}/planification`)}
              className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700"
            >
              ← Étape 3
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
