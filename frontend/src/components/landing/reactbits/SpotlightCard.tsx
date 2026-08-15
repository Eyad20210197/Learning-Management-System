import { useRef, type MouseEventHandler, type PropsWithChildren } from "react";
import "./SpotlightCard.css";

interface SpotlightCardProps extends PropsWithChildren {
  className?: string;
  spotlightColor?: string;
}

export default function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(143, 108, 255, 0.16)",
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove: MouseEventHandler<HTMLDivElement> = (event) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const style = cardRef.current.style;
    style.setProperty("--mouse-x", `${event.clientX - rect.left}px`);
    style.setProperty("--mouse-y", `${event.clientY - rect.top}px`);
    style.setProperty("--spotlight-color", spotlightColor);
  };

  return (
    <div
      ref={cardRef}
      className={`fc-card-spotlight ${className}`}
      onMouseMove={handleMouseMove}
    >
      {children}
    </div>
  );
}
