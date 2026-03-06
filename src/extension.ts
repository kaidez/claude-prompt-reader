import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand('claude-prompt-reader.readPrompts', async () => {

    // Get API key from VS Code settings
    const apiKey = vscode.workspace.getConfiguration('claudePromptReader').get<string>('apiKey');

    // If no API key has been entered in VS Code settings, show error message
    if (!apiKey) {
      vscode.window.showErrorMessage('No API key found. Please add it in Settings → Claude Prompt Reader → Api Key.');
      return;
    }

    // Initialize Anthropic client with the provided API key
    const client = new Anthropic({ apiKey });

    // Get the first workspace folder path
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

      } catch (error) {
        vscode.window.showErrorMessage(`Claude API error: ${error}`);
      }
    });
  });

  context.subscriptions.push(disposable);

  // Watch the prompts folder for file saves
  const watcher = vscode.workspace.createFileSystemWatcher('**/prompts/**');

  watcher.onDidChange(async (uri) => {
    const promptText = fs.readFileSync(uri.fsPath, 'utf8');
    const apiKey = vscode.workspace.getConfiguration('claudePromptReader').get<string>('apiKey');

    if (!apiKey) { return; }

    const client = new Anthropic({ apiKey });

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

      } catch (error) {
        vscode.window.showErrorMessage(`Claude API error: ${error}`);
      }
    });
  });

  context.subscriptions.push(watcher);
}

// Clean up resources on deactivation
export function deactivate() { }