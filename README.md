# Git Tracked Explorer

VS Code extension that shows only git-tracked files in the explorer view.

## Features

- Displays only files tracked by git (using `git ls-files`)
- Respects force-tracked files (files added with `--force`)
- Tree view structure matching your repository structure
- Real-time updates when files change
- Refresh button to manually update the view

## Requirements

- Git must be installed and available in PATH
- The workspace must be a git repository

## Usage

1. Open a git repository in VS Code
2. Look for "Git Tracked Files" view in the Explorer sidebar
3. All git-tracked files will be displayed in a tree structure
4. Click on any file to open it
5. Use the refresh button to manually update the view

## Development

```bash
npm install
npm run compile
```

Press F5 in VS Code to run the extension in development mode.
