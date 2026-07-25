/**
 * node:test + --experimental-strip-types：解析无后缀相对导入到 .ts
 * 生产/Next 仍用无后缀；勿在源码 import 里加回 .ts
 */
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

function tryFile(absPath) {
  try {
    if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
      return pathToFileURL(absPath).href;
    }
  } catch {
    /* ignore */
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
      return nextResolve(specifier, context);
    }
    if (path.extname(specifier)) {
      return nextResolve(specifier, context);
    }
    const parentDir = context.parentURL
      ? path.dirname(fileURLToPath(context.parentURL))
      : process.cwd();
    const base = path.resolve(parentDir, specifier);
    const url =
      tryFile(`${base}.ts`) ||
      tryFile(`${base}.tsx`) ||
      tryFile(path.join(base, 'index.ts')) ||
      tryFile(`${base}.js`);
    if (url) {
      return { shortCircuit: true, url };
    }
    return nextResolve(specifier, context);
  },
});
