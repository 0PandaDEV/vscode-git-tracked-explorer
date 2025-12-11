import * as cp from 'child_process';

/**
 * Utility for executing git commands with consistent error handling.
 * Follows: "There should be one obvious way to do it"
 */
export class GitCommand {
    /**
     * Check if .git exists in the given directory (no parent traversal).
     */
    static async hasGitRepo(cwd: string): Promise<boolean> {
        return this.exec('[ -e .git ]', cwd)
            .then(() => true)
            .catch(() => false);
    }

    /**
     * Get git directory path (supports --separate-git-dir).
     * Returns absolute path or null if not a git repository.
     */
    static async getGitDir(cwd: string): Promise<string | null> {
        try {
            const gitDir = await this.exec('[ -e .git ] && git rev-parse --git-dir', cwd);
            return this.resolveGitDir(gitDir.trim(), cwd);
        } catch {
            return null;
        }
    }

    /**
     * Get list of git tracked files.
     * Returns empty array if not a git repository.
     */
    static async listTrackedFiles(cwd: string): Promise<string[]> {
        try {
            const output = await this.exec('[ -e .git ] && git ls-files', cwd);
            return output
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
        } catch {
            return [];
        }
    }

    /**
     * Execute shell command and return stdout.
     * Follows: "Explicit is better than implicit"
     */
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

    /**
     * Resolve git directory path to absolute path.
     * Follows: "Simple is better than complex"
     */
    private static resolveGitDir(gitDir: string, cwd: string): string {
        const path = require('path');
        return path.isAbsolute(gitDir) ? gitDir : path.resolve(cwd, gitDir);
    }
}
