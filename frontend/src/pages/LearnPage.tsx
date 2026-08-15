import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../app/auth";
import { learningApi } from "../lib/api";

export function LearnPage() {
  const { user, accessToken, isLoading } = useAuth();
  if (isLoading)
    return (
      <section className="auth-page page-container">
        <p>Loading your space…</p>
      </section>
    );
  if (!user || !accessToken) return <Navigate to="/login" replace />;
  return <LearningDashboard token={accessToken} firstName={user.firstName} />;
}

function LearningDashboard({
  token,
  firstName,
}: {
  token: string;
  firstName: string;
}) {
  const courses = useQuery({
    queryKey: ["my-courses"],
    queryFn: () => learningApi.myCourses(token),
  });
  return (
    <section className="dashboard page-container">
      <div className="dashboard-heading">
        <p className="eyebrow">Your learning space</p>
        <h1>Welcome, {firstName}.</h1>
      </div>
      {courses.isLoading && <p className="lede">Loading your courses…</p>}
      {courses.isError && (
        <p className="form-error" role="alert">
          We could not load your courses. Please refresh and try again.
        </p>
      )}
      {courses.data?.items.length === 0 && (
        <div className="empty-state">
          <p className="eyebrow">A clear beginning</p>
          <h2>Your courses will appear here.</h2>
          <p className="lede">
            Once you enroll, your next lesson will always be close.
          </p>
        </div>
      )}
      {courses.data && courses.data.items.length > 0 && (
        <div className="course-grid">
          {courses.data.items.map((course) => (
            <Link
              className="course-card"
              key={course.id}
              to={`/learn/courses/${course.id}`}
            >
              <p className="eyebrow">Course</p>
              <h2>{course.title}</h2>
              <p>{course.description}</p>
              {course.courseProgress && (
                <div
                  className="course-progress"
                  aria-label={`${course.courseProgress.percentage}% complete`}
                >
                  <div className="course-progress-copy">
                    <span>{course.courseProgress.percentage}% complete</span>
                    <span>
                      {course.courseProgress.completedLessons} of{" "}
                      {course.courseProgress.totalLessons} lessons
                    </span>
                  </div>
                  <progress
                    max="100"
                    value={course.courseProgress.percentage}
                  />
                </div>
              )}
              <span className="text-link">Open course →</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
