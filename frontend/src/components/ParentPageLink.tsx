import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";

type ParentPageLinkProps = {
  label: string;
  to: string;
};

export function ParentPageLink({ label, to }: ParentPageLinkProps) {
  return (
    <Link className="parent-page-link" to={to} aria-label={label} title={label}>
      <ChevronLeft aria-hidden="true" strokeWidth={1.9} />
    </Link>
  );
}
