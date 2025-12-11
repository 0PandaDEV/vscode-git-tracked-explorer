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

    // Watch git index file only (changes when git add/commit/reset happens)
    if (rootPath) {
        const gitIndexWatcher = vscode.workspace.createFileSystemWatcher('**/.git/index');
        gitIndexWatcher.onDidChange(() => gitTrackedProvider.refresh());
        context.subscriptions.push(gitIndexWatcher);
    }
}

export function deactivate() {}
