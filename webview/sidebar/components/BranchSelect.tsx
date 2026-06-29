import { type Dispatch, useEffect, useId, useRef, useState } from "react";
import type { BranchRef } from "../../../src/git/GitBackend";
import { BranchSelectList } from "./BranchSelectList";
import { CurrentBranchMarker } from "./BranchSelectOption";
import { DropdownIcon } from "./Icons";

interface BranchSelectProps {
  branches: BranchRef[];
  currentBranchName?: string;
  label: string;
  onChange(value: string): void;
  value: string;
}

export function BranchSelect({
  branches,
  currentBranchName,
  label,
  onChange,
  value,
}: BranchSelectProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef(new Map<number, HTMLDivElement>());
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(
    0,
    branches.findIndex((branch) => branch.name === value),
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  useDismissOnOutsidePointer(rootRef, open, setOpen);

  useEffect(() => {
    if (open) {
      optionRefs.current.get(activeIndex)?.focus();
    }
  }, [activeIndex, open]);

  const openAt = (index: number) => {
    setActiveIndex(index);
    setOpen(true);
  };

  const choose = (index: number) => {
    const branch = branches[index];
    if (!branch) {
      return;
    }
    onChange(branch.name);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const move = (offset: number) => {
    setActiveIndex((current) =>
      Math.min(branches.length - 1, Math.max(0, current + offset)),
    );
  };

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  return (
    <div className="branch-select" ref={rootRef}>
      <span className="branch-select-label" id={`${id}-label`}>
        {label}
      </span>
      <button
        aria-controls={`${id}-listbox`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={`${id}-label ${id}-value`}
        className="branch-select-trigger"
        id={`${id}-value`}
        onClick={() => (open ? setOpen(false) : openAt(selectedIndex))}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openAt(
              Math.min(
                branches.length - 1,
                Math.max(
                  0,
                  selectedIndex + (event.key === "ArrowDown" ? 1 : -1),
                ),
              ),
            );
          }
        }}
        ref={triggerRef}
        role="combobox"
        type="button"
      >
        <span className="branch-select-value">
          {value === currentBranchName && <CurrentBranchMarker />}
          <span className="branch-select-value-text">{value}</span>
        </span>
        <DropdownIcon />
      </button>
      {open && (
        <BranchSelectList
          activeIndex={activeIndex}
          branches={branches}
          currentBranchName={currentBranchName}
          id={id}
          onChoose={choose}
          onClose={close}
          onMove={move}
          onSetActive={setActiveIndex}
          register={(optionIndex, element) => {
            if (element) {
              optionRefs.current.set(optionIndex, element);
            } else {
              optionRefs.current.delete(optionIndex);
            }
          }}
          value={value}
        />
      )}
    </div>
  );
}

function useDismissOnOutsidePointer(
  rootRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  setOpen: Dispatch<React.SetStateAction<boolean>>,
) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointer);
    return () => document.removeEventListener("pointerdown", handlePointer);
  }, [open, rootRef, setOpen]);
}
