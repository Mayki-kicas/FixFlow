import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// BASE_DIR est lu à l'import du module → on fixe le dossier AVANT d'importer.
const dir = await mkdtemp(path.join(tmpdir(), 'storage-test-'));
process.env.STORAGE_LOCAL_DIR = dir;
const { putObject, getObject, deleteObject, buildAttachmentKey } = await import('../lib/storage');

test('storage: put / get / delete (aller-retour disque)', async () => {
  const key = buildAttachmentKey('abc-123');
  const data = Buffer.from('bonjour éàü — PJ test');

  await putObject(key, data);
  const read = await getObject(key);
  assert.ok(read, 'la lecture doit renvoyer un buffer');
  assert.equal(read.toString('utf8'), 'bonjour éàü — PJ test');

  await deleteObject(key);
  assert.equal(await getObject(key), null, 'après suppression, getObject renvoie null');
});

test('storage: getObject renvoie null pour une clé inexistante', async () => {
  assert.equal(await getObject(buildAttachmentKey('n-existe-pas')), null);
});

test('storage: une clé avec ../ reste contenue sous la base (pas de traversal)', async () => {
  const { access } = await import('node:fs/promises');
  const key = 'attachments/../../../etc/passwd-like';

  await putObject(key, Buffer.from('contained'));

  // Écriture contenue et relisible via la même clé.
  const back = await getObject(key);
  assert.ok(back);
  assert.equal(back.toString('utf8'), 'contained');

  // Aucun fichier écrit hors de la base de stockage.
  const outside = path.resolve(dir, '..', '..', '..', 'etc', 'passwd-like');
  await assert.rejects(() => access(outside), 'ne doit rien écrire hors de la base');
});

test.after(async () => {
  await rm(dir, { recursive: true, force: true });
});
