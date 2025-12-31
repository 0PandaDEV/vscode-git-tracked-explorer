import * as cp from "child_process";

export class GitCommand {
  static async hasGitRepo(cwd: string): Promise<boolean> {
    return this.exec("[ -e .git ]", cwd)
      .then(() => true)
      .catch(() => false);
  }

  static async getGitDir(cwd: string): Promise<string | null> {
    try {
      const gitDir = await this.exec(
        "[ -e .git ] && git rev-parse --git-dir",
        cwd
      );
      return this.resolveGitDir(gitDir.trim(), cwd);
    } catch {
      return null;
    }
  }

  static async listTrackedFiles(cwd: string): Promise<string[]> {
    try {
      const output = await this.exec("[ -e .git ] && git ls-files", cwd);
      return output
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    } catch {
      return [];
    }
  }

  private static exec(command: string, cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      cp.exec(command, { cwd }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
  }

  private static resolveGitDir(gitDir: string, cwd: string): string {
    const path = require("path");
    return path.isAbsolute(gitDir) ? gitDir : path.resolve(cwd, gitDir);
  }
}
