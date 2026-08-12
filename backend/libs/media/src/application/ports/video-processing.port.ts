import type { VideoProbe, VideoRendition } from '../../domain';

export interface ProcessingWorkspace {
  rootPath: string;
  sourcePath: string;
  outputPath: string;
}

export interface TemporaryWorkspacePort {
  create(sourceExtension: string): Promise<ProcessingWorkspace>;
  remove(rootPath: string): Promise<void>;
}

export interface GeneratedMediaFile {
  absolutePath: string;
  relativePath: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
}

export interface GeneratedVariant {
  width: number;
  height: number;
  bitrateKbps: number;
  playlistRelativePath: string;
  sizeBytes: number;
}

export interface TranscodeResult {
  masterPlaylistRelativePath: string;
  thumbnailRelativePath: string;
  files: GeneratedMediaFile[];
  variants: GeneratedVariant[];
}

export interface MediaProbePort {
  inspect(sourcePath: string): Promise<VideoProbe>;
}

export interface VideoTranscoderPort {
  transcode(input: {
    sourcePath: string;
    outputPath: string;
    probe: VideoProbe;
    renditions: VideoRendition[];
  }): Promise<TranscodeResult>;
}

export const TEMPORARY_WORKSPACE = Symbol('media.temporary-workspace');
export const MEDIA_PROBE = Symbol('media.probe');
export const VIDEO_TRANSCODER = Symbol('media.video-transcoder');
