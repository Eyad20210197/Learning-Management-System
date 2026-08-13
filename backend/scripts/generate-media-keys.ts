import { generateKeyPairSync } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
});

process.stdout.write(
  [
    `MEDIA_LEASE_PRIVATE_KEY=${privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64')}`,
    `MEDIA_LEASE_PUBLIC_KEY=${publicKey.export({ format: 'der', type: 'spki' }).toString('base64')}`,
  ].join('\n'),
);
