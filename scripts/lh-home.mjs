/**
 * 对本地生产首页跑 Lighthouse Performance（需先 npm run build && PORT=3010 npm start）
 * 用法: node scripts/lh-home.mjs [url] [label]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = process.argv[2] || 'http://127.0.0.1:3010/';
const label = process.argv[3] || 'run';
const outDir = path.join(root, 'tmp', 'lh');
mkdirSync(outDir, { recursive: true });

const chromePath = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find((p) => p && existsSync(p));

const lh = path.join(root, 'node_modules', 'lighthouse', 'cli', 'index.js');
const forms = [
  { name: 'mobile', args: ['--form-factor=mobile', '--screenEmulation.mobile=true'] },
  {
    name: 'desktop',
    args: [
      '--preset=desktop',
      '--form-factor=desktop',
      '--screenEmulation.mobile=false',
    ],
  },
];

for (const form of forms) {
  const outBase = path.join(outDir, `${label}-${form.name}`);
  const args = [
    lh,
    url,
    '--only-categories=performance',
    ...form.args,
    '--chrome-flags=--headless=new --no-sandbox --disable-gpu',
    '--output=json',
    '--output=html',
    `--output-path=${outBase}`,
    '--quiet',
  ];
  if (chromePath) args.splice(4, 0, `--chrome-path=${chromePath}`);
  console.log(`Lighthouse ${form.name} → ${outBase}.report.json`);
  const r = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: root });
  if (r.status !== 0) process.exit(r.status || 1);
  const report = JSON.parse(readFileSync(`${outBase}.report.json`, 'utf8'));
  const a = report.audits;
  console.log(
    JSON.stringify({
      form: form.name,
      score: Math.round((report.categories.performance.score || 0) * 100),
      FCP: a['first-contentful-paint']?.displayValue,
      LCP: a['largest-contentful-paint']?.displayValue,
      TBT: a['total-blocking-time']?.displayValue,
      CLS: a['cumulative-layout-shift']?.displayValue,
    }),
  );
}
