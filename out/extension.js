"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
function activate(context) {
    let disposable = vscode.commands.registerCommand('claude-prompt-reader.readPrompts', async () => {
        // Get API key from VS Code settings
        const apiKey = vscode.workspace.getConfiguration('claudePromptReader').get('apiKey');
        if (!apiKey) {
            vscode.window.showErrorMessage('No API key found. Please add it in Settings → Claude Prompt Reader → Api Key.');
            return;
        }
        const client = new sdk_1.default({ apiKey });
        const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!workspacePath) {
            vscode.window.showErrorMessage('No workspace folder found.');
            return;
        }
        const promptsPath = path.join(workspacePath, 'prompts');
        if (!fs.existsSync(promptsPath)) {
            vscode.window.showErrorMessage('No prompts folder found in this workspace.');
            return;
        }
        const files = fs.readdirSync(promptsPath).filter(f => f.endsWith('.txt') || f.endsWith('.md'));
        if (files.length === 0) {
            vscode.window.showErrorMessage('No .txt or .md files found in prompts folder.');
            return;
        }
        const firstFile = path.join(promptsPath, files[0]);
        const promptText = fs.readFileSync(firstFile, 'utf8');
        // Show progress while waiting for Claude
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Sending "${files[0]}" to Claude...`,
            cancellable: false
        }, async () => {
            try {
                const message = await client.messages.create({
                    model: 'claude-sonnet-4-6',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: promptText }]
                });
                const response = message.content[0].type === 'text'
                    ? message.content[0].text
                    : 'No response received.';
                const doc = await vscode.workspace.openTextDocument({
                    content: `PROMPT:\n${promptText}\n\n---\n\nCLAUDE'S RESPONSE:\n${response}`,
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(doc);
            }
            catch (error) {
                vscode.window.showErrorMessage(`Claude API error: ${error}`);
            }
        });
    });
    context.subscriptions.push(disposable);
    // Watch the prompts folder for file saves
    const watcher = vscode.workspace.createFileSystemWatcher('**/prompts/**');
    watcher.onDidChange(async (uri) => {
        const promptText = fs.readFileSync(uri.fsPath, 'utf8');
        const apiKey = vscode.workspace.getConfiguration('claudePromptReader').get('apiKey');
        if (!apiKey) {
            return;
        }
        const client = new sdk_1.default({ apiKey });
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Auto-detected change in "${path.basename(uri.fsPath)}", sending to Claude...`,
            cancellable: false
        }, async () => {
            try {
                const message = await client.messages.create({
                    model: 'claude-sonnet-4-6',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: promptText }]
                });
                const response = message.content[0].type === 'text'
                    ? message.content[0].text
                    : 'No response received.';
                const doc = await vscode.workspace.openTextDocument({
                    content: `PROMPT:\n${promptText}\n\n---\n\nCLAUDE'S RESPONSE:\n${response}`,
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(doc);
            }
            catch (error) {
                vscode.window.showErrorMessage(`Claude API error: ${error}`);
            }
        });
    });
    context.subscriptions.push(watcher);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map