import {
  Component,
  type ErrorInfo,
  type PropsWithChildren,
  type ReactNode,
} from "react";

export class ErrorBoundary extends Component<
  PropsWithChildren,
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* Error reporting is wired in F8. */
  }
  render(): ReactNode {
    if (this.state.failed)
      return (
        <main className="error-page">
          <p className="eyebrow">A small pause</p>
          <h1>Something needs a refresh.</h1>
          <button
            className="button button-primary"
            onClick={() => window.location.reload()}
          >
            Refresh
          </button>
        </main>
      );
    return this.props.children;
  }
}
