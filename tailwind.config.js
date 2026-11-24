import defaultTheme from 'tailwindcss/defaultTheme';

const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: token('paper'),
        surface: token('surface'),
        sunken: token('sunken'),
        ink: token('ink'),
        'ink-muted': token('ink-muted'),
        line: token('line'),
        'line-strong': token('line-strong'),
        primary: token('primary'),
        'primary-hover': token('primary-hover'),
        'on-primary': token('on-primary'),
        'module-inner': token('module-inner'),
        'module-edge': token('module-edge'),
        pusher: token('pusher'),
        'pusher-edge': token('pusher-edge'),
        alert: token('alert'),
        'alert-soft': token('alert-soft'),
        'info-soft': token('info-soft')
      },
      fontFamily: {
        sans: ['Barlow', ...defaultTheme.fontFamily.sans],
        display: ['"Barlow Semi Condensed"', 'Barlow', ...defaultTheme.fontFamily.sans]
      }
    }
  },
  plugins: []
};
