import { render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { FirstCommitLandingPage } from "./FirstCommitLandingPage";

vi.mock("../components/landing/Lightfall", () => ({
  default: () => <div aria-hidden="true" />,
}));
vi.mock("../components/landing/reactbits/AnimatedContent", () => ({
  default: ({
    children,
    className,
  }: PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
}));
vi.mock("../components/landing/reactbits/BlurText", () => ({
  default: ({ text, className }: { text: string; className?: string }) => (
    <p className={className}>{text}</p>
  ),
}));
vi.mock("../components/landing/reactbits/Magnet", () => ({
  default: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));
vi.mock("../components/landing/reactbits/SpotlightCard", () => ({
  default: ({
    children,
    className,
  }: PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
}));

describe("FirstCommitLandingPage", () => {
  it("offers real login routes from its primary calls to action", () => {
    render(
      <MemoryRouter>
        <FirstCommitLandingPage />
      </MemoryRouter>,
    );

    const callsToAction = screen.getAllByRole("link", {
      name: /start (free|learning)/i,
    });
    expect(callsToAction.length).toBeGreaterThan(2);
    expect(
      callsToAction.every((link) => link.getAttribute("href") === "/login"),
    ).toBe(true);
  });
});
