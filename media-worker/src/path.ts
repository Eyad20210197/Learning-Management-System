const VIDEO_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  m3u8: 'application/vnd.apple.mpegurl',
  ts: 'video/mp2t',
  m4s: 'video/iso.segment',
  mp4: 'video/mp4',
  vtt: 'text/vtt; charset=utf-8',
};

export interface MediaPath {
  videoId: string;
  objectKey: string;
  contentType: string;
}

export const mapMediaPath = (pathname: string): MediaPath | null => {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\\') || decoded.includes('\0')) return null;
  const segments = decoded.split('/');
  if (
    segments.length < 5 ||
    segments[0] !== '' ||
    segments[1] !== 'media' ||
    segments[2] !== 'hls'
  ) {
    return null;
  }
  const videoId = segments[3];
  const relative = segments.slice(4);
  if (
    videoId === undefined ||
    !VIDEO_ID.test(videoId) ||
    relative.some(
      (segment) =>
        segment === '' ||
        segment === '.' ||
        segment === '..' ||
        !SAFE_SEGMENT.test(segment),
    )
  ) {
    return null;
  }
  const filename = relative.at(-1);
  const extension = filename?.split('.').at(-1)?.toLowerCase();
  const contentType = extension && CONTENT_TYPES[extension];
  if (contentType === undefined) return null;
  return {
    videoId: videoId.toLowerCase(),
    objectKey: `processed/${videoId.toLowerCase()}/hls/${relative.join('/')}`,
    contentType,
  };
};
