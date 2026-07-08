---
name: copilot-pr-reviewer
description: Simulates the GitHub Copilot Pull Request Reviewer by analyzing git diffs against the base branch (defaulting to origin/main) and generating structured review reports.
---

# Copilot Pull Request Reviewer Simulation Skill

This skill allows the agent to simulate the PR review process of GitHub Copilot Reviewer. It analyzes code modifications in the current branch against the target base branch (default: `origin/main`), detects potential bugs, security issues, performance problems, and styling flaws, and generates a structured report with code fixes.

## When to Use

Use this skill when:
- The user requests a PR review of their changes.
- You want to verify and audit local modifications before pushing them or creating a pull request.
- You need to reproduce the Copilot reviewer findings.

## Review Methodology

The review follows a structured 4-step process:

### Step 1: Extract PR Diff
Run the helper script to analyze the differences between the current branch (`HEAD`) and the target base branch (`origin/main`):
```bash
node .agents/skills/copilot-pr-reviewer/scripts/get-pr-diff.js
```
*Note: If the base branch is local, you can set it via argument:*
```bash
node .agents/skills/copilot-pr-reviewer/scripts/get-pr-diff.js main
```
This script writes the structured diff to `.agents/skills/copilot-pr-reviewer/pr_diff.json`.

### Step 2: Read and Parse Modified Code
Read `.agents/skills/copilot-pr-reviewer/pr_diff.json`. Focus the analysis on the file path, modified line numbers, and the modified contents. You must read the surrounding code context of modified files to ensure accuracy.

### Step 3: Analyze for Issues
Review the modifications against the following categories:
1. **Critical/Bug (Critical/High Severity)**:
   - Logic bugs, race conditions, memory/timer leaks (e.g. uncleared `setInterval`).
   - Undefined reference errors, unhandled promise rejections.
   - Code that runs in incompatible environments (e.g. browser code running in Node unit tests).
2. **Security (Critical/High Severity)**:
   - Hardcoded secrets or tokens.
   - Insecure data handling or unsafe DOM manipulation (e.g. `innerHTML` on unescaped user input).
3. **Performance & Best Practices (Moderate/Low Severity)**:
   - Duplicate code or inefficient search loops.
   - Lockfile/dependency drift (e.g. missing `--frozen-lockfile` in CI).
   - Inconsistent coding standards or formatting.

### Step 4: Generate a Structured Report
Create a markdown report named `pr_review_report.md` in the workspace root. The report must contain:
1. **Summary of Changes**: High-level overview of the PR size, files touched, and overall quality.
2. **Review Comments Table**:
   - `ID`: comment counter (e.g., `001`).
   - `File`: path to the file.
   - `Lines`: start-end line range.
   - `Severity`: `Critical`, `Moderate`, or `Low`.
   - `Category`: `Bug`, `Security`, `Performance`, or `Best Practice`.
   - `Description`: explanation of the issue and why it needs fixing.
3. **Proposed Fixes**: For each issue, provide a markdown diff showing how to fix the code.

Example Report entry:
```markdown
### Comment [001] - chrome/content.js (Lines 653-667)
- **Severity**: Critical
- **Category**: Bug
- **Description**: The script runs `init()` in Node environments, leaking intervals during unit testing.
- **Proposed Fix**:
```diff
-  init();
+  if (typeof module === 'undefined') {
+    init();
+  }
```
```
