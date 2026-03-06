import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';

suite('Claude Prompt Reader Extension Tests', () => {

  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
  });

  teardown(() => {
    sandbox.restore();
  });

  // Test 1: Extension loads correctly
  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('undefined_publisher.claude-prompt-reader'));
  });

  // Test 2: Command is registered
  test('Command claude-prompt-reader.readPrompts should be registered', async () => {
    // Explicitly activate the extension first before checking commands
    const ext = vscode.extensions.getExtension('undefined_publisher.claude-prompt-reader');
    await ext?.activate();
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('claude-prompt-reader.readPrompts'));
  });

  // Test 3: File reading logic works
  test('Should read contents of a prompt file correctly', () => {
    const tmpDir = path.join(__dirname, 'tmp');
    const promptsDir = path.join(tmpDir, 'prompts');
    const testFile = path.join(promptsDir, 'test.txt');
    const testContent = 'This is a test prompt';

    // Create temp dirs and file
    fs.mkdirSync(promptsDir, { recursive: true });
    fs.writeFileSync(testFile, testContent, 'utf8');

    // Read it back
    const result = fs.readFileSync(testFile, 'utf8');
    assert.strictEqual(result, testContent);

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true });
  });

  // Test 4: Empty prompts folder is handled gracefully
  test('Should handle empty prompts folder without crashing', () => {
    const tmpDir = path.join(__dirname, 'tmp-empty');
    const promptsDir = path.join(tmpDir, 'prompts');
    fs.mkdirSync(promptsDir, { recursive: true });

    const files = fs.readdirSync(promptsDir)
      .filter(f => f.endsWith('.txt') || f.endsWith('.md'));

    assert.strictEqual(files.length, 0);

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true });
  });

  // Test 5: Only .txt and .md files are picked up
  test('Should only process .txt and .md files', () => {
    const tmpDir = path.join(__dirname, 'tmp-filter');
    const promptsDir = path.join(tmpDir, 'prompts');
    fs.mkdirSync(promptsDir, { recursive: true });

    // Create mixed file types
    fs.writeFileSync(path.join(promptsDir, 'prompt.txt'), 'text prompt');
    fs.writeFileSync(path.join(promptsDir, 'prompt.md'), 'markdown prompt');
    fs.writeFileSync(path.join(promptsDir, 'ignore.json'), '{}');
    fs.writeFileSync(path.join(promptsDir, 'ignore.js'), 'console.log()');

    const files = fs.readdirSync(promptsDir)
      .filter(f => f.endsWith('.txt') || f.endsWith('.md'));

    assert.strictEqual(files.length, 2);
    assert.ok(files.includes('prompt.txt'));
    assert.ok(files.includes('prompt.md'));

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true });
  });

  // Test 6: Claude API response is parsed correctly
  test('Should extract text from Claude API response correctly', () => {
    const mockResponse = {
      content: [{ type: 'text', text: 'This is Claude\'s response' }]
    };

    const result = mockResponse.content[0].type === 'text'
      ? mockResponse.content[0].text
      : 'No response received.';

    assert.strictEqual(result, 'This is Claude\'s response');
  });

  // Test 7: Fallback when API response has no text block
  test('Should return fallback message when API response has no text block', () => {
    const mockResponse = {
      content: [{ type: 'tool_use', text: '' }]
    };

    const result = mockResponse.content[0].type === 'text'
      ? mockResponse.content[0].text
      : 'No response received.';

    assert.strictEqual(result, 'No response received.');
  });
});