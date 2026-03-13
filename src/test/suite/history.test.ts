import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadHistory, saveHistory, clearHistory } from '../../history';

let tmpDir: string;
let workspacePath: string;
let promptFilePath: string;

const mockMessages = [
  { role: 'user' as const, content: 'first prompt' },
  { role: 'assistant' as const, content: 'first response' },
];

suite('history.ts Tests', () => {

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-history-test-'));
    workspacePath = tmpDir;
    promptFilePath = path.join(tmpDir, 'prompts', 'my-prompt.txt');
  });

  teardown(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('Test 1: loadHistory returns empty array when no history file exists', () => {
    const result = loadHistory(workspacePath, promptFilePath);
    assert.deepStrictEqual(result, []);
  });

  test('Test 2: loadHistory returns parsed messages when history file exists', () => {
    const historyDir = path.join(workspacePath, 'history');
    fs.mkdirSync(historyDir, { recursive: true });
    const historyFile = path.join(historyDir, 'my-prompt.txt.json');
    fs.writeFileSync(historyFile, JSON.stringify(mockMessages), 'utf8');

    const result = loadHistory(workspacePath, promptFilePath);
    assert.deepStrictEqual(result, mockMessages);
  });

  test('Test 3: saveHistory creates the history directory if it does not exist', () => {
    const historyDir = path.join(workspacePath, 'history');
    assert.ok(!fs.existsSync(historyDir));

    saveHistory(workspacePath, promptFilePath, mockMessages);

    assert.ok(fs.existsSync(historyDir));
  });

  test('Test 4: saveHistory writes the correct JSON structure to the correct path', () => {
    saveHistory(workspacePath, promptFilePath, mockMessages);

    const historyFile = path.join(workspacePath, 'history', 'my-prompt.txt.json');
    assert.ok(fs.existsSync(historyFile));

    const written = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
    assert.deepStrictEqual(written, mockMessages);
  });

  test('Test 5: clearHistory deletes the history file when it exists', () => {
    saveHistory(workspacePath, promptFilePath, mockMessages);
    const historyFile = path.join(workspacePath, 'history', 'my-prompt.txt.json');
    assert.ok(fs.existsSync(historyFile));

    clearHistory(workspacePath, promptFilePath);

    assert.ok(!fs.existsSync(historyFile));
  });

  test('Test 6: clearHistory does nothing when no history file exists', () => {
    assert.doesNotThrow(() => {
      clearHistory(workspacePath, promptFilePath);
    });
  });
});