import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';

/**
 * Garde-fou frontière client/serveur.
 *
 * Un composant `'use client'` ne doit JAMAIS importer (en direct) un module
 * `lib/` qui atteint `node:crypto` — sinon webpack essaie de bundler node:crypto
 * côté navigateur et TOUTES les pages concernées renvoient 500 (UnhandledScheme).
 * C'est exactement le bug qui avait cassé 16 routes (PartsManager -> parts-core
 * -> notifications-core -> email -> node:crypto).
 *
 * Les fichiers `'use server'` (server actions) sont une frontière sûre : Next les
 * remplace par une référence serveur, donc un client peut les importer librement.
 */

const APP_ROOT = join(dirname(new URL(import.meta.url).pathname), '..');
const LIB_DIR = join(APP_ROOT, 'lib');

function walk(dir: string, exts: string[]): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full, exts));
    else if (exts.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

function firstLines(content: string, n = 5): string {
  return content.split('\n', n).join('\n');
}

function isDirective(content: string, directive: string): boolean {
  // La directive doit être en tout début de fichier (après d'éventuels commentaires).
  return new RegExp(`^\\s*(//.*\\n|/\\*[\\s\\S]*?\\*/\\n|\\s)*['"]${directive}['"]`).test(content);
}

/** Résout un spécifieur d'import vers un chemin lib/ absolu, ou null si hors lib. */
function resolveLibImport(spec: string, fromFile: string): string | null {
  let base: string | null = null;
  if (spec.startsWith('@/lib/')) base = join(APP_ROOT, spec.slice(2));
  else if (spec.startsWith('./') || spec.startsWith('../')) {
    const candidate = join(dirname(fromFile), spec);
    if (candidate.startsWith(LIB_DIR)) base = candidate;
  }
  if (!base) return null;
  for (const ext of ['.ts', '.tsx', '/index.ts']) {
    if (existsSync(base + ext)) return base + ext;
  }
  if (existsSync(base) && statSync(base).isFile()) return base;
  return null;
}

function importSpecifiers(content: string): string[] {
  const specs: string[] = [];
  const re = /(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) specs.push(m[1]);
  return specs;
}

// --- graphe de poison : modules lib (hors 'use server') atteignant node:crypto ---
const libFiles = walk(LIB_DIR, ['.ts', '.tsx']);
const content = new Map<string, string>();
for (const f of libFiles) content.set(f, readFileSync(f, 'utf8'));

const poisonCache = new Map<string, boolean>();
function reachesCrypto(file: string, stack: Set<string> = new Set()): boolean {
  if (poisonCache.has(file)) return poisonCache.get(file)!;
  if (stack.has(file)) return false;
  stack.add(file);
  const src = content.get(file) ?? '';
  // Une server action est une frontière : Next ne bundle pas son contenu côté client.
  if (isDirective(src, 'use server')) {
    poisonCache.set(file, false);
    return false;
  }
  let poison = /from\s*['"]node:crypto['"]/.test(src) || /require\(['"]node:crypto['"]\)/.test(src);
  if (!poison) {
    for (const spec of importSpecifiers(src)) {
      const dep = resolveLibImport(spec, file);
      if (dep && reachesCrypto(dep, stack)) {
        poison = true;
        break;
      }
    }
  }
  stack.delete(file);
  poisonCache.set(file, poison);
  return poison;
}

test('aucun composant client n’importe une lib server-only atteignant node:crypto', () => {
  const clientFiles = [
    ...walk(join(APP_ROOT, 'components'), ['.tsx', '.ts']),
    ...walk(join(APP_ROOT, 'app'), ['.tsx', '.ts']),
  ].filter((f) => isDirective(readFileSync(f, 'utf8'), 'use client'));

  const violations: string[] = [];
  for (const file of clientFiles) {
    const src = readFileSync(file, 'utf8');
    for (const spec of importSpecifiers(src)) {
      const dep = resolveLibImport(spec, file);
      if (dep && reachesCrypto(dep)) {
        const rel = file.slice(APP_ROOT.length + 1);
        violations.push(`${rel}  ->  ${spec}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Composant(s) client important une lib server-only (node:crypto). ` +
      `Extraire le helper pur dans un module sans import serveur :\n  ${violations.join('\n  ')}`,
  );
});

test('le graphe de poison détecte bien la chaîne email/notifications (sanity)', () => {
  // Garantit que le test ci-dessus n'est pas vert par erreur (résolution cassée).
  const email = join(LIB_DIR, 'email.ts');
  const notif = join(LIB_DIR, 'notifications-core.ts');
  if (existsSync(email)) assert.equal(reachesCrypto(email), true, 'email.ts devrait être poison');
  if (existsSync(notif)) assert.equal(reachesCrypto(notif), true, 'notifications-core.ts devrait être poison');
});
