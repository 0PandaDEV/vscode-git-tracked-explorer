import * as vscode from 'vscode';
import { GitTrackedProvider } from './gitTrackedProvider';
import { WatcherManager } from './watcherManager';

/**
 * Extension activation entry point.
 * Follows: "Beautiful is better than ugly"
 */
export function activate(context: vscode.ExtensionContext) {
    const provider = new GitTrackedProvider(vscode.workspace.workspaceFolders || []);
    const watcherManager = new WatcherManager(provider, context);

    registerTreeView(provider, context);
    registerCommands(provider, context);
    setupInitialWatchers(watcherManager);
    watchWorkspaceFolderChanges(provider, watcherManager, context);
}

/**
 * Register tree data provider.
 */
function registerTreeView(provider: GitTrackedProvider, context: vscode.ExtensionContext): void {
    vscode.window.registerTreeDataProvider('gitTrackedExplorer', provider);
}

/**
 * Register extension commands.
 * Follows: "Sparse is better than dense"
 */
function registerCommands(provider: GitTrackedProvider, context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('gitTrackedExplorer.refresh', () => {
            provider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('gitTrackedExplorer.openFile', (resource: vscode.Uri) => {
            vscode.window.showTextDocument(resource);
        })
    );
}

/**
 * Setup watchers for initial workspace folders.
 */
function setupInitialWatchers(watcherManager: WatcherManager): void {
    const folders = vscode.workspace.workspaceFolders || [];
    folders.forEach(folder => {
        watcherManager.setupWatchers(folder.uri.fsPath);
    });
}

/**
 * Watch for workspace folder changes (add/remove).
 * Follows: "Flat is better than nested"
 */
function watchWorkspaceFolderChanges(
    provider: GitTrackedProvider,
    watcherManager: WatcherManager,
    context: vscode.ExtensionContext
): void {
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(event => {
            handleWorkspaceFoldersChanged(event, provider, watcherManager);
        })
    );
}

/**
 * Handle workspace folder add/remove events.
 * Follows: "Readability counts"
 */
function handleWorkspaceFoldersChanged(
    event: vscode.WorkspaceFoldersChangeEvent,
    provider: GitTrackedProvider,
    watcherManager: WatcherManager
): void {
    provider.updateWorkspaceFolders(vscode.workspace.workspaceFolders || []);

    event.added.forEach(folder => {
        watcherManager.setupWatchers(folder.uri.fsPath);
    });

    event.removed.forEach(folder => {
        watcherManager.removeWatchers(folder.uri.fsPath);
    });
}

export function deactivate() {}
