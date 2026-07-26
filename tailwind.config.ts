import type { Config } from 'tailwindcss';
import { Z_INDEX, Z_INDEX_LAYERS } from './lib/ui/zIndex';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // 与 app/globals.css :root --color-* / lib/ui/brandColors.ts 同源
        ink: {
          DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
          hover: 'rgb(var(--color-ink-hover) / <alpha-value>)',
        },
        paper: 'rgb(var(--color-paper) / <alpha-value>)',
        mint: 'rgb(var(--color-mint) / <alpha-value>)',
        coral: {
          DEFAULT: 'rgb(var(--color-coral) / <alpha-value>)',
          deep: 'rgb(var(--color-coral-deep) / <alpha-value>)',
          hover: 'rgb(var(--color-coral-hover) / <alpha-value>)',
          ink: 'rgb(var(--color-coral-ink) / <alpha-value>)',
        },
      },
      boxShadow: {
        panel: '0 18px 50px rgb(var(--color-ink) / 0.08)',
      },
      // 与 lib/ui/zIndex.ts 同源；改数值请先改该文件（Tailwind theme 要求 string）
      zIndex: {
        ...Object.fromEntries(Z_INDEX_LAYERS.map((k) => [k, String(Z_INDEX[k])])),
      },
    },
  },
  plugins: [],
};

export default config;
