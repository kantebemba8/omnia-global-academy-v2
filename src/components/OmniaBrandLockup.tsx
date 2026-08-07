import { Link } from 'react-router-dom';

export const OMNIA_OFFICIAL_SLOGAN = 'EMPOWER SKILLS. TRANSFORM AFRICA. IMPACT THE WORLD.';

type Props = {
  href?: string;
  inverse?: boolean;
  compact?: boolean;
  showSlogan?: boolean;
  className?: string;
};

export default function OmniaBrandLockup({
  href = '/home',
  inverse = false,
  compact = false,
  showSlogan = true,
  className = '',
}: Props) {
  const content = (
    <>
      <img
        src="/IMG_0349.png"
        alt=""
        className={`${compact ? 'h-9' : 'h-10'} w-auto shrink-0 object-contain`}
      />
      <span className="min-w-0 leading-none">
        <span
          className={`${compact ? 'text-[13px]' : 'text-[15px]'} block font-black tracking-[0.09em]`}
          style={{ color: inverse ? '#FFFFFF' : '#002050' }}
        >
          OMNIA
        </span>
        <span className="mt-1 block text-[8px] font-bold tracking-[0.18em]" style={{ color: '#BF8813' }}>
          GLOBAL ACADEMY
        </span>
        {showSlogan && (
          <span
            className={`${compact ? 'text-[7px]' : 'text-[8px]'} mt-1.5 block max-w-[255px] whitespace-normal font-semibold leading-[1.35] tracking-[0.055em]`}
            style={{ color: inverse ? 'rgba(255,255,255,.62)' : '#64748B' }}
          >
            {OMNIA_OFFICIAL_SLOGAN}
          </span>
        )}
      </span>
    </>
  );

  if (!href) {
    return <div className={`flex min-w-0 items-center gap-2.5 ${className}`}>{content}</div>;
  }

  return (
    <Link
      to={href}
      className={`flex min-w-0 items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813] ${className}`}
      aria-label="Accueil Omnia Global Academy"
    >
      {content}
    </Link>
  );
}
