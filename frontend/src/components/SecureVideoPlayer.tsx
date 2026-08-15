import { useEffect, useRef, useState } from "react";
import { learningApi, type PlaybackSession } from "../lib/api";

export function SecureVideoPlayer({
  token,
  lessonId,
}: {
  token: string;
  lessonId: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [session, setSession] = useState<PlaybackSession | null>(null);
  const [message, setMessage] = useState("Preparing your lesson…");

  useEffect(() => {
    let active = true;
    let current: PlaybackSession | null = null;
    let timer: number | undefined;
    learningApi
      .createPlayback(token, lessonId)
      .then((created) => {
        if (!active) return;
        current = created;
        setSession(created);
        setMessage("");
        timer = window.setInterval(() => {
          const position =
            videoRef.current?.currentTime ?? created.lastPositionSeconds;
          learningApi
            .heartbeat(token, created.id, Math.floor(position))
            .then((updated) => {
              if (active) setSession(updated);
            })
            .catch(() =>
              setMessage("Your secure video session needs to be renewed."),
            );
        }, created.heartbeatIntervalSeconds * 1000);
      })
      .catch(() => {
        if (active) setMessage("This video is not available yet.");
      });
    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
      if (current) void learningApi.endPlayback(token, current.id);
    };
  }, [lessonId, token]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !session) return;
    const source = new URL(
      session.hlsUrl,
      import.meta.env.VITE_API_ORIGIN || window.location.origin,
    ).toString();
    let hls: {
      destroy: () => void;
      loadSource: (source: string) => void;
      attachMedia: (media: HTMLMediaElement) => void;
    } | null = null;
    void import("hls.js").then(({ default: Hls }) => {
      if (!video.isConnected || !Hls.isSupported()) return;
      hls = new Hls({
        xhrSetup: (xhr) => {
          xhr.withCredentials = true;
        },
      });
      hls.loadSource(source);
      hls.attachMedia(video);
    });
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = source;
      video.crossOrigin = "use-credentials";
    }
    return () => hls?.destroy();
  }, [session]);

  return (
    <div className="secure-player">
      {message && <p className="player-message">{message}</p>}
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        aria-label="Course video"
      />
    </div>
  );
}
