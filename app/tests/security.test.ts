import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAttachmentMeta,
  sanitizeFileName,
  hasAllowedBinarySignature,
} from '@/lib/security';

test('validateAttachmentMeta accepte images matricielles courantes + PDF', () => {
  for (const mimeType of [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/avif',
  ]) {
    assert.doesNotThrow(
      () => validateAttachmentMeta({ size: 1024, mimeType, context: 'ticket' }),
      `${mimeType} devrait être accepté`,
    );
  }
});

test('validateAttachmentMeta rejette SVG (XSS) et binaire inconnu', () => {
  assert.throws(() => validateAttachmentMeta({ size: 1024, mimeType: 'image/svg+xml', context: 'ticket' }));
  assert.throws(() => validateAttachmentMeta({ size: 1024, mimeType: 'application/octet-stream', context: 'chat' }));
});

test('validateAttachmentMeta rejette fichier vide ou trop volumineux', () => {
  assert.throws(() => validateAttachmentMeta({ size: 0, mimeType: 'image/png', context: 'ticket' }));
  assert.throws(() => validateAttachmentMeta({ size: 999_999_999, mimeType: 'image/png', context: 'ticket' }));
});

test('hasAllowedBinarySignature accepte les vraies signatures image/PDF', () => {
  const pad = (arr: number[]) => Buffer.concat([Buffer.from(arr), Buffer.alloc(12)]);
  assert.equal(hasAllowedBinarySignature(pad([0xff, 0xd8, 0xff])), true); // JPEG
  assert.equal(hasAllowedBinarySignature(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true); // PNG
  assert.equal(hasAllowedBinarySignature(Buffer.from('%PDF-1.7\n....')), true); // PDF
  assert.equal(hasAllowedBinarySignature(Buffer.from('GIF89a......')), true); // GIF
});

test('hasAllowedBinarySignature rejette un fichier déguisé (HTML/texte)', () => {
  assert.equal(hasAllowedBinarySignature(Buffer.from('<html><script>alert(1)</script>')), false);
  assert.equal(hasAllowedBinarySignature(Buffer.from('juste du texte brut ici')), false);
  assert.equal(hasAllowedBinarySignature(Buffer.from('<svg xmlns="..."></svg>')), false);
});

test('sanitizeFileName neutralise CR/LF/guillemets et gère le vide', () => {
  assert.equal(sanitizeFileName('a\r\nb"c'), 'a__b_c');
  assert.equal(sanitizeFileName('   '), 'attachment');
  assert.equal(sanitizeFileName('rapport.pdf'), 'rapport.pdf');
});
