import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function safeExec(command) {
  try {
    return execSync(command, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
}

function parseGitHubEventPr() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !existsSync(eventPath)) return null;

  try {
    const raw = readFileSync(eventPath, 'utf8');
    const payload = JSON.parse(raw);
    if (!payload?.pull_request) return null;
    const pr = payload.pull_request;
    return {
      number: typeof pr.number === 'number' ? pr.number : null,
      title: typeof pr.title === 'string' ? pr.title : null,
    };
  } catch {
    return null;
  }
}

function normalizePrNumber(value) {
  if (!value) return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function inferPrNumberFromRef() {
  const ref = process.env.GITHUB_REF ?? process.env.GITHUB_REF_NAME ?? '';
  const match = ref.match(/refs\/pull\/(\d+)\//) ?? ref.match(/^pull\/(\d+)\//);
  return match ? normalizePrNumber(match[1]) : null;
}

function detectEnvironment() {
  if (process.env.VERCEL_ENV === 'production') return 'production';
  if (process.env.VERCEL_ENV === 'preview') return 'preview';
  if (process.env.VERCEL_ENV === 'development') return 'local';
  if (process.env.NODE_ENV === 'production') return 'production';
  return 'local';
}

function resolveBranch() {
  return process.env.VERCEL_GIT_COMMIT_REF
    ?? process.env.GITHUB_HEAD_REF
    ?? process.env.GITHUB_REF_NAME
    ?? safeExec('git rev-parse --abbrev-ref HEAD')
    ?? null;
}

function resolveCommitSha() {
  const full = process.env.VERCEL_GIT_COMMIT_SHA
    ?? process.env.GITHUB_SHA
    ?? safeExec('git rev-parse HEAD')
    ?? null;

  const short = full
    ? full.slice(0, 7)
    : (safeExec('git rev-parse --short HEAD') ?? null);

  return { full, short };
}

const packageJsonPath = path.join(repoRoot, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const gitSha = resolveCommitSha();
const eventPr = parseGitHubEventPr();

const prNumber = normalizePrNumber(process.env.VERCEL_GIT_PULL_REQUEST_ID)
  ?? normalizePrNumber(process.env.PR_NUMBER)
  ?? eventPr?.number
  ?? inferPrNumberFromRef()
  ?? null;

const prTitle = process.env.PR_TITLE
  ?? eventPr?.title
  ?? null;

const buildMeta = {
  version: packageJson.version,
  commitSha: gitSha.full,
  shortSha: gitSha.short,
  buildTimestamp: new Date().toISOString(),
  branch: resolveBranch(),
  environment: detectEnvironment(),
  prNumber,
  prTitle,
  deploymentUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : (process.env.DEPLOYMENT_URL ?? null),
};

const outputFile = path.join(repoRoot, 'src/generated/buildMeta.ts');
mkdirSync(path.dirname(outputFile), { recursive: true });

const fileContents = `/* eslint-disable */\n// AUTO-GENERATED FILE. DO NOT EDIT.\n// Run \`npm run generate:build-meta\` to regenerate.\n\nexport type RawBuildMeta = {\n  version: string;\n  commitSha: string | null;\n  shortSha: string | null;\n  buildTimestamp: string;\n  branch: string | null;\n  environment: 'production' | 'preview' | 'local';\n  prNumber: number | null;\n  prTitle: string | null;\n  deploymentUrl: string | null;\n};\n\nexport const rawBuildMeta: RawBuildMeta = ${JSON.stringify(buildMeta, null, 2)};\n`;

writeFileSync(outputFile, fileContents);
console.log(`Generated ${path.relative(repoRoot, outputFile)}`);
