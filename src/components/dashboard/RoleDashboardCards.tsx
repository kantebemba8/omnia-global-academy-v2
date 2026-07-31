import type { ElementType, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type SharedCardProps = {
  className?: string;
  to?: string;
  onClick?: () => void;
  children: ReactNode;
  ariaLabel?: string;
};

function SharedCard({ className = '', to, onClick, children, ariaLabel }: SharedCardProps) {
  const classes = `block h-full rounded-2xl border bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${className}`;
  const style = { borderColor: BORDER };

  if (to) {
    return <Link to={to} className={classes} style={style} aria-label={ariaLabel}>{children}</Link>;
  }

  if (onClick) {
    return <button type="button" onClick={onClick} className={`w-full ${classes}`} style={style} aria-label={ariaLabel}>{children}</button>;
  }

  return <div className={classes} style={style}>{children}</div>;
}

export function RoleDashboardStatCard({
  label,
  value,
  icon: Icon,
  accent = BLUE,
  detail,
  to,
  onClick,
  className,
}: {
  label: string;
  value: ReactNode;
  icon: ElementType;
  accent?: string;
  detail?: string;
  to?: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <SharedCard to={to} onClick={onClick} className={className} ariaLabel={label}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black leading-tight" style={{ color: BLUE }}>{value}</p>
          {detail && <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>}
        </div>
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${accent}14`, color: accent }}
        >
          <Icon size={21} aria-hidden="true" />
        </span>
      </div>
    </SharedCard>
  );
}

export function RoleDashboardActionCard({
  title,
  text,
  icon: Icon,
  to,
  accent = GOLD,
  cta = 'Ouvrir',
  onClick,
}: {
  title: string;
  text: string;
  icon: ElementType;
  to?: string;
  accent?: string;
  cta?: string;
  onClick?: () => void;
}) {
  return (
    <SharedCard to={to} onClick={onClick} ariaLabel={title}>
      <div className="flex items-start gap-4">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${accent}14`, color: accent }}
        >
          <Icon size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold" style={{ color: BLUE }}>{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">{text}</p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: GOLD }}>
            {cta} <ArrowRight size={15} aria-hidden="true" />
          </span>
        </div>
      </div>
    </SharedCard>
  );
}

export function RoleDashboardPanel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border bg-white p-5 shadow-sm ${className}`} style={{ borderColor: BORDER }}>
      {children}
    </section>
  );
}
