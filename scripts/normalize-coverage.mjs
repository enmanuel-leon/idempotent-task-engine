import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const packages = [
  { dir: 'apps/api', prefix: 'apps/api/' },
  { dir: 'apps/web', prefix: 'apps/web/' },
];

for (const pkg of packages) {
  const lcovPath = resolve(process.cwd(), pkg.dir, 'coverage/lcov.info');
  if (existsSync(lcovPath)) {
    const content = readFileSync(lcovPath, 'utf8');
    const updated = content.replaceAll('\nSF:src/', `\nSF:${pkg.prefix}src/`);
    let finalContent = updated;
    if (finalContent.startsWith('SF:src/')) {
      finalContent = `SF:${pkg.prefix}src/` + finalContent.slice(7);
    }
    writeFileSync(lcovPath, finalContent, 'utf8');
    console.log(`[coverage] Normalized LCOV report paths for ${pkg.dir}`);
  }
}
