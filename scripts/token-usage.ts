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
import { join } from 'node:path';

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
  const p = filePath.replace(process.cwd() + '/', '');
  if (/\.(e2e-)?spec\.ts$/.test(p) || p.startsWith('test/')) return 'test';
  if (p.endsWith('.md') || p.startsWith('docs/')) return 'docs';
  if (p.startsWith('src/')) return 'code';
  return 'other';
}

function projectDir(): string {
  const slug = process.cwd().replace(/[^a-zA-Z0-9]/g, '-');
  return join(homedir(), '.claude', 'projects', slug);
}

function sessionFiles(dir: string, id: string): string[] {
  const files = [join(dir, `${id}.jsonl`)];
  const sub = join(dir, id, 'subagents');
  if (existsSync(sub)) {
    for (const f of readdirSync(sub)) if (f.endsWith('.jsonl')) files.push(join(sub, f));
  }
  return files.filter((f) => existsSync(f));
}

function main(): void {
  const args = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const since = flag('--since');
  const until = flag('--until');
  const asMarkdown = args.includes('--md');
  const ids = args.filter((a, i) => !a.startsWith('--') && !['--since', '--until'].includes(args[i - 1] ?? ''));

  const dir = projectDir();
  const resolved = ids.map((id) => {
    if (id !== 'latest') return id;
    const latest = readdirSync(dir)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)[0];
    return latest.f.replace('.jsonl', '');
  });
  if (resolved.length === 0) {
    console.error('Cần ít nhất một sessionId (hoặc "latest").');
    process.exit(1);
  }

  // Một message API có thể bị ghi thành nhiều dòng (mỗi content block một dòng),
  // cùng message.id và cùng usage → gộp theo id, chỉ tính usage một lần.
  const messages = new Map<string, { usage: Usage; files: string[] }>();
  for (const id of resolved) {
    for (const file of sessionFiles(dir, id)) {
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
        if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === 'tool_use' && ['Write', 'Edit', 'NotebookEdit'].includes(block.name ?? '')) {
              if (block.input?.file_path) entry.files.push(block.input.file_path);
            }
          }
        }
        messages.set(msg.id, entry);
      }
    }
  }

  const buckets = new Map<Category, Bucket>(CATEGORIES.map((c) => [c, emptyBucket()]));
  const total = emptyBucket();
  for (const { usage, files } of messages.values()) {
    const cats = files.length ? [...new Set(files.map(classify))] : (['explore/chat'] as Category[]);
    const share = 1 / cats.length;
    for (const c of cats) {
      const b = buckets.get(c)!;
      b.input += (usage.input_tokens ?? 0) * share;
      b.cacheWrite += (usage.cache_creation_input_tokens ?? 0) * share;
      b.cacheRead += (usage.cache_read_input_tokens ?? 0) * share;
      b.output += (usage.output_tokens ?? 0) * share;
      b.messages += share;
    }
    total.input += usage.input_tokens ?? 0;
    total.cacheWrite += usage.cache_creation_input_tokens ?? 0;
    total.cacheRead += usage.cache_read_input_tokens ?? 0;
    total.output += usage.output_tokens ?? 0;
    total.messages += 1;
  }

  const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');
  const rows: [string, Bucket][] = [
    ...CATEGORIES.map((c) => [c, buckets.get(c)!] as [string, Bucket]),
    ['TOTAL', total],
  ];
  const header = ['Loại', 'Messages', 'Input', 'Cache write', 'Cache read', 'Output'];
  const body = rows.map(([name, b]) => [
    name,
    fmt(b.messages),
    fmt(b.input),
    fmt(b.cacheWrite),
    fmt(b.cacheRead),
    fmt(b.output),
  ]);

  console.log(`Sessions: ${resolved.join(', ')}${since ? ` · since ${since}` : ''}${until ? ` · until ${until}` : ''}`);
  if (asMarkdown) {
    console.log(`| ${header.join(' | ')} |`);
    console.log(`| ${header.map(() => '---').join(' | ')} |`);
    for (const r of body) console.log(`| ${r.join(' | ')} |`);
  } else {
    console.table(
      Object.fromEntries(body.map((r) => [r[0], Object.fromEntries(header.slice(1).map((h, i) => [h, r[i + 1]]))])),
    );
  }
}

main();
