import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const source = path.resolve('src/frontend');
const target = path.resolve('public');

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

console.log(`Copied static frontend assets to ${path.relative(process.cwd(), target)}`);
