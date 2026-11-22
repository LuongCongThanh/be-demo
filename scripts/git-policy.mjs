import { readFile } from 'node:fs/promises';

const AI_AGENT_NAMES =
  '(claude|copilot|codex|chatgpt|openai|gpt|gemini|cursor|windsurf|cline|aider|devin|codeium|cody|tabnine|opencode|roo|continue|augment|replit|ai|agent|bot)';
const AI_ATTRIBUTION = new RegExp(
  `((co-authored-by|assisted-by|reviewed-by|generated-by):\\s*.*\\b${AI_AGENT_NAMES}\\b|generated\\s+(with|by)\\s+.*\\b${AI_AGENT_NAMES}\\b|ai-generated|noreply@anthropic\\.com)`,
  'i',
);

const REQUIRED_PR_SECTIONS = [
  '# Pull Request',
  '## 1. Type',
  '## 2. Summary',
  '## 3. Input / Output',
  '### Input',
  '### Output',
  '## 4. Changes',
  '## 5. Verification',
];

const PR_TYPE_VALUES =
  '(feat|fix|refactor|perf|security|chore|docs|test|architecture)';

export function validateCommitMessage(message) {
  const errors = [];
  if (AI_ATTRIBUTION.test(message ?? '')) {
    errors.push(
      'Commit message không được chứa AI/tool/agent attribution',
    );
  }
  return { valid: errors.length === 0, errors };
}

export function validatePullRequestBody(body) {
  const errors = [];
  const normalized = (body ?? '').replace(/\r/g, '');

  for (const section of REQUIRED_PR_SECTIONS) {
    if (!normalized.includes(section)) {
      errors.push(`Missing required section: ${section}`);
    }
  }

  const ticked = normalized
    .split('\n')
    .filter((line) =>
      new RegExp(`^- \\[[xX]\\] ${PR_TYPE_VALUES}$`).test(line),
    ).length;
  if (ticked !== 1) {
    errors.push(`Tick exactly one PR Type checkbox (found ${ticked})`);
  }

  const verification = normalized.match(
    /^## 5\. Verification$([\s\S]*?)(?=^## 6\.)/m,
  );
  if (!verification) {
    errors.push('Missing PR verification section');
  } else {
    const text = verification[1];
    if (!/^- \[[xX]\] Code review: .+/m.test(text)) {
      errors.push('Record the code-review outcome under ## 5. Verification');
    }
    if (
      /Code review:.*(chưa chạy|không chạy|bỏ qua|skip(ped)?|not run|pending)/i.test(
        text,
      )
    ) {
      errors.push('Code review outcome says review was skipped or not run');
    }
  }

  if (AI_ATTRIBUTION.test(normalized)) {
    errors.push(
      'PR body không được chứa AI/tool/agent attribution',
    );
  }

  return { valid: errors.length === 0, errors };
}

async function main() {
  const [kind, file] = process.argv.slice(2);
  if (!kind || !file) {
    console.error('Usage: node scripts/git-policy.mjs <pr|commit> <file>');
    process.exit(2);
  }

  let content;
  try {
    content = await readFile(file, 'utf8');
  } catch (error) {
    console.error(`Could not read ${file}: ${error.message}`);
    process.exit(2);
  }

  const result =
    kind === 'pr'
      ? validatePullRequestBody(content)
      : kind === 'commit'
        ? validateCommitMessage(content)
        : null;

  if (!result) {
    console.error(`Unknown policy kind: ${kind}`);
    process.exit(2);
  }
  if (!result.valid) {
    for (const error of result.errors) console.error(`Blocked: ${error}`);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('/scripts/git-policy.mjs')) {
  await main();
}
