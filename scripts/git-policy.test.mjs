import assert from 'node:assert/strict';
import test from 'node:test';

import { isDependabotCommit, validateCommitMessage, validatePullRequestBody } from './git-policy.mjs';

test('rejects AI attribution in commit messages', () => {
  const result = validateCommitMessage(
    'chore(agent): improve guardrails\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>\n',
  );

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /AI\/tool\/agent attribution/);
});

test('rejects additional AI attribution trailer variants', () => {
  for (const trailer of ['Assisted-by: Copilot', 'Reviewed-by: Claude', 'Generated-by: Codex']) {
    assert.equal(validateCommitMessage(`chore(agent): improve guardrails\n\n${trailer}\n`).valid, false);
  }
});

test('rejects AI tool names in commit subjects and bodies', () => {
  for (const message of ['feat: update Claude integration', 'chore: refactor\n\nCopilot implementation notes']) {
    assert.equal(validateCommitMessage(message).valid, false);
  }
});

test('rejects a PR body that is missing the template sections', () => {
  const result = validatePullRequestBody('# Summary\n\nInline body');

  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 3);
});

test('accepts a template-shaped PR body', () => {
  const body = `# Pull Request

## 1. Type
- [x] chore

## 2. Summary
- **Thay đổi:** Thêm validator Git/PR.
- **Lý do:** Các guardrail sử dụng cùng quy tắc.
- **Kết quả:** Commit và PR được kiểm tra trước khi tạo.

## 3. Input / Output
### Input
- PR hoặc commit mới.

### Output
- Exit code xác nhận hợp lệ hoặc lỗi cụ thể.

## 4. Changes
- **Configuration:** Thêm validator dùng chung.

## 5. Verification
- [x] Unit tests: passed
- [x] Code review: passed with no findings

## 6. Reviewer Notes
- **Breaking Changes:** Không.

## 7. References
- **Related PR:** không.
`;

  assert.deepEqual(validatePullRequestBody(body), { valid: true, errors: [] });
});

test('accepts the template without an optional section 6', () => {
  const body = `# Pull Request

## 1. Type
- [x] fix

## 2. Summary
- **Thay đổi:** Sửa validator.

## 3. Input / Output
### Input
- PR body.
### Output
- Validation result.

## 4. Changes
- **Other:** Validator.

## 5. Verification
- [x] Code review: no findings
`;

  assert.deepEqual(validatePullRequestBody(body), { valid: true, errors: [] });
});

const DEPENDABOT_SIGNOFF = 'Signed-off-by: dependabot[bot] <support@github.com>';

test('recognises Dependabot commits, including squash-merged ones', () => {
  for (const message of [
    `chore(deps): bump openai from 4.52.0 to 4.53.0\n\nBumps openai.\n\n${DEPENDABOT_SIGNOFF}\n`,
    `chore(deps-dev): bump vitest from 3.0.0 to 3.1.0 (#140)\r\n\r\n${DEPENDABOT_SIGNOFF}\r\n`,
    `ci(deps): bump the actions-minor-patch group with 2 updates\n\n${DEPENDABOT_SIGNOFF}`,
  ]) {
    assert.equal(isDependabotCommit(message), true, message);
  }
});

test('does not treat other commits as Dependabot commits', () => {
  for (const message of [
    'chore(deps): bump openai from 4.52.0 to 4.53.0',
    `feat: update Claude integration\n\n${DEPENDABOT_SIGNOFF}`,
    `chore(deps): update lockfile\n\n${DEPENDABOT_SIGNOFF}`,
    '',
  ]) {
    assert.equal(isDependabotCommit(message), false, message);
  }
});
