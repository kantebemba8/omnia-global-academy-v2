import { useState, type FormEvent } from 'react';
import { Mail, Send } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { PageFooter } from '../components/PageFooter';

const CONTACT_EMAIL = 'contact@omniaglobalacademy.com';

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = [
      name.trim() ? `Nom : ${name.trim()}` : '',
      email.trim() ? `E-mail : ${email.trim()}` : '',
      '',
      message.trim(),
    ].filter(Boolean).join('\n');
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject.trim() || 'Contact Omnia Global Academy')}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Navbar />
      <main className="pt-20">
        <section className="relative overflow-hidden border-b border-slate-200 bg-[#FBFCFE] px-5 py-16 sm:px-6 lg:px-8">
          <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(circle at 78% 36%, rgba(191,136,19,.18), transparent 18%), linear-gradient(rgba(0,32,80,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,32,80,.05) 1px, transparent 1px)', backgroundSize: 'auto,32px 32px,32px 32px' }} />
          <div className="relative mx-auto max-w-7xl">
            <h1 className="max-w-3xl text-4xl font-black tracking-[-0.04em] text-[#002050] sm:text-5xl">Contactez Omnia</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">Écrivez-nous pour toute demande concernant Omnia Global Academy. Votre message sera préparé dans votre application de messagerie.</p>
          </div>
        </section>

        <section className="px-5 py-14 sm:px-6 lg:px-8 lg:py-16">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.15fr_.85fr]">
            <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,.06)] sm:p-8">
              <h2 className="text-2xl font-black text-[#002050]">Écrivez-nous un message</h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-bold text-[#002050]">Nom complet
                  <input value={name} onChange={event => setName(event.target.value)} autoComplete="name" className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-normal text-slate-900 outline-none focus:border-[#BF8813] focus:ring-2 focus:ring-[#BF8813]/15" placeholder="Votre nom" />
                </label>
                <label className="text-sm font-bold text-[#002050]">Adresse e-mail
                  <input value={email} onChange={event => setEmail(event.target.value)} required type="email" autoComplete="email" className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-normal text-slate-900 outline-none focus:border-[#BF8813] focus:ring-2 focus:ring-[#BF8813]/15" placeholder="votre@email.com" />
                </label>
              </div>
              <label className="mt-5 block text-sm font-bold text-[#002050]">Sujet
                <input value={subject} onChange={event => setSubject(event.target.value)} required className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-normal text-slate-900 outline-none focus:border-[#BF8813] focus:ring-2 focus:ring-[#BF8813]/15" placeholder="Objet de votre demande" />
              </label>
              <label className="mt-5 block text-sm font-bold text-[#002050]">Votre message
                <textarea value={message} onChange={event => setMessage(event.target.value)} required rows={8} className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3 py-3 text-sm font-normal text-slate-900 outline-none focus:border-[#BF8813] focus:ring-2 focus:ring-[#BF8813]/15" placeholder="Décrivez votre demande..." />
              </label>
              <button type="submit" className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#002050] px-5 py-3 text-sm font-black text-white transition hover:bg-[#00183E]">
                <Send size={17} /> Préparer mon e-mail
              </button>
              <p className="mt-3 text-xs leading-5 text-slate-500">Le bouton ouvre votre application de messagerie avec les informations saisies. Aucun message n’est présenté comme envoyé tant que vous ne l’envoyez pas depuis votre messagerie.</p>
            </form>

            <aside className="rounded-2xl border border-[#E8DDBF] bg-[#FFFCF6] p-6 sm:p-8">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#BF8813] text-white"><Mail size={22} /></span>
              <h2 className="mt-5 text-xl font-black text-[#002050]">Adresse de contact</h2>
              <a href={`mailto:${CONTACT_EMAIL}`} className="mt-3 inline-flex text-sm font-bold text-[#002050] underline decoration-[#BF8813] underline-offset-4">{CONTACT_EMAIL}</a>
              <p className="mt-5 text-sm leading-7 text-slate-600">Pour les questions liées à la confidentialité, utilisez l’adresse dédiée indiquée dans la politique de confidentialité de la plateforme.</p>
            </aside>
          </div>
        </section>
      </main>
      <PageFooter managedOnly />
    </div>
  );
}
