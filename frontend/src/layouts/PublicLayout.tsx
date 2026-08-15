import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../app/auth";

export function PublicLayout() {
  const { user } = useAuth();
  const location = useLocation();

  if (location.pathname === "/") return <Outlet />;

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <Link className="brand" to="/" aria-label="LMS home">
          lms<span>.</span>
        </Link>
        <nav className="header-nav">
          {user?.roles.includes("OWNER") && (
            <Link className="header-link" to="/owner/courses">
              Workspace
            </Link>
          )}
          {user?.roles.includes("OWNER") && (
            <Link className="header-link" to="/owner/operations">
              Operations
            </Link>
          )}
          <Link className="header-link" to={user ? "/learn" : "/login"}>
            {user ? "My learning" : "Log in"}
          </Link>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">Learn with intention.</footer>
    </div>
  );
}
