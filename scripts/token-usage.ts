/**
 * Đếm token Claude Code thực tế đã dùng cho một task, đọc từ transcript JSONL
 * của Claude Code (~/.claude/projects/<cwd-slug>/<session>.jsonl + subagents/).
 *
 * Phân loại output token của mỗi assistant message theo file nó ghi (Write/Edit):
 *   code  = src/**  (không phải spec)
 *   test  = *.spec.ts, *.e2e-spec.ts, test/**
 *   docs  = *.md, docs/**
 *   other = file khác (config, scripts…)
 *   explore/chat = message không ghi file (đọc code, chạy lệnh, trả lời)
 * Message ghi nhiều loại file thì chia đều output token cho các loại đó.
 *
 * Usage:
 *   npm run tokens -- <sessionId|latest> [...more] [--since 2026-11-07T00:00] [--until ...] [--md]
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';

type Category = 'code' | 'test' | 'docs' | 'other' | 'explore/chat';
const CATEGORIES: Category[] = ['code', 'test', 'docs', 'other', 'explore/chat'];

interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}
interface ContentBlock {
  type: string;
  name?: string;
  input?: { file_path?: string };
}
interface Line {
  type?: string;
  timestamp?: string;
  message?: { id?: string; model?: string; usage?: Usage; content?: ContentBlock[] | string };
}

interface Bucket {
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
  messages: number;
}
const emptyBucket = (): Bucket => ({ input: 0, cacheWrite: 0, cacheRead: 0, output: 0, messages: 0 });

function classify(filePath: string): Category {
  const p = relative(process.cwd(), filePath);
  if (/\.(e2e-)?spec\.ts$/.test(p) || p.startsWith('test/')) return 'test';
  if (p.endsWith('.md') || p.startsWith('docs/')) return 'docs';
  if (p.startsWith('src/')) return 'code';
  return 'other';
}

function projectDir(): string {
  const slug = process.cwd().replace(/[^a-zA-Z0-9]/g, '-');
  return join(homedir(), '.claude', 'projects', slug);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Nhận full id, tiền tố id (vd. `9ceecdea`) hoặc `latest`; không khớp thì báo lỗi thay vì in 0. */
function resolveSession(dir: string, id: string): string {
  if (!existsSync(dir)) fail(`Không có thư mục transcript: ${dir} (chạy script từ gốc repo).`);
  const sessions = readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => ({ id: f.slice(0, -'.jsonl'.length), mtime: statSync(join(dir, f)).mtimeMs }));
  if (id === 'latest') {
    const newest = sessions.sort((a, b) => b.mtime - a.mtime)[0];
    if (!newest) fail(`Không có session nào trong ${dir}.`);
    return newest.id;
  }
  const matches = sessions.filter((s) => s.id.startsWith(id));
  if (matches.length === 0) fail(`Không tìm thấy session "${id}" trong ${dir}.`);
  if (matches.length > 1) fail(`"${id}" khớp nhiều session: ${matches.map((m) => m.id).join(', ')}.`);
  return matches[0].id;
}

function sessionFiles(dir: string, id: string): string[] {
  const files = [join(dir, `${id}.jsonl`)];
  const sub = join(dir, id, 'subagents');
  if (existsSync(sub)) {
    for (const f of readdirSync(sub)) if (f.endsWith('.jsonl')) files.push(join(sub, f));
  }
  return files;
}

interface Options {
  ids: string[];
  since?: string;
  until?: string;
  asMarkdown: boolean;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { ids: [], asMarkdown: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--md') options.asMarkdown = true;
    else if (arg === '--since' || arg === '--until') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) fail(`${arg} cần một giá trị ISO, vd. 2026-11-07T00:00.`);
      options[arg === '--since' ? 'since' : 'until'] = value;
    } else if (arg.startsWith('--')) fail(`Cờ không hỗ trợ: ${arg}`);
    else options.ids.push(arg);
  }
  if (options.ids.length === 0) fail('Cần ít nhất một sessionId (hoặc "latest").');
  return options;
}

function addUsage(bucket: Bucket, usage: Usage, share: number): void {
  bucket.input += (usage.input_tokens ?? 0) * share;
  bucket.cacheWrite += (usage.cache_creation_input_tokens ?? 0) * share;
  bucket.cacheRead += (usage.cache_read_input_tokens ?? 0) * share;
  bucket.output += (usage.output_tokens ?? 0) * share;
  bucket.messages += share;
}

/**
 * Một message API có thể bị ghi thành nhiều dòng (mỗi content block một dòng),
 * cùng message.id → gộp theo id. Giữ `usage` của dòng **sau cùng** (số cuối khi stream xong)
 * và gom file từ mọi dòng.
 */
function collectMessages(
  files: string[],
  since?: string,
  until?: string,
): Map<string, { usage: Usage; files: string[] }> {
  const messages = new Map<string, { usage: Usage; files: string[] }>();
  for (const file of files) {
    for (const raw of readFileSync(file, 'utf8').split('\n')) {
      if (!raw.trim()) continue;
      let line: Line;
      try {
        line = JSON.parse(raw) as Line;
      } catch {
        continue;
      }
      const msg = line.message;
      if (line.type !== 'assistant' || !msg?.id || !msg.usage) continue;
      if (since && (line.timestamp ?? '') < since) continue;
      if (until && (line.timestamp ?? '') > until) continue;
      const entry = messages.get(msg.id) ?? { usage: msg.usage, files: [] };
      entry.usage = msg.usage;
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'tool_use' && WRITE_TOOLS.has(block.name ?? '') && block.input?.file_path) {
            entry.files.push(block.input.file_path);
          }
        }
      }
      messages.set(msg.id, entry);
    }
  }
  return messages;
}

const WRITE_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit']);

function main(): void {
  const { ids, since, until, asMarkdown } = parseArgs(process.argv.slice(2));
  const dir = projectDir();
  const sessions = ids.map((id) => resolveSession(dir, id));
  const messages = collectMessages(
    sessions.flatMap((id) => sessionFiles(dir, id)),
    since,
    until,
  );

  const buckets = Object.fromEntries(CATEGORIES.map((c) => [c, emptyBucket()])) as Record<Category, Bucket>;
  const total = emptyBucket();
  for (const { usage, files } of messages.values()) {
    const categories: Category[] = files.length ? [...new Set(files.map(classify))] : ['explore/chat'];
    for (const c of categories) addUsage(buckets[c], usage, 1 / categories.length);
    addUsage(total, usage, 1);
  }

  const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');
  const header = ['Loại', 'Messages', 'Input', 'Cache write', 'Cache read', 'Output'];
  const tableRows = [...CATEGORIES.map((c) => [c, buckets[c]] as const), ['TOTAL', total] as const].map(([name, b]) => [
    name,
    fmt(b.messages),
    fmt(b.input),
    fmt(b.cacheWrite),
    fmt(b.cacheRead),
    fmt(b.output),
  ]);

  console.log(`Sessions: ${sessions.join(', ')}${since ? ` · since ${since}` : ''}${until ? ` · until ${until}` : ''}`);
  if (asMarkdown) {
    console.log(`| ${header.join(' | ')} |`);
    console.log(`| ${header.map(() => '---').join(' | ')} |`);
    for (const r of tableRows) console.log(`| ${r.join(' | ')} |`);
  } else {
    console.table(
      Object.fromEntries(
        tableRows.map((r) => [r[0], Object.fromEntries(header.slice(1).map((h, i) => [h, r[i + 1]]))]),
      ),
    );
  }
}

main();
