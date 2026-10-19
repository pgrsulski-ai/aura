/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        neon: {
          DEFAULT: '#00FFA3',
          50: '#ccffe6',
          100: '#b3ffd9',
          200: '#80ffbf',
          300: '#4dffaa',
          400: '#1aff94',
          500: '#00FFA3',
          600: '#00cc82',
          700: '#009966',
          800: '#006649',
          900: '#00332c',
        },
      },
      fontFamily: {
        display: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        pop: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '60%': { transform: 'scale(1.05)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
        'heart-burst': {
          '0%': { transform: 'scale(0) rotate(-10deg)', opacity: '0' },
          '15%': { transform: 'scale(1.2) rotate(5deg)', opacity: '0.9' },
          '30%': { transform: 'scale(0.95) rotate(-3deg)', opacity: '1' },
          '45%': { transform: 'scale(1.1) rotate(2deg)', opacity: '1' },
          '70%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'scale(1.4) rotate(0deg)', opacity: '0' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        pop: 'pop 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'heart-burst': 'heart-burst 0.8s ease-out forwards',
        'spin-slow': 'spin-slow 8s linear infinite',
      },
    },
  },
  plugins: [],
};
