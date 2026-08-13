import { describe, expect, it } from 'vitest';
import { mapMediaPath } from './path';

const VIDEO_ID = '0198d03a-81df-7c0f-9908-e700c1c6744d';

describe('mapMediaPath', () => {
  it('maps a safe HLS path to the private canonical object key', () => {
    expect(mapMediaPath(`/media/hls/${VIDEO_ID}/720p/segment-001.ts`)).toEqual({
      videoId: VIDEO_ID,
      objectKey: `processed/${VIDEO_ID}/hls/720p/segment-001.ts`,
      contentType: 'video/mp2t',
    });
  });

  it.each([
    `/media/hls/${VIDEO_ID}/../source.mp4`,
    `/media/hls/${VIDEO_ID}/%2e%2e/source.mp4`,
    `/media/hls/${VIDEO_ID}/master.exe`,
    `/media/hls/not-a-uuid/master.m3u8`,
    `/media/hls/${VIDEO_ID}/folder%5Csource.mp4`,
  ])('rejects unsafe or unsupported path %s', (path) => {
    expect(mapMediaPath(path)).toBeNull();
  });
});
