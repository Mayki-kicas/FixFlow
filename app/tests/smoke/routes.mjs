#!/usr/bin/env node
/**
 * Smoke test des routes (pages App Router).
 *
 * Authentifie une session via le dev-bypass NextAuth (DEV_AUTH_BYPASS=true,
 * NODE_ENV!=production), puis fait un GET sur chaque route et signale tout
 * statut >= 500 (route cassée). Les redirections (307/308) et 404 (donnée
 * absente) sont considérées OK — on traque les erreurs serveur.
 *
 * Usage :
 *   SMOKE_BASE_URL=http://localhost:3000 SMOKE_ROLE=ADMIN node tests/smoke/routes.mjs
 *   npm run smoke
 *
 * Prérequis : serveur en marche + dev-bypass actif (environnement de dev).
 */

const BASE = (process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const ROLE = process.env.SMOKE_ROLE || 'ADMIN';
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 15000);

// --- petit cookie jar -------------------------------------------------------
const jar = new Map();
function storeCookies(res) {
  for (const raw of res.headers.getSetCookie()) {
    const [pair] = raw.split(';');
    const eq = pair.indexOf('=');
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}
function cookieHeader() {
  return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function http(path, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      redirect: 'manual',
      ...init,
      headers: { cookie: cookieHeader(), ...(init.headers || {}) },
      signal: controller.signal,
    });
    storeCookies(res);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// --- authentification (dev bypass) ------------------------------------------
async function login() {
  const csrfRes = await http('/api/auth/csrf');
  const { csrfToken } = await csrfRes.json();
  const body = new URLSearchParams({
    csrfToken,
    devRole: ROLE,
    username: '',
    password: '',
    callbackUrl: BASE,
    json: 'true',
  });
  await http('/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const sess = await http('/api/auth/session');
  const data = await sess.json().catch(() => null);
  if (!data || !data.user) {
    throw new Error(
      `Connexion échouée (role=${ROLE}). Dev-bypass actif ? session=${JSON.stringify(data)}`,
    );
  }
  return data.user;
}

// --- routes statiques (ADMIN voit tout) -------------------------------------
const STATIC_ROUTES = [
  '/auth/signin',
  '/auth/pending',
  '/',
  '/tickets',
  '/tickets/new',
  '/tickets/search',
  '/tickets/preferences',
  '/demandes',
  '/demandes/mine',
  '/demandes/new',
  '/plans',
  '/backoffice',
  '/backoffice/analytique',
  '/backoffice/auth',
  '/backoffice/email',
  '/backoffice/categories',
  '/backoffice/codes-defaut',
  '/backoffice/equipments',
  '/backoffice/equipments/new',
  '/backoffice/exports',
  '/backoffice/fiabilite',
  '/backoffice/groups',
  '/backoffice/incident-reports',
  '/backoffice/incident-reports/new',
  '/backoffice/locations',
  '/backoffice/locations/new',
  '/backoffice/maintainers',
  '/backoffice/pieces',
  '/backoffice/planning',
  '/backoffice/preventif',
  '/backoffice/settings',
  '/backoffice/teams',
  '/backoffice/teams/new',
  '/backoffice/techniciens',
  '/backoffice/users',
];

// --- découverte d'un ID concret sur une page liste --------------------------
async function allMatches(seedPath, regex, reject = []) {
  const res = await http(seedPath);
  if (res.status >= 500) return [];
  const html = await res.text();
  const out = [];
  for (const m of html.matchAll(regex)) {
    const val = m[1];
    if (val && !reject.includes(val) && !out.includes(val)) out.push(val);
  }
  return out;
}

async function firstMatch(seedPath, regex, reject = []) {
  return (await allMatches(seedPath, regex, reject))[0] || null;
}

async function resolveDynamicRoutes() {
  const routes = [];
  const note = [];

  // Équipes : on les collecte toutes depuis /tickets, puis on balaie chaque
  // kanban jusqu'à trouver un ticket (certaines équipes peuvent être vides).
  const teamIds = await allMatches('/tickets', /href="\/tickets\/team\/([^"?]+)"/g);
  if (teamIds.length) {
    routes.push(`/tickets/team/${teamIds[0]}`);
    let ticketId = process.env.SMOKE_TICKET_ID || null;
    for (const tid of teamIds) {
      if (ticketId) break;
      ticketId = await firstMatch(
        `/tickets/team/${tid}`,
        /href="\/tickets\/([^"/?]+)"/g,
        ['new', 'search', 'preferences'],
      );
    }
    if (ticketId) {
      routes.push(`/tickets/${ticketId}`);
      routes.push(`/tickets/${ticketId}/edit`);
    } else note.push('aucun ticket pour tester /tickets/[id] (SMOKE_TICKET_ID pour forcer)');
  } else note.push('aucune équipe pour tester /tickets/team/[teamId]');

  if (process.env.SMOKE_REFCODE) routes.push(`/equipements/${process.env.SMOKE_REFCODE}`);
  if (process.env.SMOKE_DEMANDE_ID) routes.push(`/demandes/${process.env.SMOKE_DEMANDE_ID}`);

  const pairs = [
    ['/demandes', /href="\/demandes\/([^"/?]+)"/g, ['mine', 'new'], (id) => `/demandes/${id}`],
    ['/backoffice/equipments', /href="\/backoffice\/equipments\/([^"/?]+)"/g, ['new'], (id) => `/backoffice/equipments/${id}`],
    ['/backoffice/teams', /href="\/backoffice\/teams\/([^"/?]+)"/g, ['new'], (id) => `/backoffice/teams/${id}`],
    ['/backoffice/locations', /href="\/backoffice\/locations\/([^"/?]+)"/g, ['new'], (id) => `/backoffice/locations/${id}`],
    ['/backoffice/maintainers', /href="\/backoffice\/maintainers\/([^"/?]+)"/g, ['new'], (id) => `/backoffice/maintainers/${id}`],
    ['/backoffice/groups', /href="\/backoffice\/groups\/([^"/?]+)"/g, ['new'], (id) => `/backoffice/groups/${id}`],
    ['/backoffice/incident-reports', /href="\/backoffice\/incident-reports\/([^"/?]+)"/g, ['new'], (id) => `/backoffice/incident-reports/${id}`],
    ['/plans', /href="\/plans\/([^"/?]+)"/g, [], (id) => `/plans/${id}`],
  ];
  for (const [seed, rx, reject, build] of pairs) {
    const id = await firstMatch(seed, rx, reject);
    if (id) routes.push(build(id));
    else note.push(`aucun ID trouvé via ${seed} pour ${build('[id]')}`);
  }

  return { routes, note };
}

// --- exécution --------------------------------------------------------------
function classify(status) {
  if (status >= 500) return 'FAIL';
  return 'OK';
}

async function run() {
  console.log(`\n🔎 Smoke routes — ${BASE} (role ${ROLE})\n`);
  let user;
  try {
    user = await login();
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(2);
  }
  console.log(`✓ Session : ${user.name} <${user.email}> [${user.role}]\n`);

  const { routes: dynamicRoutes, note } = await resolveDynamicRoutes();
  const all = [...STATIC_ROUTES, ...dynamicRoutes];

  const results = [];
  for (const path of all) {
    try {
      const res = await http(path);
      results.push({ path, status: res.status, verdict: classify(res.status) });
    } catch (err) {
      results.push({ path, status: 0, verdict: 'FAIL', error: err.message });
    }
  }

  const pad = Math.max(...results.map((r) => r.path.length));
  for (const r of results) {
    const icon = r.verdict === 'OK' ? '✓' : '✗';
    const extra = r.error ? `  (${r.error})` : '';
    console.log(`  ${icon} ${r.path.padEnd(pad)}  ${r.status || '—'}  ${r.verdict}${extra}`);
  }

  if (note.length) {
    console.log('\nℹ️  Routes dynamiques non couvertes (pas de donnée) :');
    for (const n of note) console.log(`   - ${n}`);
  }

  const failures = results.filter((r) => r.verdict === 'FAIL');
  console.log(
    `\n${failures.length ? '❌' : '✅'} ${results.length - failures.length}/${results.length} OK` +
      (failures.length ? ` — ${failures.length} en échec` : '') +
      '\n',
  );
  process.exit(failures.length ? 1 : 0);
}

run();
