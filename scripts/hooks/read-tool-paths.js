// Print every file path a tool call touches, one per line, whatever agent sent it:
// - Claude Code: tool_input.file_path (and tool_response.filePath after the call)
// - Copilot (Claude-compatible events): tool_input.filePath / tool_input.path
// - Codex: apply_patch text in tool_input.command (`*** Add|Update|Delete File:` / `*** Move to:`)
// - Copilot native payloads: toolArgs / toolCalls[].args with filePath or path
// Exits 0 with no output when the payload names no file.

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});

function parseArgs(args) {
  if (typeof args !== 'string') return args;
  try {
    return JSON.parse(args);
  } catch {
    return undefined;
  }
}

function pathsFromPatch(text) {
  if (typeof text !== 'string' || !text.includes('*** ')) return [];
  return [...text.matchAll(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm)].map((match) =>
    match[1].trim(),
  );
}

function pathsFromArgs(args) {
  if (!args || typeof args !== 'object') return [];
  return [
    args.file_path,
    args.filePath,
    args.path,
    ...pathsFromPatch(args.command),
    ...pathsFromPatch(args.patch),
    ...pathsFromPatch(args.input),
  ];
}

process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    return;
  }
  if (!payload || typeof payload !== 'object') return;

  const candidates = [
    ...pathsFromArgs(payload.tool_input),
    payload.tool_response?.filePath,
    ...pathsFromArgs(parseArgs(payload.toolArgs)),
    ...(Array.isArray(payload.toolCalls)
      ? payload.toolCalls.flatMap((call) => pathsFromArgs(parseArgs(call?.args)))
      : []),
  ];
  const paths = [...new Set(candidates.filter((path) => typeof path === 'string' && path.trim().length > 0))];
  if (paths.length) process.stdout.write(`${paths.join('\n')}\n`);
});
