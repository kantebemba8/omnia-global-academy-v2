/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#002050',
        accent: '#BF8813',
        'bg-light': '#F8F9FA',
        'bg-dark': '#002050',
        'text-main': '#111827',
        'text-muted': '#6B7280',
        'bg-white': '#FFFFFF',
        border: '#E4E7EC',
        success: '#1E7A52',
        error: '#DC2626',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
};
