import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, LockKeyhole, ShieldCheck, Trash2 } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { PageFooter } from '../components/PageFooter';
import { getSessionToken } from '../lib/session';

const RETAINED = [
  'factures, paiements et remboursements lorsque la loi impose leur conservation',
  'traces minimales nécessaires à la lutte contre la fraude et à la sécurité',
  'journaux d’audit strictement pseudonymisés lorsqu’ils sont nécessaires à la conformité',
];

export function SupprimerCompte() {
  const signedIn = Boolean(getSessionToken());

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Navbar />
      <main className="px-5 pb-16 pt-24 sm:px-6">
        <section className="mx-auto max-w-3xl">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 sm:p-9">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700">
              <Trash2 aria-hidden="true" size={24} />
            </div>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-[#BF8813]">Gestion du compte</p>
            <h1 className="mt-2 text-3xl font-black text-[#002050] sm:text-4xl">Supprimer votre compte Omnia</h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              La suppression ferme immédiatement votre accès, révoque toutes vos sessions et efface ou anonymise les données personnelles qui ne doivent pas être conservées. Une suspension temporaire et réversible est disponible dans Mon profil si vous souhaitez simplement faire une pause.
            </p>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 p-6">
              <ShieldCheck aria-hidden="true" className="text-[#BF8813]" size={22} />
              <h2 className="mt-4 text-lg font-bold text-[#002050]">Données supprimées</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Vos identifiants, sessions, profils privés, préférences, candidatures, conversations, fichiers personnels et autres données directement rattachées au compte sont supprimés ou anonymisés.
              </p>
            </article>
            <article className="rounded-2xl border border-slate-200 p-6">
              <LockKeyhole aria-hidden="true" className="text-[#BF8813]" size={22} />
              <h2 className="mt-4 text-lg font-bold text-[#002050]">Données légalement conservées</h2>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
                {RETAINED.map(item => <li key={item}>• {item}</li>)}
              </ul>
            </article>
          </div>

          <div className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-6">
            <div className="flex items-start gap-3">
              <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-blue-800" size={22} />
              <div>
                <h2 className="font-bold text-blue-950">Vous souhaitez seulement faire une pause ?</h2>
                <p className="mt-2 text-sm leading-6 text-blue-900">La suspension volontaire conserve vos données, ferme toutes vos sessions et peut être annulée de manière sécurisée depuis la page de connexion avec votre mot de passe.</p>
                {signedIn && <Link to="/mon-profil?tab=securite#gestion-compte" className="mt-3 inline-flex rounded-lg bg-[#002050] px-4 py-2 text-sm font-bold text-white">Suspendre plutôt mon compte</Link>}
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0 text-amber-800" size={22} />
              <div>
                <h2 className="font-bold text-amber-950">Action irréversible</h2>
                <p className="mt-2 text-sm leading-6 text-amber-900">
                  Après confirmation, vous ne pourrez plus vous connecter ni restaurer vos espaces. Les achats déjà facturés restent uniquement dans les registres comptables pseudonymisés requis.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 p-6 sm:p-8">
            <CheckCircle2 aria-hidden="true" className="text-emerald-700" size={24} />
            <h2 className="mt-4 text-xl font-bold text-[#002050]">Effectuer la suppression</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Pour protéger votre compte, la suppression nécessite une session active, votre mot de passe actuel, un motif et la confirmation explicite « SUPPRIMER ». Un questionnaire d’amélioration facultatif est proposé sans être affiché dans les journaux administratifs.
            </p>
            {signedIn ? (
              <Link
                to="/mon-profil?tab=securite"
                className="mt-5 inline-flex rounded-xl bg-[#002050] px-5 py-3 text-sm font-bold text-white"
              >
                Ouvrir les paramètres de sécurité
              </Link>
            ) : (
              <Link
                to="/connexion?redirect=%2Fmon-profil%3Ftab%3Dsecurite%23gestion-compte"
                className="mt-5 inline-flex rounded-xl bg-[#002050] px-5 py-3 text-sm font-bold text-white"
              >
                Se connecter pour supprimer le compte
              </Link>
            )}
            <p className="mt-4 text-xs leading-5 text-slate-500">
              En cas d’impossibilité d’accès, contactez privacy@omniaglobalacademy.com depuis l’adresse liée au compte. Une vérification d’identité sera demandée avant toute action.
            </p>
          </div>
        </section>
      </main>
      <PageFooter />
    </div>
  );
}
