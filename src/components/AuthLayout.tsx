import React from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8 sm:py-12"
      style={{ backgroundColor: '#F8F9FA' }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-10"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}
      >
        {/* Logo */}
        <div className="text-center mb-6">
          <Link to="/accueil" aria-label="Retour à l’accueil">
            <img
              src="/IMG_0349.png"
              alt="Omnia"
              className="h-10 mx-auto object-contain"
            />
          </Link>
          <div
            className="font-bold mt-2"
            style={{ color: '#002050', fontSize: '16px', letterSpacing: '0.09em' }}
          >
            OMNIA
          </div>
          <div
            className="font-semibold"
            style={{ color: '#BF8813', fontSize: '9px', letterSpacing: '0.18em' }}
          >
            GLOBAL ACADEMY
          </div>
          <div
            className="mt-4 h-0.5 w-16 mx-auto rounded"
            style={{ backgroundColor: '#BF8813' }}
          />
        </div>

        {/* Title */}
        <h1
          className="text-center font-bold mb-1"
          style={{ color: '#002050', fontSize: '22px' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-center mb-6 text-sm" style={{ color: '#6B7280' }}>
            {subtitle}
          </p>
        )}

        {children}
      </div>
    </div>
  );
}
