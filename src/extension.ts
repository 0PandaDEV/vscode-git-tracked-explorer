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
    // Use git rev-parse to find actual git directory (handles --separate-git-dir)
    cp.exec('git rev-parse --git-dir', { cwd: rootPath }, (error, stdout, stderr) => {
        if (error) {
            console.error('Failed to find git directory:', error);
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
