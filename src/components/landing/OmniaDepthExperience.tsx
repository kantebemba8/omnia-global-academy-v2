import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  Briefcase,
  Check,
  FolderKanban,
  Network,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import type { CourseCardData } from '../CourseCard';
import { useEnhancedLandingMotion } from '../../hooks/useLandingMotion';

type HeroDepthStageProps = {
  course?: CourseCardData | null;
};

type JourneyDepthStageProps = {
  activeIndex: number;
};

type NexusStep = {
  label: string;
  title: string;
  description: string;
  href: string;
  icon: typeof BookOpen;
  signals: string[];
};

const NEXUS_STEPS: NexusStep[] = [
  {
    label: 'Apprendre',
    title: 'Construire des compétences utiles',
    description: 'Formations, parcours, évaluations et sessions en direct sont réunis dans un environnement de progression cohérent.',
    href: '/catalogue',
    icon: BookOpen,
    signals: ['Formations', 'Parcours', 'Évaluations'],
  },
  {
    label: 'Pratiquer',
    title: 'Transformer les acquis en réalisations',
    description: 'Les projets, missions et livrables donnent une dimension concrète aux connaissances acquises.',
    href: '/projects',
    icon: FolderKanban,
    signals: ['Projets', 'Missions', 'Portfolio'],
  },
  {
    label: 'Prouver',
    title: 'Rendre les acquis vérifiables',
    description: 'Certificats, badges et preuves professionnelles structurent une identité de compétences crédible.',
    href: '/verify',
    icon: BadgeCheck,
    signals: ['Certificats', 'Badges', 'Skills Passport'],
  },
  {
    label: 'Se développer',
    title: 'Préparer la prochaine étape professionnelle',
    description: 'CV, portfolio, coaching et outils de carrière permettent de convertir les compétences en progression professionnelle.',
    href: '/coaching',
    icon: Target,
    signals: ['Career', 'Coaching', 'Portfolio'],
  },
  {
    label: 'Opportunités',
    title: 'Relier talents, recruteurs et structures',
    description: 'Les profils, offres, candidatures et besoins des organisations se rencontrent dans le même écosystème.',
    href: '/talent',
    icon: Network,
    signals: ['Talent', 'Offres', 'Recrutement'],
  },
];

function SignalList({ items }: { items: string[] }) {
  return (
    <div className="oga-nexus-signals" aria-label="Fonctions disponibles">
      {items.map(item => (
        <span key={item}><Check className="h-3.5 w-3.5" aria-hidden="true" />{item}</span>
      ))}
    </div>
  );
}

export function OmniaHeroDepthStage({ course }: HeroDepthStageProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const enhancedMotion = useEnhancedLandingMotion();
  const active = NEXUS_STEPS[activeIndex] || NEXUS_STEPS[0];
  const ActiveIcon = active.icon;

  const activeTitle = useMemo(() => {
    if (activeIndex === 0 && course?.title?.trim()) return course.title.trim();
    return active.title;
  }, [active.title, activeIndex, course?.title]);

  const activeDescription = activeIndex === 0 && course?.short_description?.trim()
    ? course.short_description.trim()
    : active.description;

  return (
    <div className="oga-nexus-stage" data-motion={enhancedMotion ? 'enhanced' : 'static'}>
      <span className="oga-nexus-stage__layer oga-nexus-stage__layer--back" aria-hidden="true" />
      <span className="oga-nexus-stage__layer oga-nexus-stage__layer--middle" aria-hidden="true" />

      <div className="oga-nexus-stage__surface">
        <header className="oga-nexus-stage__header">
          <div>
            <span className="oga-nexus-stage__status"><i aria-hidden="true" />Écosystème connecté</span>
            <strong>OMNIA NEXUS</strong>
          </div>
          <span className="oga-nexus-stage__index">{String(activeIndex + 1).padStart(2, '0')} / 05</span>
        </header>

        <div className="oga-nexus-stage__body">
          <nav className="oga-nexus-route" aria-label="Explorer le parcours Omnia">
            {NEXUS_STEPS.map((step, index) => {
              const Icon = step.icon;
              const selected = index === activeIndex;
              return (
                <button
                  key={step.label}
                  type="button"
                  className={selected ? 'is-active' : ''}
                  aria-pressed={selected}
                  onClick={() => setActiveIndex(index)}
                  onPointerEnter={() => setActiveIndex(index)}
                >
                  <span><Icon className="h-4 w-4" aria-hidden="true" /></span>
                  <strong>{step.label}</strong>
                  <i aria-hidden="true" />
                </button>
              );
            })}
          </nav>

          <section className="oga-nexus-viewport" aria-live="polite">
            <div className="oga-nexus-viewport__identity">
              <span><ActiveIcon className="h-7 w-7" aria-hidden="true" /></span>
              <div>
                <small>{active.label}</small>
                <h3 data-no-auto-translate={activeIndex === 0 && Boolean(course?.title) ? 'true' : undefined}>{activeTitle}</h3>
              </div>
            </div>

            <p data-no-auto-translate={activeIndex === 0 && Boolean(course?.short_description) ? 'true' : undefined}>{activeDescription}</p>
            <SignalList items={active.signals} />

            <Link to={active.href} className="oga-nexus-viewport__action">
              Explorer cet espace <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>
        </div>

        <footer className="oga-nexus-stage__footer">
          <span><ShieldCheck className="h-4 w-4" aria-hidden="true" />Identité Omnia</span>
          <span><Sparkles className="h-4 w-4" aria-hidden="true" />Une progression continue</span>
          <span><Briefcase className="h-4 w-4" aria-hidden="true" />Des résultats professionnels</span>
        </footer>
      </div>
    </div>
  );
}

const JOURNEY_SCENES: Array<{
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof BookOpen;
  rows: string[];
}> = [
  {
    eyebrow: 'Étape 01',
    title: 'Apprendre',
    description: 'Choisir une formation ou un parcours, progresser et valider les connaissances.',
    icon: BookOpen,
    rows: ['Formations', 'Parcours', 'Évaluations', 'Omnia Live'],
  },
  {
    eyebrow: 'Étape 02',
    title: 'Pratiquer',
    description: 'Appliquer les acquis dans des situations concrètes et produire des livrables.',
    icon: FolderKanban,
    rows: ['Projets', 'Missions', 'Livrables', 'Portfolio'],
  },
  {
    eyebrow: 'Étape 03',
    title: 'Prouver',
    description: 'Rassembler les documents, badges et preuves qui attestent les compétences.',
    icon: BadgeCheck,
    rows: ['Certificats', 'Badges', 'Learning Record', 'Skills Passport'],
  },
  {
    eyebrow: 'Étape 04',
    title: 'Se développer',
    description: 'Structurer son profil, se faire accompagner et préparer ses prochaines décisions.',
    icon: Target,
    rows: ['CV', 'Portfolio', 'Coaching', 'Préparation'],
  },
  {
    eyebrow: 'Étape 05',
    title: 'Accéder aux opportunités',
    description: 'Mettre les compétences en relation avec les recruteurs, structures et missions.',
    icon: Network,
    rows: ['Omnia Talent', 'Offres', 'Candidatures', 'Structures'],
  },
];

function JourneyRow({ children }: { children: ReactNode }) {
  return <span><Check className="h-3.5 w-3.5" aria-hidden="true" />{children}</span>;
}

export function OmniaJourneyDepthStage({ activeIndex }: JourneyDepthStageProps) {
  const normalizedIndex = ((activeIndex % JOURNEY_SCENES.length) + JOURNEY_SCENES.length) % JOURNEY_SCENES.length;
  const active = JOURNEY_SCENES[normalizedIndex];
  const ActiveIcon = active.icon;

  return (
    <div className="oga-journey-front-stage">
      <span className="oga-journey-front-stage__layer oga-journey-front-stage__layer--one" aria-hidden="true" />
      <span className="oga-journey-front-stage__layer oga-journey-front-stage__layer--two" aria-hidden="true" />

      <div key={active.title} className="oga-journey-front-stage__surface">
        <div className="oga-journey-front-stage__topline">
          <span>{active.eyebrow}</span>
          <strong>{String(normalizedIndex + 1).padStart(2, '0')} / 05</strong>
        </div>

        <div className="oga-journey-front-stage__focus">
          <span className="oga-journey-front-stage__icon"><ActiveIcon className="h-8 w-8" aria-hidden="true" /></span>
          <h3>{active.title}</h3>
          <p>{active.description}</p>
          <div className="oga-journey-front-stage__rows">
            {active.rows.map(row => <JourneyRow key={row}>{row}</JourneyRow>)}
          </div>
        </div>

        <div className="oga-journey-front-stage__progress" aria-hidden="true">
          {JOURNEY_SCENES.map((scene, index) => (
            <span key={scene.title} className={index <= normalizedIndex ? 'is-complete' : ''}>
              <i />
              <small>{String(index + 1).padStart(2, '0')}</small>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
