import { useState } from "react";
import type { ReviewCommit } from "../../../src/git/GitBackend";
import { ChevronIcon } from "./Icons";

interface DetailsSectionsProps {
  selectedCommit: ReviewCommit | undefined;
}

export function DetailsSections({ selectedCommit }: DetailsSectionsProps) {
  const [messageOpen, setMessageOpen] = useState(true);

  if (!selectedCommit) return null;

  return (
    <div className="grid">
      {selectedCommit && (
        <section className="min-w-0">
          <DisclosureButton
            expanded={messageOpen}
            label="Message"
            onClick={() => setMessageOpen((open) => !open)}
          />
          {messageOpen && (
            <p className="px-[9px] py-1 whitespace-pre-wrap text-[var(--vscode-descriptionForeground)] [overflow-wrap:anywhere]">
              {selectedCommit.message}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function DisclosureButton({
  expanded,
  label,
  onClick,
}: {
  expanded: boolean;
  label: string;
  onClick(): void;
}) {
  return (
    <button
      aria-expanded={expanded}
      className="flex h-7 w-full cursor-pointer items-center justify-between border-0 bg-transparent px-[3px] text-left text-[var(--vscode-sideBar-foreground)] focus-visible:bg-[var(--vscode-list-hoverBackground)] focus-visible:outline-none"
      onClick={onClick}
      type="button"
    >
      <span>{label}</span>
      <ChevronIcon expanded={expanded} />
    </button>
  );
}
