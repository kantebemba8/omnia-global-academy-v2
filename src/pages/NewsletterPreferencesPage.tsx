import { useState } from 'react';
import { CheckCircle2, Loader2, Mail, XCircle } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { PageFooter } from '../components/PageFooter';
import { ENDPOINTS } from '../lib/config';
import { edgeGatewayHeaders } from '../lib/edgeAuth';

type Action = 'subscribe' | 'unsubscribe';

export default function NewsletterPreferencesPage() {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState<Action | null>(null);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  async function submit(action: Action) {
    if (!email.trim() || loading) return;
    if (action === 'subscribe' && !consent) {
      setSuccess(false);
      setMessage('Cochez la case de consentement pour vous inscrire.');
      return;
    }
    setLoading(action);
    setMessage('');
    try {
      const response = await fetch(ENDPOINTS.newsletterSend, {
        method: 'POST',
        headers: edgeGatewayHeaders(),
        body: JSON.stringify({
          action,
          email: email.trim(),
          consent: action === 'subscribe' ? true : undefined,
          source: 'preferences_page',
          locale: document.documentElement.lang || navigator.language?.slice(0, 2) || 'fr',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || 'Action impossible.');
      setSuccess(true);
      setMessage(data.message || (action === 'subscribe' ? 'Inscription enregistrée.' : 'Désinscription enregistrée.'));
      if (action === 'unsubscribe') setConsent(false);
    } catch (error) {
      setSuccess(false);
      setMessage(error instanceof Error ? error.message : 'Le service est momentanément indisponible.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="px-5 pb-20 pt-28">
        <section className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/40">
          <div className="bg-[#002050] px-6 py-8 text-white sm:px-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#BF8813]/50 bg-[#BF8813]/15 px-4 py-2 text-sm font-bold"><Mail className="h-4 w-4 text-[#BF8813]" /> Omnia Newsletter</div>
            <h1 className="mt-4 text-3xl font-bold">Gérer mon abonnement</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">Inscrivez-vous aux actualités d’Omnia Global Academy ou retirez votre consentement à tout moment.</p>
          </div>

          <div className="space-y-5 p-6 sm:p-10">
            <div>
              <label htmlFor="newsletter-email" className="text-sm font-semibold text-slate-700">Adresse e-mail</label>
              <input id="newsletter-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="votre@email.com" className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#BF8813] focus:ring-4 focus:ring-[#BF8813]/10" />
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1" />
              <span>J’accepte de recevoir la newsletter d’Omnia Global Academy. Mon consentement est facultatif et peut être retiré à tout moment.</span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => submit('subscribe')} disabled={!email.trim() || !consent || Boolean(loading)} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#002050] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {loading === 'subscribe' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} S’inscrire
              </button>
              <button type="button" onClick={() => submit('unsubscribe')} disabled={!email.trim() || Boolean(loading)} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
                {loading === 'unsubscribe' ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Se désinscrire
              </button>
            </div>

            {message && <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${success ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{success && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}<span>{message}</span></div>}

            <p className="text-xs leading-5 text-slate-500">Les préférences sont enregistrées avec leur date, leur origine et la version du consentement. Elles ne servent qu’à la gestion de la newsletter.</p>
          </div>
        </section>
      </main>
      <PageFooter />
    </div>
  );
}
