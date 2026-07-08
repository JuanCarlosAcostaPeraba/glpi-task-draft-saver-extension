const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Determine base branch
let baseBranch = process.argv[2] || 'origin/main';
let diffCommand = '';

try {
  // Test if baseBranch exists
  execSync(`git rev-parse --verify ${baseBranch}`, { stdio: 'ignore' });
  diffCommand = `git diff ${baseBranch}...HEAD`;
} catch (e) {
  console.log(`Warning: Base branch '${baseBranch}' could not be verified.`);
  if (baseBranch === 'origin/main') {
    try {
      execSync(`git rev-parse --verify main`, { stdio: 'ignore' });
      baseBranch = 'main';
      diffCommand = `git diff main...HEAD`;
      console.log(`Falling back to local 'main' branch.`);
    } catch (err) {
      baseBranch = 'HEAD~1';
      diffCommand = `git diff HEAD~1...HEAD`;
      console.log(`Falling back to comparing last commit (HEAD~1).`);
    }
  } else {
    baseBranch = 'HEAD~1';
    diffCommand = `git diff HEAD~1...HEAD`;
    console.log(`Falling back to comparing last commit (HEAD~1).`);
  }
}

try {
  console.log(`Running: ${diffCommand}`);
  const diffOutput = execSync(diffCommand, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  
  // Parse diff output
  const files = [];
  let currentFile = null;
  let currentHunk = null;
  
  const lines = diffOutput.split('\n');
  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      if (currentFile) {
        files.push(currentFile);
      }
      currentFile = {
        path: '',
        hunks: []
      };
      currentHunk = null;
    } else if (line.startsWith('--- a/')) {
      // Ignore
    } else if (line.startsWith('+++ b/')) {
      if (currentFile) {
        currentFile.path = line.substring(6);
      }
    } else if (line.startsWith('@@ ')) {
      // parse hunk header, e.g. @@ -653,4 +656,14 @@
      const match = line.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
      if (match && currentFile) {
        currentHunk = {
          oldStart: parseInt(match[1]),
          oldLines: parseInt(match[2] || '1'),
          newStart: parseInt(match[3]),
          newLines: parseInt(match[4] || '1'),
          lines: []
        };
        currentFile.hunks.push(currentHunk);
      }
    } else if (currentHunk) {
      if (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ')) {
        currentHunk.lines.push(line);
      }
    }
  }
  
  if (currentFile) {
    files.push(currentFile);
  }
  
  const output = {
    base: baseBranch,
    command: diffCommand,
    files: files.filter(f => f.path) // Filter out any empty files
  };
  
  const outputPath = path.join(__dirname, '../pr_diff.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Successfully parsed diff. Saved ${files.length} modified files to ${outputPath}`);
} catch (error) {
  console.error('Failed to parse git diff:', error.message);
  process.exit(1);
}
