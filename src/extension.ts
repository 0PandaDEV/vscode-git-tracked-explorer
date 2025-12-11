import * as vscode from 'vscode';
import { GitTrackedProvider } from './gitTrackedProvider';

export function activate(context: vscode.ExtensionContext) {
    const rootPath = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : undefined;

    const gitTrackedProvider = new GitTrackedProvider(rootPath);

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

    // Watch for git changes
    const watcher = vscode.workspace.createFileSystemWatcher('**/*');
    watcher.onDidCreate(() => gitTrackedProvider.refresh());
    watcher.onDidDelete(() => gitTrackedProvider.refresh());
    watcher.onDidChange(() => gitTrackedProvider.refresh());
    context.subscriptions.push(watcher);
}

export function deactivate() {}
