import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#d6e4f0',
          500: '#2e75b6',
          600: '#1e5a96',
          900: '#1e3a5f',
        },
      },
      fontFamily: {
        sans: ['Heebo', 'Arial', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
