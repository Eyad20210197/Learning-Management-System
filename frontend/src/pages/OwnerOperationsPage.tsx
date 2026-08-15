import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { useAuth } from "../app/auth";
import { ownerApi } from "../lib/api";

export function OwnerOperationsPage() {
  const { user, accessToken, isLoading } = useAuth();
  const client = useQueryClient();
  const enabled = Boolean(accessToken && user?.roles.includes("OWNER"));
  const summary = useQuery({
    queryKey: ["operations-summary"],
    queryFn: () => ownerApi.operationsSummary(accessToken!),
    enabled,
  });
  const videos = useQuery({
    queryKey: ["owner-videos"],
    queryFn: () => ownerApi.videos(accessToken!),
    enabled,
  });
  const resources = useQuery({
    queryKey: ["owner-resources"],
    queryFn: () => ownerApi.resources(accessToken!),
    enabled,
  });
  const retry = useMutation({
    mutationFn: (id: string) => ownerApi.retryVideo(accessToken!, id),
    onSuccess: () =>
      void client.invalidateQueries({ queryKey: ["owner-videos"] }),
  });
  const activate = useMutation({
    mutationFn: ({
      lessonId,
      videoId,
    }: {
      lessonId: string;
      videoId: string;
    }) => ownerApi.activateVideo(accessToken!, lessonId, videoId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["owner-videos"] });
      void client.invalidateQueries({ queryKey: ["operations-summary"] });
    },
  });
  const removeVideo = useMutation({
    mutationFn: (id: string) => ownerApi.deleteVideo(accessToken!, id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["owner-videos"] });
      void client.invalidateQueries({ queryKey: ["operations-summary"] });
    },
  });
  const removeResource = useMutation({
    mutationFn: (id: string) => ownerApi.deleteResource(accessToken!, id),
    onSuccess: () =>
      void client.invalidateQueries({ queryKey: ["owner-resources"] }),
  });

  if (isLoading)
    return (
      <section className="auth-page page-container">
        <p>Loading your space...</p>
      </section>
    );
  if (!user || !accessToken) return <Navigate to="/login" replace />;
  if (!user.roles.includes("OWNER")) return <Navigate to="/learn" replace />;

  const cards = summary.data
    ? [
        ["Students", summary.data.students],
        ["Active enrollments", summary.data.activeEnrollments],
        ["Published courses", summary.data.publishedCourses],
        ["Videos processing", summary.data.videosProcessing],
        ["Videos processed", summary.data.videosProcessed],
        ["Videos failed", summary.data.videosFailed],
        ["Active playback", summary.data.activePlaybackSessions],
        ["Security events", summary.data.unresolvedSecurityEvents],
      ]
    : [];

  return (
    <section className="dashboard page-container">
      <p className="eyebrow">Owner workspace</p>
      <h1>Operations, at a glance.</h1>
      <div className="operations-summary">
        {cards.map(([label, value]) => (
          <div className="metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="owner-form operations-panel">
        <div className="operations-panel-heading">
          <div>
            <p className="eyebrow">Media library</p>
            <h2>Video versions</h2>
          </div>
          <span>{videos.data?.items.length ?? 0} uploads</span>
        </div>
        <p className="operations-note">
          One version can be active for each lesson. Older uploads remain here
          until you delete them.
        </p>
        {videos.isLoading && (
          <p className="lede">Loading processing status...</p>
        )}
        {videos.data?.items.map((video) => {
          const latest = video.processingJobs[0];
          const status = latest?.status ?? video.status;
          return (
            <div className="operation-item" key={video.id}>
              <div className="operation-main">
                <div className="operation-title-line">
                  <strong>{video.lessonTitle}</strong>
                  <span
                    className={`operation-status operation-status-${status.toLowerCase()}`}
                  >
                    {status === "SUCCEEDED"
                      ? "Processed"
                      : status.toLowerCase()}
                  </span>
                </div>
                <span
                  className="operation-filename"
                  title={video.sourceFilename}
                >
                  {video.sourceFilename}
                </span>
                <div className="operation-meta">
                  <span>{video.courseTitle}</span>
                  <span>{new Date(video.createdAt).toLocaleString()}</span>
                  <span>Version {video.id.slice(0, 8)}</span>
                </div>
              </div>
              <div className="operation-actions">
                {status === "FAILED" && (
                  <button
                    className="operation-button"
                    onClick={() => retry.mutate(video.id)}
                    disabled={retry.isPending}
                  >
                    {retry.isPending ? "Retrying..." : "Retry"}
                  </button>
                )}
                {status === "SUCCEEDED" && !video.isCurrent && (
                  <button
                    className="operation-button operation-button-primary"
                    onClick={() =>
                      activate.mutate({
                        lessonId: video.lessonId,
                        videoId: video.id,
                      })
                    }
                    disabled={activate.isPending}
                  >
                    {activate.isPending ? "Activating..." : "Make active"}
                  </button>
                )}
                {video.isCurrent && (
                  <span className="status-pill">Active version</span>
                )}
                <button
                  className="operation-button operation-button-danger"
                  type="button"
                  disabled={removeVideo.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete ${video.sourceFilename}? This cannot be undone.`,
                      )
                    )
                      removeVideo.mutate(video.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
        {videos.data?.items.length === 0 && (
          <p className="lede">No video operations yet.</p>
        )}
      </div>
      <div className="owner-form operations-panel">
        <div className="operations-panel-heading">
          <div>
            <p className="eyebrow">Downloads</p>
            <h2>Lesson resources</h2>
          </div>
          <span>{resources.data?.items.length ?? 0} files</span>
        </div>
        <p className="operations-note">
          Files available to students inside their lessons.
        </p>
        {resources.isLoading && <p className="lede">Loading resources...</p>}
        {resources.data?.items.map((resource) => (
          <div className="operation-item" key={resource.id}>
            <div className="operation-main">
              <div className="operation-title-line">
                <strong>{resource.lessonTitle}</strong>
                <span className="operation-status">
                  {resource.status.toLowerCase()}
                </span>
              </div>
              <span className="operation-filename" title={resource.filename}>
                {resource.filename}
              </span>
              <div className="operation-meta">
                <span>{resource.courseTitle}</span>
                <span>{new Date(resource.createdAt).toLocaleString()}</span>
              </div>
            </div>
            <button
              className="operation-button operation-button-danger"
              type="button"
              disabled={removeResource.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Delete ${resource.filename}? This cannot be undone.`,
                  )
                )
                  removeResource.mutate(resource.id);
              }}
            >
              Delete
            </button>
          </div>
        ))}
        {resources.data?.items.length === 0 && (
          <p className="lede">No lesson resources uploaded.</p>
        )}
      </div>
    </section>
  );
}
