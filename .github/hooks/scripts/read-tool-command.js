cat << 'EOF' > scripts / hooks / read - tool - command.js;
import fs from 'fs';

const raw = fs.readFileSync(0, 'utf8').trim();
if (!raw) {
  process.exit(0);
}

let data;
try {
  data = JSON.parse(raw);
} catch {
  process.exit(1);
}

const cmd = data?.toolArgs?.command ?? data?.toolArgs?.cmd ?? data?.tool_input?.command ?? '';

process.stdout.write(String(cmd));
EOF;
