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
        // Load existing history for this prompt file
        const history = loadHistory(workspacePath, promptFilePath);

        // Append current user message
        const updatedHistory: Message[] = [
          ...history,
          { role: 'user', content: promptText }
        ];

        // Send full conversation history to Claude
        const message = await client.messages.create({
          model: claudeModel ?? 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: updatedHistory
        });

        const response = message.content[0].type === 'text'
          ? message.content[0].text
          : 'No response received.';

        // Append Claude's response to history and save
        const finalHistory: Message[] = [
          ...updatedHistory,
          { role: 'assistant', content: response }
        ];
        saveHistory(workspacePath, promptFilePath, finalHistory);

        // Show result in a new tab
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

      const files = fs.readdirSync(promptsPath).filter(f => f.endsWith('.txt') || f.endsWith('.md'));
      if (files.length === 0) {
        vscode.window.showErrorMessage('No .txt or .md files found in prompts folder.');
        return;
      }

      const firstFile = path.join(promptsPath, files[0]);
      const promptText = fs.readFileSync(firstFile, 'utf8');

      await sendToClaudeWithHistory(
        firstFile,
        promptText,
        `Sending "${files[0]}" to Claude...`
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
        vscode.window.showErrorMessage('No prompts folder found in this workspace.');
        return;
      }

      const files = fs.readdirSync(promptsPath).filter(f => f.endsWith('.txt') || f.endsWith('.md'));
      if (files.length === 0) {
        vscode.window.showErrorMessage('No .txt or .md files found in prompts folder.');
        return;
      }

      // If multiple prompt files exist, ask which one to clear
      let selectedFile: string | undefined;
      if (files.length === 1) {
        selectedFile = files[0];
      } else {
        selectedFile = await vscode.window.showQuickPick(files, {
          placeHolder: 'Select a prompt file to clear history for'
        });
      }

      if (!selectedFile) { return; }

      const filePath = path.join(promptsPath, selectedFile);
      clearHistory(workspacePath, filePath);
      vscode.window.showInformationMessage(`History cleared for "${selectedFile}".`);
    }
  );

  // ─── File Watcher ──────────────────────────────────────────────────────────
  const watcher = vscode.workspace.createFileSystemWatcher('**/prompts/**');

  watcher.onDidChange(async (uri) => {
    // Only process .txt and .md files instead of the folder they're in to avoid server-side errors
    const filePath = uri.fsPath;
    if (!filePath.endsWith('.txt') && !filePath.endsWith('.md')) {
      return;
    }

    const promptText = fs.readFileSync(filePath, 'utf8');
    await sendToClaudeWithHistory(
      filePath,
      promptText,
      `Auto-detected change in "${path.basename(filePath)}", sending to Claude...`
    );
  });

  context.subscriptions.push(readPromptsCommand, clearHistoryCommand, watcher);
}

export function deactivate() { }