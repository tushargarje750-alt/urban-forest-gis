/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        'surface-2': token('surface-2'),
        ink: token('ink'),
        'ink-2': token('ink-2'),
        muted: token('muted'),
        line: token('line'),
        accent: token('accent'),
        'accent-ink': token('accent-ink'),
        'accent-soft': token('accent-soft'),
        good: token('good'),
        'good-ink': token('good-ink'),
        warn: token('warn'),
        bad: token('bad'),
        'bad-ink': token('bad-ink'),
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.04), 0 1px 1px rgb(0 0 0 / 0.02)',
        pop: '0 8px 24px rgb(0 0 0 / 0.12)',
      },
    },
  },
  plugins: [],
};
