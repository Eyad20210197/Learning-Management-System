import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { PublicLayout } from "./layouts/PublicLayout";
import { LoginPage } from "./pages/LoginPage";
import { LearnPage } from "./pages/LearnPage";
import { CoursePage } from "./pages/CoursePage";
import { LessonPage } from "./pages/LessonPage";
import { OwnerCoursesPage } from "./pages/OwnerCoursesPage";
import { OwnerCourseEditorPage } from "./pages/OwnerCourseEditorPage";
import { OwnerOperationsPage } from "./pages/OwnerOperationsPage";

const FirstCommitLandingPage = lazy(
  () => import("./pages/FirstCommitLandingPage"),
);

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route
          path="/"
          element={
            <Suspense
              fallback={
                <div className="route-loading" role="status">
                  Opening FirstCommit…
                </div>
              }
            >
              <FirstCommitLandingPage />
            </Suspense>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<LoginPage mode="register" />} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="/learn/courses/:courseId" element={<CoursePage />} />
        <Route path="/learn/lessons/:lessonId" element={<LessonPage />} />
        <Route path="/owner/courses" element={<OwnerCoursesPage />} />
        <Route
          path="/owner/courses/:courseId"
          element={<OwnerCourseEditorPage />}
        />
        <Route path="/owner/operations" element={<OwnerOperationsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
