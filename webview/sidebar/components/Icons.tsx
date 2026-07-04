import type { FileStatus } from "../../../src/git/GitBackend";

interface IconProps {
  className?: string;
}

const strokeIcon =
  "fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.5]";

export function BranchArrowIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={`${strokeIcon} ${className ?? ""}`}
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
      className={`${strokeIcon} ${className ?? ""}`}
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
    <svg
      aria-hidden="true"
      className={strokeIcon}
      height="16"
      viewBox="0 0 16 16"
      width="16"
    >
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      className={strokeIcon}
      height="16"
      viewBox="0 0 16 16"
      width="16"
    >
      <rect height="9" rx="1" width="8" x="5" y="4" />
      <path d="M3 11H2.5A1.5 1.5 0 0 1 1 9.5v-7A1.5 1.5 0 0 1 2.5 1h6A1.5 1.5 0 0 1 10 2.5V3" />
    </svg>
  );
}

export function GearIcon() {
  return (
    <svg
      aria-hidden="true"
      className={strokeIcon}
      height="18"
      viewBox="0 0 16 16"
      width="18"
    >
      <path d="M6.7 1.8h2.6l.4 1.6c.3.1.6.3.9.5l1.6-.5 1.3 2.2-1.2 1.1v1.1l1.2 1.1-1.3 2.2-1.6-.5-.9.5-.4 1.6H6.7l-.4-1.6-.9-.5-1.6.5-1.3-2.2 1.2-1.1V6.7L2.5 5.6l1.3-2.2 1.6.5.9-.5.4-1.6Z" />
      <circle cx="8" cy="7.8" r="2.1" />
    </svg>
  );
}

export function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      className={strokeIcon}
      height="18"
      viewBox="0 0 16 16"
      width="18"
    >
      <path d={direction === "left" ? "m10 3-5 5 5 5" : "m6 3 5 5-5 5"} />
    </svg>
  );
}

export function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`${strokeIcon} shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
      data-expanded={expanded}
      height="16"
      viewBox="0 0 16 16"
      width="16"
    >
      <path d="m6 3 5 5-5 5" />
    </svg>
  );
}

export function FolderChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`${strokeIcon} text-[var(--vscode-icon-foreground)] transition-transform ${expanded ? "rotate-90" : ""}`}
      height="16"
      viewBox="0 0 16 16"
      width="16"
    >
      <path d="m5.75 3.5 4.5 4.5-4.5 4.5" />
    </svg>
  );
}

export function FileStatusIcon({ status }: { status: FileStatus }) {
  if (status !== "added" && status !== "deleted") {
    return null;
  }

  const color =
    status === "added"
      ? "text-[var(--vscode-gitDecoration-addedResourceForeground)]"
      : "text-[var(--vscode-gitDecoration-deletedResourceForeground)]";

  return (
    <svg
      aria-hidden="true"
      className={`${strokeIcon} ${color}`}
      height="16"
      viewBox="0 0 16 16"
      width="16"
    >
      {status === "added" && <path d="M8 3v10M3 8h10" />}
      {status === "deleted" && <path d="M3 8h10" />}
    </svg>
  );
}
