import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.mjs', '.cjs'];

function tryResolve(candidateBase) {
  for (const ext of EXTENSIONS) {
    const full = candidateBase + ext;
    if (existsSync(full) && statSync(full).isFile()) return pathToFileURL(full).href;
  }
  const idx = path.join(candidateBase, 'index.ts');
  if (existsSync(idx) && statSync(idx).isFile()) return pathToFileURL(idx).href;
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const url = tryResolve(path.join(ROOT, specifier.slice(2)));
      if (url) return { url, shortCircuit: true };
      return nextResolve(specifier, context);
    }
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      const parent = path.dirname(fileURLToPath(context.parentURL));
      const base = path.resolve(parent, specifier);
      if (!path.extname(base) && !existsSync(base)) {
        const url = tryResolve(base);
        if (url) return { url, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});
