import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { RuntimeConfigIssue } from '../lib/runtimeConfig';

export default function ConfigurationError({ issues }: { issues: RuntimeConfigIssue[] }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
      <section className="w-full max-w-xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
            <AlertTriangle aria-hidden="true" size={22} />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Configuration requise</p>
            <h1 className="mt-2 text-2xl font-bold text-[#002050]">La plateforme ne peut pas démarrer</h1>
          </div>
        </div>

        <p className="mt-6 text-sm leading-6 text-slate-600">
          Une configuration technique nécessaire à Omnia Global Academy est manquante. Aucun mot de passe ni aucune donnée personnelle n’est affiché sur cette page.
        </p>

        <ul className="mt-5 space-y-2 text-sm text-slate-700">
          {issues.map(issue => (
            <li key={issue.key} className="border-l-2 border-amber-500 bg-amber-50 px-4 py-3">
              {issue.message}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-7 inline-flex items-center gap-2 rounded-lg bg-[#002050] px-5 py-3 text-sm font-semibold text-white hover:bg-[#00183d]"
        >
          <RefreshCw aria-hidden="true" size={17} />
          Réessayer
        </button>
      </section>
    </main>
  );
}
