const { execFile } = require('child_process');
const { spawn }    = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const TIMEOUT_MS = 15000;

const LANG_CONFIG = {
  cpp: {
    filename:   'main.cpp',
    needsBuild: true,
  },
  python: {
    filename:   'main.py',
    needsBuild: false,
    image:      'python:3.11-alpine',
    runCmd:     (f) => ['python3', f],
  },
  javascript: {
    filename:   'main.js',
    needsBuild: false,
    image:      'node:20-alpine',
    runCmd:     (f) => ['node', f],
  },
};

async function executeCode(code, language, stdin = '') {
  const config = LANG_CONFIG[language];
  if (!config) {
    return { error: `Language "${language}" not supported. Use: cpp, python, javascript` };
  }

  const tmpDir    = fs.mkdtempSync(path.join(os.tmpdir(), 'collab-exec-'));
  const srcFile   = path.join(tmpDir, config.filename);
  const startTime = Date.now();

  try {
    fs.writeFileSync(srcFile, code, 'utf8');

    let result;

    if (language === 'cpp') {
      result = await runCpp(tmpDir, config.filename, stdin);
    } else {
      result = await runInterpreted(
        config.image,
        tmpDir,
        config.filename,
        config.runCmd(`/code/${config.filename}`),
        stdin
      );
    }

    cleanup(tmpDir);
    return { ...result, executionTime: Date.now() - startTime, error: null };

  } catch (err) {
    cleanup(tmpDir);
    const executionTime = Date.now() - startTime;

    if (err.message?.includes('Cannot connect') || err.message?.includes('ENOENT')) {
      return { stdout: '', stderr: '', exitCode: 1, executionTime,
               error: 'Docker is not available. Make sure Docker Desktop is running.' };
    }

    return { stdout: '', stderr: err.message, exitCode: 1, executionTime, error: null };
  }
}

/**
 * C++: compile with g++ inside docker, then run the binary
 * Uses a single container with sh -c so we only need one image pull
 */
async function runCpp(tmpDir, filename, stdin) {
  // Step 1: compile
  // Use frolvlad/alpine-gxx — small image with g++ pre-installed
  const compileArgs = [
    'run', '--rm',
    '--network=none',
    '--memory=256m', '--cpus=1',
    '-v', `${tmpDir}:/code`,
    '-w', '/code',
    'frolvlad/alpine-gxx',
    'g++', '-o', '/code/program', `/code/${filename}`, '-std=c++17',
  ];

  try {
    await execFileAsync('docker', compileArgs, { timeout: TIMEOUT_MS });
  } catch (err) {
    return {
      stdout: '',
      stderr: err.stderr || err.stdout || err.message,
      exitCode: 1,
      stage: 'compilation',
    };
  }

  // Step 2: run
  const runArgs = [
    'run', '--rm',
    '--network=none',
    '--memory=128m', '--cpus=0.5',
    '-v', `${tmpDir}:/code:ro`,
    '-w', '/code',
    'frolvlad/alpine-gxx',
    '/code/program',
  ];

  const runResult = await spawnWithStdin('docker', runArgs, stdin, TIMEOUT_MS);
  return { ...runResult, stage: 'runtime' };
}

/**
 * Python / JavaScript: just run directly
 */
async function runInterpreted(image, tmpDir, filename, runCmd, stdin) {
  const args = [
    'run', '--rm',
    '--network=none',
    '--memory=128m', '--cpus=0.5',
    '-v', `${tmpDir}:/code:ro`,
    '-w', '/code',
    image,
    ...runCmd,
  ];

  const result = await spawnWithStdin('docker', args, stdin, TIMEOUT_MS);
  return { ...result, stage: 'runtime' };
}

/**
 * Spawn a process, pipe stdin, collect stdout/stderr, return { stdout, stderr, exitCode }
 */
function spawnWithStdin(cmd, args, stdin, timeoutMs) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args);
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
    }, timeoutMs);

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        resolve({ stdout, stderr: 'Execution timed out (15s limit).', exitCode: 124 });
      } else {
        resolve({
          stdout: stdout.slice(0, 50000),
          stderr: stderr.slice(0, 10000),
          exitCode: code ?? 0,
        });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ stdout: '', stderr: err.message, exitCode: 1 });
    });

    if (stdin) proc.stdin.write(stdin);
    proc.stdin.end();
  });
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

async function pullImages() {
  const { exec } = require('child_process');
  const images = ['frolvlad/alpine-gxx', 'python:3.11-alpine', 'node:20-alpine'];
  console.log('[executor] pulling execution images in background...');
  for (const img of images) {
    exec(`docker pull ${img}`, (err) => {
      if (err) console.warn(`[executor] could not pull ${img}:`, err.message);
      else console.log(`[executor] pulled ${img}`);
    });
  }
}

module.exports = { executeCode, pullImages };