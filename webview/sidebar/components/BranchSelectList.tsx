import type { KeyboardEvent } from "react";
import type { BranchRef } from "../../../src/git/GitBackend";
import { BranchSelectOption } from "./BranchSelectOption";

interface BranchSelectListProps {
  activeIndex: number;
  branches: BranchRef[];
  currentBranchName?: string;
  id: string;
  onChoose(index: number): void;
  onClose(restoreFocus: boolean): void;
  onMove(offset: number): void;
  onSetActive(index: number): void;
  register(index: number, element: HTMLDivElement | null): void;
  value: string;
}

export function BranchSelectList({
  activeIndex,
  branches,
  currentBranchName,
  id,
  onChoose,
  onClose,
  onMove,
  onSetActive,
  register,
  value,
}: BranchSelectListProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      onMove(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      onSetActive(event.key === "Home" ? 0 : branches.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onChoose(activeIndex);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose(true);
    } else if (event.key === "Tab") {
      onClose(false);
    }
  };

  return (
    <div
      aria-labelledby={`${id}-label`}
      className="branch-select-list"
      id={`${id}-listbox`}
      onKeyDown={handleKeyDown}
      role="listbox"
      tabIndex={-1}
    >
      {branches.map((branch, index) => (
        <BranchSelectOption
          active={index === activeIndex}
          branch={branch}
          current={branch.name === currentBranchName}
          id={`${id}-option-${index}`}
          index={index}
          key={branch.name}
          onChoose={onChoose}
          onFocus={onSetActive}
          register={register}
          selected={branch.name === value}
        />
      ))}
    </div>
  );
}
