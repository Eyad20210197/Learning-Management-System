import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { useState } from "react";
import { z } from "zod";
import { useAuth } from "../app/auth";
import { ApiError, ownerApi } from "../lib/api";

const schema = z.object({
  title: z.string().min(1, "Add a course title."),
  slug: z
    .string()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase words separated by hyphens.",
    ),
  description: z.string().min(1, "Add a short description."),
});

export function OwnerCoursesPage() {
  const { user, accessToken, isLoading } = useAuth();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", slug: "", description: "" });
  const [error, setError] = useState("");
  const courses = useQuery({
    queryKey: ["owner-courses"],
    queryFn: () => ownerApi.courses(accessToken!),
    enabled: Boolean(accessToken && user?.roles.includes("OWNER")),
  });
  const create = useMutation({
    mutationFn: () => ownerApi.createCourse(accessToken!, form),
    onSuccess: () => {
      setForm({ title: "", slug: "", description: "" });
      setOpen(false);
      void client.invalidateQueries({ queryKey: ["owner-courses"] });
    },
  });
  const publish = useMutation({
    mutationFn: (id: string) => ownerApi.publishCourse(accessToken!, id),
    onSuccess: () =>
      void client.invalidateQueries({ queryKey: ["owner-courses"] }),
  });
  if (isLoading)
    return (
      <section className="auth-page page-container">
        <p>Loading your space…</p>
      </section>
    );
  if (!user || !accessToken) return <Navigate to="/login" replace />;
  if (!user.roles.includes("OWNER")) return <Navigate to="/learn" replace />;
  function submit() {
    const result = schema.safeParse(form);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Check the course details.");
      return;
    }
    setError("");
    create.mutate();
  }
  return (
    <section className="dashboard page-container">
      <div className="owner-heading">
        <div>
          <p className="eyebrow">Owner workspace</p>
          <h1>Your courses.</h1>
        </div>
        <button
          className="button button-primary"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Close" : "Create course"}
        </button>
      </div>
      {open && (
        <div className="owner-form">
          <h2>New course</h2>
          <label>
            Title
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label>
            Slug
            <input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="intro-to-design"
            />
          </label>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={3}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          {create.error instanceof ApiError && (
            <p className="form-error">{create.error.message}</p>
          )}
          <button
            className="button button-primary"
            onClick={submit}
            disabled={create.isPending}
          >
            {create.isPending ? "Creating…" : "Save course"}
          </button>
        </div>
      )}
      {courses.isLoading && <p className="lede">Loading courses…</p>}
      {courses.isError && (
        <p className="form-error">We could not load the owner workspace.</p>
      )}
      {courses.data?.items.length === 0 && (
        <div className="empty-state">
          <p className="eyebrow">A clear beginning</p>
          <h2>Create your first course.</h2>
          <p className="lede">
            Keep the catalog focused. Add only what learners need next.
          </p>
        </div>
      )}
      {courses.data && courses.data.items.length > 0 && (
        <div className="course-grid">
          {courses.data.items.map((course) => (
            <article className="course-card" key={course.id}>
              <Link
                className="owner-course-link"
                to={`/owner/courses/${course.id}`}
              >
                <p className="eyebrow">{course.status}</p>
                <h2>{course.title}</h2>
                <p>{course.description}</p>
              </Link>
              {course.status === "DRAFT" && (
                <button
                  className="text-button"
                  onClick={() => publish.mutate(course.id)}
                  disabled={publish.isPending}
                >
                  {publish.isPending ? "Publishing…" : "Publish course"}
                </button>
              )}
              {publish.isError && publish.variables === course.id && (
                <p className="form-error">
                  {publish.error instanceof ApiError
                    ? publish.error.message
                    : "Publish failed. Check that the course has at least one section and lesson."}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
