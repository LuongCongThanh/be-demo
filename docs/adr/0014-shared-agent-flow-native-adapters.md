# Một quy trình chung cho mọi AI agent, mỗi agent cấu hình theo kiểu riêng

Claude Code, Codex và GitHub Copilot phải chạy **cùng một quy trình**: cùng thứ tự bước, cùng chỗ phải dừng, cùng điều kiện được coi là xong, và cùng quyết định chặn hay cho qua của hook. Riêng **cách cấu hình và cách gọi** thì mỗi agent dùng kiểu riêng của nó. Quy trình `feature`/`ship` chỉ được viết ở một chỗ, `docs/agents/flows/`. Skill dự án chỉ được viết ở một chỗ, `.agents/skills/`, rồi được copy y hệt sang `.github/skills/` và `.claude/skills/`. Quy trình chỉ được gọi những skill có trong bộ đó; skill cài toàn cục trên máy một người không được tính là có sẵn cho mọi agent. Phiên bản skill lấy từ bên ngoài được khoá trong `skills-lock.json`.

Các file cấu hình riêng của từng agent (`.claude/settings.json`, `.codex/hooks.json`, `.mcp.json`, `.codex/config.toml`, `.vscode/mcp.json`, `.claude/rules/`, `.github/instructions/`, các `AGENTS.md` lồng nhau) không copy nội dung của nhau. Thay vào đó, `agents:check` và `agents:test` kiểm tra rằng chúng cho cùng kết quả: cùng bộ hook đăng ký, cùng tên MCP server, và cùng quyết định của hook khi chạy trên payload mẫu viết theo định dạng của cả ba agent.

## Phương án bị loại

- **Copy nguyên cấu hình giữa các agent.** Định dạng của mỗi agent khác nhau: tên event, tên tool như `Edit|Write` so với `apply_patch`, payload của hook. Copy nguyên thì trông đồng bộ nhưng hook có thể âm thầm không chạy.
- **Mỗi agent một quy trình riêng.** Claude từng có `/feature` 108 dòng còn Codex/Copilot có bản 38 dòng, và `/ship` khác nhau ở quy tắc cho phép rebase/push. Cùng một yêu cầu cho ra hành vi khác nhau tuỳ agent.
- **Dựa vào skill cài toàn cục.** Máy khác hoặc agent khác không có các skill đó, nên quy trình không chạy lại được.

## Hệ quả

- Copilot trong VS Code luôn đọc cả `.github/hooks/*.json` lẫn `.claude/settings.json`, và không có setting nào tắt được một nguồn. Vì vậy Copilot dùng chung hook với Claude qua `.claude/settings.json`, và repo không có `.github/hooks/`. Copilot coding agent trên cloud vì thế không chạy hook nào của repo.
- Claude bỏ `.claude/commands/`; `feature`/`ship` trở thành skill dùng chung.
- Bộ Matt Pocock và các skill tiện ích mà quy trình gọi được đưa vào repo.
- Khi bộ này ổn định, nó sẽ được tách thành một bộ cấu hình dùng chung (`agent-kit`) cho `cms` và `fe-ecommerce-nike-style`.
