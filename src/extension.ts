import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { GitTrackedProvider } from './gitTrackedProvider';

export function activate(context: vscode.ExtensionContext) {
    const workspaceFolders = vscode.workspace.workspaceFolders || [];

    const gitTrackedProvider = new GitTrackedProvider(workspaceFolders);

    vscode.window.registerTreeDataProvider('gitTrackedExplorer', gitTrackedProvider);

    context.subscriptions.push(
        vscode.commands.registerCommand('gitTrackedExplorer.refresh', () => {
            gitTrackedProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('gitTrackedExplorer.openFile', (resource: vscode.Uri) => {
            vscode.window.showTextDocument(resource);
        })
    );

    // Watch git index file for each workspace folder (supports --separate-git-dir)
    workspaceFolders.forEach(folder => {
        setupGitIndexWatcher(folder.uri.fsPath, gitTrackedProvider, context);
    });
}

function setupGitIndexWatcher(
    rootPath: string,
    provider: GitTrackedProvider,
    context: vscode.ExtensionContext
) {
    // Only process if .git exists in current directory (don't traverse up)
    // Note: .git can be a file (--separate-git-dir) or directory
    const checkAndGetGitDir = '[ -e .git ] && git rev-parse --git-dir';

    cp.exec(checkAndGetGitDir, { cwd: rootPath }, (error, stdout, stderr) => {
        if (error) {
            // No .git in this directory, skip
            console.log('No git repository in:', rootPath);
            return;
        }

        let gitDir = stdout.trim();

        // If relative path, resolve it relative to rootPath
        if (!path.isAbsolute(gitDir)) {
            gitDir = path.resolve(rootPath, gitDir);
        }

        const indexPath = path.join(gitDir, 'index');

        // Watch the specific index file
        const pattern = new vscode.RelativePattern(gitDir, 'index');
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);

        watcher.onDidChange(() => provider.refresh());
        watcher.onDidCreate(() => provider.refresh());
        watcher.onDidDelete(() => provider.refresh());

        context.subscriptions.push(watcher);

        console.log('Watching git index at:', indexPath);
    });
}

export function deactivate() {}
