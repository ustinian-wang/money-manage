import type { Config } from 'tailwindcss';
import { Z_INDEX, Z_INDEX_LAYERS } from './lib/ui/zIndex';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17212b',
        paper: '#f6f8f5',
        mint: '#d8f3e4',
        coral: '#f07f62',
      },
      boxShadow: {
        panel: '0 18px 50px rgba(23, 33, 43, 0.08)',
      },
      // 与 lib/ui/zIndex.ts 同源；改数值请先改该文件
      zIndex: {
        ...Object.fromEntries(Z_INDEX_LAYERS.map((k) => [k, Z_INDEX[k]])),
      },
    },
  },
  plugins: [],
};

export default config;
