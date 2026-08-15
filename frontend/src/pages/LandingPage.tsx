import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function LandingPage() {
  return (
    <section className="landing page-container">
      <div className="landing-copy">
        <p className="eyebrow">A quieter way to learn</p>
        <h1>Make room for what matters.</h1>
        <p className="lede">
          Focused courses, thoughtful progress, and one clear place to keep
          moving forward.
        </p>
        <div className="landing-actions">
          <Link className="button button-primary" to="/login">
            Start learning <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link className="text-link" to="/register">
            Create an account
          </Link>
        </div>
      </div>
      <aside className="welcome-card" aria-label="Learning note">
        <span className="card-mark" aria-hidden="true">
          ✦
        </span>
        <p>
          Open a lesson.
          <br />
          Pick up where you left off.
        </p>
        <span className="card-caption">Your next step is always close.</span>
      </aside>
    </section>
  );
}
