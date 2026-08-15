import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../app/auth";
import { ownerApi } from "../lib/api";
import { VideoUploadControl } from "../components/VideoUploadControl";
import { ResourceUploadControl } from "../components/ResourceUploadControl";

export function OwnerCourseEditorPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user, accessToken, isLoading } = useAuth();
  const client = useQueryClient();
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lessonRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [sectionTitle, setSectionTitle] = useState("");
  const [newLesson, setNewLesson] = useState<{
    sectionId: string;
    title: string;
    type: "VIDEO" | "TEXT";
    textContent: string;
  } | null>(null);
  const [debugMessage, setDebugMessage] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set(),
  );
  const [draggedLesson, setDraggedLesson] = useState<string | null>(null);
  const [studentId, setStudentId] = useState("");
  const [editingSection, setEditingSection] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [editingLesson, setEditingLesson] = useState<{
    id: string;
    title: string;
    type: "VIDEO" | "TEXT";
    textContent: string;
  } | null>(null);
  const [editing, setEditing] = useState(false);
  const [courseForm, setCourseForm] = useState({
    title: "",
    slug: "",
    description: "",
  });
  const course = useQuery({
    queryKey: ["owner-course", courseId],
    queryFn: () => ownerApi.course(accessToken!, courseId!),
    enabled: Boolean(accessToken && courseId && user?.roles.includes("OWNER")),
  });
  useEffect(() => {
    if (course.data)
      setCourseForm({
        title: course.data.title,
        slug: course.data.slug,
        description: course.data.description,
      });
  }, [course.data]);
  useEffect(() => {
    if (!editingSection && !editingLesson) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setEditingSection(null);
      setEditingLesson(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [editingLesson, editingSection]);
  const students = useQuery({
    queryKey: ["owner-students"],
    queryFn: () => ownerApi.students(accessToken!),
    enabled: Boolean(accessToken && user?.roles.includes("OWNER")),
  });
  const enrollments = useQuery({
    queryKey: ["owner-enrollments", courseId],
    queryFn: () => ownerApi.enrollments(accessToken!, courseId!),
    enabled: Boolean(accessToken && courseId && user?.roles.includes("OWNER")),
  });
  const section = useMutation({
    mutationFn: () =>
      ownerApi.createSection(accessToken!, courseId!, { title: sectionTitle }),
    onSuccess: () => {
      setSectionTitle("");
      void client.invalidateQueries({ queryKey: ["owner-course", courseId] });
    },
  });
  const updateCourse = useMutation({
    mutationFn: () =>
      ownerApi.updateCourse(accessToken!, courseId!, courseForm),
    onSuccess: () => {
      setEditing(false);
      void client.invalidateQueries({ queryKey: ["owner-course", courseId] });
      void client.invalidateQueries({ queryKey: ["owner-courses"] });
    },
  });
  const updateSection = useMutation({
    mutationFn: () =>
      ownerApi.updateSection(accessToken!, editingSection!.id, {
        title: editingSection!.title,
      }),
    onSuccess: () => {
      setEditingSection(null);
      void client.invalidateQueries({ queryKey: ["owner-course", courseId] });
    },
  });
  const updateLesson = useMutation({
    mutationFn: () =>
      ownerApi.updateLesson(accessToken!, editingLesson!.id, {
        title: editingLesson!.title,
        type: editingLesson!.type,
        textContent:
          editingLesson!.type === "TEXT"
            ? editingLesson!.textContent
            : undefined,
      }),
    onSuccess: () => {
      setEditingLesson(null);
      void client.invalidateQueries({ queryKey: ["owner-course", courseId] });
    },
  });
  const createLesson = useMutation({
    mutationFn: () =>
      ownerApi.createLesson(accessToken!, newLesson!.sectionId, {
        title: newLesson!.title,
        type: newLesson!.type,
        textContent:
          newLesson!.type === "TEXT" ? newLesson!.textContent : undefined,
      }),
    onSuccess: () => {
      setNewLesson(null);
      void client.invalidateQueries({ queryKey: ["owner-course", courseId] });
    },
  });
  const grant = useMutation({
    mutationFn: () =>
      ownerApi.grantEnrollment(accessToken!, courseId!, studentId),
    onSuccess: () => {
      setStudentId("");
      void client.invalidateQueries({
        queryKey: ["owner-enrollments", courseId],
      });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => ownerApi.revokeEnrollment(accessToken!, id),
    onSuccess: () =>
      void client.invalidateQueries({
        queryKey: ["owner-enrollments", courseId],
      }),
  });
  const reorderSections = useMutation({
    mutationFn: (ids: string[]) =>
      ownerApi.reorderSections(accessToken!, courseId!, ids),
    onSuccess: () =>
      void client.invalidateQueries({ queryKey: ["owner-course", courseId] }),
  });
  const reorderLessons = useMutation({
    mutationFn: ({ sectionId, ids }: { sectionId: string; ids: string[] }) =>
      ownerApi.reorderLessons(accessToken!, sectionId, ids),
    onSuccess: () =>
      void client.invalidateQueries({ queryKey: ["owner-course", courseId] }),
  });
  const removeSection = useMutation({
    mutationFn: (id: string) => ownerApi.deleteSection(accessToken!, id),
    onSuccess: () => {
      setEditingSection(null);
      void client.invalidateQueries({ queryKey: ["owner-course", courseId] });
    },
  });
  const removeLesson = useMutation({
    mutationFn: (id: string) => ownerApi.deleteLesson(accessToken!, id),
    onSuccess: () => {
      setEditingLesson(null);
      void client.invalidateQueries({ queryKey: ["owner-course", courseId] });
    },
  });
  if (isLoading)
    return (
      <section className="auth-page page-container">
        <p>Loading your space…</p>
      </section>
    );
  if (!user || !accessToken) return <Navigate to="/login" replace />;
  if (!user.roles.includes("OWNER")) return <Navigate to="/learn" replace />;
  if (course.isLoading)
    return (
      <section className="auth-page page-container">
        <p>Opening course editor…</p>
      </section>
    );
  if (!course.data)
    return (
      <section className="auth-page page-container">
        <p className="form-error">Course could not be opened.</p>
      </section>
    );
  return (
    <section className="course-page page-container">
      <Link className="text-link" to="/owner/courses">
        ← All courses
      </Link>
      <p className="eyebrow course-eyebrow">{course.data.status}</p>
      <h1>{course.data.title}</h1>
      <p className="lede">{course.data.description}</p>
      <button
        className="text-button"
        onClick={() => setEditing((value) => !value)}
      >
        {editing ? "Close details" : "Edit details"}
      </button>
      {editing && (
        <div className="owner-form">
          <h2>Course details</h2>
          <label>
            Title
            <input
              value={courseForm.title}
              onChange={(e) =>
                setCourseForm({ ...courseForm, title: e.target.value })
              }
            />
          </label>
          <label>
            Slug
            <input
              value={courseForm.slug}
              onChange={(e) =>
                setCourseForm({ ...courseForm, slug: e.target.value })
              }
            />
          </label>
          <label>
            Description
            <textarea
              rows={3}
              value={courseForm.description}
              onChange={(e) =>
                setCourseForm({ ...courseForm, description: e.target.value })
              }
            />
          </label>
          <button
            className="button button-primary"
            onClick={() => updateCourse.mutate()}
            disabled={updateCourse.isPending}
          >
            {updateCourse.isPending ? "Saving…" : "Save details"}
          </button>
        </div>
      )}
      <div className="editor-add">
        <input
          aria-label="Section title"
          value={sectionTitle}
          onChange={(e) => setSectionTitle(e.target.value)}
          placeholder="New section title"
        />
        <button
          className="button button-primary"
          onClick={() => section.mutate()}
          disabled={!sectionTitle || section.isPending}
        >
          {section.isPending ? "Adding…" : "Add section"}
        </button>
      </div>
      <div className="lesson-list">
        {debugMessage && (
          <p className="debug-message" role="status">
            {debugMessage}
          </p>
        )}
        {course.data.sections?.map((item, index, sections) => (
          <div
            key={item.id}
            ref={(node) => {
              sectionRefs.current[item.id] = node;
            }}
            className="tree-section"
          >
            <div className="editor-row">
              <div className="tree-section-heading">
                <button
                  type="button"
                  className="tree-toggle"
                  aria-expanded={!collapsedSections.has(item.id)}
                  aria-label={`${collapsedSections.has(item.id) ? "Expand" : "Collapse"} ${item.title}`}
                  onClick={() =>
                    setCollapsedSections((current) => {
                      const next = new Set(current);
                      if (next.has(item.id)) next.delete(item.id);
                      else next.add(item.id);
                      return next;
                    })
                  }
                >
                  <span aria-hidden="true">
                    {collapsedSections.has(item.id) ? "+" : "−"}
                  </span>
                </button>
                <div>
                  <p className="tree-kicker">
                    Section {String(index + 1).padStart(2, "0")}
                  </p>
                  <h2>{item.title}</h2>
                </div>
              </div>
              <details className="context-menu section-menu">
                <summary aria-label={`Manage ${item.title}`}>Manage</summary>
                <div className="context-menu-panel">
                  <button
                    className="text-button"
                    aria-label="Edit section"
                    onClick={() => {
                      setEditingSection({ id: item.id, title: item.title });
                      setTimeout(
                        () =>
                          sectionRefs.current[item.id]?.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          }),
                        0,
                      );
                    }}
                  >
                    Edit
                  </button>{" "}
                  <button
                    className="text-button"
                    aria-label="Move section up"
                    disabled={index === 0 || reorderSections.isPending}
                    onClick={() => {
                      const ids = sections.map((value) => value.id);
                      [ids[index - 1], ids[index]] = [
                        ids[index]!,
                        ids[index - 1]!,
                      ];
                      reorderSections.mutate(ids);
                    }}
                  >
                    ↑
                  </button>{" "}
                  <button
                    className="text-button"
                    aria-label="Move section down"
                    disabled={
                      index === sections.length - 1 || reorderSections.isPending
                    }
                    onClick={() => {
                      const ids = sections.map((value) => value.id);
                      [ids[index], ids[index + 1]] = [
                        ids[index + 1]!,
                        ids[index]!,
                      ];
                      reorderSections.mutate(ids);
                    }}
                  >
                    ↓
                  </button>
                  <button
                    className="text-button"
                    aria-label="Add lesson"
                    onClick={() => {
                      setNewLesson({
                        sectionId: item.id,
                        title: "",
                        type: "TEXT",
                        textContent: "",
                      });
                      setCollapsedSections((current) => {
                        const next = new Set(current);
                        next.delete(item.id);
                        return next;
                      });
                    }}
                  >
                    Add lesson
                  </button>
                  <button
                    className="danger-link menu-danger"
                    type="button"
                    disabled={removeSection.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete section “${item.title}” and all of its lessons, videos, and resources? This cannot be undone.`,
                        )
                      )
                        removeSection.mutate(item.id);
                    }}
                  >
                    Delete section
                  </button>
                </div>
              </details>
            </div>
            {!collapsedSections.has(item.id) &&
              item.lessons.map((itemLesson, lessonIndex, lessons) => (
                <div
                  className="lesson-row tree-lesson"
                  key={itemLesson.id}
                  draggable
                  onDragStart={() => setDraggedLesson(itemLesson.id)}
                  onDragEnd={() => setDraggedLesson(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (!draggedLesson || draggedLesson === itemLesson.id)
                      return;
                    const ids = lessons.map((value) => value.id);
                    const from = ids.indexOf(draggedLesson);
                    const to = lessonIndex;
                    if (from < 0) return;
                    ids.splice(from, 1);
                    ids.splice(to, 0, draggedLesson);
                    reorderLessons.mutate({ sectionId: item.id, ids });
                    setDraggedLesson(null);
                  }}
                  data-dragging={
                    draggedLesson === itemLesson.id ? "true" : undefined
                  }
                  ref={(node) => {
                    lessonRefs.current[itemLesson.id] = node;
                  }}
                >
                  <div className="lesson-main">
                    <span className="lesson-drag-handle" aria-hidden="true">
                      ::
                    </span>
                    <span className="lesson-index">
                      {String(lessonIndex + 1).padStart(2, "0")}
                    </span>
                    <div className="lesson-copy">
                      <strong>{itemLesson.title}</strong>
                      <small>
                        {itemLesson.type === "VIDEO"
                          ? "Video lesson"
                          : "Reading lesson"}
                      </small>
                    </div>
                    <span className="lesson-badge">
                      {itemLesson.type === "VIDEO" ? "Video" : "Text"}
                    </span>
                    <button
                      className="text-button"
                      onClick={() => {
                        setEditingLesson({
                          id: itemLesson.id,
                          title: itemLesson.title,
                          type: itemLesson.type,
                          textContent: itemLesson.textContent ?? "",
                        });
                        setTimeout(
                          () =>
                            lessonRefs.current[itemLesson.id]?.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            }),
                          0,
                        );
                      }}
                    >
                      Edit
                    </button>
                  </div>
                  <details className="context-menu lesson-menu">
                    <summary aria-label={`Actions for ${itemLesson.title}`}>
                      Actions
                    </summary>
                    <div className="context-menu-panel lesson-actions">
                      {itemLesson.type === "VIDEO" && (
                        <VideoUploadControl
                          token={accessToken}
                          lessonId={itemLesson.id}
                          onCompleted={() =>
                            void client.invalidateQueries({
                              queryKey: ["owner-course", courseId],
                            })
                          }
                        />
                      )}
                      <ResourceUploadControl
                        token={accessToken}
                        lessonId={itemLesson.id}
                        onCompleted={() =>
                          void client.invalidateQueries({
                            queryKey: ["owner-course", courseId],
                          })
                        }
                      />
                      <div
                        className="lesson-reorder"
                        aria-label="Reorder lesson"
                      >
                        <button
                          className="text-button"
                          aria-label="Move lesson up"
                          disabled={
                            lessonIndex === 0 || reorderLessons.isPending
                          }
                          onClick={() => {
                            const ids = lessons.map((value) => value.id);
                            [ids[lessonIndex - 1], ids[lessonIndex]] = [
                              ids[lessonIndex]!,
                              ids[lessonIndex - 1]!,
                            ];
                            reorderLessons.mutate({ sectionId: item.id, ids });
                          }}
                        >
                          ↑
                        </button>{" "}
                        <button
                          className="text-button"
                          aria-label="Move lesson down"
                          disabled={
                            lessonIndex === lessons.length - 1 ||
                            reorderLessons.isPending
                          }
                          onClick={() => {
                            const ids = lessons.map((value) => value.id);
                            [ids[lessonIndex], ids[lessonIndex + 1]] = [
                              ids[lessonIndex + 1]!,
                              ids[lessonIndex]!,
                            ];
                            reorderLessons.mutate({ sectionId: item.id, ids });
                          }}
                        >
                          ↓
                        </button>
                      </div>
                      <button
                        className="danger-link menu-danger"
                        type="button"
                        disabled={removeLesson.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete lesson “${itemLesson.title}” and all of its videos and resources? This cannot be undone.`,
                            )
                          )
                            removeLesson.mutate(itemLesson.id);
                        }}
                      >
                        Delete lesson
                      </button>
                    </div>
                  </details>
                </div>
              ))}
            {!collapsedSections.has(item.id) && (
              <button
                type="button"
                className="text-button"
                aria-label={`Add lesson to ${item.title}`}
                data-testid={`add-lesson-${item.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  console.debug("LMS add lesson clicked", item.id);
                  setDebugMessage(`Add lesson clicked for “${item.title}”.`);
                  setNewLesson({
                    sectionId: item.id,
                    title: "",
                    type: "TEXT",
                    textContent: "",
                  });
                }}
              >
                + Add lesson
              </button>
            )}
            {!collapsedSections.has(item.id) &&
              newLesson?.sectionId === item.id && (
                <div className="owner-form">
                  <h2>New lesson</h2>
                  <label>
                    Title
                    <input
                      value={newLesson.title}
                      onChange={(e) =>
                        setNewLesson({ ...newLesson, title: e.target.value })
                      }
                      placeholder="Lesson title"
                    />
                  </label>
                  <label>
                    Type
                    <select
                      value={newLesson.type}
                      onChange={(e) =>
                        setNewLesson({
                          ...newLesson,
                          type: e.target.value as "VIDEO" | "TEXT",
                        })
                      }
                    >
                      <option value="TEXT">Reading</option>
                      <option value="VIDEO">Video</option>
                    </select>
                  </label>
                  {newLesson.type === "TEXT" && (
                    <label>
                      Lesson content
                      <textarea
                        rows={5}
                        value={newLesson.textContent}
                        onChange={(e) =>
                          setNewLesson({
                            ...newLesson,
                            textContent: e.target.value,
                          })
                        }
                        placeholder="Write the lesson content"
                      />
                    </label>
                  )}
                  {createLesson.isError && (
                    <p className="form-error">
                      {createLesson.error instanceof Error
                        ? createLesson.error.message
                        : "Lesson could not be added."}
                    </p>
                  )}
                  <button
                    className="button button-primary"
                    onClick={() => createLesson.mutate()}
                    disabled={
                      !newLesson.title ||
                      (newLesson.type === "TEXT" &&
                        !newLesson.textContent.trim()) ||
                      createLesson.isPending
                    }
                  >
                    {createLesson.isPending ? "Adding…" : "Add lesson"}
                  </button>
                </div>
              )}
          </div>
        ))}
      </div>
      {editingSection && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setEditingSection(null)}
        >
          <div
            className="edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-section-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              aria-label="Close"
              onClick={() => setEditingSection(null)}
            >
              ×
            </button>
            <p className="eyebrow">Section details</p>
            <h2 id="edit-section-title">Edit section</h2>
            <p className="modal-description">
              Update how this section appears in the course curriculum.
            </p>
            <label>
              Title
              <input
                autoFocus
                value={editingSection.title}
                onChange={(e) =>
                  setEditingSection({
                    ...editingSection,
                    title: e.target.value,
                  })
                }
              />
            </label>
            <button
              className="button button-primary"
              onClick={() => updateSection.mutate()}
              disabled={updateSection.isPending}
            >
              {updateSection.isPending ? "Saving…" : "Save section"}
            </button>
          </div>
        </div>
      )}
      {editingLesson && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setEditingLesson(null)}
        >
          <div
            className="edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-lesson-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              aria-label="Close"
              onClick={() => setEditingLesson(null)}
            >
              ×
            </button>
            <p className="eyebrow">Lesson details</p>
            <h2 id="edit-lesson-title">Edit lesson</h2>
            <p className="modal-description">
              Change the lesson title, format, and learning content.
            </p>
            <label>
              Title
              <input
                autoFocus
                value={editingLesson.title}
                onChange={(e) =>
                  setEditingLesson({ ...editingLesson, title: e.target.value })
                }
              />
            </label>
            <label>
              Type
              <select
                value={editingLesson.type}
                onChange={(e) =>
                  setEditingLesson({
                    ...editingLesson,
                    type: e.target.value as "VIDEO" | "TEXT",
                  })
                }
              >
                <option value="TEXT">Reading</option>
                <option value="VIDEO">Video</option>
              </select>
            </label>
            {editingLesson.type === "TEXT" && (
              <label>
                Lesson content
                <textarea
                  rows={6}
                  value={editingLesson.textContent}
                  onChange={(e) =>
                    setEditingLesson({
                      ...editingLesson,
                      textContent: e.target.value,
                    })
                  }
                />
              </label>
            )}
            <button
              className="button button-primary"
              onClick={() => updateLesson.mutate()}
              disabled={
                updateLesson.isPending ||
                (editingLesson.type === "TEXT" &&
                  !editingLesson.textContent.trim())
              }
            >
              {updateLesson.isPending ? "Saving…" : "Save lesson"}
            </button>
          </div>
        </div>
      )}
      <div className="owner-form enrollment-panel">
        <h2>Course access</h2>
        <label>
          Grant access
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          >
            <option value="">Choose a student</option>
            {students.data?.items.map((student) => (
              <option key={student.id} value={student.id}>
                {student.firstName} {student.lastName} — {student.email}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button button-primary"
          onClick={() => grant.mutate()}
          disabled={!studentId || grant.isPending}
        >
          {grant.isPending ? "Granting…" : "Grant access"}
        </button>
        {enrollments.data?.items.map((enrollment) => (
          <div className="lesson-row" key={enrollment.id}>
            <span>
              {students.data?.items.find(
                (student) => student.id === enrollment.userId,
              )?.email ?? enrollment.userId}
            </span>
            <button
              className="text-button"
              onClick={() => revoke.mutate(enrollment.id)}
              disabled={revoke.isPending}
            >
              {enrollment.status === "ACTIVE" ? "Revoke" : enrollment.status}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
