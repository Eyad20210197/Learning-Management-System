import { Link } from "react-router-dom";

type ParentPageLinkProps = {
  label: string;
  to: string;
};

export function ParentPageLink({ label, to }: ParentPageLinkProps) {
  return (
    <Link className="parent-page-link" to={to} aria-label={label} title={label}>
      <svg
        aria-hidden="true"
        fill="none"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M15 18 9 12l6-6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    </Link>
  );
}
