import type { KeyboardEvent } from "react";
import type { BranchRef } from "../../../src/git/GitBackend";
import { CheckIcon } from "./Icons";

interface BranchSelectOptionProps {
  active: boolean;
  branch: BranchRef;
  current: boolean;
  id: string;
  index: number;
  onChoose(index: number): void;
  onFocus(index: number): void;
  register(index: number, element: HTMLDivElement | null): void;
  selected: boolean;
}

export function BranchSelectOption({
  active,
  branch,
  current,
  id,
  index,
  onChoose,
  onFocus,
  register,
  selected,
}: BranchSelectOptionProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onChoose(index);
  };

  return (
    <div
      aria-selected={selected}
      className="branch-select-option"
      data-active={active}
      id={id}
      onClick={() => onChoose(index)}
      onFocus={() => onFocus(index)}
      onKeyDown={handleKeyDown}
      onPointerMove={() => onFocus(index)}
      ref={(element) => register(index, element)}
      role="option"
      tabIndex={active ? 0 : -1}
    >
      <span className="branch-select-option-name">
        {current && <CurrentBranchMarker />}
        <span>{branch.name}</span>
      </span>
      {selected && <CheckIcon className="branch-select-check" />}
    </div>
  );
}

export function CurrentBranchMarker() {
  return (
    <>
      <span className="branch-select-current" aria-hidden="true">
        •
      </span>
      <span className="sr-only">Current branch: </span>
    </>
  );
}
