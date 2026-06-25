1. Issue branches use `<name>/IS-<3-digit-issue-nr>/<revision>`, for example `felixf/IS-003/0`.
2. Commit messages use `IS-XXX:` followed by a concise action, for example `IS-003: load product data`.
3. Commits are atomic. Corrections to an existing commit use `git commit --fixup=<commit>`.
4. Before publishing, fetch and rebase the issue branch onto the latest `origin/main`. Autosquash all fixup commits in that single rebase, then rerun affected checks.
5. Push the issue branch and open a draft pull request titled `IS-XXX: <What is implemented>`.
6. The issue document and pull request body include What, Acceptance criteria, Confirmation, and Notes.
7. Confirmation separates automated checks from a manual reviewer checklist. Each manual step states how to reach the feature, what action to take, and the intended visible or behavioral result. Include the change from previous behavior and relevant loading, empty, error, responsive, and keyboard states.
