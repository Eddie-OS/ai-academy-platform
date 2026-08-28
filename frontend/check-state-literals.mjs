import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const CSV = resolve(
  process.cwd(),
  '../backend/platform/statemachine/src/test/resources/statemachine/requirement-transitions.csv',
);
const ALLOWED = new Set([
  'src/shared/ui/StatusTag/StatusTag.tsx',
  'src/shared/metrics/cockpitMetrics.tsx',
]);
const ALLOWED_DIRS = ['src/fixtures'];

function stateValues() {
  const csv = readFileSync(CSV, 'utf8');
  const values = new Set();
  csv.split(/\r?\n/).slice(1).filter((l) => l.trim() !== '').forEach((line) => {
    const cells = line.split(',');
    [cells[3], cells[5]].forEach((cell) => {
      const state = (cell ?? '').trim();
      if (state.length >= 3 && !state.startsWith('（')) values.add(state);
    });
  });
  return [...values];
}

const stripComments = (code) =>
  code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const states = stateValues();
const violations = [];
sourceFiles(resolve(process.cwd(), 'src')).forEach((file) => {
  const key = relative(process.cwd(), file).replace(/\\/g, '/');
  if (ALLOWED.has(key)) return;
  if (ALLOWED_DIRS.some((d) => key.startsWith(`${d}/`))) return;
  const code = stripComments(readFileSync(file, 'utf8'));
  states.forEach((state) => {
    if (code.includes(state)) {
      const lineNo = code.split('\n').findIndex((l) => l.includes(state)) + 1;
      violations.push(`${key}:${lineNo} 出现状态值「${state}」`);
    }
  });
});

writeFileSync('state-literal-violations.txt', violations.join('\n') || '(none)', 'utf8');
console.log('violations:', violations.length);
