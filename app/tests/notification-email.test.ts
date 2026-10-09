import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNotificationEmail } from '@/lib/notification-email';

test('buildNotificationEmail renvoie subject/text/html non vides', () => {
  const email = buildNotificationEmail({
    type: 'TICKET_CREATED',
    title: 'Nouveau ticket',
    message: 'Un incident a été déclaré.',
    ticketContext: { ticketNumber: 42, ticketTitle: 'Imprimante HS' },
  });
  assert.ok(email.subject.includes('[FixFlow]'));
  assert.ok(email.subject.includes('#42'));
  assert.ok(email.text.length > 0);
  assert.ok(email.html.includes('<'));
});

test('sujet préfixé par le libellé du type', () => {
  const status = buildNotificationEmail({
    type: 'STATUS_CHANGED',
    title: 'Changement',
    message: 'Statut mis à jour',
    statusContext: { previousStatus: 'Nouveau', nextStatus: 'En cours' },
  });
  assert.ok(status.subject.includes('Changement de statut'));
});

test('échappe le HTML dans le titre et le message (anti-XSS)', () => {
  const email = buildNotificationEmail({
    type: 'NEW_MESSAGE',
    title: '<script>alert(1)</script>',
    message: 'Fuite <img src=x onerror=alert(2)> "guillemets"',
    messageContent: '<b>brut</b>',
  });
  // Aucune balise injectée telle quelle dans le HTML.
  assert.ok(!email.html.includes('<script>'), 'le <script> doit être échappé');
  assert.ok(!email.html.includes('<img src=x'), 'le <img> doit être échappé');
  assert.ok(email.html.includes('&lt;script&gt;'), 'échappement attendu');
});
