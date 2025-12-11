import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import * as fs from 'fs';

export class GitTrackedProvider implements vscode.TreeDataProvider<TreeNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined | null | void> = new vscode.EventEmitter<TreeNode | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private workspaceFolders: readonly vscode.WorkspaceFolder[]) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    updateWorkspaceFolders(folders: readonly vscode.WorkspaceFolder[]): void {
        this.workspaceFolders = folders;
        this.refresh();
    }

    getTreeItem(element: TreeNode): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TreeNode): Promise<TreeNode[]> {
        if (!element) {
            // Root level: return workspace folders
            if (this.workspaceFolders.length === 0) {
                vscode.window.showInformationMessage('No workspace folder open');
                return [];
            }

            // Single workspace: show files directly
            if (this.workspaceFolders.length === 1) {
                return this.getGitTrackedFiles(this.workspaceFolders[0].uri.fsPath);
            }

            // Multi-root: show only workspace folders with git repositories
            const gitFolders = await this.filterGitFolders(this.workspaceFolders);
            return gitFolders.map(folder => new WorkspaceFolderItem(folder));
        }

        if (element instanceof WorkspaceFolderItem) {
            // Return git tracked files for this workspace folder
            return this.getGitTrackedFiles(element.workspaceFolder.uri.fsPath);
        }

        if (element instanceof FileItem) {
            // Return children of a directory
            return this.getFilesInDirectory(element.resourceUri.fsPath, element.workspaceRoot);
        }

        return [];
    }

    private async filterGitFolders(folders: readonly vscode.WorkspaceFolder[]): Promise<vscode.WorkspaceFolder[]> {
        const checks = await Promise.all(
            folders.map(folder => this.hasGitRepository(folder.uri.fsPath))
        );

        return folders.filter((_, index) => checks[index]);
    }

    private async hasGitRepository(workspaceRoot: string): Promise<boolean> {
        return new Promise((resolve) => {
            const checkGit = '[ -e .git ]';

            cp.exec(checkGit, { cwd: workspaceRoot }, (error) => {
                resolve(!error);
            });
        });
    }

    private async getGitTrackedFiles(workspaceRoot: string): Promise<FileItem[]> {
        return new Promise((resolve) => {
            // Only process if .git exists in current directory (don't traverse up)
            const checkAndList = '[ -e .git ] && git ls-files';

            cp.exec(checkAndList, { cwd: workspaceRoot }, (error, stdout, stderr) => {
                if (error) {
                    // No .git in this directory, return empty
                    console.log('No git repository in:', workspaceRoot);
                    resolve([]);
                    return;
                }

                const files = stdout
                    .split('\n')
                    .filter(file => file.trim() !== '')
                    .map(file => file.trim());

                const tree = this.buildFileTree(files, workspaceRoot);
                resolve(tree);
            });
        });
    }

    private buildFileTree(files: string[], workspaceRoot: string): FileItem[] {
        const root: { [key: string]: any } = {};

        // Build tree structure
        files.forEach(file => {
            const parts = file.split('/');
            let current = root;

            parts.forEach((part, index) => {
                if (!current[part]) {
                    current[part] = index === parts.length - 1 ? null : {};
                }
                if (current[part] !== null) {
                    current = current[part];
                }
            });
        });

        // Convert tree structure to FileItem array
        return this.convertToFileItems(root, workspaceRoot);
    }

    private convertToFileItems(node: any, basePath: string): FileItem[] {
        const items: FileItem[] = [];

        Object.keys(node).sort().forEach(key => {
            const fullPath = path.join(basePath, key);
            const isDirectory = node[key] !== null;

            if (isDirectory) {
                // Directory
                items.push(new FileItem(
                    key,
                    vscode.Uri.file(fullPath),
                    vscode.TreeItemCollapsibleState.Collapsed,
                    true,
                    basePath
                ));
            } else {
                // File
                items.push(new FileItem(
                    key,
                    vscode.Uri.file(fullPath),
                    vscode.TreeItemCollapsibleState.None,
                    false,
                    basePath
                ));
            }
        });

        return items;
    }

    private async getFilesInDirectory(dirPath: string, workspaceRoot: string): Promise<FileItem[]> {
        return new Promise((resolve) => {
            // Only process if .git exists in current directory (don't traverse up)
            const checkAndList = '[ -e .git ] && git ls-files';

            cp.exec(checkAndList, { cwd: workspaceRoot }, (error, stdout, stderr) => {
                if (error) {
                    resolve([]);
                    return;
                }

                const relativeDirPath = path.relative(workspaceRoot, dirPath);
                const allFiles = stdout
                    .split('\n')
                    .filter(file => file.trim() !== '')
                    .map(file => file.trim());

                // Filter files that are direct children of this directory
                const prefix = relativeDirPath ? relativeDirPath + '/' : '';
                const childrenFiles = allFiles
                    .filter(file => file.startsWith(prefix))
                    .map(file => file.substring(prefix.length))
                    .filter(file => file.length > 0);

                // Group into direct children only
                const directChildren = new Set<string>();
                childrenFiles.forEach(file => {
                    const firstPart = file.split('/')[0];
                    directChildren.add(firstPart);
                });

                const items: FileItem[] = [];
                Array.from(directChildren).sort().forEach(name => {
                    const fullPath = path.join(dirPath, name);
                    const isDirectory = fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();

                    items.push(new FileItem(
                        name,
                        vscode.Uri.file(fullPath),
                        isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                        isDirectory,
                        workspaceRoot
                    ));
                });

                resolve(items);
            });
        });
    }
}

// Union type for all tree node types
type TreeNode = WorkspaceFolderItem | FileItem;

class WorkspaceFolderItem extends vscode.TreeItem {
    constructor(public readonly workspaceFolder: vscode.WorkspaceFolder) {
        super(workspaceFolder.name, vscode.TreeItemCollapsibleState.Collapsed);

        this.tooltip = workspaceFolder.uri.fsPath;
        this.contextValue = 'workspaceFolder';
        this.iconPath = vscode.ThemeIcon.Folder;
        this.description = workspaceFolder.uri.fsPath;
    }
}

class FileItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly resourceUri: vscode.Uri,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly isDirectory: boolean,
        public readonly workspaceRoot: string
    ) {
        super(label, collapsibleState);

        this.resourceUri = resourceUri;
        this.tooltip = resourceUri.fsPath;

        if (!isDirectory) {
            this.command = {
                command: 'gitTrackedExplorer.openFile',
                title: 'Open File',
                arguments: [resourceUri]
            };
            this.contextValue = 'file';
        } else {
            this.contextValue = 'directory';
        }

        // Set icon
        if (isDirectory) {
            this.iconPath = vscode.ThemeIcon.Folder;
        } else {
            this.iconPath = vscode.ThemeIcon.File;
        }
    }
}
