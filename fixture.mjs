import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.env.FLOW_RESOURCE_DIR;
if (!root) throw new Error('FLOW_RESOURCE_DIR required');
const mode = process.argv[2];
if (mode === 'prepare') {
  if (process.env.FLOW_FIXTURE_FAIL_PREPARE === '1') throw new Error('Injected preparation failure');
  if (process.env.FLOW_FIXTURE_CHANGE_HEAD === '1') execFileSync('git', ['checkout', '--detach', 'HEAD^'], { stdio: 'pipe' });
  await mkdir(join(root, 'data'), { recursive: true });
} else if (mode === 'cleanup') {
  await rm(join(root, 'data'), { recursive: true, force: true });
} else if (mode === 'check') {
  execFileSync(process.execPath, ['--check', 'app.mjs'], { stdio: 'pipe' });
} else if (mode === 'accept') {
  const blankAssertions = [
    ['blank-space-rejected', ' '],
    ['blank-tab-rejected', '\t'],
    ['blank-form-feed-rejected', '\f'],
    ['blank-nbsp-rejected', '\u00a0'],
    ['blank-em-space-rejected', '\u2003'],
  ].map(([name, input]) => {
    let passed = false;
    try { execFileSync(process.execPath, ['app.mjs', input], { stdio: 'pipe' }); }
    catch (error) { passed = error.status === 2 && error.stdout?.length === 0; }
    return { name, passed };
  });
  let greeting;
  try { greeting = execFileSync(process.execPath, ['app.mjs', 'Ada'], { encoding: 'utf8' }); }
  catch { /* Record CLI failure in the greeting assertion below. */ }
  let rejected = false;
  try { execFileSync(process.execPath, ['app.mjs'], { stdio: 'pipe' }); }
  catch (error) { rejected = error.status === 2; }
  const assertions = [
    { name: 'greeting-for-name', passed: greeting === 'Hello, Ada!\n' },
    { name: 'missing-name-rejected', passed: rejected },
    ...blankAssertions,
  ];
  const passed = assertions.every(assertion => assertion.passed);
  process.stdout.write(JSON.stringify(passed ? { passed: true, assertions } : {
    schema: 'flow-command-failure-v1',
    kind: 'behavior',
    codeSha: process.env.FLOW_CODE_SHA,
    assertions,
  }) + '\n');
  if (!passed) process.exitCode = 1;
} else {
  throw new Error('Unsupported fixture phase');
}
