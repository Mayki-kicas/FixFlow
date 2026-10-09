import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeCsvCell, buildCsv } from '@/lib/csv';

test('escapeCsvCell encadre et double les guillemets internes', () => {
  assert.equal(escapeCsvCell('simple'), '"simple"');
  assert.equal(escapeCsvCell('a "b" c'), '"a ""b"" c"');
  assert.equal(escapeCsvCell(''), '""');
  assert.equal(escapeCsvCell(null), '""');
  assert.equal(escapeCsvCell(42), '"42"');
});

test('escapeCsvCell neutralise l’injection de formule (= + - @ tab CR)', () => {
  assert.equal(escapeCsvCell('=1+2'), `"'=1+2"`);
  assert.equal(escapeCsvCell('+SUM(A1)'), `"'+SUM(A1)"`);
  assert.equal(escapeCsvCell('-2'), `"'-2"`);
  assert.equal(escapeCsvCell('@cmd'), `"'@cmd"`);
  assert.equal(escapeCsvCell('\tTAB'), `"'\tTAB"`);
  // une valeur normale contenant = plus loin n'est pas préfixée
  assert.equal(escapeCsvCell('a=b'), '"a=b"');
});

test('buildCsv assemble en-têtes + lignes avec CRLF', () => {
  const csv = buildCsv(['Nom', 'Note'], [['Alice', 'ok'], ['Bob "le" pro', '=danger']]);
  assert.equal(
    csv,
    '"Nom","Note"\r\n"Alice","ok"\r\n"Bob ""le"" pro","\'=danger"',
  );
});
