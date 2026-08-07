import type { ElementType, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E2E8F0';

type SharedItemProps = {
  className?: string;
  to?: string;
  onClick?: () => void;
  children: ReactNode;
  ariaLabel?: string;
};

function SharedItem({ className = '', to, onClick, children, ariaLabel }: SharedItemProps) {
  const classes = `block h-full border-b border-slate-200 bg-white px-1 py-5 text-left transition hover:bg-slate-50/70 ${className}`;
  if (to) {
    return <Link to={to} className={classes} aria-label={ariaLabel}>{children}</Link>;
  }
  if (onClick) {
    return <button type="button" onClick={onClick} className={`w-full ${classes}`} aria-label={ariaLabel}>{children}</button>;
  }
  return <div className={classes}>{children}</div>;
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
    <SharedItem to={to} onClick={onClick} className={className} ariaLabel={label}>
      <div className="flex min-h-[82px] items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black leading-tight" style={{ color: BLUE }}>{value}</p>
          {detail && <p className="mt-1.5 text-xs leading-5 text-slate-500">{detail}</p>}
        </div>
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border border-slate-200 bg-white" style={{ color: accent }}>
          <Icon size={18} aria-hidden="true" />
        </span>
      </div>
    </SharedItem>
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
    <SharedItem to={to} onClick={onClick} ariaLabel={title}>
      <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-3">
        <Icon size={18} className="mt-0.5" style={{ color: accent }} aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="font-bold" style={{ color: BLUE }}>{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">{text}</p>
        </div>
        <span className="inline-flex items-center gap-1 whitespace-nowrap pt-0.5 text-sm font-semibold" style={{ color: GOLD }}>
          {cta} <ArrowRight size={15} aria-hidden="true" />
        </span>
      </div>
    </SharedItem>
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
    <section className={`border-y bg-white py-5 ${className}`} style={{ borderColor: BORDER }}>
      {children}
    </section>
  );
}
