import * as vscode from "vscode";
import { ExclusionManager } from "./exclusionManager";
import { WatcherManager } from "./watcherManager";

export function activate(context: vscode.ExtensionContext) {
  const exclusionManager = new ExclusionManager();
  const watcherManager = new WatcherManager(exclusionManager, context);

  const syncState = async () => {
    const config = vscode.workspace.getConfiguration("gitTracked");
    const isEnabled = config.get<boolean>("enabled", false);

    if (isEnabled) {
      console.log("[GitHide] Enabled via settings. Applying exclusions...");
      await exclusionManager.refresh();
      setupWatchers(watcherManager);
    } else {
      console.log("[GitHide] Disabled via settings. Not applying exclusions.");
      watcherManager.disposeAll();

      // Only clear if there's actually a workspace value to clear
      const configAny = vscode.workspace.getConfiguration();
      const inspected = configAny.inspect("files.exclude");
      if (inspected?.workspaceValue !== undefined) {
        await exclusionManager.clearExclusions();
      }
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("gitTracked.toggle", async () => {
      const config = vscode.workspace.getConfiguration("gitTracked");
      const currentState = config.get<boolean>("enabled", false);

      await config.update(
        "enabled",
        !currentState,
        vscode.ConfigurationTarget.Workspace
      );
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("gitTracked.enabled")) {
        syncState();
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      syncState();
    })
  );

  syncState();
}

function setupWatchers(watcherManager: WatcherManager) {
  const folders = vscode.workspace.workspaceFolders || [];
  folders.forEach((folder) => watcherManager.setupWatchers(folder.uri.fsPath));
}

export function deactivate() {}
