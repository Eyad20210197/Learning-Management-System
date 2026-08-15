import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import Lightfall from "../components/landing/Lightfall";
import AnimatedContent from "../components/landing/reactbits/AnimatedContent";
import BlurText from "../components/landing/reactbits/BlurText";
import Magnet from "../components/landing/reactbits/Magnet";
import SpotlightCard from "../components/landing/reactbits/SpotlightCard";
import stackArtwork from "../assets/firstcommit-hero.png";
import "../styles/firstcommit-landing.css";

type IconName =
  | "arrow"
  | "check"
  | "clock"
  | "code"
  | "layers"
  | "menu"
  | "play"
  | "project"
  | "spark"
  | "terminal"
  | "x";

type Course = {
  id: string;
  category: "crash" | "path";
  language: string;
  title: string;
  description: string;
  duration: string;
  projects: string;
  lessonCount: number;
  accent: string;
  softAccent: string;
  lessons: string[];
  code: string[];
  output: string;
};

const LIGHTFALL_COLORS = ["#B69CFF", "#7452FF", "#BFFF68"];

const courses: Course[] = [
  {
    id: "python",
    category: "crash",
    language: "PY",
    title: "Python: Zero to First Project",
    description:
      "Learn variables, loops, functions, and files by building a useful command-line app.",
    duration: "3 hours",
    projects: "6 mini projects",
    lessonCount: 18,
    accent: "#8f6cff",
    softAccent: "#eee9ff",
    lessons: [
      "Meet Python",
      "Variables that make sense",
      "Make decisions",
      "Build a grade tracker",
    ],
    code: [
      "scores = [84, 91, 78, 96]",
      "average = sum(scores) / len(scores)",
      "",
      "if average >= 90:",
      '    print("You crushed it ✨")',
      "else:",
      '    print("Keep building!")',
    ],
    output: "Average: 87.25  ·  Keep building!",
  },
  {
    id: "web",
    category: "path",
    language: "JS",
    title: "Web Basics: HTML, CSS & JS",
    description:
      "Build and publish your first responsive webpage while learning how the browser works.",
    duration: "4 hours",
    projects: "5 real builds",
    lessonCount: 24,
    accent: "#ee7b4d",
    softAccent: "#fff0e9",
    lessons: [
      "How websites work",
      "Your first HTML page",
      "Make it look good",
      "Add interaction",
    ],
    code: [
      'const button = document.querySelector("button")',
      "",
      'button.addEventListener("click", () => {',
      '  button.textContent = "You did it!"',
      '  document.body.classList.add("launched")',
      "})",
    ],
    output: "✓ Event connected. Your page is interactive.",
  },
  {
    id: "cpp",
    category: "crash",
    language: "C++",
    title: "C++ Crash Course",
    description:
      "Go from your first program to functions, arrays, and confident problem-solving.",
    duration: "3.5 hours",
    projects: "40 exercises",
    lessonCount: 21,
    accent: "#178f87",
    softAccent: "#e4f6f3",
    lessons: [
      "Hello, C++",
      "Values and variables",
      "Control the flow",
      "Build a number game",
    ],
    code: [
      "#include <iostream>",
      "using namespace std;",
      "",
      "int main() {",
      '  cout << "First commit complete!";',
      "  return 0;",
      "}",
    ],
    output: "First commit complete!",
  },
];

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    check: <path d="m5 12 4 4L19 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    code: <path d="m8.5 7-5 5 5 5m7-10 5 5-5 5m-2.5-12-3 14" />,
    layers: (
      <>
        <path d="m12 3-9 5 9 5 9-5-9-5Z" />
        <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    play: <path d="m9 7 8 5-8 5V7Z" />,
    project: (
      <>
        <rect x="3" y="5" width="18" height="15" rx="3" />
        <path d="M8 5V3m8 2V3M3 10h18m-13 4h3m2 0h3" />
      </>
    ),
    spark: (
      <path d="m12 2 1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Zm7 13 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
    ),
    terminal: (
      <>
        <rect x="2.5" y="4" width="19" height="16" rx="3" />
        <path d="m6 9 3 3-3 3m6 0h5" />
      </>
    ),
    x: <path d="M6 6l12 12M18 6 6 18" />,
  };

  return (
    <svg
      aria-hidden="true"
      className="fc-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export function FirstCommitLandingPage() {
  const [activeFilter, setActiveFilter] = useState<"all" | "crash" | "path">(
    "all",
  );
  const [activeCourseId, setActiveCourseId] = useState("python");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const courseGridRef = useRef<HTMLDivElement>(null);

  const activeCourse =
    courses.find((course) => course.id === activeCourseId) ?? courses[0]!;
  const visibleCourses = useMemo(
    () =>
      courses.filter(
        (course) => activeFilter === "all" || course.category === activeFilter,
      ),
    [activeFilter],
  );

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    const desktopQuery = window.matchMedia("(min-width: 761px)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileMenuOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    desktopQuery.addEventListener("change", closeOnDesktop);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      desktopQuery.removeEventListener("change", closeOnDesktop);
    };
  }, [mobileMenuOpen]);

  const previewCourse = (courseId: string) => {
    setActiveCourseId(courseId);
    document
      .getElementById("top")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    courseGridRef.current?.scrollTo({
      left: 0,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [activeFilter]);

  return (
    <div className="fc-site-shell">
      <a className="fc-skip-link" href="#top">
        Skip to content
      </a>
      <header className="fc-site-header">
        <a
          className="fc-brand"
          href="#top"
          aria-label="FirstCommit home"
          onClick={() => setMobileMenuOpen(false)}
        >
          <span className="fc-brand-mark" aria-hidden="true">
            <span>&lt;</span>
            <span className="fc-brand-slash">/</span>
            <span>&gt;</span>
          </span>
          <span>FirstCommit</span>
        </a>

        <button
          className="fc-mobile-menu-button"
          type="button"
          aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileMenuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <Icon name={mobileMenuOpen ? "x" : "menu"} size={22} />
        </button>

        <nav
          id="primary-navigation"
          className={mobileMenuOpen ? "fc-main-nav is-open" : "fc-main-nav"}
          aria-label="Primary navigation"
        >
          <a href="#courses" onClick={() => setMobileMenuOpen(false)}>
            Courses
          </a>
          <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>
            How it works
          </a>
          <a href="#why-firstcommit" onClick={() => setMobileMenuOpen(false)}>
            Why us
          </a>
          <a href="#faq" onClick={() => setMobileMenuOpen(false)}>
            FAQ
          </a>
          <Link
            className="fc-mobile-nav-cta"
            to="/login"
            onClick={() => setMobileMenuOpen(false)}
          >
            Start learning free <Icon name="arrow" size={16} />
          </Link>
        </nav>

        <div className="fc-header-actions">
          <a className="fc-text-link" href="#courses">
            Browse courses
          </a>
          <Magnet padding={36} magnetStrength={5}>
            <Link
              className="fc-button fc-button-small fc-button-lime"
              to="/login"
            >
              Start free <Icon name="arrow" size={16} />
            </Link>
          </Magnet>
        </div>
      </header>

      {mobileMenuOpen && (
        <button
          className="fc-menu-backdrop"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <main id="top">
        <section className="fc-hero-section">
          <div className="fc-hero-lightfall" aria-hidden="true">
            <Lightfall
              dpr={1.25}
              colors={LIGHTFALL_COLORS}
              backgroundColor="#090a0f"
              speed={0.32}
              streakCount={3}
              streakWidth={0.65}
              streakLength={0.8}
              glow={0.9}
              density={0.5}
              twinkle={0.65}
              zoom={3.5}
              backgroundGlow={0.15}
              opacity={0.82}
              mouseInteraction
              mouseStrength={0.25}
              mouseRadius={0.7}
            />
          </div>
          <div className="fc-hero-noise" aria-hidden="true" />

          <div className="fc-hero-inner fc-section-inner">
            <div className="fc-hero-copy">
              <AnimatedContent distance={30} duration={0.65}>
                <div className="fc-eyebrow">
                  <span className="fc-eyebrow-dot" /> Beginner mode: on
                </div>
              </AnimatedContent>
              <h1 className="fc-sr-only">
                Your first line of code starts here.
              </h1>
              <div className="fc-hero-title" aria-hidden="true">
                <BlurText
                  text="Your first line"
                  className="fc-hero-title-line"
                  delay={80}
                  direction="bottom"
                />
                <BlurText
                  text="of code starts here."
                  className="fc-hero-title-line fc-hero-title-accent"
                  delay={72}
                  direction="bottom"
                />
              </div>
              <AnimatedContent distance={28} duration={0.7} delay={0.35}>
                <p className="fc-hero-description">
                  Short, practical programming courses for students and complete
                  beginners. Learn the essentials, build something real, and
                  understand what your code is doing.
                </p>
                <div className="fc-hero-actions">
                  <Magnet padding={70} magnetStrength={5}>
                    <Link className="fc-button fc-button-primary" to="/login">
                      Start learning free <Icon name="arrow" />
                    </Link>
                  </Magnet>
                  <button
                    className="fc-button fc-button-ghost"
                    type="button"
                    onClick={() => previewCourse("python")}
                  >
                    <span className="fc-play-chip">
                      <Icon name="play" size={14} />
                    </span>{" "}
                    Preview a lesson
                  </button>
                </div>
                <ul className="fc-trust-list" aria-label="Course benefits">
                  <li>
                    <Icon name="check" size={15} /> No experience needed
                  </li>
                  <li>
                    <Icon name="check" size={15} /> Learn at your pace
                  </li>
                  <li>
                    <Icon name="check" size={15} /> Real coding projects
                  </li>
                </ul>
              </AnimatedContent>
            </div>

            <AnimatedContent
              className="fc-hero-visual-reveal"
              distance={60}
              direction="horizontal"
              reverse
              duration={1}
              delay={0.15}
            >
              <div className="fc-hero-visual" id="course-preview">
                <img
                  className="fc-stack-artwork"
                  src={stackArtwork}
                  alt=""
                  aria-hidden="true"
                />
                <div className="fc-floating-tag fc-floating-tag-top">
                  <span className="fc-tag-icon">
                    <Icon name="spark" size={15} />
                  </span>
                  <span>
                    <strong>Zero jargon</strong> explanations
                  </span>
                </div>

                <div className="fc-course-window">
                  <div className="fc-window-topbar">
                    <div className="fc-window-dots" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="fc-window-address">
                      learn.firstcommit.dev/{activeCourse.id}
                    </div>
                    <span className="fc-window-live">
                      <span /> LIVE
                    </span>
                  </div>

                  <div className="fc-course-window-body" key={activeCourse.id}>
                    <aside
                      className="fc-lesson-sidebar"
                      aria-label={`${activeCourse.title} lesson preview`}
                    >
                      <div className="fc-sidebar-kicker">CURRENT COURSE</div>
                      <div className="fc-sidebar-course-title">
                        <span
                          style={{
                            backgroundColor: activeCourse.softAccent,
                            color: activeCourse.accent,
                          }}
                        >
                          {activeCourse.language}
                        </span>
                        <strong>{activeCourse.title}</strong>
                      </div>
                      <div className="fc-lesson-progress-label">
                        <span>Course progress</span>
                        <strong>32%</strong>
                      </div>
                      <div className="fc-lesson-progress">
                        <span
                          style={{
                            width: "32%",
                            backgroundColor: activeCourse.accent,
                          }}
                        />
                      </div>
                      <div className="fc-lesson-list">
                        {activeCourse.lessons.map((lesson, index) => (
                          <div
                            className={
                              index === 2
                                ? "fc-lesson-item is-active"
                                : "fc-lesson-item"
                            }
                            key={lesson}
                          >
                            <span
                              className={
                                index < 2
                                  ? "fc-lesson-status is-done"
                                  : "fc-lesson-status"
                              }
                            >
                              {index < 2 ? (
                                <Icon name="check" size={12} />
                              ) : (
                                String(index + 1).padStart(2, "0")
                              )}
                            </span>
                            <span>{lesson}</span>
                          </div>
                        ))}
                      </div>
                    </aside>

                    <div className="fc-coding-area">
                      <div className="fc-lesson-heading-row">
                        <div>
                          <span>LESSON 03</span>
                          <h2>Make the computer decide</h2>
                        </div>
                        <span className="fc-lesson-time">
                          <Icon name="clock" size={14} /> 8 min
                        </span>
                      </div>
                      <div className="fc-editor-card">
                        <div className="fc-editor-tabs">
                          <span className="fc-editor-tab is-active">
                            main.
                            {activeCourse.id === "python"
                              ? "py"
                              : activeCourse.id === "web"
                                ? "js"
                                : "cpp"}
                          </span>
                          <span className="fc-editor-language">
                            {activeCourse.language}
                          </span>
                        </div>
                        <div
                          className="fc-code-editor"
                          aria-label="Code example"
                        >
                          <div className="fc-line-numbers" aria-hidden="true">
                            {activeCourse.code.map((_, index) => (
                              <span key={index}>{index + 1}</span>
                            ))}
                          </div>
                          <pre>{activeCourse.code.join("\n")}</pre>
                        </div>
                        <div className="fc-editor-footer">
                          <button type="button" className="fc-run-button">
                            <Icon name="play" size={13} /> Run code
                          </button>
                          <span>Saved just now</span>
                        </div>
                      </div>
                      <div className="fc-console-card">
                        <div>
                          <Icon name="terminal" size={14} /> OUTPUT
                        </div>
                        <code>{activeCourse.output}</code>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="fc-floating-tag fc-floating-tag-bottom">
                  <span className="fc-progress-ring">3</span>
                  <span>
                    <strong>3 of 8</strong> lessons committed
                  </span>
                </div>
              </div>
            </AnimatedContent>
          </div>

          <div className="fc-hero-strip fc-section-inner">
            <div>
              <Icon name="clock" />
              <span>
                <strong>15-minute</strong> focused lessons
              </span>
            </div>
            <div>
              <Icon name="code" />
              <span>
                <strong>Code from</strong> lesson one
              </span>
            </div>
            <div>
              <Icon name="project" />
              <span>
                <strong>Projects</strong> you can keep
              </span>
            </div>
            <div>
              <Icon name="layers" />
              <span>
                <strong>Clear paths</strong> with no guessing
              </span>
            </div>
          </div>
        </section>

        <section className="fc-courses-section fc-section-pad" id="courses">
          <div className="fc-section-inner">
            <AnimatedContent distance={42}>
              <div className="fc-section-heading fc-split-heading">
                <div>
                  <div className="fc-section-label">// CHOOSE_YOUR_PATH</div>
                  <h2>Start small. Build something.</h2>
                  <p>
                    Pick one goal and get to a real result without a 40-hour
                    commitment.
                  </p>
                </div>
                <div
                  className="fc-filter-tabs"
                  role="group"
                  aria-label="Filter courses"
                >
                  {(
                    [
                      ["all", "All courses"],
                      ["crash", "Crash courses"],
                      ["path", "Learning paths"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={activeFilter === value ? "is-active" : ""}
                      aria-pressed={activeFilter === value}
                      onClick={() => setActiveFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </AnimatedContent>

            <p className="fc-mobile-swipe-hint">
              <span>Swipe to explore courses</span>
              <Icon name="arrow" size={14} />
            </p>
            <div
              ref={courseGridRef}
              className="fc-course-grid"
              role="region"
              aria-label="Available courses"
              tabIndex={0}
            >
              {visibleCourses.map((course, index) => (
                <AnimatedContent
                  key={course.id}
                  distance={48}
                  delay={index * 0.1}
                >
                  <SpotlightCard
                    className="fc-course-card"
                    spotlightColor={`${course.accent}28`}
                  >
                    <div
                      className="fc-course-accent-bar"
                      style={{ backgroundColor: course.accent }}
                    />
                    <div className="fc-course-card-top">
                      <span className="fc-course-number">
                        0
                        {courses.findIndex((item) => item.id === course.id) + 1}
                      </span>
                      <span className="fc-course-level">
                        <span /> Beginner
                      </span>
                    </div>
                    <div
                      className="fc-course-logo"
                      style={{
                        backgroundColor: course.softAccent,
                        color: course.accent,
                      }}
                    >
                      {course.language}
                    </div>
                    <h3>{course.title}</h3>
                    <p>{course.description}</p>
                    <div className="fc-course-meta">
                      <span>
                        <Icon name="clock" size={15} /> {course.duration}
                      </span>
                      <span>
                        <Icon name="project" size={15} /> {course.projects}
                      </span>
                    </div>
                    <div className="fc-course-card-footer">
                      <span>{course.lessonCount} bite-sized lessons</span>
                      <button
                        type="button"
                        onClick={() => previewCourse(course.id)}
                      >
                        Preview <Icon name="arrow" size={16} />
                      </button>
                    </div>
                  </SpotlightCard>
                </AnimatedContent>
              ))}
            </div>
          </div>
        </section>

        <section
          className="fc-process-section fc-section-pad"
          id="how-it-works"
        >
          <div className="fc-section-inner fc-process-layout">
            <AnimatedContent
              className="fc-process-copy"
              direction="horizontal"
              distance={55}
              reverse
            >
              <div className="fc-section-label fc-section-label-light">
                // HOW_IT_WORKS
              </div>
              <h2>
                Less watching.
                <br />
                More becoming.
              </h2>
              <p>
                Each lesson closes the gap between “I get it” and “I can do it.”
                Learn one idea, use it immediately, then keep what you build.
              </p>
              <a href="#get-started" className="fc-inline-link">
                See your first week <Icon name="arrow" size={16} />
              </a>
            </AnimatedContent>

            <div className="fc-process-steps">
              {[
                [
                  "01",
                  "spark" as IconName,
                  "Understand",
                  "Plain-English explanations with visual examples and zero assumed knowledge.",
                ],
                [
                  "02",
                  "code" as IconName,
                  "Write code",
                  "Small exercises inside every lesson, with helpful feedback when you get stuck.",
                ],
                [
                  "03",
                  "project" as IconName,
                  "Ship a project",
                  "Turn the concepts into something real you can share, improve, and feel proud of.",
                ],
              ].map(([number, icon, title, copy], index) => (
                <AnimatedContent
                  key={number}
                  distance={42}
                  delay={index * 0.12}
                >
                  <article>
                    <div className="fc-step-index">{number}</div>
                    <div className="fc-step-icon">
                      <Icon name={icon as IconName} size={22} />
                    </div>
                    <div>
                      <h3>{title}</h3>
                      <p>{copy}</p>
                    </div>
                  </article>
                </AnimatedContent>
              ))}
            </div>
          </div>
        </section>

        <section className="fc-why-section fc-section-pad" id="why-firstcommit">
          <div className="fc-section-inner">
            <AnimatedContent>
              <div className="fc-section-heading fc-centered-heading">
                <div className="fc-section-label">// BUILT_FOR_BEGINNERS</div>
                <h2>
                  No experience found.
                  <br />
                  <span>Perfect place to start.</span>
                </h2>
                <p>
                  Everything is designed around the questions beginners actually
                  have.
                </p>
              </div>
            </AnimatedContent>

            <p className="fc-mobile-swipe-hint">
              <span>Swipe to explore benefits</span>
              <Icon name="arrow" size={14} />
            </p>
            <div
              className="fc-feature-grid"
              role="region"
              aria-label="Why FirstCommit works for beginners"
              tabIndex={0}
            >
              <AnimatedContent className="fc-feature-large-wrap" distance={50}>
                <SpotlightCard
                  className="fc-feature-card fc-feature-card-large"
                  spotlightColor="rgba(143, 108, 255, .15)"
                >
                  <div className="fc-feature-icon">
                    <Icon name="code" />
                  </div>
                  <h3>Code from lesson one</h3>
                  <p>
                    Every concept becomes a small exercise or project—not
                    another hour of passive watching.
                  </p>
                  <div className="fc-mini-code">
                    <div>
                      <span>1</span>
                      <code>
                        message = <b>"I made this"</b>
                      </code>
                    </div>
                    <div>
                      <span>2</span>
                      <code>
                        print(message) <i># nice.</i>
                      </code>
                    </div>
                  </div>
                </SpotlightCard>
              </AnimatedContent>

              <AnimatedContent distance={50} delay={0.1}>
                <SpotlightCard
                  className="fc-feature-card"
                  spotlightColor="rgba(238, 123, 77, .14)"
                >
                  <div className="fc-feature-icon fc-feature-icon-orange">
                    <Icon name="spark" />
                  </div>
                  <h3>Clear enough for day one</h3>
                  <p>
                    No unexplained jargon. See what the code does, why it works,
                    and where it fits.
                  </p>
                  <div className="fc-clarity-meter">
                    <span>Confusion</span>
                    <div>
                      <i />
                    </div>
                    <strong>Clarity</strong>
                  </div>
                </SpotlightCard>
              </AnimatedContent>

              <AnimatedContent distance={50} delay={0.18}>
                <SpotlightCard
                  className="fc-feature-card"
                  spotlightColor="rgba(23, 143, 135, .14)"
                >
                  <div className="fc-feature-icon fc-feature-icon-green">
                    <Icon name="clock" />
                  </div>
                  <h3>Fits around student life</h3>
                  <p>
                    Focused lessons and natural stopping points make learning
                    easy to return to.
                  </p>
                  <div className="fc-week-row">
                    {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
                      <span
                        className={
                          index < 4
                            ? "is-complete"
                            : index === 4
                              ? "is-today"
                              : ""
                        }
                        key={`${day}-${index}`}
                      >
                        {day}
                      </span>
                    ))}
                  </div>
                </SpotlightCard>
              </AnimatedContent>
            </div>
          </div>
        </section>

        <section className="fc-friction-section fc-section-pad">
          <AnimatedContent className="fc-section-inner" distance={55}>
            <div className="fc-friction-card">
              <div className="fc-quote-mark" aria-hidden="true">
                “
              </div>
              <div>
                <div className="fc-section-label">THE PROBLEM WE BUILT FOR</div>
                <blockquote>
                  I understand the tutorial. Then I open the editor and freeze.
                </blockquote>
                <p>
                  FirstCommit turns every explanation into a guided action, so
                  you never face the blank screen alone.
                </p>
              </div>
              <div className="fc-friction-solution">
                <span>
                  <Icon name="check" size={15} /> A clear next step
                </span>
                <span>
                  <Icon name="check" size={15} /> Hints when you need them
                </span>
                <span>
                  <Icon name="check" size={15} /> A finished project at the end
                </span>
              </div>
            </div>
          </AnimatedContent>
        </section>

        <section className="fc-faq-section fc-section-pad" id="faq">
          <div className="fc-section-inner fc-faq-layout">
            <AnimatedContent
              className="fc-section-heading"
              direction="horizontal"
              reverse
              distance={45}
            >
              <div className="fc-section-label">// QUICK_ANSWERS</div>
              <h2>Before you start.</h2>
              <p>Still unsure where to begin? That is completely normal.</p>
            </AnimatedContent>
            <AnimatedContent
              className="fc-faq-list"
              direction="horizontal"
              distance={45}
            >
              <details name="firstcommit-faq">
                <summary>Do I need any coding experience?</summary>
                <p>
                  No. Beginner courses start with setup and the smallest useful
                  concepts, then build from there.
                </p>
              </details>
              <details name="firstcommit-faq">
                <summary>Which language should I learn first?</summary>
                <p>
                  Choose Python for a gentle general introduction, JavaScript
                  for websites, or C++ for deeper fundamentals.
                </p>
              </details>
              <details name="firstcommit-faq">
                <summary>Are these full courses or quick tutorials?</summary>
                <p>
                  Both formats exist: focused crash courses for a fast win and
                  guided paths for deeper learning.
                </p>
              </details>
            </AnimatedContent>
          </div>
        </section>

        <section className="fc-cta-section" id="get-started">
          <div className="fc-cta-glow" aria-hidden="true" />
          <AnimatedContent
            className="fc-section-inner fc-cta-content"
            distance={48}
          >
            <span className="fc-cta-prompt">firstcommit@learn:~$ start</span>
            <h2>
              Ready to make your
              <br />
              first commit?
            </h2>
            <p>Get the launch note and choose your first beginner course.</p>
            <Magnet padding={48} magnetStrength={5}>
              <Link className="fc-button fc-button-lime" to="/login">
                Start learning <Icon name="arrow" />
              </Link>
            </Magnet>
            <small>No credit card. Start with a free course.</small>
          </AnimatedContent>
        </section>
      </main>

      <footer className="fc-site-footer">
        <div className="fc-section-inner fc-footer-inner">
          <a className="fc-brand" href="#top" aria-label="FirstCommit home">
            <span className="fc-brand-mark" aria-hidden="true">
              <span>&lt;</span>
              <span className="fc-brand-slash">/</span>
              <span>&gt;</span>
            </span>
            <span>FirstCommit</span>
          </a>
          <p>Practical programming for your very first build.</p>
          <div className="fc-footer-links">
            <a href="#courses">Courses</a>
            <a href="#how-it-works">How it works</a>
            <a href="#faq">FAQ</a>
          </div>
          <span className="fc-copyright">© 2026 FirstCommit</span>
        </div>
      </footer>
    </div>
  );
}

export default FirstCommitLandingPage;
