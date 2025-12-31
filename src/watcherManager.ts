import * as vscode from "vscode";
import { GitCommand } from "./gitCommand";
import { ExclusionManager } from "./exclusionManager";

export class WatcherManager {
  private indexWatchers = new Map<string, vscode.FileSystemWatcher>();
  private gitDirWatchers = new Map<string, vscode.FileSystemWatcher>();

  constructor(
    private manager: ExclusionManager,
    private context: vscode.ExtensionContext
  ) {}

  async setupWatchers(folderPath: string): Promise<void> {
    if (this.indexWatchers.has(folderPath)) return;

    await this.setupGitIndexWatcher(folderPath);
    this.setupGitDirWatcher(folderPath);
  }

  disposeAll(): void {
    this.indexWatchers.forEach((w) => w.dispose());
    this.indexWatchers.clear();
    this.gitDirWatchers.forEach((w) => w.dispose());
    this.gitDirWatchers.clear();
  }

  removeWatchers(folderPath: string): void {
    this.disposeWatcher(this.indexWatchers, folderPath);
    this.disposeWatcher(this.gitDirWatchers, folderPath);
  }

  private async setupGitIndexWatcher(folderPath: string): Promise<void> {
    const gitDir = await GitCommand.getGitDir(folderPath);
    if (!gitDir) return;
    const pattern = new vscode.RelativePattern(gitDir, "index");
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    watcher.onDidChange(() => this.manager.refresh());
    watcher.onDidCreate(() => this.manager.refresh());
    watcher.onDidDelete(() => this.manager.refresh());
    this.registerWatcher(watcher, this.indexWatchers, folderPath);
  }

  private setupGitDirWatcher(folderPath: string): void {
    const pattern = new vscode.RelativePattern(folderPath, ".git");
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    watcher.onDidCreate(() => this.manager.refresh());
    watcher.onDidDelete(() => this.manager.refresh());
    this.registerWatcher(watcher, this.gitDirWatchers, folderPath);
  }

  private registerWatcher(
    w: vscode.FileSystemWatcher,
    map: Map<string, any>,
    key: string
  ) {
    this.context.subscriptions.push(w);
    map.set(key, w);
  }

  private disposeWatcher(
    map: Map<string, vscode.FileSystemWatcher>,
    key: string
  ) {
    const watcher = map.get(key);
    if (watcher) {
      watcher.dispose();
      map.delete(key);
    }
  }
}
