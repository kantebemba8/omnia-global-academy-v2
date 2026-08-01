import { useRef, type CSSProperties, type ReactNode } from 'react';
import {
  Award,
  BadgeCheck,
  BookOpen,
  Briefcase,
  CalendarDays,
  Check,
  FileBadge2,
  FolderKanban,
  Monitor,
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

function InterfaceWindow({
  eyebrow,
  title,
  icon,
  children,
  className = '',
  style,
}: InterfaceWindowProps) {
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

function MiniInterfaceCard({
  title,
  icon,
  items,
  className = '',
}: {
  title: string;
  icon: ReactNode;
  items: string[];
  className?: string;
}) {
  return (
    <div className={`oga-depth-tile ${className}`}>
      <div className="oga-depth-tile__heading">
        <span className="oga-depth-tile__icon">{icon}</span>
        <strong>{title}</strong>
      </div>
      <div className="oga-depth-tile__items">
        {items.map(item => <span key={item}>{item}</span>)}
      </div>
    </div>
  );
}

const LEARNING_ROUTE = [
  { label: 'Apprendre', icon: BookOpen },
  { label: 'Pratiquer', icon: FolderKanban },
  { label: 'Prouver', icon: BadgeCheck },
  { label: 'Avancer', icon: Briefcase },
];

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
      className="oga-hero-depth-stage oga-premium-depth-stage"
      style={stageStyle}
      data-motion={enhancedMotion ? 'enhanced' : 'static'}
      aria-hidden="true"
    >
      <div className="oga-depth-grid" />
      <div className="oga-depth-aurora oga-depth-aurora--gold" />
      <div className="oga-depth-aurora oga-depth-aurora--blue" />
      <div className="oga-depth-orbit oga-depth-orbit--one" />
      <div className="oga-depth-orbit oga-depth-orbit--two" />
      <div className="oga-depth-orbit oga-depth-orbit--three" />

      <div className="oga-learning-route">
        {LEARNING_ROUTE.map((item, index) => {
          const Icon = item.icon;
          return (
            <span key={item.label} className={`oga-learning-route__node oga-learning-route__node--${index + 1}`}>
              <Icon className="h-3.5 w-3.5" />
              <small>{item.label}</small>
            </span>
          );
        })}
      </div>

      <InterfaceWindow
        eyebrow={course ? 'Formation publiée' : 'Apprendre'}
        title={courseTitle}
        icon={<BookOpen className="h-5 w-5" />}
        className="oga-depth-layer oga-depth-layer--course oga-academy-core"
      >
        {courseMeta.length > 0 ? (
          <div className="oga-interface-pills">
            {courseMeta.map(item => <span key={item}>{item}</span>)}
          </div>
        ) : (
          <p className="oga-interface-copy">Les formations publiées apparaissent ici.</p>
        )}

        <div className="oga-academy-progress">
          <div>
            <span>Progression</span>
            <strong>Parcours structuré</strong>
          </div>
          <span className="oga-academy-progress__ring"><i /></span>
        </div>

        <div className="oga-interface-progress" aria-hidden="true">
          <span /><span /><span />
        </div>

        <div className="oga-academy-core__footer">
          <span><Monitor className="h-3.5 w-3.5" />Sessions en direct</span>
          <span><ShieldCheck className="h-3.5 w-3.5" />Preuves vérifiables</span>
        </div>
      </InterfaceWindow>

      <MiniInterfaceCard
        title="Omnia Projects"
        icon={<FolderKanban className="h-5 w-5" />}
        items={['Briefs', 'Livrables', 'Validation']}
        className="oga-depth-layer oga-depth-layer--projects"
      />

      <MiniInterfaceCard
        title="Preuves vérifiées"
        icon={<BadgeCheck className="h-5 w-5" />}
        items={['Certificat', 'Badge', 'Skills Passport']}
        className="oga-depth-layer oga-depth-layer--credentials"
      />

      <MiniInterfaceCard
        title="Carrière et coaching"
        icon={<Target className="h-5 w-5" />}
        items={['CV', 'Portfolio', 'Coaching']}
        className="oga-depth-layer oga-depth-layer--career"
      />

      <MiniInterfaceCard
        title="Opportunités"
        icon={<Network className="h-5 w-5" />}
        items={['Talent', 'Offres', 'Recrutement']}
        className="oga-depth-layer oga-depth-layer--opportunities"
      />

      <div className="oga-depth-signal oga-depth-signal--live">
        <Monitor className="h-4 w-4" />
        <span><small>Omnia Live</small><strong>Apprendre ensemble</strong></span>
      </div>

      <div className="oga-depth-signal oga-depth-signal--verified">
        <ShieldCheck className="h-4 w-4" />
        <span><small>Vérifiable</small><strong>Compétence prouvée</strong></span>
      </div>

      <div className="oga-depth-signal oga-depth-signal--calendar">
        <CalendarDays className="h-4 w-4" />
        <span><small>Parcours</small><strong>Prochaine étape</strong></span>
      </div>

      <div className="oga-depth-axis" />
      <div className="oga-depth-caption">
        <span>Un seul écosystème</span>
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
  const normalizedIndex = Math.min(Math.max(activeIndex, 0), JOURNEY_SCENES.length - 1);
  const activeScene = JOURNEY_SCENES[normalizedIndex];

  return (
    <div className="oga-journey-depth-stage oga-premium-journey-stage" aria-hidden="true">
      <div className="oga-journey-depth-stage__grid" />
      <div className="oga-journey-depth-stage__halo" />

      <div className="oga-journey-path">
        {JOURNEY_SCENES.map((scene, index) => {
          const Icon = scene.icon;
          return (
            <span key={scene.title} className={index === normalizedIndex ? 'is-active' : ''}>
              <Icon className="h-3.5 w-3.5" />
              <small>{index + 1}</small>
            </span>
          );
        })}
      </div>

      <div className="oga-journey-depth-stage__stack">
        <div className="oga-journey-scene-backdrop oga-journey-scene-backdrop--two" />
        <div className="oga-journey-scene-backdrop oga-journey-scene-backdrop--one" />
        <InterfaceWindow
          eyebrow={activeScene.eyebrow}
          title={activeScene.title}
          icon={(() => { const ActiveIcon = activeScene.icon; return <ActiveIcon className="h-5 w-5" />; })()}
          className="oga-journey-scene is-active"
        >
          <InterfaceRows items={activeScene.rows} />
          <div className="oga-journey-scene__footer">
            <span>Omnia Global Academy</span>
            <span>{String(normalizedIndex + 1).padStart(2, '0')} / 05</span>
          </div>
        </InterfaceWindow>
      </div>

      <div className="oga-journey-depth-stage__label">
        <span>Le parcours Omnia</span>
        <strong>{activeScene.title}</strong>
      </div>

      <div className="oga-journey-metric">
        <span>{String(normalizedIndex + 1).padStart(2, '0')}</span>
        <small>étape active</small>
      </div>
    </div>
  );
}
