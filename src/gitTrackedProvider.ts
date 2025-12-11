import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GitCommand } from './gitCommand';

/**
 * Tree data provider for git tracked files.
 * Follows: "If the implementation is easy to explain, it may be a good idea"
 */
export class GitTrackedProvider implements vscode.TreeDataProvider<TreeNode> {
    private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

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
            return this.getRootChildren();
        }

        if (element instanceof WorkspaceFolderItem) {
            return this.getWorkspaceFolderChildren(element);
        }

        if (element instanceof FileItem) {
            return this.getDirectoryChildren(element);
        }

        return [];
    }

    /**
     * Get root level children (workspace folders or files).
     * Follows: "Flat is better than nested"
     */
    private async getRootChildren(): Promise<TreeNode[]> {
        if (this.workspaceFolders.length === 0) {
            vscode.window.showInformationMessage('No workspace folder open');
            return [];
        }

        // Single workspace: show files directly
        if (this.workspaceFolders.length === 1) {
            return this.getTrackedFiles(this.workspaceFolders[0].uri.fsPath);
        }

        // Multi-root: show only workspace folders with git repositories
        const gitFolders = await this.filterGitFolders();
        return gitFolders.map(folder => new WorkspaceFolderItem(folder));
    }

    /**
     * Get tracked files for a workspace folder.
     */
    private async getWorkspaceFolderChildren(item: WorkspaceFolderItem): Promise<TreeNode[]> {
        return this.getTrackedFiles(item.workspaceFolder.uri.fsPath);
    }

    /**
     * Get children for a directory.
     */
    private async getDirectoryChildren(item: FileItem): Promise<TreeNode[]> {
        return this.getDirectoryFiles(item.resourceUri.fsPath, item.workspaceRoot);
    }

    /**
     * Filter workspace folders that have git repositories.
     * Follows: "There should be one obvious way to do it"
     */
    private async filterGitFolders(): Promise<vscode.WorkspaceFolder[]> {
        const checks = await Promise.all(
            this.workspaceFolders.map(folder =>
                GitCommand.hasGitRepo(folder.uri.fsPath)
            )
        );
        return this.workspaceFolders.filter((_, index) => checks[index]);
    }

    /**
     * Get git tracked files as tree structure.
     * Follows: "Simple is better than complex"
     */
    private async getTrackedFiles(workspaceRoot: string): Promise<FileItem[]> {
        const files = await GitCommand.listTrackedFiles(workspaceRoot);
        if (files.length === 0) {
            return [];
        }
        return this.buildFileTree(files, workspaceRoot);
    }

    /**
     * Build tree structure from flat file list.
     */
    private buildFileTree(files: string[], workspaceRoot: string): FileItem[] {
        const tree = this.createTreeStructure(files);
        return this.convertTreeToItems(tree, workspaceRoot);
    }

    /**
     * Create nested tree structure from file paths.
     * Follows: "Readability counts"
     */
    private createTreeStructure(files: string[]): TreeStructure {
        const root: TreeStructure = {};

        files.forEach(file => {
            const parts = file.split('/');
            let current = root;

            parts.forEach((part, index) => {
                const isFile = index === parts.length - 1;
                if (!current[part]) {
                    current[part] = isFile ? null : {};
                }
                if (!isFile) {
                    current = current[part] as TreeStructure;
                }
            });
        });

        return root;
    }

    /**
     * Convert tree structure to FileItem array.
     */
    private convertTreeToItems(tree: TreeStructure, basePath: string): FileItem[] {
        return Object.keys(tree)
            .sort()
            .map(key => this.createFileItem(key, tree[key], basePath));
    }

    /**
     * Create FileItem from tree node.
     * Follows: "Explicit is better than implicit"
     */
    private createFileItem(name: string, node: TreeStructure | null, basePath: string): FileItem {
        const fullPath = path.join(basePath, name);
        const isDirectory = node !== null;
        const collapsibleState = isDirectory
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None;

        return new FileItem(name, vscode.Uri.file(fullPath), collapsibleState, isDirectory, basePath);
    }

    /**
     * Get files in a directory.
     */
    private async getDirectoryFiles(dirPath: string, workspaceRoot: string): Promise<FileItem[]> {
        const allFiles = await GitCommand.listTrackedFiles(workspaceRoot);
        if (allFiles.length === 0) {
            return [];
        }

        const relativeDirPath = path.relative(workspaceRoot, dirPath);
        const directChildren = this.extractDirectChildren(allFiles, relativeDirPath);

        return Array.from(directChildren)
            .sort()
            .map(name => this.createDirectoryItem(name, dirPath, workspaceRoot));
    }

    /**
     * Extract direct children from file list.
     * Follows: "Simple is better than complex"
     */
    private extractDirectChildren(files: string[], relativeDirPath: string): Set<string> {
        const prefix = relativeDirPath ? relativeDirPath + '/' : '';
        const children = new Set<string>();

        files.forEach(file => {
            if (file.startsWith(prefix)) {
                const remainder = file.substring(prefix.length);
                if (remainder.length > 0) {
                    const firstPart = remainder.split('/')[0];
                    children.add(firstPart);
                }
            }
        });

        return children;
    }

    /**
     * Create FileItem for directory child.
     */
    private createDirectoryItem(name: string, dirPath: string, workspaceRoot: string): FileItem {
        const fullPath = path.join(dirPath, name);
        const isDirectory = fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
        const collapsibleState = isDirectory
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None;

        return new FileItem(name, vscode.Uri.file(fullPath), collapsibleState, isDirectory, workspaceRoot);
    }
}

/**
 * Tree structure type.
 * null = file, object = directory
 */
type TreeStructure = { [key: string]: TreeStructure | null };

/**
 * Union type for all tree nodes.
 */
type TreeNode = WorkspaceFolderItem | FileItem;

/**
 * Tree item for workspace folder.
 */
class WorkspaceFolderItem extends vscode.TreeItem {
    constructor(public readonly workspaceFolder: vscode.WorkspaceFolder) {
        super(workspaceFolder.name, vscode.TreeItemCollapsibleState.Collapsed);
        this.tooltip = workspaceFolder.uri.fsPath;
        this.contextValue = 'workspaceFolder';
        this.iconPath = vscode.ThemeIcon.Folder;
        this.description = workspaceFolder.uri.fsPath;
    }
}

/**
 * Tree item for file or directory.
 */
class FileItem extends vscode.TreeItem {
    constructor(
        label: string,
        public readonly resourceUri: vscode.Uri,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly isDirectory: boolean,
        public readonly workspaceRoot: string
    ) {
        super(label, collapsibleState);
        this.resourceUri = resourceUri;
        this.tooltip = resourceUri.fsPath;
        this.contextValue = isDirectory ? 'directory' : 'file';
        this.iconPath = isDirectory ? vscode.ThemeIcon.Folder : vscode.ThemeIcon.File;

        if (!isDirectory) {
            this.command = {
                command: 'gitTrackedExplorer.openFile',
                title: 'Open File',
                arguments: [resourceUri]
            };
        }
    }
}
