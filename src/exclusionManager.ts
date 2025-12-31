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

  private async updateConfig(value: any) {
    const config = vscode.workspace.getConfiguration();
    await config.update(
      "files.exclude",
      value,
      vscode.ConfigurationTarget.Workspace
    );
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
