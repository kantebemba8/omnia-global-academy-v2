import React from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  variant?: 'compact' | 'wide';
}

export function AuthLayout({ children, title, subtitle, variant = 'compact' }: AuthLayoutProps) {
  const isWide = variant === 'wide';

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#F5F7FB] px-3 py-5 sm:px-6 sm:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 10% 8%, rgba(191,136,19,0.12), transparent 24%), radial-gradient(circle at 90% 88%, rgba(0,32,80,0.12), transparent 30%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-16 h-64 w-64 rounded-full border border-[#BF8813]/10 sm:h-80 sm:w-80"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 bottom-4 h-80 w-80 rounded-full border border-[#002050]/10 sm:h-96 sm:w-96"
      />

      <main className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] w-full items-center justify-center sm:min-h-[calc(100vh-5rem)]">
        <div className={`w-full ${isWide ? 'max-w-4xl' : 'max-w-lg'}`}>
          <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-[0_24px_70px_rgba(0,32,80,0.12)] backdrop-blur sm:rounded-[28px]">
            <div className="h-1.5 bg-gradient-to-r from-[#002050] via-[#BF8813] to-[#002050]" />

            <div className={`${isWide ? 'p-5 sm:p-8 lg:p-10' : 'p-5 sm:p-8'} `}>
              <header className="mx-auto mb-6 max-w-2xl text-center sm:mb-7">
                <Link
                  to="/accueil"
                  aria-label="Retour à l’accueil"
                  className="inline-flex flex-col items-center rounded-xl px-2 py-1 transition-opacity hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-[#BF8813]/35"
                >
                  <img
                    src="/IMG_0349.png"
                    alt="Omnia Global Academy"
                    className="h-10 object-contain sm:h-11"
                  />
                  <span
                    className="mt-2 font-bold"
                    style={{ color: '#002050', fontSize: '15px', letterSpacing: '0.11em' }}
                  >
                    OMNIA
                  </span>
                  <span
                    className="font-semibold"
                    style={{ color: '#BF8813', fontSize: '9px', letterSpacing: '0.19em' }}
                  >
                    GLOBAL ACADEMY
                  </span>
                </Link>

                <div className="mx-auto mt-4 h-0.5 w-14 rounded-full bg-[#BF8813]" />

                <h1 className="mt-5 text-2xl font-bold tracking-tight text-[#002050] sm:text-[28px]">
                  {title}
                </h1>
                {subtitle && (
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-500 sm:text-[15px]">
                    {subtitle}
                  </p>
                )}
              </header>

              <div className="mx-auto w-full">{children}</div>
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] font-medium tracking-wide text-gray-400 sm:text-xs">
            OMNIA GLOBAL ACADEMY · ESPACE SÉCURISÉ
          </p>
        </div>
      </main>
    </div>
  );
}
