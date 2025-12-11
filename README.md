# Git Tracked Explorer

A VS Code extension that displays only git-tracked files in the Explorer view, making it easy to focus on version-controlled files.

## Features

- **Shows only git-tracked files** - Uses `git ls-files` to display exactly what's tracked
- **Respects force-tracked files** - Files added with `git add --force` are included
- **Tree view structure** - Matches your repository's directory structure
- **Real-time updates** - Automatically refreshes when git tracking changes
- **Multi-root workspace support** - Works with multiple workspace folders
- **--separate-git-dir support** - Handles repositories with separate git directories

## Why This Extension?

Unlike using `.gitignore` to filter the Explorer view, this extension shows the **actual git-tracked files** based on what's in your git index. This means:

- Files in `.gitignore` but force-tracked with `git add --force` are shown
- Newly created files (not yet tracked) are hidden until you `git add` them
- It reflects the true state of your git repository

## Usage

1. Open a git repository in VS Code
2. Find the "Git Tracked Files" view in the Explorer sidebar
3. Browse your git-tracked files in tree structure

## Supported Scenarios

- ✅ Standard git repositories
- ✅ Repositories with `--separate-git-dir`
- ✅ Multi-root workspaces
- ✅ Force-tracked files
- ✅ Dynamic workspace folder changes
- ✅ Repository initialization (`git init`)

## License

MIT

## Author

Jun Wooram - [@chatoo2412](https://github.com/chatoo2412)

## Issues & Contributions

Report issues or contribute at [GitHub](https://github.com/chatoo2412/vscode-git-tracked-explorer)
