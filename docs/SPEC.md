# SPEC: VS Code Branch Diff Review Extension

## t'sup

Like in "what's up"

**Branch Diff Review**

A VS Code extension for reviewing the difference between the current branch and a base branch, similar to the file-review experience you get when opening a pull request on GitHub or a merge request on GitLab.

The extension should make it easy to answer:

> “What changed on this branch compared to main/master?”

## Problem

VS Code has good Git tooling for everyday work: source control, staging, committing, branch switching, and single-file diffs. What is missing is a simple local review surface for branch-level diffs.

When working on a feature branch, I often want to review the whole branch before opening a PR/MR. In GitHub or GitLab, I can see all changed files, open each file diff, and eventually review commit by commit. In VS Code, that workflow is more fragmented.

## Product idea

Create a local PR/MR-style branch diff viewer inside VS Code.

At a high level:

- Pick a base branch and a compare branch.
- Default to `main`/`master` as base and current `HEAD` as compare.
- Show a left sidebar with changed files.
- Show the selected file diff in the editor area.
- Later, add all-files review and commit-by-commit review.

## MVP scope

The MVP should stay intentionally small.

### MVP goal

Allow a user to open VS Code, open the extension window in the left sidebar, and review the diff between their current branch and `main`/`master`.

### MVP features

- VS Code command: **Open Branch Diff Review**.
- Automatically detect the active Git repository.
- Automatically detect the current branch.
- Automatically choose a default base branch, preferably in this order:
  - configured default base branch
  - `main`
  - `master`
  - `origin/main`
  - `origin/master`
- Compare current branch against the base branch using PR-style merge-base semantics.
- Show a sidebar view with:
  - compact base branch row
  - compact compare branch row
  - native changed-file explorer
  - one-line diff summary
- Mark the current branch with `•` in branch selectors.
- Use VS Code's native Tree View API for the changed-file explorer.
- Use VS Code's built-in diff editor for rendering file diffs.
- Clicking a file in the explorer opens that file’s diff in the main editor area.
- Handle common file states:
  - added
  - modified
  - deleted
  - renamed
  - binary
- Do not load every file patch upfront. Load file patches only when selected.

### MVP non-goals

These should not be part of the first version:

- Creating pull requests or merge requests.
- Posting comments to GitHub/GitLab.
- Persisted review comments.
- Commit-by-commit review.
- Full all-files review surface.
- Editing or applying hunks.
- Staging/unstaging changes.
- Merge conflict resolution.
- Deep GitHub/GitLab API integration.
- Supporting non-Git workspaces.
- Replacing VS Code’s Source Control view.

## Loose UX concept

### Left sidebar

The left sidebar is the main navigation surface.

Rough shape:

```text
Branch Diff

Base                  main
Compare              • feature/x
13 changed files      +428 -97

src/
  components/
    Button.tsx       +21 -4  M
    DiffPanel.tsx    +90     A
  git/
    DiffService.ts   +44 -11 M
README.md             +8 -2 M
```

The two branch rows should be compact. Selecting one opens a native Quick Pick, and the current branch is marked with `•`. Changed files follow the one-line summary in the same native view. File names and A/M/D/R badges use VS Code's Git decoration colors, while GitHub-style `+added -removed` counts remain visible beside each file.

### Main editor area

The main editor area shows the currently selected file diff.

Rough shape:

```text
feature/x into main
src/components/Button.tsx
M  +21 -4

[VS Code diff editor controls]

<diff rendered here>
```

The MVP can start with a single selected-file diff. A full “all files” review page can come later.

## Git comparison behavior

The default comparison should match how people think about pull requests: compare the branch against the point where it diverged from the base branch.

Conceptually:

```bash
git merge-base <base> <head>
git diff <merge-base> <head>
```

This is preferable to a raw `base..head` or tip-to-tip diff because it avoids showing unrelated changes that were added to the base branch after the feature branch was created.

In product language, this should be described as:

> “Show what this branch introduces compared to the base branch.”

## Tech stack

### Extension

- VS Code extension
- TypeScript
- VS Code Extension API
- VS Code Tree View for branch selection, summary, and changed files
- VS Code virtual text documents and built-in diff editor for the main diff viewer

### Native sidebar UI

- Use one contributed Tree View for the complete Branch Diff sidebar.
- Use native Quick Picks for branch selection.
- Use native file decorations for file icons, A/M/D/R badges, and theme-aware Git status colors.
- Keep Git discovery, comparisons, and selected-file loading in the extension host.

### Git integration

Use a hybrid approach:

- Use VS Code’s built-in Git extension API where it is helpful.
- Use the Git CLI where exact diff output is needed.

Native VS Code Git API is useful for:

- discovering repositories
- detecting current branch
- watching repository state changes
- reading known refs/branches where available

Git CLI is useful for:

- merge-base comparison
- changed-file summaries
- rename detection
- numstat/addition/deletion counts
- selected file contents at the merge base and head
- binary file detection
- reliable machine-readable output

The extension should not depend entirely on one or the other. Native VS Code Git support gives better integration, while Git CLI gives more control over exact diff behavior.

### UI surfaces

- VS Code's `TreeDataProvider` and `TreeView` APIs for changed-file navigation.
- VS Code's `QuickPick` API for compact branch selection.
- VS Code's `FileDecorationProvider` for Git status colors and badges.
- VS Code's `TextDocumentContentProvider` and `vscode.diff` command for file diffs.

### Optional supporting tools

These are useful but not mandatory:

- Vitest/Jest for unit tests.
- Git fixture repositories for integration-style tests.
- Playwright or VS Code extension tests once UI behavior becomes complex enough to justify browser/extension-host coverage.

### Project hygiene

- Biome is the source of truth for formatting and linting.
- `pnpm check` is the primary local and hook validation command.
- Keep checks deterministic and runnable from the repository root.
- Do not add overlapping format/lint tools unless Biome cannot cover a concrete need.

## Biggest architectural decisions

### 1. Hybrid Git backend

Do not build the app directly against scattered Git commands or directly against the VS Code Git API everywhere.

Instead, create a small internal Git backend layer.

Rough shape:

```ts
interface GitBackend {
  getRepositories(): Promise<Repository[]>;
  getCurrentBranch(repo: Repository): Promise<BranchRef>;
  getBranches(repo: Repository): Promise<BranchRef[]>;
  getComparisonSummary(input: ComparisonInput): Promise<ComparisonSummary>;
  getFileDiff(input: FileDiffInput): Promise<FileDiffResult>;
}
```

The implementation can use native VS Code Git APIs, Git CLI, or both behind the scenes.

### 2. Merge-base comparison by default

The default behavior should be PR/MR-style comparison:

```text
merge-base(base, head) -> head
```

This should be the core mental model of the product.

A two-dot/tip-to-tip comparison mode can be added later if users ask for it.

### 3. Summary first, file contents later

The extension should first load a cheap comparison summary:

- list of changed files
- file statuses
- additions/deletions
- commit count if easy

It should not load every changed file upfront.

The merge-base and head versions of a file should be loaded lazily when the user clicks it.

### 4. Native diff editor for the review surface

Use the native sidebar view for branch and file navigation, then open selected files in VS Code's built-in diff editor through read-only virtual documents.

This keeps diff rendering, syntax highlighting, accessibility, layout, and editor controls aligned with VS Code without owning a second renderer.

### 5. Extension host owns Git state

The extension host should own:

- repository detection
- branch detection
- diff computation
- selected-file content loading
- caching
- error handling

The native Branch Diff view should own:

- branch selection commands
- compact comparison presentation
- selected file
- expanded folders

### 6. Native UI stays thin

Preferred direction:

- keep Git and filesystem behavior in the extension host
- keep comparison state explicit
- use VS Code-native controls and theme colors
- avoid custom rendering until a native API cannot meet a demonstrated need

### 7. Keep the first version single-repository focused

Multi-root support matters, but the MVP can stay simple.

Preferred behavior:

- if one Git repository is open, use it
- if the active editor belongs to a Git repository, use that one
- if multiple repositories are open and the active editor does not clarify, ask the user to choose

### 8. Do not create a new SCM provider

The extension is a review surface, not a replacement for VS Code’s built-in Source Control view.

It should not try to become a full source control provider.

## Rough internal data model

This does not need to be final, but the app will probably need concepts like these:

```ts
type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'binary' | 'unknown';

interface ComparisonInput {
  repoRoot: string;
  baseRef: string;
  headRef: string;
}

interface ComparisonSummary {
  id: string;
  repoRoot: string;
  baseRef: string;
  headRef: string;
  mergeBase?: string;
  files: DiffFileSummary[];
  totals: {
    files: number;
    additions: number;
    deletions: number;
  };
}

interface DiffFileSummary {
  path: string;
  oldPath?: string;
  status: FileStatus;
  additions?: number;
  deletions?: number;
  isBinary?: boolean;
}

interface FilePatchResult {
  path: string;
  oldPath?: string;
  patch?: string;
  isBinary?: boolean;
  tooLarge?: boolean;
}
```

## Rough Git commands

These are implementation ideas, not strict requirements.

Find repo:

```bash
git rev-parse --show-toplevel
```

Find current branch:

```bash
git branch --show-current
```

Find merge base:

```bash
git merge-base <base> <head>
```

List changed files:

```bash
git diff --find-renames --name-status -z <merge-base> <head>
```

Get additions/deletions:

```bash
git diff --find-renames --numstat -z <merge-base> <head>
```

Get one file patch:

```bash
git diff --find-renames --unified=80 <merge-base> <head> -- <path>
```

Use argument arrays, not shell-interpolated command strings.

## Suggested project shape

Loose starting point:

```text
src/
  extension.ts
  commands.ts
  config.ts

  git/
    GitBackend.ts
    NativeGitBackend.ts
    CliGitBackend.ts
    DiffService.ts
    GitRunner.ts

  state/
    ReviewState.ts
    SidebarReviewController.ts

  panel.ts
  view.ts
```

This should evolve as the project gets built.

## Rough issue plan

This is intentionally lighter than a full implementation breakdown.

### P0 — MVP foundation

1. Scaffold VS Code extension project.
2. Add command to open Branch Diff Review.
3. Add placeholder sidebar view.
4. Add placeholder diff surface.
5. Wire native VS Code UI surfaces.
6. Add Biome formatting/lint checks.

### P0 — Git backend

7. Create internal `GitBackend` interface.
8. Add VS Code Git API integration for repository/current branch discovery.
9. Add Git CLI runner.
10. Resolve default base branch.
11. Compute merge-base comparison summary.
12. Parse changed files, statuses, renames, additions, and deletions.
13. Load a patch for one selected file.

### P0 — Sidebar UX

14. Build branch selector UI.
15. Mark current branch with `•`.
16. Show diff summary counts.
17. Render changed files using VS Code's native Tree View API.
18. Send selected file changes to the extension host.

### P0 — Diff UX

19. Open selected files in VS Code's native diff editor.
20. Render merge-base and head contents through virtual documents.
21. Handle added, modified, deleted, renamed, binary, and too-large files.
22. Add refresh behavior.
23. Add useful empty/error states.

### P0 — Ship MVP

24. Add README with usage instructions.
25. Add basic tests around Git parsing.
26. Package local `.vsix` for manual testing.

### P1 — After MVP

- All-files diff review page.
- Commit-by-commit review.
- Viewed/unviewed file state.
- Search/filter changed files.
- Whitespace toggle.
- Split/unified layout toggle.
- Native VS Code diff fallback command.
- Remote branch support.
- Better multi-root support.

### P2 — Later ideas

- GitHub/GitLab PR/MR integration.
- Create PR/MR from VS Code.
- Inline comments.
- Review notes stored locally.
- Image diff support.
- Markdown preview diffs.
- Lockfile/generated-file hiding.

## Open questions

- Should the base branch default to local `main/master` or remote `origin/main/origin/master`?
- Should remote branches appear in the selector by default?
- Should the MVP show only one selected file diff, or should it include a simple all-files diff view?
- Should the changed-file explorer add search or filtering after the MVP?
- Should the extension remember the last selected base branch per workspace?
- Should there be a setting for merge-base vs two-dot comparison?

## Definition of done for MVP

The MVP is done when:

- I can open a Git repository in VS Code.
- I can run **Open Branch Diff Review**.
- The extension automatically compares my current branch to `main` or `master`.
- I can see a tree of changed files.
- I can click a file and see its diff.
- Added, modified, deleted, renamed, and binary files do not break the UI.
- Large patches do not freeze VS Code.
- The extension feels useful even before GitHub/GitLab integration exists.
