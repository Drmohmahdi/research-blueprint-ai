import { readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve('.');
const dirs = [root, join(root, 'backend')];
const patterns = [/^test_.*\.db$/, /^test_.*\.log$/];

let removed = 0;

for (const dir of dirs) {
  for (const entry of readdirSync(dir)) {
    if (!patterns.some((pattern) => pattern.test(entry))) {
      continue;
    }

    const target = join(dir, entry);
    if (statSync(target).isFile()) {
      rmSync(target, { force: true });
      removed += 1;
    }
  }
}

console.log(`Removed ${removed} generated test artifact(s).`);
