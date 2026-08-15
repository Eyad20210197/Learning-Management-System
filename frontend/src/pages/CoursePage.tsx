import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../app/auth";
import { ParentPageLink } from "../components/ParentPageLink";
import { learningApi } from "../lib/api";

export function CoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user, accessToken, isLoading } = useAuth();
  const course = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => learningApi.course(accessToken!, courseId!),
    enabled: Boolean(accessToken && courseId),
  });
  if (isLoading)
    return (
      <section className="auth-page page-container">
        <p>Loading your space…</p>
      </section>
    );
  if (!user || !accessToken) return <Navigate to="/login" replace />;
  if (course.isLoading)
    return (
      <section className="auth-page page-container">
        <p>Opening your course…</p>
      </section>
    );
  if (course.isError || !course.data)
    return (
      <section className="auth-page page-container">
        <p className="form-error">This course could not be opened.</p>
      </section>
    );
  const lessons =
    course.data.sections?.flatMap((section) => section.lessons) ?? [];
  const nextLesson =
    lessons.find((lesson) => !lesson.progress?.completedAt) ?? lessons[0];
  return (
    <section className="course-page student-course-page page-container">
      <div className="student-hero-panel">
        <ParentPageLink label="Back to learning" to="/learn" />
        <p className="eyebrow course-eyebrow">Course</p>
        <h1>{course.data.title}</h1>
        <p className="lede">{course.data.description}</p>
        {course.data.courseProgress && (
          <div
            className="course-progress course-progress-detail"
            aria-label={`${course.data.courseProgress.percentage}% complete`}
          >
            <div className="course-progress-copy">
              <strong>{course.data.courseProgress.percentage}% complete</strong>
              <span>
                {course.data.courseProgress.completedLessons} of{" "}
                {course.data.courseProgress.totalLessons} lessons finished
              </span>
            </div>
            <progress max="100" value={course.data.courseProgress.percentage} />
          </div>
        )}
        {nextLesson && (
          <Link
            className="button button-primary course-start"
            to={`/learn/lessons/${nextLesson.id}`}
          >
            {course.data.courseProgress?.completedLessons
              ? "Continue learning"
              : "Start course"}
          </Link>
        )}
      </div>
      <div className="lesson-list">
        {course.data.sections?.map((section, sectionIndex) => (
          <section className="student-section" key={section.id}>
            <div className="student-section-heading">
              <div>
                <p className="eyebrow">
                  Section {String(sectionIndex + 1).padStart(2, "0")}
                </p>
                <h2>{section.title}</h2>
              </div>
              <span>
                {section.lessons.length}{" "}
                {section.lessons.length === 1 ? "lesson" : "lessons"}
              </span>
            </div>
            {section.lessons.map((lesson, lessonIndex) => (
              <Link
                className={
                  lesson.progress?.completedAt
                    ? "lesson-row is-complete"
                    : "lesson-row"
                }
                key={lesson.id}
                to={`/learn/lessons/${lesson.id}`}
              >
                <span className="student-lesson-main">
                  <span className="student-lesson-number">
                    {String(sectionIndex + 1).padStart(2, "0")}.
                    {lessonIndex + 1}
                  </span>
                  <strong>{lesson.title}</strong>
                </span>
                <span className="lesson-type">
                  {lesson.progress?.completedAt
                    ? "Completed"
                    : lesson.type === "VIDEO"
                      ? "Video"
                      : "Reading"}
                  <span aria-hidden="true"> →</span>
                </span>
              </Link>
            ))}
          </section>
        ))}
      </div>
    </section>
  );
}
