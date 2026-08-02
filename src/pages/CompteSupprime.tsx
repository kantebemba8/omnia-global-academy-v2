import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, FileLock2 } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { PageFooter } from '../components/PageFooter';

export function CompteSupprime() {
  const [params] = useSearchParams();
  const reference = params.get('reference');

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Navbar />
      <main className="flex min-h-[70vh] items-center px-5 pb-16 pt-24 sm:px-6">
        <section className="mx-auto w-full max-w-2xl rounded-3xl border border-slate-200 bg-slate-50 p-7 text-center sm:p-10">
          <CheckCircle2 aria-hidden="true" className="mx-auto text-emerald-700" size={52} />
          <h1 className="mt-5 text-3xl font-black text-[#002050]">Votre compte a été supprimé</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-600">
            Toutes les sessions ont été révoquées. Les données personnelles non soumises à une obligation de conservation ont été supprimées ou anonymisées.
          </p>
          {reference && (
            <div className="mx-auto mt-6 max-w-lg rounded-xl border border-slate-200 bg-white p-4 text-left">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <FileLock2 aria-hidden="true" size={15} /> Référence de suppression
              </p>
              <p className="mt-2 break-all font-mono text-sm text-slate-800">{reference}</p>
            </div>
          )}
          <Link to="/accueil" className="mt-7 inline-flex rounded-xl bg-[#002050] px-5 py-3 text-sm font-bold text-white">
            Retour à l’accueil
          </Link>
        </section>
      </main>
      <PageFooter />
    </div>
  );
}
