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

- Start Branch Diff Review automatically when the extension activates.
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
  - base branch dropdown
  - compare branch dropdown
  - changed-file tree
  - basic diff summary
- Mark the current branch with `•` in branch selectors.
- Use fully styleable webview comboboxes for branch selection.
- Show a custom changed-file tree without file-type icons.
- Give added, modified, deleted, and renamed files distinct status icons and theme-aware colors.
- Show per-file additions and deletions at the right edge of each row.
- Use VS Code's built-in diff editor for rendering file diffs.
- Clicking a file in the tree opens that file’s diff in the main editor area.
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

Base
[ main        v ]
-
Compare
[ • feature/x v ]

13 files changed
+428 -97

src/
  components/
    ● Button.tsx       +21 -4
    + DiffPanel.tsx    +90
  git/
    − OldService.ts          -11
README.md              ● +8 -2
```

The branch selector should feel lightweight and be fully controlled by the sidebar stylesheet, including its open list. The current branch is marked with `•`. The default comparison should be selected automatically so the user does not need to configure anything for the common case.

File rows should not display file-type icons. The leading visual communicates Git status only, using distinct added, modified, deleted, and renamed symbols with the active VS Code theme's Git colors. Addition and deletion counts stay aligned at the right edge and use independent green and red colors.

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
- VS Code Webview View for the sidebar
- VS Code virtual text documents and built-in diff editor for the main diff viewer

### Webview UI

- React for the sidebar webview view.
- Tailwind CSS for webview styling.
- `esbuild` for small, explicit webview bundles.
- Keep webview code as UI-only code. It should render state and send messages; it should not discover repositories, run Git, or parse patches.
- Prefer simple local build scripts over a larger app framework until the UI needs routing, dev server behavior, or heavier asset handling.

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

- Small local React components for the branch selectors and changed-file tree.
- VS Code's `TextDocumentContentProvider` and `vscode.diff` command for file diffs.
- VS Code theme variables for selection, focus, Git status, and addition/deletion colors.

### Optional supporting tools

These are useful but not mandatory:

- Zod or similar for validating webview messages.
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

Use the sidebar webview for branch and file navigation, then open selected files in VS Code's built-in diff editor through read-only virtual documents.

This keeps diff rendering, syntax highlighting, accessibility, layout, and editor controls aligned with VS Code without owning a second renderer.

### 5. Extension host owns Git state

The webview should not run Git commands.

The extension host should own:

- repository detection
- branch detection
- diff computation
- selected-file content loading
- caching
- error handling

The webview should own:

- local UI state
- selected file
- expanded folders
- message dispatch back to the extension host

### 6. React/Tailwind webviews stay thin

React is the chosen webview UI layer, but it should not become the application architecture by itself.

Preferred direction:

- keep Git and filesystem behavior in the extension host
- keep shared message types explicit
- keep Tailwind usage local to webview surfaces
- avoid global state libraries until there is real cross-view state complexity
- build small components around stable product concepts such as branch selectors, file tree, and summary

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
    ComparisonStore.ts
    PatchCache.ts

  webviews/
    SidebarViewProvider.ts
    DiffPanel.ts
    protocol.ts

webview/
  sidebar/
  diff-panel/
  shared/

scripts/
  build-webviews.mjs
```

This should evolve as the project gets built.

## Rough issue plan

This is intentionally lighter than a full implementation breakdown.

### P0 — MVP foundation

1. Scaffold VS Code extension project.
2. Add command to open Branch Diff Review.
3. Add placeholder sidebar webview.
4. Add placeholder diff panel webview.
5. Add React/Tailwind webview build setup.
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
17. Render changed files with a custom accessible tree.
18. Send selected file changes to the extension host.

### P0 — Diff UX

19. Expose selected file versions through read-only virtual documents.
20. Render selected files with VS Code's built-in diff editor.
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
- Should the extension remember the last selected base branch per workspace?
- Should there be a setting for merge-base vs two-dot comparison?

## Definition of done for MVP

The MVP is done when:

- I can open a Git repository in VS Code.
- Branch Diff Review starts without requiring a command.
- The extension automatically compares my current branch to `main` or `master`.
- I can see a tree of changed files.
- I can click a file and see its diff.
- Added, modified, deleted, renamed, and binary files do not break the UI.
- Large patches do not freeze VS Code.
- The extension feels useful even before GitHub/GitLab integration exists.
