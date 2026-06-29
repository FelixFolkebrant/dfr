import type { FileStatus } from "../../../src/git/GitBackend";

interface IconProps {
  className?: string;
}

export function BranchArrowIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      height="16"
      viewBox="0 0 16 16"
      width="16"
    >
      <path d="M2.5 8h11m-3-3 3 3-3 3" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      height="16"
      viewBox="0 0 16 16"
      width="16"
    >
      <path d="m3 8 3 3 7-7" />
    </svg>
  );
}

export function DropdownIcon() {
  return (
    <svg aria-hidden="true" height="16" viewBox="0 0 16 16" width="16">
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}

export function FolderChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      className="file-tree-chevron"
      height="16"
      viewBox="0 0 16 16"
      width="16"
    >
      <path d="m5.75 3.5 4.5 4.5-4.5 4.5" />
    </svg>
  );
}

export function FileStatusIcon({ status }: { status: FileStatus }) {
  return (
    <svg
      aria-hidden="true"
      className="file-status-icon"
      height="16"
      viewBox="0 0 16 16"
      width="16"
    >
      {status === "added" && <path d="M8 3v10M3 8h10" />}
      {status === "deleted" && <path d="M3 8h10" />}
      {status === "modified" && (
        <circle cx="8" cy="8" fill="currentColor" r="2.5" stroke="none" />
      )}
      {status === "renamed" && (
        <path d="M2.5 5.5h9m-2.5-3 3 3-3 3m4.5 2h-9m2.5-3-3 3 3 3" />
      )}
      {status === "unknown" && (
        <path d="M6 5.5A2 2 0 0 1 8 4c1.2 0 2 .7 2 1.7 0 1.3-2 1.6-2 3M8 12h.01" />
      )}
    </svg>
  );
}
