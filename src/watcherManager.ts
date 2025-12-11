import * as vscode from 'vscode';
import * as path from 'path';
import { GitCommand } from './gitCommand';
import { GitTrackedProvider } from './gitTrackedProvider';

/**
 * Manages file system watchers for git repositories.
 * Follows: "Namespaces are one honking great idea"
 */
export class WatcherManager {
    private indexWatchers = new Map<string, vscode.FileSystemWatcher>();
    private gitDirWatchers = new Map<string, vscode.FileSystemWatcher>();

    constructor(
        private provider: GitTrackedProvider,
        private context: vscode.ExtensionContext
    ) {}

    /**
     * Setup all watchers for a workspace folder.
     * Follows: "Simple is better than complex"
     */
    async setupWatchers(folderPath: string): Promise<void> {
        await this.setupGitIndexWatcher(folderPath);
        this.setupGitDirWatcher(folderPath);
    }

    /**
     * Remove all watchers for a workspace folder.
     * Follows: "Explicit is better than implicit"
     */
    removeWatchers(folderPath: string): void {
        this.disposeWatcher(this.indexWatchers, folderPath);
        this.disposeWatcher(this.gitDirWatchers, folderPath);
        console.log('Stopped watching:', folderPath);
    }

    /**
     * Setup watcher for git index file changes.
     */
    private async setupGitIndexWatcher(folderPath: string): Promise<void> {
        const gitDir = await GitCommand.getGitDir(folderPath);
        if (!gitDir) {
            console.log('No git repository in:', folderPath);
            return;
        }

        const indexPath = path.join(gitDir, 'index');
        const pattern = new vscode.RelativePattern(gitDir, 'index');
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);

        watcher.onDidChange(() => this.provider.refresh());
        watcher.onDidCreate(() => this.provider.refresh());
        watcher.onDidDelete(() => this.provider.refresh());

        this.registerWatcher(watcher, this.indexWatchers, folderPath);
        console.log('Watching git index at:', indexPath);
    }

    /**
     * Setup watcher for .git directory creation/deletion.
     */
    private setupGitDirWatcher(folderPath: string): void {
        const pattern = new vscode.RelativePattern(folderPath, '.git');
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);

        watcher.onDidCreate(() => this.handleGitDirCreated(folderPath));
        watcher.onDidDelete(() => this.handleGitDirDeleted(folderPath));

        this.registerWatcher(watcher, this.gitDirWatchers, folderPath);
    }

    /**
     * Handle .git directory creation (git init).
     */
    private async handleGitDirCreated(folderPath: string): Promise<void> {
        console.log('.git created in:', folderPath);
        await this.setupGitIndexWatcher(folderPath);
        this.provider.refresh();
    }

    /**
     * Handle .git directory deletion.
     */
    private handleGitDirDeleted(folderPath: string): void {
        console.log('.git deleted in:', folderPath);
        this.disposeWatcher(this.indexWatchers, folderPath);
        this.provider.refresh();
    }

    /**
     * Register watcher and add to subscription.
     * Follows: "Flat is better than nested"
     */
    private registerWatcher(
        watcher: vscode.FileSystemWatcher,
        map: Map<string, vscode.FileSystemWatcher>,
        key: string
    ): void {
        this.context.subscriptions.push(watcher);
        map.set(key, watcher);
    }

    /**
     * Dispose and remove watcher from map.
     * Follows: "Readability counts"
     */
    private disposeWatcher(
        map: Map<string, vscode.FileSystemWatcher>,
        key: string
    ): void {
        const watcher = map.get(key);
        if (watcher) {
            watcher.dispose();
            map.delete(key);
        }
    }
}
