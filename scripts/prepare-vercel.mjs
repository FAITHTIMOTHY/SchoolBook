import { cp, copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const source = path.resolve('src/frontend');
const targets = [path.resolve('public'), path.resolve('dist')];

for (const target of targets) {
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });

  await cp(source, target, {
    recursive: true,
    filter: (entry) => {
      const relative = path.relative(source, entry);
      if (!relative) {
        return true;
      }

      const [first] = relative.split(path.sep);
      if (first === 'ts') {
        return false;
      }

      return !entry.endsWith('.map');
    },
  });

  // On static hosts like Vercel CDN, index.html is served automatically for "/".
  // SchoolBook's landing page (landing.html) must be served at "/",
  // while the school dashboard workspace (index.html) must be served at "/app".
  await copyFile(path.join(source, 'landing.html'), path.join(target, 'index.html'));
  await copyFile(path.join(source, 'index.html'), path.join(target, 'app.html'));

  console.log(`Copied static frontend assets to ${path.relative(process.cwd(), target)}`);
}
