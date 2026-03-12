import * as fs from 'fs';
import * as path from 'path';

// The shape of all coming and going messages.  "extension.ts" needs this to manage the convo history
export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function getHistoryPath(workspacePath: string, promptFilePath: string): string {
  const historyDir = path.join(workspacePath, 'history');
  const promptFileName = path.basename(promptFilePath);
  return path.join(historyDir, `${promptFileName}.json`);
}

export function loadHistory(workspacePath: string, promptFilePath: string): Message[] {
  const historyPath = getHistoryPath(workspacePath, promptFilePath);

  if (!fs.existsSync(historyPath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(historyPath, 'utf8');
    return JSON.parse(raw) as Message[];
  } catch {
    return [];
  }
}

export function saveHistory(workspacePath: string, promptFilePath: string, messages: Message[]): void {
  const historyDir = path.join(workspacePath, 'history');

  if (!fs.existsSync(historyDir)) {
    fs.mkdirSync(historyDir, { recursive: true });
  }

  const historyPath = getHistoryPath(workspacePath, promptFilePath);
  fs.writeFileSync(historyPath, JSON.stringify(messages, null, 2), 'utf8');
}

export function clearHistory(workspacePath: string, promptFilePath: string): void {
  const historyPath = getHistoryPath(workspacePath, promptFilePath);

  if (fs.existsSync(historyPath)) {
    fs.unlinkSync(historyPath);
  }
}