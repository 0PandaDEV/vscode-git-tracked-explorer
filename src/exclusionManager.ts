import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { GitCommand } from "./gitCommand";

export class ExclusionManager {
  public async refresh(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders || [];
    if (folders.length === 0) return;

    const newExclusions: { [key: string]: boolean } = {
      "**/.git": true,
      "**/.DS_Store": true,
    };

    for (const folder of folders) {
      const rootPath = folder.uri.fsPath;

      const trackedFiles = await GitCommand.listTrackedFiles(rootPath);
      const trackedSet = new Set(trackedFiles.map((p) => path.normalize(p)));

      const dirsToScan = new Set<string>(["."]);
      trackedFiles.forEach((f) => {
        let current = path.dirname(f);
        while (current !== ".") {
          dirsToScan.add(current);
          current = path.dirname(current);
        }
      });

      for (const dirRelative of dirsToScan) {
        const fullDir = path.join(rootPath, dirRelative);
        if (!fs.existsSync(fullDir)) continue;

        const entries = fs.readdirSync(fullDir, { withFileTypes: true });

        for (const entry of entries) {
          const entryRelative =
            dirRelative === "."
              ? entry.name
              : path.join(dirRelative, entry.name);

          const normalizedEntry = path.normalize(entryRelative);

          if (!this.isTrackedOrParent(normalizedEntry, trackedSet)) {
            newExclusions[entryRelative] = true;
          }
        }
      }
    }

    await this.updateConfig(newExclusions);
  }

  public async clearExclusions(): Promise<void> {
    await this.updateConfig(undefined);
  }

  private async updateConfig(next: Record<string, boolean> | undefined) {
    const config = vscode.workspace.getConfiguration();

    const inspected = config.inspect<Record<string, boolean>>("files.exclude");
    const current = inspected?.workspaceValue; // what's actually in the workspace file

    const normalize = (obj?: Record<string, boolean>) => {
      if (!obj) return "";
      const keys = Object.keys(obj).sort();
      return JSON.stringify(
        keys.reduce(
          (acc, k) => ((acc[k] = obj[k]), acc),
          {} as Record<string, boolean>
        )
      );
    };

    if (normalize(current) === normalize(next)) return; // no-op => no settings.json write

    await config.update(
      "files.exclude",
      next,
      vscode.ConfigurationTarget.Workspace
    );

    // optional cleanup if we just removed the last setting
    await this.deleteEmptyWorkspaceSettingsJsonIfSafe();
  }

  private async deleteEmptyWorkspaceSettingsJsonIfSafe(): Promise<void> {
    // If it's a multi-root workspace, settings live in the .code-workspace file. [web:2]
    if (vscode.workspace.workspaceFile) return;

    const folders = vscode.workspace.workspaceFolders ?? [];
    for (const folder of folders) {
      const settingsPath = path.join(
        folder.uri.fsPath,
        ".vscode",
        "settings.json"
      );
      if (!fs.existsSync(settingsPath)) continue;

      const raw = fs.readFileSync(settingsPath, "utf8").trim();

      // Very conservative: only delete if it's exactly an empty object
      if (raw === "{}") {
        fs.unlinkSync(settingsPath);

        const vscodeDir = path.dirname(settingsPath);
        const remaining = fs.existsSync(vscodeDir)
          ? fs.readdirSync(vscodeDir)
          : [];
        if (remaining.length === 0) fs.rmdirSync(vscodeDir);
      }
    }
  }

  private isTrackedOrParent(
    candidatePath: string,
    trackedSet: Set<string>
  ): boolean {
    if (trackedSet.has(candidatePath)) return true;
    const prefix = candidatePath + path.sep;
    for (const tracked of trackedSet) {
      if (tracked.startsWith(prefix)) return true;
    }
    if (candidatePath === ".vscode") return true;
    return false;
  }
}
