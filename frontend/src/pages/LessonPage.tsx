import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../app/auth";
import { ParentPageLink } from "../components/ParentPageLink";
import { learningApi } from "../lib/api";
import { SecureVideoPlayer } from "../components/SecureVideoPlayer";

const formatBytes = (value: string): string => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 1024) return `${bytes || 0} B`;
  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`;
};

const resourceKind = (mimeType: string): string => {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.includes("zip")) return "Archive";
  if (mimeType.includes("wordprocessingml")) return "Document";
  if (mimeType.startsWith("text/")) return "Text file";
  return "File";
};

export function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { user, accessToken, isLoading } = useAuth();
  const client = useQueryClient();
  const lesson = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: () => learningApi.lesson(accessToken!, lessonId!),
    enabled: Boolean(accessToken && lessonId),
  });
  const progress = useMutation({
    mutationFn: () =>
      learningApi.progress(accessToken!, lessonId!, {
        positionSeconds: 0,
        watchedSeconds: 1,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["lesson", lessonId] });
      void client.invalidateQueries({ queryKey: ["course"] });
      void client.invalidateQueries({ queryKey: ["my-courses"] });
    },
  });
  const download = useMutation({
    mutationFn: (resourceId: string) =>
      learningApi.downloadResource(accessToken!, resourceId),
    onSuccess: (resource) => {
      const link = document.createElement("a");
      link.href = resource.downloadUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    },
  });
  if (isLoading)
    return (
      <section className="auth-page page-container">
        <p>Loading your space…</p>
      </section>
    );
  if (!user || !accessToken) return <Navigate to="/login" replace />;
  if (lesson.isLoading)
    return (
      <section className="auth-page page-container">
        <p>Opening your lesson…</p>
      </section>
    );
  if (lesson.isError || !lesson.data)
    return (
      <section className="auth-page page-container">
        <p className="form-error">This lesson could not be opened.</p>
      </section>
    );
  return (
    <section className="lesson-page student-lesson-page page-container">
      <div className="student-hero-panel">
        <ParentPageLink
          label="Back to course"
          to={
            lesson.data.courseId
              ? `/learn/courses/${lesson.data.courseId}`
              : "/learn"
          }
        />
        <p className="eyebrow course-eyebrow">
          {lesson.data.type === "VIDEO" ? "Video lesson" : "Reading lesson"}
        </p>
        <h1>{lesson.data.title}</h1>
        {lesson.data.description && (
          <p className="lede">{lesson.data.description}</p>
        )}
      </div>
      {lesson.data.type === "VIDEO" && (
        <SecureVideoPlayer token={accessToken} lessonId={lessonId!} />
      )}
      {lesson.data.textContent && (
        <article className="lesson-content">{lesson.data.textContent}</article>
      )}
      {lesson.data.resources && lesson.data.resources.length > 0 && (
        <section
          className="lesson-resources"
          aria-labelledby="lesson-resources-title"
        >
          <div className="lesson-resources-heading">
            <div>
              <p className="eyebrow">Downloads</p>
              <h2 id="lesson-resources-title">Lesson resources</h2>
            </div>
            <span>
              {lesson.data.resources.length}{" "}
              {lesson.data.resources.length === 1 ? "file" : "files"}
            </span>
          </div>
          <div className="resource-list">
            {lesson.data.resources.map((resource) => (
              <div className="resource-item" key={resource.id}>
                <div className="resource-file-mark" aria-hidden="true">
                  {resourceKind(resource.mimeType).slice(0, 3).toUpperCase()}
                </div>
                <div className="resource-copy">
                  <strong>{resource.title || resource.filename}</strong>
                  <small>
                    {resource.filename} · {resourceKind(resource.mimeType)} ·{" "}
                    {formatBytes(resource.sizeBytes)}
                  </small>
                </div>
                <button
                  className="resource-download"
                  type="button"
                  onClick={() => download.mutate(resource.id)}
                  disabled={
                    download.isPending && download.variables === resource.id
                  }
                >
                  {download.isPending && download.variables === resource.id
                    ? "Preparing..."
                    : "Download"}
                </button>
              </div>
            ))}
          </div>
          {download.isError && (
            <p className="form-error">
              The resource could not be downloaded. Please try again.
            </p>
          )}
        </section>
      )}
      <button
        className="button button-primary lesson-complete-button"
        onClick={() => progress.mutate()}
        disabled={
          progress.isPending || Boolean(lesson.data.progress?.completedAt)
        }
      >
        {lesson.data.progress?.completedAt
          ? "Completed"
          : progress.isPending
            ? "Saving…"
            : "Mark complete"}
      </button>
    </section>
  );
}
