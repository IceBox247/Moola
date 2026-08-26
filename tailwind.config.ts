import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Moola brand — neon green cow
        moo: {
          50: '#eafff0',
          100: '#c8ffd8',
          200: '#8dffb0',
          300: '#4dfd84',
          400: '#22f05f',
          500: '#0fd94b', // primary neon green
          600: '#08b93c',
          700: '#0a9134',
          800: '#0d722d',
          900: '#0c4d21',
        },
        gold: {
          400: '#ffd54a',
          500: '#f5c518',
          600: '#d9a406',
        },
        ink: {
          900: '#04070c', // near-black background
          850: '#070c14',
          800: '#0a1119',
          700: '#0f1826',
          600: '#16233a',
          500: '#1f3350',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        neon: '0 0 20px rgba(15,217,75,0.45), 0 0 4px rgba(15,217,75,0.6)',
        'neon-lg': '0 0 40px rgba(15,217,75,0.5), 0 0 12px rgba(15,217,75,0.65)',
        gold: '0 0 22px rgba(245,197,24,0.4)',
        card: '0 8px 30px rgba(0,0,0,0.5)',
      },
      keyframes: {
        floaty: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        pulseGlow: {
          '0%,100%': { boxShadow: '0 0 18px rgba(15,217,75,0.35)' },
          '50%': { boxShadow: '0 0 42px rgba(15,217,75,0.75)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        spinSlow: {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        floaty: 'floaty 4s ease-in-out infinite',
        pulseGlow: 'pulseGlow 2.4s ease-in-out infinite',
        shimmer: 'shimmer 2s infinite',
        spinSlow: 'spinSlow 8s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
