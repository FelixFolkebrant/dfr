import type { BranchRef } from "../../../src/git/GitBackend";
import { BranchSelect } from "./BranchSelect";
import { BranchArrowIcon } from "./Icons";

interface BranchComparisonProps {
  baseRef: string;
  branches: BranchRef[];
  currentBranchName?: string;
  headRef: string;
  onChange(baseRef: string, headRef: string): void;
}

export function BranchComparison({
  baseRef,
  branches,
  currentBranchName,
  headRef,
  onChange,
}: BranchComparisonProps) {
  return (
    <section className="branch-comparison" aria-label="Compared branches">
      <BranchSelect
        branches={branches}
        currentBranchName={currentBranchName}
        label="Base"
        onChange={(nextBase) => onChange(nextBase, headRef)}
        value={baseRef}
      />
      <BranchArrowIcon className="branch-comparison-arrow" />
      <BranchSelect
        branches={branches}
        currentBranchName={currentBranchName}
        label="Compare"
        onChange={(nextHead) => onChange(baseRef, nextHead)}
        value={headRef}
      />
    </section>
  );
}
