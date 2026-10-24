import express from 'express';
import path from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT) || 3000;
const PHOTO_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp']
]);
const shareAttempts = new Map();

function loadLocalEnv() {
  try {
    const source = readFileSync(path.join(here, '.env'), 'utf8');
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || Object.hasOwn(process.env, match[1])) continue;
      const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
      process.env[match[1]] = value;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
loadLocalEnv();

app.disable('x-powered-by');
app.use(express.json({ limit: '6mb' }));

function supabaseSettings() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_PHOTO_BUCKET || 'report-photos';
  if (!url || !key) return null;
  return { url, key, bucket };
}

async function supabaseFetch(pathname, options = {}) {
  const settings = supabaseSettings();
  if (!settings) throw Object.assign(new Error('Supabase is not configured on the server.'), { status: 503 });
  const response = await fetch(`${settings.url}${pathname}`, {
    ...options,
    headers: {
      apikey: settings.key,
      authorization: `Bearer ${settings.key}`,
      ...(options.body && !(options.body instanceof Buffer) ? { 'content-type': 'application/json' } : {}),
      ...options.headers
    }
  });
  if (!response.ok) {
    const details = await response.text();
    let summary = `HTTP ${response.status}`;
    try {
      const payload = JSON.parse(details);
      const code = typeof payload.code === 'string' ? payload.code : '';
      const message = typeof payload.message === 'string'
        ? payload.message
        : typeof payload.error_description === 'string'
          ? payload.error_description
          : typeof payload.error === 'string'
            ? payload.error
            : '';
      if (message) summary = `${code ? `${code}: ` : ''}${message.replace(/[\r\n]+/g, ' ').slice(0, 240)}`;
    } catch {}
    console.error('Supabase request failed:', response.status, summary);
    throw Object.assign(new Error(`Supabase request failed (${summary}).`), { status: 502 });
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function limitShareRequests(request, response, next) {
  const now = Date.now();
  const key = request.ip || request.socket.remoteAddress || 'unknown';
  const existing = shareAttempts.get(key);
  if (!existing || now - existing.startedAt > 60_000) {
    shareAttempts.set(key, { startedAt: now, count: 1 });
    return next();
  }
  existing.count += 1;
  if (existing.count > 10) return response.status(429).json({ error: 'Too many report-link requests. Please wait a minute and try again.' });
  return next();
}

function digestToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function authorizationToken(request) {
  const match = request.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{40,})$/);
  return match?.[1] || '';
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function imageBytesMatchType(buffer, mimeType) {
  if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === 'image/webp') return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

function apiReport(row) {
  return {
    id: row.id,
    created_at: row.createdAt,
    updated_at: new Date().toISOString(),
    status: row.status,
    description: row.description,
    latitude: row.latitude,
    longitude: row.longitude,
    location_name: row.locationName,
    location_captured_at: row.locationCapturedAt,
    photo_path: row.photoPath,
    photo_mime_type: row.photoMimeType,
    utility_id: row.utilityId,
    recipient_email: row.recipientEmail,
    utility_snapshot: row.utilitySnapshot,
    linked_to_report_id: row.linkedToReportId,
    email_draft_opened_at: row.emailDraftOpenedAt,
    handoff_method: row.handoffMethod,
    submitted_at: row.submittedAt,
    last_checked_at: row.lastCheckedAt,
    fixed_at: row.fixedAt,
    resolution_note: row.resolutionNote,
    share_token_hash: row.shareTokenHash,
    share_expires_at: row.shareExpiresAt,
    shared_at: row.sharedAt
  };
}

function shareUrl(request, token) {
  const configured = process.env.PUBLIC_APP_URL?.trim() || process.env.RENDER_EXTERNAL_URL?.trim();
  if (configured) {
    const target = new URL(configured);
    if (target.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(target.hostname)) {
      throw Object.assign(new Error('PUBLIC_APP_URL must use HTTPS for a hosted app.'), { status: 503 });
    }
    target.hash = `share=${encodeURIComponent(token)}`;
    return target.toString();
  }
  const host = request.get('host') || '';
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) {
    throw Object.assign(new Error('Set PUBLIC_APP_URL to the public HTTPS address of the hosted app.'), { status: 503 });
  }
  return `${request.protocol}://${host}/#share=${encodeURIComponent(token)}`;
}

app.post('/api/reports/share', limitShareRequests, async (request, response) => {
  const input = request.body;
  const settings = supabaseSettings();
  if (!settings) return response.status(503).json({ error: 'Cloud report links are not configured yet. Add the Supabase server settings and restart the app.' });
  if (!input || !isUuid(input.id) || typeof input.description !== 'string' || !input.description.trim() || input.description.length > 600) {
    return response.status(400).json({ error: 'The report needs a valid ID and a description of 1–600 characters.' });
  }
  if (!['pending', 'submitted', 'fixed'].includes(input.status)) return response.status(400).json({ error: 'The report status is invalid.' });
  if (!PHOTO_TYPES.has(input.photoMimeType) || typeof input.photoBase64 !== 'string') return response.status(400).json({ error: 'A JPEG, PNG, or WebP photo is required.' });
  const photo = Buffer.from(input.photoBase64, 'base64');
  if (!photo.length || photo.length > 4 * 1024 * 1024 || photo.toString('base64') !== input.photoBase64 || !imageBytesMatchType(photo, input.photoMimeType)) {
    return response.status(400).json({ error: 'The photo must be a valid image no larger than 4 MB.' });
  }

  let uploadedPath;
  try {
    const existingRows = await supabaseFetch(`/rest/v1/reports?id=eq.${encodeURIComponent(input.id)}&select=id,share_token_hash,photo_path,shared_at&limit=1`);
    const existing = existingRows?.[0];
    const suppliedToken = authorizationToken(request);
    if (existing && (!suppliedToken || digestToken(suppliedToken) !== existing.share_token_hash)) {
      return response.status(409).json({ error: 'This report ID already exists. Open it from the original browser to update its link.' });
    }

    const token = suppliedToken || randomBytes(32).toString('base64url');
    const publicUrl = shareUrl(request, token);
    const extension = PHOTO_TYPES.get(input.photoMimeType);
    uploadedPath = `${input.id}/${randomUUID()}.${extension}`;
    await supabaseFetch(`/storage/v1/object/${encodeURIComponent(settings.bucket)}/${uploadedPath.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST',
      headers: { 'content-type': input.photoMimeType, 'x-upsert': 'false' },
      body: photo
    });

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    let linkedToReportId = null;
    if (isUuid(input.linkedToReportId)) {
      const parent = await supabaseFetch(`/rest/v1/reports?id=eq.${encodeURIComponent(input.linkedToReportId)}&select=id&limit=1`);
      linkedToReportId = parent?.[0]?.id || null;
    }
    const row = apiReport({
      ...input,
      linkedToReportId,
      photoPath: uploadedPath,
      shareTokenHash: digestToken(token),
      shareExpiresAt: expiresAt,
      sharedAt: existing?.shared_at || now
    });
    await supabaseFetch('/rest/v1/reports?on_conflict=id', {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(row)
    });

    if (existing?.photo_path && existing.photo_path !== uploadedPath) {
      await supabaseFetch(`/storage/v1/object/${encodeURIComponent(settings.bucket)}`, {
        method: 'DELETE',
        body: JSON.stringify({ prefixes: [existing.photo_path] })
      }).catch((error) => console.warn('Old report photo cleanup failed:', error.message));
    }
    return response.json({ url: publicUrl, token, expiresAt });
  } catch (error) {
    if (uploadedPath) {
      await supabaseFetch(`/storage/v1/object/${encodeURIComponent(settings.bucket)}`, {
        method: 'DELETE', body: JSON.stringify({ prefixes: [uploadedPath] })
      }).catch(() => {});
    }
    console.error('Could not prepare report sharing:', error.message);
    const isLocalRequest = ['localhost', '127.0.0.1'].includes(request.hostname);
    const genericError = 'Could not prepare the private report link. Your report is still saved on this device; try again later.';
    const errorMessage = error.status === 503
      ? error.message
      : isLocalRequest
        ? `${genericError} ${error.message}`
        : genericError;
    return response.status(error.status || 502).json({ error: errorMessage });
  }
});

app.get('/api/shared-report', async (request, response) => {
  const token = authorizationToken(request);
  if (!token) return response.status(401).json({ error: 'A report link is required.' });
  try {
    const hash = digestToken(token);
    const filters = new URLSearchParams({
      share_token_hash: `eq.${hash}`,
      share_expires_at: `gt.${new Date().toISOString()}`,
      select: 'id,created_at,status,description,latitude,longitude,location_name,photo_path,photo_mime_type,utility_snapshot,shared_at,share_expires_at',
      limit: '1'
    });
    const rows = await supabaseFetch(`/rest/v1/reports?${filters}`);
    const report = rows?.[0];
    if (!report) return response.status(404).json({ error: 'This report link is invalid or has expired.' });
    const settings = supabaseSettings();
    const signed = await supabaseFetch(`/storage/v1/object/sign/${encodeURIComponent(settings.bucket)}/${report.photo_path.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST', body: JSON.stringify({ expiresIn: 300 })
    });
    if (typeof signed?.signedURL !== 'string') throw new Error('Supabase did not return a signed photo URL.');
    const signedUrl = /^https?:\/\//i.test(signed.signedURL)
      ? signed.signedURL
      : new URL(`/storage/v1${signed.signedURL.startsWith('/') ? '' : '/'}${signed.signedURL}`, `${settings.url}/`).toString();
    return response.json({ report, imageUrl: signedUrl });
  } catch (error) {
    console.error('Could not load shared report:', error.message);
    return response.status(error.status || 502).json({ error: 'Could not load this report right now. Please try again.' });
  }
});

app.patch('/api/reports/:id/status', async (request, response) => {
  const token = authorizationToken(request);
  const { status, submittedAt, lastCheckedAt, fixedAt, resolutionNote, handoffMethod } = request.body || {};
  if (!token || !isUuid(request.params.id)) return response.status(401).json({ error: 'Report access was not verified.' });
  if (!['pending', 'submitted', 'fixed'].includes(status)) return response.status(400).json({ error: 'The report status is invalid.' });
  try {
    const hash = digestToken(token);
    const query = new URLSearchParams({ id: `eq.${request.params.id}`, share_token_hash: `eq.${hash}`, select: 'id', limit: '1' });
    const matching = await supabaseFetch(`/rest/v1/reports?${query}`);
    if (!matching?.length) return response.status(404).json({ error: 'Report access was not verified.' });
    const update = { status, submitted_at: submittedAt || null, last_checked_at: lastCheckedAt || null, fixed_at: fixedAt || null, resolution_note: resolutionNote || null, handoff_method: handoffMethod || null, updated_at: new Date().toISOString() };
    await supabaseFetch(`/rest/v1/reports?id=eq.${request.params.id}`, { method: 'PATCH', body: JSON.stringify(update), headers: { prefer: 'return=minimal' } });
    return response.status(204).end();
  } catch (error) {
    console.error('Could not update shared report status:', error.message);
    return response.status(error.status || 502).json({ error: 'Could not update the cloud report. The local copy remains saved.' });
  }
});

app.delete('/api/reports/:id', async (request, response) => {
  const token = authorizationToken(request);
  if (!token || !isUuid(request.params.id)) return response.status(401).json({ error: 'Report access was not verified.' });
  try {
    const hash = digestToken(token);
    const query = new URLSearchParams({ id: `eq.${request.params.id}`, share_token_hash: `eq.${hash}`, select: 'id,photo_path', limit: '1' });
    const matching = await supabaseFetch(`/rest/v1/reports?${query}`);
    const report = matching?.[0];
    if (!report) return response.status(404).json({ error: 'Report access was not verified.' });
    if (report.photo_path) {
      await supabaseFetch(`/storage/v1/object/${encodeURIComponent(supabaseSettings().bucket)}`, {
        method: 'DELETE', body: JSON.stringify({ prefixes: [report.photo_path] })
      });
    }
    await supabaseFetch(`/rest/v1/reports?id=eq.${request.params.id}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } });
    return response.status(204).end();
  } catch (error) {
    console.error('Could not delete cloud report:', error.message);
    return response.status(error.status || 502).json({ error: 'Could not delete the cloud report and photo. The local report was kept.' });
  }
});

app.get('/api/health', (_request, response) => response.json({ ready: true }));
app.get('/api/diagnostics/supabase', async (request, response) => {
  if (!['localhost', '127.0.0.1'].includes(request.hostname)) return response.status(404).end();
  const settings = supabaseSettings();
  if (!settings) {
    return response.json({ configured: false, message: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from the server environment.' });
  }

  const columns = [
    'id', 'created_at', 'updated_at', 'status', 'description', 'latitude', 'longitude',
    'location_name', 'location_captured_at', 'photo_path', 'photo_mime_type', 'utility_id',
    'recipient_email', 'utility_snapshot', 'linked_to_report_id', 'email_draft_opened_at',
    'handoff_method', 'submitted_at', 'last_checked_at', 'fixed_at', 'resolution_note',
    'share_token_hash', 'share_expires_at', 'shared_at'
  ].join(',');
  let reportsTable;
  try {
    await supabaseFetch(`/rest/v1/reports?select=${encodeURIComponent(columns)}&limit=0`);
    reportsTable = { ok: true, message: 'Reports table and required columns are accessible.' };
  } catch (error) {
    reportsTable = { ok: false, message: error.message };
  }

  let photoBucket;
  try {
    const bucket = await supabaseFetch(`/storage/v1/bucket/${encodeURIComponent(settings.bucket)}`);
    photoBucket = {
      ok: true,
      private: bucket.public === false,
      message: bucket.public === false ? 'Configured bucket exists and is private.' : 'Configured bucket exists but is public.'
    };
  } catch (error) {
    photoBucket = { ok: false, message: error.message };
  }
  return response.json({ configured: true, reportsTable, photoBucket });
});
app.get('/api/utilities', async (_request, response, next) => {
  try {
    const directory = await readFile(path.join(here, 'src', 'data', 'utilities.json'), 'utf8');
    response.type('json').send(directory);
  } catch (error) {
    next(error);
  }
});
app.use(express.static(path.join(here, 'public')));
app.get('*splat', (_request, response) => response.sendFile(path.join(here, 'public', 'index.html')));

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`CitizenWater is running at http://localhost:${port}`);
});
server.on('error', (error) => {
  console.error(`CitizenWater could not start on port ${port}:`, error.message);
  process.exitCode = 1;
});
