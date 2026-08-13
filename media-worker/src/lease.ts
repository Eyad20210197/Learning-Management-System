export interface MediaLeaseClaims {
  sid: string;
  sub: string;
  did: string;
  vid: string;
  aud: 'lms-media';
  iat: number;
  exp: number;
  jti: string;
}

const decodeBase64Url = (value: string): Uint8Array => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const bytes = atob(padded);
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
};

const parseJson = (value: string): unknown =>
  JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as unknown;

const asArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

const isClaims = (value: unknown): value is MediaLeaseClaims => {
  if (typeof value !== 'object' || value === null) return false;
  const claims = value as Partial<MediaLeaseClaims>;
  return (
    typeof claims.sid === 'string' &&
    typeof claims.sub === 'string' &&
    typeof claims.did === 'string' &&
    typeof claims.vid === 'string' &&
    claims.aud === 'lms-media' &&
    typeof claims.iat === 'number' &&
    Number.isInteger(claims.iat) &&
    typeof claims.exp === 'number' &&
    Number.isInteger(claims.exp) &&
    typeof claims.jti === 'string'
  );
};

export const verifyMediaLease = async (
  token: string,
  publicKeyBase64: string,
  expectedVideoId: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<MediaLeaseClaims | null> => {
  try {
    const segments = token.split('.');
    if (segments.length !== 3) return null;
    const [encodedHeader, encodedPayload, encodedSignature] = segments;
    if (
      encodedHeader === undefined ||
      encodedPayload === undefined ||
      encodedSignature === undefined
    ) {
      return null;
    }
    const header = parseJson(encodedHeader) as {
      alg?: unknown;
      typ?: unknown;
      kid?: unknown;
    };
    if (header.alg !== 'ES256' || header.typ !== 'JWT' || header.kid !== 'v1')
      return null;
    const claims = parseJson(encodedPayload);
    if (!isClaims(claims)) return null;
    if (
      claims.vid !== expectedVideoId ||
      claims.exp <= nowSeconds ||
      claims.iat > nowSeconds + 5 ||
      claims.exp - claims.iat > 300
    ) {
      return null;
    }
    const publicKey = await crypto.subtle.importKey(
      'spki',
      Uint8Array.from(atob(publicKeyBase64), (character) =>
        character.charCodeAt(0),
      ),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      asArrayBuffer(decodeBase64Url(encodedSignature)),
      asArrayBuffer(
        new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
      ),
    );
    return valid ? claims : null;
  } catch {
    return null;
  }
};
