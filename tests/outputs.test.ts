import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const rules = new URL('../tools/apple-store-rules.sh', import.meta.url).pathname;

/**
 * Reads a file of workflow outputs the way the runner of the workflow does.
 *
 * The runner reads the file line by line. A line is "name=value", and the
 * value is everything after the first "=". A line of the form "name<<EOF"
 * starts a value that ends at the next line that is exactly "EOF"; when
 * that line is missing, the runner fails the whole step.
 */
function readOutputs(text: string): Record<string, string> {
  const outputs: Record<string, string> = {};
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line === '') continue;

    const heredoc = line.indexOf('<<');
    const equals = line.indexOf('=');

    if (heredoc >= 0 && (equals < 0 || heredoc < equals)) {
      const name = line.slice(0, heredoc);
      const delimiter = line.slice(heredoc + 2);
      const value: string[] = [];
      let found = false;

      for (i++; i < lines.length; i++) {
        const next = lines[i] ?? '';
        if (next === delimiter) {
          found = true;
          break;
        }
        value.push(next);
      }

      assert.ok(found, `the value of ${name} has no line that is exactly ${delimiter}`);
      outputs[name] = value.join('\n');
    } else {
      assert.ok(equals >= 0, `the line "${line}" is neither a name=value nor a name<<delimiter`);
      outputs[line.slice(0, equals)] = line.slice(equals + 1);
    }
  }

  return outputs;
}

/** Writes a value with the helper of the rules and reads the file back. */
function writeThroughHelper(name: string, value: string): Record<string, string> {
  const directory = mkdtempSync(join(tmpdir(), 'md-reader-output-'));
  const file = join(directory, 'output');

  try {
    execFileSync(
      'bash',
      [
        '-c',
        `export GITHUB_OUTPUT="$1"; source "$2"; write_output "$3" "$4"`,
        'bash',
        file,
        rules,
        name,
        value,
      ],
      { encoding: 'utf8' },
    );

    return readOutputs(readFileSync(file, 'utf8'));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('a value with line breaks in it is written on one line', () => {
  const outputs = writeThroughHelper(
    'profile_details',
    'name=MD Reader Mac Profile\nplatform=OSX\nsandbox=no',
  );

  assert.equal(
    outputs.profile_details,
    'name=MD Reader Mac Profile platform=OSX sandbox=no',
  );
});

test('a value with an "=" in it keeps the whole value', () => {
  // The runner splits a name=value line on the first "=", so the "=" inside
  // the value is kept.
  const outputs = writeThroughHelper('profile_details', 'app-id=com.example.app');

  assert.equal(outputs.profile_details, 'app-id=com.example.app');
});

test('a value is not written when there is no file to write it to', () => {
  const result = execFileSync(
    'bash',
    ['-c', `source "$1" && write_output "name" "value"`, 'bash', rules],
    { encoding: 'utf8' },
  );

  assert.equal(result.trim(), '');
});
