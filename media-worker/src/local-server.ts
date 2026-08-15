import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { config as loadEnv } from 'dotenv';
import * as Minio from 'minio';
import { verifyMediaLease } from './lease';
import { mapMediaPath } from './path';

loadEnv({ path: '../backend/.env' });
loadEnv({ path: '.env' });
loadEnv({ path: '.dev.vars' });

const port = Number(process.env.MEDIA_GATEWAY_PORT ?? 8787);
const endpoint = new URL(process.env.OBJECT_STORAGE_ENDPOINT ?? 'http://127.0.0.1:9000');
const bucket = process.env.OBJECT_STORAGE_BUCKET ?? 'lms-private';
const publicKey = process.env.MEDIA_LEASE_PUBLIC_KEY ?? '';

if (!publicKey) throw new Error('MEDIA_LEASE_PUBLIC_KEY is required');

const client = new Minio.Client({
  endPoint: endpoint.hostname,
  port: Number(endpoint.port || (endpoint.protocol === 'https:' ? 443 : 80)),
  useSSL: endpoint.protocol === 'https:',
  accessKey: process.env.OBJECT_STORAGE_ACCESS_KEY_ID ?? 'minioadmin',
  secretKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY ?? 'minioadmin',
});

const cookie = (request: IncomingMessage, name: string): string | null => {
  for (const part of (request.headers.cookie ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index >= 0 && part.slice(0, index).trim() === name)
      return part.slice(index + 1).trim();
  }
  return null;
};

const respond = (response: ServerResponse, status: number, message: string) => {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify({ statusCode: status, code: message, message }));
};

const handle = async (request: IncomingMessage, response: ServerResponse) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return respond(response, 405, 'METHOD_NOT_ALLOWED');
  const mapped = mapMediaPath(new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`).pathname);
  if (!mapped) return respond(response, 404, 'MEDIA_NOT_FOUND');
  const token = cookie(request, 'lms_media_lease');
  if (!token || !(await verifyMediaLease(token, publicKey, mapped.videoId))) return respond(response, 403, 'MEDIA_LEASE_INVALID');

  try {
    const metadata = await client.statObject(bucket, mapped.objectKey);
    response.writeHead(200, {
      'Content-Type': mapped.contentType,
      'Content-Length': String(metadata.size),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'HEAD') return response.end();
    const stream = await client.getObject(bucket, mapped.objectKey);
    stream.on('error', () => response.destroy());
    stream.pipe(response);
  } catch {
    respond(response, 404, 'MEDIA_NOT_FOUND');
  }
};

createServer((request, response) => {
  void handle(request, response).catch(() => respond(response, 500, 'MEDIA_GATEWAY_ERROR'));
}).listen(port, '127.0.0.1', () => {
  console.log(`Local media gateway listening on http://127.0.0.1:${port}`);
});
