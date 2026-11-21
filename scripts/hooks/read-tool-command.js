let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    process.stderr.write('Unable to parse the hook payload as JSON.\n');
    process.exitCode = 2;
    return;
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    process.stderr.write('The hook payload must be a JSON object.\n');
    process.exitCode = 2;
    return;
  }

  const toolInputCommand = payload.tool_input?.command;
  if (typeof toolInputCommand === 'string' && toolInputCommand.length > 0) {
    process.stdout.write(toolInputCommand);
    return;
  }

  const bashCalls = Array.isArray(payload.toolCalls)
    ? payload.toolCalls.filter((call) => typeof call?.name === 'string' && call.name.toLowerCase() === 'bash')
    : [];
  if (bashCalls.length > 0) {
    const commands = bashCalls.map((call) => call.args?.command);
    if (commands.some((command) => typeof command !== 'string' || command.length === 0)) {
      process.stderr.write('A Bash tool call is missing its command.\n');
      process.exitCode = 2;
      return;
    }

    process.stdout.write(commands.join('\n;\n'));
    return;
  }

  process.stderr.write('No Bash command was found in the hook payload.\n');
  process.exitCode = 2;
});
