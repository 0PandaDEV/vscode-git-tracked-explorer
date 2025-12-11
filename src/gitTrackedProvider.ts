import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import * as fs from 'fs';

export class GitTrackedProvider implements vscode.TreeDataProvider<FileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileItem | undefined | null | void> = new vscode.EventEmitter<FileItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<FileItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string | undefined) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: FileItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: FileItem): Promise<FileItem[]> {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No workspace folder open');
            return [];
        }

        if (element) {
            // Return children of a directory
            return this.getFilesInDirectory(element.resourceUri.fsPath);
        } else {
            // Return root level git tracked files
            return this.getGitTrackedFiles();
        }
    }

    private async getGitTrackedFiles(): Promise<FileItem[]> {
        if (!this.workspaceRoot) {
            return [];
        }

        return new Promise((resolve) => {
            cp.exec('git ls-files', { cwd: this.workspaceRoot }, (error, stdout, stderr) => {
                if (error) {
                    console.error('Error executing git ls-files:', error);
                    vscode.window.showErrorMessage('Failed to get git tracked files. Make sure this is a git repository.');
                    resolve([]);
                    return;
                }

                const files = stdout
                    .split('\n')
                    .filter(file => file.trim() !== '')
                    .map(file => file.trim());

                const tree = this.buildFileTree(files);
                resolve(tree);
            });
        });
    }

    private buildFileTree(files: string[]): FileItem[] {
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
        return this.convertToFileItems(root, this.workspaceRoot!);
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
                    true
                ));
            } else {
                // File
                items.push(new FileItem(
                    key,
                    vscode.Uri.file(fullPath),
                    vscode.TreeItemCollapsibleState.None,
                    false
                ));
            }
        });

        return items;
    }

    private async getFilesInDirectory(dirPath: string): Promise<FileItem[]> {
        if (!this.workspaceRoot) {
            return [];
        }

        return new Promise((resolve) => {
            cp.exec('git ls-files', { cwd: this.workspaceRoot }, (error, stdout, stderr) => {
                if (error) {
                    resolve([]);
                    return;
                }

                const relativeDirPath = path.relative(this.workspaceRoot!, dirPath);
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
                        isDirectory
                    ));
                });

                resolve(items);
            });
        });
    }
}

class FileItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly resourceUri: vscode.Uri,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly isDirectory: boolean
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
