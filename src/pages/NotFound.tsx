import { ArrowLeft, Home } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getSessionToken } from '../lib/session';

export default function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();
  const authenticated = Boolean(getSessionToken());
  const homePath = authenticated && location.pathname.startsWith('/omnia-career') ? '/omnia-career' : authenticated ? '/home' : '/accueil';

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-5 py-12">
      <section className="w-full max-w-2xl border-t-4 border-[#BF8813] py-10 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#BF8813]">Erreur 404</p>
        <h1 className="mt-4 text-3xl font-bold text-[#002050] sm:text-4xl">Cette page n’existe pas</h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-slate-600 sm:text-base">
          L’adresse utilisée est incorrecte ou la page a été déplacée. Vos données et votre session n’ont pas été modifiées.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-[#002050] hover:bg-slate-50"
          >
            <ArrowLeft aria-hidden="true" size={17} />
            Page précédente
          </button>
          <Link
            to={homePath}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#002050] px-5 py-3 text-sm font-semibold text-white hover:bg-[#00183d]"
          >
            <Home aria-hidden="true" size={17} />
            Retour à l’accueil
          </Link>
        </div>
      </section>
    </main>
  );
}
