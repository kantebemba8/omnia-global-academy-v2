import { useRef, type CSSProperties, type ReactNode } from 'react';
import {
  Award,
  BadgeCheck,
  BookOpen,
  Briefcase,
  Check,
  FileBadge2,
  FolderKanban,
  Network,
  ShieldCheck,
  Target,
} from 'lucide-react';
import type { CourseCardData } from '../CourseCard';
import { useElementScrollProgress, useEnhancedLandingMotion } from '../../hooks/useLandingMotion';

type StageStyle = CSSProperties & Record<'--oga-scroll', number>;

type HeroDepthStageProps = {
  course?: CourseCardData | null;
};

type JourneyDepthStageProps = {
  activeIndex: number;
};

type InterfaceWindowProps = {
  eyebrow: string;
  title: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

function InterfaceWindow({ eyebrow, title, icon, children, className = '', style }: InterfaceWindowProps) {
  return (
    <div className={`oga-interface-window ${className}`} style={style}>
      <div className="oga-interface-window__bar">
        <span className="oga-interface-window__mark" />
        <span className="oga-interface-window__mark" />
        <span className="oga-interface-window__mark" />
        <span className="oga-interface-window__brand">Omnia</span>
      </div>
      <div className="oga-interface-window__body">
        <div className="oga-interface-window__heading">
          <span className="oga-interface-window__icon">{icon}</span>
          <span>
            <span className="oga-interface-window__eyebrow">{eyebrow}</span>
            <strong>{title}</strong>
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

function InterfaceRows({ items }: { items: string[] }) {
  return (
    <div className="oga-interface-rows">
      {items.map(item => (
        <div key={item} className="oga-interface-row">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

export function OmniaHeroDepthStage({ course }: HeroDepthStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const enhancedMotion = useEnhancedLandingMotion();
  const progress = useElementScrollProgress(stageRef, enhancedMotion);
  const stageStyle: StageStyle = { '--oga-scroll': progress };

  const courseTitle = course?.title?.trim() || 'Catalogue de formations';
  const courseMeta = [course?.category, course?.level, course?.language].filter(Boolean) as string[];

  return (
    <div
      ref={stageRef}
      className="oga-hero-depth-stage"
      style={stageStyle}
      data-motion={enhancedMotion ? 'enhanced' : 'static'}
      aria-hidden="true"
    >
      <div className="oga-depth-grid" />
      <div className="oga-depth-orbit oga-depth-orbit--one" />
      <div className="oga-depth-orbit oga-depth-orbit--two" />
      <div className="oga-depth-light" />

      <InterfaceWindow
        eyebrow={course ? 'Formation publiée' : 'Apprendre'}
        title={courseTitle}
        icon={<BookOpen className="h-5 w-5" />}
        className="oga-depth-layer oga-depth-layer--course"
      >
        {courseMeta.length > 0 ? (
          <div className="oga-interface-pills">
            {courseMeta.map(item => <span key={item}>{item}</span>)}
          </div>
        ) : (
          <p className="oga-interface-copy">Les formations publiées apparaissent ici.</p>
        )}
        <div className="oga-interface-progress" aria-hidden="true">
          <span /><span /><span />
        </div>
      </InterfaceWindow>

      <InterfaceWindow
        eyebrow="Pratiquer"
        title="Omnia Projects"
        icon={<FolderKanban className="h-5 w-5" />}
        className="oga-depth-layer oga-depth-layer--projects"
      >
        <InterfaceRows items={['Brief', 'Livrables', 'Validation']} />
      </InterfaceWindow>

      <InterfaceWindow
        eyebrow="Prouver"
        title="Preuves de compétences"
        icon={<BadgeCheck className="h-5 w-5" />}
        className="oga-depth-layer oga-depth-layer--credentials"
      >
        <div className="oga-proof-strip">
          <span><FileBadge2 className="h-4 w-4" />Certificat</span>
          <span><Award className="h-4 w-4" />Badge</span>
          <span><ShieldCheck className="h-4 w-4" />Skills Passport</span>
        </div>
      </InterfaceWindow>

      <InterfaceWindow
        eyebrow="Se développer"
        title="Profil professionnel"
        icon={<Briefcase className="h-5 w-5" />}
        className="oga-depth-layer oga-depth-layer--career"
      >
        <InterfaceRows items={['CV', 'Portfolio', 'Coaching']} />
      </InterfaceWindow>

      <InterfaceWindow
        eyebrow="Avancer"
        title="Opportunités"
        icon={<Network className="h-5 w-5" />}
        className="oga-depth-layer oga-depth-layer--opportunities"
      >
        <InterfaceRows items={['Omnia Talent', 'Offres', 'Recrutement']} />
      </InterfaceWindow>

      <div className="oga-depth-axis" />
      <div className="oga-depth-caption">
        <span>Un seul parcours</span>
        <strong>Formation → preuves → opportunités</strong>
      </div>
    </div>
  );
}

const JOURNEY_SCENES = [
  {
    eyebrow: 'Étape 01',
    title: 'Apprendre',
    icon: BookOpen,
    rows: ['Formations', 'Parcours', 'Évaluations', 'Omnia Live'],
  },
  {
    eyebrow: 'Étape 02',
    title: 'Pratiquer',
    icon: FolderKanban,
    rows: ['Projets', 'Missions', 'Livrables', 'Portfolio'],
  },
  {
    eyebrow: 'Étape 03',
    title: 'Prouver',
    icon: BadgeCheck,
    rows: ['Certificats', 'Badges', 'Learning Record', 'Skills Passport'],
  },
  {
    eyebrow: 'Étape 04',
    title: 'Se développer',
    icon: Target,
    rows: ['CV', 'Portfolio', 'Coaching', 'Préparation professionnelle'],
  },
  {
    eyebrow: 'Étape 05',
    title: 'Accéder aux opportunités',
    icon: Network,
    rows: ['Omnia Talent', 'Offres', 'Candidatures', 'Recrutement'],
  },
];

export function OmniaJourneyDepthStage({ activeIndex }: JourneyDepthStageProps) {
  return (
    <div className="oga-journey-depth-stage" aria-hidden="true">
      <div className="oga-journey-depth-stage__grid" />
      <div className="oga-journey-depth-stage__halo" />
      <div className="oga-journey-depth-stage__rail">
        {JOURNEY_SCENES.map((scene, index) => (
          <span key={scene.title} className={index === activeIndex ? 'is-active' : ''} />
        ))}
      </div>

      <div className="oga-journey-depth-stage__stack">
        {JOURNEY_SCENES.map((scene, index) => {
          const Icon = scene.icon;
          const difference = index - activeIndex;
          const distance = Math.abs(difference);
          const style: CSSProperties = {
            transform: `translate3d(${difference * 22}px, ${difference * 18}px, ${-distance * 145}px) rotateX(${difference * -2.5}deg) rotateY(${difference * 5.5}deg) scale(${Math.max(0.78, 1 - distance * 0.055)})`,
            opacity: distance > 2 ? 0.12 : Math.max(0.3, 1 - distance * 0.28),
            zIndex: 20 - distance,
          };

          return (
            <InterfaceWindow
              key={scene.title}
              eyebrow={scene.eyebrow}
              title={scene.title}
              icon={<Icon className="h-5 w-5" />}
              className={`oga-journey-scene ${index === activeIndex ? 'is-active' : ''}`}
              style={style}
            >
              <InterfaceRows items={scene.rows} />
              <div className="oga-journey-scene__footer">
                <span>Omnia Global Academy</span>
                <span>{String(index + 1).padStart(2, '0')} / 05</span>
              </div>
            </InterfaceWindow>
          );
        })}
      </div>

      <div className="oga-journey-depth-stage__label">
        <span>Le parcours Omnia</span>
        <strong>{JOURNEY_SCENES[activeIndex]?.title}</strong>
      </div>
    </div>
  );
}
