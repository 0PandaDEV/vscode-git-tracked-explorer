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

    // Track watchers for each workspace folder
    const watchers = new Map<string, vscode.FileSystemWatcher>();

    // Setup initial watchers
    workspaceFolders.forEach(folder => {
        setupGitIndexWatcher(folder.uri.fsPath, gitTrackedProvider, context, watchers);
    });

    // Watch for workspace folder changes (add/remove folders)
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(event => {
            // Update provider with new workspace folders
            gitTrackedProvider.updateWorkspaceFolders(vscode.workspace.workspaceFolders || []);

            // Setup watchers for added folders
            event.added.forEach(folder => {
                setupGitIndexWatcher(folder.uri.fsPath, gitTrackedProvider, context, watchers);
            });

            // Dispose watchers for removed folders
            event.removed.forEach(folder => {
                const watcher = watchers.get(folder.uri.fsPath);
                if (watcher) {
                    watcher.dispose();
                    watchers.delete(folder.uri.fsPath);
                    console.log('Stopped watching:', folder.uri.fsPath);
                }
            });
        })
    );
}

function setupGitIndexWatcher(
    rootPath: string,
    provider: GitTrackedProvider,
    context: vscode.ExtensionContext,
    watchers: Map<string, vscode.FileSystemWatcher>
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
        watchers.set(rootPath, watcher);

        console.log('Watching git index at:', indexPath);
    });
}

export function deactivate() {}
