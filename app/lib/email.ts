import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
};

export type EmailAttachment = {
  filename: string;
  contentType: string;
  filePath?: string;
  content?: Buffer;
};

type SmtpConfig = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  from: string;
  timeoutMs: number;
  ehloName: string;
};

function getSmtpConfig(): SmtpConfig {
  return {
    enabled: process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true',
    host: process.env.SMTP_HOST || 'mailpit',
    port: Number(process.env.SMTP_PORT || 1025),
    secure: process.env.SMTP_SECURE === 'true',
    from: process.env.SMTP_FROM || "FixFlow <noreply@fixflow.local>",
    timeoutMs: Number(process.env.SMTP_TIMEOUT_MS || 10000),
    ehloName: process.env.SMTP_EHLO_NAME || 'localhost',
  };
}

// Empêche l'injection d'en-têtes SMTP/MIME (CRLF) via une valeur interpolée
// dans un en-tête (To, Subject, nom de fichier de pièce jointe, RCPT TO...).
function sanitizeHeaderValue(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function normalizeBody(body: string) {
  return body.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
}

function normalizeHtml(html: string) {
  return html.replace(/\r?\n/g, '\r\n');
}

function chunkBase64(value: string) {
  return value.replace(/(.{76})/g, '$1\r\n');
}

function socketWrite(socket: net.Socket | tls.TLSSocket, payload: string) {
  return new Promise<void>((resolve, reject) => {
    socket.write(payload, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function readSmtpResponse(
  socket: net.Socket | tls.TLSSocket,
  timeoutMs: number
) {
  return new Promise<{ code: number; text: string }>((resolve, reject) => {
    let buffer = '';

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('SMTP timeout'));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off('data', onData);
      socket.off('error', onError);
      socket.off('end', onEnd);
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onEnd = () => {
      cleanup();
      reject(new Error('SMTP connection ended unexpectedly'));
    };

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      if (lines.length === 0) return;

      const last = lines[lines.length - 1];
      const match = /^(\d{3})([ -])/.exec(last);
      if (!match) return;
      if (match[2] !== ' ') return;

      cleanup();
      resolve({
        code: Number(match[1]),
        text: lines.join('\n'),
      });
    };

    socket.on('data', onData);
    socket.once('error', onError);
    socket.once('end', onEnd);
  });
}

async function sendCommand(
  socket: net.Socket | tls.TLSSocket,
  timeoutMs: number,
  command: string,
  expectedCodes: number[]
) {
  await socketWrite(socket, `${command}\r\n`);
  const response = await readSmtpResponse(socket, timeoutMs);
  if (!expectedCodes.includes(response.code)) {
    throw new Error(`SMTP command failed (${command}): ${response.text}`);
  }
}

async function createMessage(input: SendEmailInput, from: string) {
  const date = new Date().toUTCString();
  const messageId = `<${crypto.randomUUID()}@fixflow.local>`;
  const to = sanitizeHeaderValue(input.to);
  const subject = sanitizeHeaderValue(input.subject);
  const body = normalizeBody(input.text);
  const html = input.html ? normalizeHtml(input.html) : null;
  const attachments = input.attachments || [];

  if (attachments.length === 0 && !html) {
    return [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Date: ${date}`,
      `Message-ID: ${messageId}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      body,
      '',
    ].join('\r\n');
  }

  if (attachments.length === 0 && html) {
    const altBoundary = `----=_Alt_${crypto.randomUUID()}`;
    return [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Date: ${date}`,
      `Message-ID: ${messageId}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      '',
      `--${altBoundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      body,
      '',
      `--${altBoundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      html,
      '',
      `--${altBoundary}--`,
      '',
    ].join('\r\n');
  }

  const boundary = `----=_Mixed_${crypto.randomUUID()}`;
  const parts: string[] = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Date: ${date}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
  ];

  if (html) {
    const altBoundary = `----=_Alt_${crypto.randomUUID()}`;
    parts.push(`--${boundary}`);
    parts.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    parts.push('');
    parts.push(`--${altBoundary}`);
    parts.push('Content-Type: text/plain; charset=UTF-8');
    parts.push('Content-Transfer-Encoding: 8bit');
    parts.push('');
    parts.push(body);
    parts.push('');
    parts.push(`--${altBoundary}`);
    parts.push('Content-Type: text/html; charset=UTF-8');
    parts.push('Content-Transfer-Encoding: 8bit');
    parts.push('');
    parts.push(html);
    parts.push('');
    parts.push(`--${altBoundary}--`);
    parts.push('');
  } else {
    parts.push(`--${boundary}`);
    parts.push('Content-Type: text/plain; charset=UTF-8');
    parts.push('Content-Transfer-Encoding: 8bit');
    parts.push('');
    parts.push(body);
    parts.push('');
  }

  for (const attachment of attachments) {
    let content: Buffer;
    if (attachment.content) {
      content = attachment.content;
    } else if (attachment.filePath) {
      content = await readFile(attachment.filePath);
    } else {
      continue;
    }
    const encoded = chunkBase64(content.toString('base64'));
    const safeFilename = sanitizeHeaderValue(attachment.filename).replace(/"/g, '\\"');
    parts.push(`--${boundary}`);
    parts.push(`Content-Type: ${attachment.contentType}; name="${safeFilename}"`);
    parts.push('Content-Transfer-Encoding: base64');
    parts.push(`Content-Disposition: attachment; filename="${safeFilename}"`);
    parts.push('');
    parts.push(encoded);
    parts.push('');
  }

  parts.push(`--${boundary}--`);
  parts.push('');

  return parts.join('\r\n');
}

export async function sendEmail(input: SendEmailInput) {
  const config = getSmtpConfig();
  if (!config.enabled) {
    return { skipped: true as const };
  }

  const socket = config.secure
    ? tls.connect({ host: config.host, port: config.port })
    : net.createConnection({ host: config.host, port: config.port });

  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('error', (error) => reject(error));
  });

  try {
    const banner = await readSmtpResponse(socket, config.timeoutMs);
    if (banner.code !== 220) {
      throw new Error(`SMTP banner error: ${banner.text}`);
    }

    await sendCommand(socket, config.timeoutMs, `EHLO ${config.ehloName}`, [250]);
    await sendCommand(socket, config.timeoutMs, `MAIL FROM:<${config.from.match(/<(.+)>/)?.[1] || config.from}>`, [250]);
    await sendCommand(socket, config.timeoutMs, `RCPT TO:<${sanitizeHeaderValue(input.to)}>`, [250, 251]);
    await sendCommand(socket, config.timeoutMs, 'DATA', [354]);
    const rawMessage = await createMessage(input, config.from);
    await socketWrite(socket, `${rawMessage}\r\n.\r\n`);
    const queued = await readSmtpResponse(socket, config.timeoutMs);
    if (queued.code !== 250) {
      throw new Error(`SMTP DATA failed: ${queued.text}`);
    }
    await sendCommand(socket, config.timeoutMs, 'QUIT', [221]);
  } finally {
    socket.destroy();
  }

  return { skipped: false as const };
}
