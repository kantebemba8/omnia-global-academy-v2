import { Link } from 'react-router-dom';
import { ArrowRight, MessageCircle, ShieldCheck, UsersRound } from 'lucide-react';
import { TalentLayout } from '../../components/talent/TalentLayout';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

export default function TalentCommunity() {
  return (
    <TalentLayout>
      <section className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
        <div className="max-w-3xl">
          <span className="text-sm font-semibold" style={{ color: GOLD }}>Communauté Omnia Talent</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl" style={{ color: BLUE }}>Échangez, apprenez et développez votre réseau professionnel</h1>
          <p className="mt-4 text-base leading-7 text-gray-600">Retrouvez les échanges de la communauté Omnia autour des compétences, des métiers, des opportunités et de l’évolution professionnelle.</p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: UsersRound, title: 'Réseau Omnia', text: 'Rencontrez des apprenants, formateurs et professionnels de la communauté.' },
            { icon: MessageCircle, title: 'Discussions utiles', text: 'Posez vos questions et partagez des retours d’expérience concrets.' },
            { icon: ShieldCheck, title: 'Espace encadré', text: 'Profitez d’un environnement modéré et relié à votre compte Omnia.' },
          ].map(item => (
            <article key={item.title} className="rounded-2xl border bg-white p-6" style={{ borderColor: BORDER }}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'rgba(191,136,19,.10)' }}><item.icon size={21} color={GOLD}/></div>
              <h2 className="mt-4 text-base font-semibold" style={{ color: BLUE }}>{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">{item.text}</p>
            </article>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 rounded-2xl border bg-white p-6 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: BORDER }}>
          <div><h2 className="font-semibold" style={{ color: BLUE }}>Accéder au forum Omnia</h2><p className="mt-1 text-sm text-gray-500">Le forum reste le cœur des discussions de la communauté.</p></div>
          <Link to="/forum" className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: BLUE }}>Ouvrir le forum <ArrowRight size={16}/></Link>
        </div>
      </section>
    </TalentLayout>
  );
}
