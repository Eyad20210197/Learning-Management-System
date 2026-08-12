import { selectVideoRenditions } from './video.entity';

describe('selectVideoRenditions', () => {
  it('selects standard renditions without upscaling a 720p source', () => {
    expect(selectVideoRenditions(1280, 720)).toEqual([
      { width: 640, height: 360, bitrateKbps: 800 },
      { width: 854, height: 480, bitrateKbps: 1400 },
      { width: 1280, height: 720, bitrateKbps: 2800 },
    ]);
  });

  it('preserves a small source as one even-dimension rendition', () => {
    expect(selectVideoRenditions(319, 179)).toEqual([
      { width: 318, height: 178, bitrateKbps: 600 },
    ]);
  });
});
