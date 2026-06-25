# Issue

### What?

IS-XXX: Concise statement of what is implemented.

Describe the user or developer outcome in one short paragraph. This statement is also the source for the pull request title.

### Acceptance criteria

- [ ] Add measurable, implementation-specific completion criteria.

### Notes

- Record important scope boundaries, decisions, or follow-up work.

# Issue recap

This recap is committed to version control and supplies the pull request description.

# What has been built
Explain what has been built. Do not review work that has not been implemented.


### Architectural alignment
Table for quick overview of what is done and not.

### What is left
Explain what remains for later issues.

# Confirmation

## Automated checks

From the relevant project directory, run:

```bash
# List the exact lint, type, test, analysis, and build commands used for this issue.
```

Record the expected successful result, including test counts when useful.

## Manual testing

Start the affected application or service with the exact command and open the relevant URL, screen, or workflow.

State what the reviewer should notice compared with the behavior or appearance before this issue. Then provide concrete scenarios:

- [ ] **Initial appearance:** Describe the intended layout, copy, controls, and data visible before interaction.
- [ ] **Primary behavior:** Name the exact control and input to use, then describe the expected visible or behavioral result.
- [ ] **State changes:** Exercise relevant loading, empty, error, retry, or reset paths and describe the expected result for each.
- [ ] **Responsive and keyboard behavior:** When relevant, name the viewport change and keyboard sequence, then describe the intended layout, focus, and control behavior.

Replace these prompts with issue-specific instructions. Keep checks unchecked because the reviewer, not the implementing agent, confirms the result.


# Problems found
A list of problems sorted by priority.

### 0.  (PRIORITY) Problem summary - STATUS
Describe the problem, why it matters, and a suggested solution. If multiple solutions are available, list their tradeoffs.


# Rebase order
Before publishing, the agent autosquashes fixup commits, rebases onto the latest default branch, pushes the issue branch, and opens a draft pull request. Record unusual rebase decisions here when they are relevant to reviewers.
