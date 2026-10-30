// Bundles each src/**/*.test.ts with esbuild (already installed via Vite) and runs
// it with Node's built-in test runner, so tests need no extra dependencies.
import { build } from 'esbuild';
import { readdirSync, statSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(root, 'node_modules', '.cache', 'unit-tests');

const findTests = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  if (statSync(path).isDirectory()) return findTests(path);
  return name.endsWith('.test.ts') ? [path] : [];
});

const entries = findTests(join(root, 'src'));
if (!entries.length) {
  console.log('No test files found.');
  process.exit(0);
}

rmSync(outDir, { recursive: true, force: true });
await build({
  entryPoints: entries,
  outdir: outDir,
  outbase: join(root, 'src'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});

const files = entries.map((entry) =>
  join(outDir, relative(join(root, 'src'), entry)).replace(/\.ts$/, '.mjs'));
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
