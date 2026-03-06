import * as path from 'path';
import * as fs from 'fs';
import Mocha = require('mocha');

export function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'tdd', color: true });
  const testsRoot = path.resolve(__dirname, '.');

  return new Promise((resolve, reject) => {
    try {
      // Find all .test.js files using fs instead of glob
      const files = fs.readdirSync(testsRoot)
        .filter((file: string) => file.endsWith('.test.js'));

      files.forEach((file: string) => {
        mocha.addFile(path.resolve(testsRoot, file));
      });

      mocha.run((failures: number) => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}