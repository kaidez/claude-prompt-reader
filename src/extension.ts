import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { Message, loadHistory, saveHistory, clearHistory } from './history';

export function activate(context: vscode.ExtensionContext) {

  // ─── Helper: send prompt to Claude with history ───────────────────────────
  async function sendToClaudeWithHistory(
    promptFilePath: string,
    promptText: string,
    progressTitle: string
  ): Promise<void> {
    const apiKey = vscode.workspace.getConfiguration('claudePromptReader').get<string>('apiKey');
    const claudeModel = vscode.workspace.getConfiguration('claudePromptReader').get<string>('modelDropdown');

    if (!apiKey) {
      vscode.window.showErrorMessage('No API key found. Please add it in Settings → Claude Prompt Reader → Api Key.');
      return;
    }

    const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspacePath) {
      vscode.window.showErrorMessage('No workspace folder found.');
      return;
    }

    const client = new Anthropic({ apiKey });

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: progressTitle,
      cancellable: false
    }, async () => {
      try {
        const history = loadHistory(workspacePath, promptFilePath);

        const updatedHistory: Message[] = [
          ...history,
          { role: 'user', content: promptText }
        ];

        const message = await client.messages.create({
          model: claudeModel ?? 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: updatedHistory
        });

        const response = message.content[0].type === 'text'
          ? message.content[0].text
          : 'No response received.';

        const finalHistory: Message[] = [
          ...updatedHistory,
          { role: 'assistant', content: response }
        ];
        saveHistory(workspacePath, promptFilePath, finalHistory);

        const turnCount = Math.floor(finalHistory.length / 2);
        const doc = await vscode.workspace.openTextDocument({
          content: `CONVERSATION TURN ${turnCount}\n\nPROMPT:\n${promptText}\n\n---\n\nCLAUDE'S RESPONSE:\n${response}`,
          language: 'markdown'
        });

        await vscode.window.showTextDocument(doc);

      } catch (error) {
        vscode.window.showErrorMessage(`Claude API error: ${error}`);
      }
    });
  }

  // ─── Helper: get watched file selection ───────────────────────────────────
  async function selectWatchedFile(promptsPath: string): Promise<string | undefined> {
    const files = fs.readdirSync(promptsPath)
      .filter(f => f.endsWith('.txt') || f.endsWith('.md'));

    if (files.length === 0) {
      vscode.window.showErrorMessage('No .txt or .md files found in prompts folder.');
      return undefined;
    }

    if (files.length === 1) {
      return files[0];
    }

    return await vscode.window.showQuickPick(files, {
      placeHolder: 'Select a prompt file to watch'
    });
  }

  // ─── Command: Read Prompts ─────────────────────────────────────────────────
  const readPromptsCommand = vscode.commands.registerCommand(
    'claude-prompt-reader.readPrompts',
    async () => {
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

      // Check if the focused editor is a prompt file
      const activeEditor = vscode.window.activeTextEditor;
      const activePath = activeEditor?.document.uri.fsPath;
      const isPromptFile = activePath &&
        activePath.startsWith(promptsPath) &&
        (activePath.endsWith('.txt') || activePath.endsWith('.md'));

      let selectedFilePath: string;

      if (isPromptFile && activePath) {
        // Use the focused file directly — no QuickPick needed
        selectedFilePath = activePath;
      } else {
        // No prompt file focused — fall back to QuickPick
        const selectedFile = await selectWatchedFile(promptsPath);
        if (!selectedFile) { return; }
        selectedFilePath = path.join(promptsPath, selectedFile);
      }

      const promptText = fs.readFileSync(selectedFilePath, 'utf8');
      await sendToClaudeWithHistory(
        selectedFilePath,
        promptText,
        `Sending "${path.basename(selectedFilePath)}" to Claude...`
      );
    }
  );

  // ─── Command: Clear History ────────────────────────────────────────────────
  const clearHistoryCommand = vscode.commands.registerCommand(
    'claude-prompt-reader.clearHistory',
    async () => {
      const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
      if (!workspacePath) {
        vscode.window.showErrorMessage('No workspace folder found.');
        return;
      }

      const promptsPath = path.join(workspacePath, 'prompts');
      if (!fs.existsSync(promptsPath)) {
        vscode.window.showErrorMessage('No prompts folder found.');
        return;
      }

      const scope = await vscode.window.showQuickPick(
        [
          { label: 'Clear history for one prompt file', value: 'single' },
          { label: 'Clear all history for all prompt files', value: 'all' }
        ],
        { placeHolder: 'What would you like to clear?' }
      );

      if (!scope) { return; }

      if (scope.value === 'all') {
        const confirm = await vscode.window.showWarningMessage(
          'This will delete history for all prompt files. Are you sure?',
          'Yes, clear all',
          'Cancel'
        );
        if (confirm !== 'Yes, clear all') { return; }

        const historyDir = path.join(workspacePath, 'history');
        if (fs.existsSync(historyDir)) {
          fs.readdirSync(historyDir).forEach(file => {
            fs.unlinkSync(path.join(historyDir, file));
          });
        }
        vscode.window.showInformationMessage('All history cleared.');
        return;
      }

      const selectedFile = await selectWatchedFile(promptsPath);
      if (!selectedFile) { return; }

      const filePath = path.join(promptsPath, selectedFile);
      clearHistory(workspacePath, filePath);
      vscode.window.showInformationMessage(`History cleared for "${selectedFile}".`);
    }
  );

  // ─── File Watcher Setup ────────────────────────────────────────────────────
  let watchedFile: string | undefined;

  const watcher = vscode.workspace.createFileSystemWatcher('**/prompts/**');

  watcher.onDidChange(async (uri) => {
    const fileName = path.basename(uri.fsPath);

    // Guard: ignore non-prompt files
    if (!uri.fsPath.endsWith('.txt') && !uri.fsPath.endsWith('.md')) {
      return;
    }

    // First save — ask the user which file to watch
    if (!watchedFile) {
      const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
      if (!workspacePath) { return; }

      const promptsPath = path.join(workspacePath, 'prompts');
      watchedFile = await selectWatchedFile(promptsPath);
      if (!watchedFile) { return; }
    }

    // Only process the watched file
    if (fileName !== watchedFile) { return; }

    const promptText = fs.readFileSync(uri.fsPath, 'utf8');
    await sendToClaudeWithHistory(
      uri.fsPath,
      promptText,
      `Auto-detected change in "${fileName}", sending to Claude...`
    );
  });

  context.subscriptions.push(readPromptsCommand, clearHistoryCommand, watcher);
}

export function deactivate() { }