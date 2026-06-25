
This file provides guidance to AI agents when working with code in this repository.

## Project Overview

One or two lines project description.

* **Full description**: @docs/SPEC.md  
* **User local documentation** @docs/local  
* **Issues documentation** @docs/ISSUES
* **Styling guidelines**: @docs/local/STYLE.md

### Tech stack
* 

## Design Philosophy

*These guidelines bias toward caution over speed. For trivial tasks, use judgment.*

**Self documenting code**
* Code should be understandable over smart
* Don't comment unless it is something that is not obvious from reading the code.

**Simplicity**
- Build simple > Premature optimization. (Major optimization suggestions should be brought up in revierw and issue notes) 
- No flexibility/configuration unless asked for
- YAGNI

> Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

**Fail loudly**
* Do not create rollbacks or backups. If something fails it should fail. 

## Git Conventions

- **Before editing:** for issue work, verify the current branch and create or switch to the correctly formatted issue branch before changing files. Never implement issue work directly on `main`, `master`, or `develop`.
- **Branch format:** `<name>/IS-<3-digit-issue-nr>/<revision>` — e.g. `FelixFolkebrant/IS-001/0`
- **Commit format:** `IS-001: description` — 3-digit issue number followed by a colon and space
- **Atomic commits:** one commit does exactly one thing; never bundle unrelated changes
- **Fixup commits:** use `git commit --fixup=<hash>` to create a fixup for an earlier commit; the message is set automatically as `fixup! IS-001: original message`.

### Completing issue work

The agent owns the complete publishing workflow unless the user explicitly asks to stop earlier:

1. Ensure the issue recap at `docs/ISSUES/IS-XXX.md` contains current **What**, **Acceptance criteria**, **Confirmation**, and **Notes** sections.
   - Confirmation must separate automated checks from manual testing.
   - Manual testing must tell the reviewer how to start the feature, what changed from the previous behavior or appearance, which actions to perform, and exactly what should be visible or happen after each action.
   - Cover every user-facing acceptance criterion, including relevant loading, empty, error, responsive, and keyboard states. Do not use vague instructions such as "run the app and inspect it."
   - Use unchecked task boxes for judgments only the user can make so approval remains with the reviewer.
2. Run the repository's relevant checks and ensure the worktree is clean.
3. Fetch the remote and rebase onto the latest default branch before pushing. If fixup commits exist, autosquash them in one pass with `GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash origin/main`. Otherwise use `git rebase origin/main`. Resolve conflicts carefully and rerun affected checks. Never rebase the default branch.
4. Push the issue branch with upstream tracking. Use a normal push when history is unchanged and `--force-with-lease` only when the rebase rewrote a branch that already exists remotely. Never use `--force`.
5. Create an IS-xxx.md in @docs/ISSUES using the template.
6. Open a **draft** pull request (merge request on non-GitHub hosts) targeting the default branch.

Pull request requirements:

- **Title:** `IS-XXX: <What is implemented>`, using the issue number and concise implementation statement from the issue document's What section.
- **Body:** include the issue document's **What**, **Acceptance criteria**, **Confirmation**, and **Notes** sections. Confirmation includes both validation commands/results and the manual reviewer checklist.
- Do not invent different scope or acceptance criteria while publishing. Update `docs/ISSUES/IS-XXX.md` first if the implementation changed.
- Return the pull request link and report the branch, commits, and validation status to the user.