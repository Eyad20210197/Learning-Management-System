import { verifyMediaLease } from './lease';
import { mapMediaPath } from './path';

export interface Env {
  MEDIA_BUCKET: R2Bucket;
  MEDIA_LEASE_PUBLIC_KEY: string;
}

const getCookie = (header: string | null, name: string): string | null => {
  if (header === null) return null;
  for (const item of header.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() === name)
      return item.slice(separator + 1).trim();
  }
  return null;
};

const errorResponse = (
  status: number,
  code: string,
  requestId: string,
): Response =>
  Response.json(
    { statusCode: status, code, message: 'Media request denied', requestId },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );

const deny = (
  request: Request,
  status: number,
  code: string,
  requestId: string,
): Response => {
  console.warn(
    JSON.stringify({
      event: 'media_request_denied',
      code,
      method: request.method,
      path: new URL(request.url).pathname,
      requestId,
    }),
  );
  return errorResponse(status, code, requestId);
};

export const handleRequest = async (
  request: Request,
  env: Env,
): Promise<Response> => {
  const requestId = request.headers.get('cf-ray') ?? crypto.randomUUID();
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return deny(request, 405, 'METHOD_NOT_ALLOWED', requestId);
  const mapped = mapMediaPath(new URL(request.url).pathname);
  if (mapped === null)
    return deny(request, 404, 'MEDIA_NOT_FOUND', requestId);
  const token = getCookie(request.headers.get('cookie'), 'lms_media_lease');
  if (token === null)
    return deny(request, 401, 'MEDIA_LEASE_REQUIRED', requestId);
  const lease = await verifyMediaLease(
    token,
    env.MEDIA_LEASE_PUBLIC_KEY,
    mapped.videoId,
  );
  if (lease === null)
    return deny(request, 403, 'MEDIA_LEASE_INVALID', requestId);

  const object =
    request.method === 'HEAD'
      ? await env.MEDIA_BUCKET.head(mapped.objectKey)
      : await env.MEDIA_BUCKET.get(mapped.objectKey);
  if (object === null)
    return deny(request, 404, 'MEDIA_NOT_FOUND', requestId);
  const headers = new Headers({
    'Content-Type': mapped.contentType,
    'Content-Length': object.size.toString(),
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Request-Id': requestId,
  });
  if (object.etag.length > 0) headers.set('ETag', object.httpEtag);
  const body = request.method === 'HEAD' ? null : (object as R2ObjectBody).body;
  return new Response(body, {
    status: 200,
    headers,
  });
};

export default { fetch: handleRequest } satisfies ExportedHandler<Env>;
