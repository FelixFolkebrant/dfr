import { useState } from "react";
import type { ReviewCommit } from "../../../src/git/GitBackend";
import { ChevronIcon } from "./Icons";

interface DetailsSectionsProps {
  documents: string[];
  onOpenDocument(path: string): void;
  selectedCommit: ReviewCommit | undefined;
}

export function DetailsSections({
  documents,
  onOpenDocument,
  selectedCommit,
}: DetailsSectionsProps) {
  const [messageOpen, setMessageOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(true);
  const messageHasBody = selectedCommit?.message.trim().includes("\n") ?? false;

  return (
    <div className="grid gap-[9px]">
      {selectedCommit && (
        <section className="min-w-0">
          {messageHasBody ? (
            <button
              aria-expanded={messageOpen}
              className="flex w-full cursor-pointer items-start gap-2 border-0 bg-transparent px-[9px] py-1 text-left text-[var(--vscode-descriptionForeground)] focus-visible:bg-[var(--vscode-list-hoverBackground)] focus-visible:outline-none"
              onClick={() => setMessageOpen((open) => !open)}
              type="button"
            >
              <span
                className={
                  messageOpen
                    ? "min-w-0 flex-1 whitespace-pre-wrap [overflow-wrap:anywhere]"
                    : "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                }
                title={messageOpen ? undefined : selectedCommit.subject}
              >
                {messageOpen ? selectedCommit.message : selectedCommit.subject}
              </span>
              <ChevronIcon expanded={messageOpen} />
            </button>
          ) : (
            <p
              className="overflow-hidden px-[9px] py-1 text-ellipsis whitespace-nowrap text-[var(--vscode-descriptionForeground)]"
              title={selectedCommit.subject}
            >
              {selectedCommit.subject}
            </p>
          )}
        </section>
      )}
      <section className="min-w-0">
        <DisclosureButton
          expanded={docsOpen}
          label="Docs"
          onClick={() => setDocsOpen((open) => !open)}
        />
        {docsOpen &&
          (documents.length > 0 ? (
            <ul className="mt-[3px] grid list-none gap-px px-[9px]">
              {documents.map((path) => (
                <li key={path}>
                  <button
                    className="block w-full cursor-pointer overflow-hidden border-0 bg-transparent py-1 text-left text-ellipsis whitespace-nowrap text-[var(--vscode-textLink-foreground,var(--vscode-descriptionForeground))] hover:text-[var(--vscode-textLink-activeForeground,var(--vscode-foreground))] hover:underline focus-visible:underline focus-visible:outline-none"
                    onClick={() => onOpenDocument(path)}
                    title={path}
                    type="button"
                  >
                    {path.split("/").at(-1)}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-[3px] px-[9px] text-[11px] leading-[1.45] text-[var(--vscode-descriptionForeground)]">
              No related Markdown files found.
            </p>
          ))}
      </section>
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
