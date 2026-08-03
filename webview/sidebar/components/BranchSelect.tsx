import { useId, useRef, useState } from "react";
import type { BranchRef } from "../../../src/git/GitBackend";
import { DropdownIcon } from "./Icons";
import { SelectDropdown, useDismissOnOutsidePointer } from "./SelectDropdown";

interface BranchSelectProps {
  branches: BranchRef[];
  currentBranchName?: string;
  label: string;
  hideLabel?: boolean;
  onChange(value: string): void;
  value: string;
}

export function BranchSelect({
  branches,
  currentBranchName,
  label,
  hideLabel = false,
  onChange,
  value,
}: BranchSelectProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useDismissOnOutsidePointer(rootRef, open, setOpen);

  const choose = (branchName: string) => {
    onChange(branchName);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  return (
    <div className="relative min-w-0" ref={rootRef}>
      <span
        className={
          hideLabel
            ? "sr-only"
            : "mb-1.5 ml-2 block text-xs text-[var(--vscode-descriptionForeground)]"
        }
        id={`${id}-label`}
      >
        {label}
      </span>
      <button
        aria-controls={`${id}-listbox`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={`${id}-label ${id}-value`}
        className={`flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-[9px] text-left text-[var(--vscode-dropdown-foreground)] focus-visible:bg-[var(--vscode-list-hoverBackground)] focus-visible:outline-none ${
          hideLabel
            ? "h-[38px] border-0 bg-transparent px-2.5 text-sm"
            : "h-[42px] border border-[var(--vscode-dropdown-border,var(--vscode-contrastBorder,transparent))] bg-[var(--vscode-dropdown-background)] px-3"
        }`}
        id={`${id}-value`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        onPointerDown={(event) => {
          if (open) event.preventDefault();
        }}
        ref={triggerRef}
        role="combobox"
        type="button"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {value === currentBranchName && (
            <CurrentBranchMarker large={hideLabel} />
          )}
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
            {value}
          </span>
        </span>
        <DropdownIcon />
      </button>
      {open && (
        <SelectDropdown
          foldedOptions={{
            label: "Remote branches",
            options: branches
              .filter((branch) => branch.kind === "remote")
              .map((branch) => ({
                label: branch.name,
                value: branch.name,
              })),
          }}
          id={id}
          label="Branches"
          onClose={close}
          onSelect={choose}
          options={branches
            .filter((branch) => branch.kind === "local")
            .map((branch) => ({
              label: branch.name,
              leading:
                branch.name === currentBranchName ? (
                  <CurrentBranchMarker />
                ) : undefined,
              value: branch.name,
            }))}
          pinnedValue={currentBranchName}
          selectedValue={value}
        />
      )}
    </div>
  );
}

function CurrentBranchMarker({ large = false }: { large?: boolean }) {
  return (
    <>
      <span
        className={`shrink-0 leading-none text-[var(--vscode-gitDecoration-addedResourceForeground)] ${large ? "text-xl" : "text-base"}`}
        aria-hidden="true"
      >
        •
      </span>
      <span className="sr-only">Current branch: </span>
    </>
  );
}
