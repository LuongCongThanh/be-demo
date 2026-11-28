# Checklist thực hành trở thành Hands-on Software Architect

> Tài liệu dành cho người muốn có thể **đi từ quyết định kiến trúc đến artifact có thể review, kiểm tra được trên ba repo và chốt trong luồng thay đổi xuyên repo**. Tài liệu không thay thế quy tắc cục bộ của từng ứng dụng.

## 1. Cách dùng tài liệu

1. Đọc `GLOSSARY.md` trước; dùng đúng tên **Backend, CMS, Storefront, API Contract, Contract Version, Breaking Change**. [GLOSSARY.md](../GLOSSARY.md)
2. Với quyết định có trade-off, tạo ADR ngắn trong `docs/adr/` của workspace coordination; không ghi quyết định chỉ ở chat, PR hoặc notebook cá nhân. Workspace hiện dùng ADR để ghi quyết định giữ ba repo tách và dùng API Contract làm điểm tích hợp. [ADR 0001](adr/0001-polyrepo-with-coordination-repo.md), [ADR 0002](adr/0002-automatic-contract-versioning.md)
3. Khi làm việc trong một app, mở `AGENTS.md` hoặc `CLAUDE.md` và quy tắc nested tương ứng trước khi thay code. Quy tắc app thắng workspace. [AGENTS.md workspace](../AGENTS.md)
4. Mỗi vòng học phải tạo ít nhất:
   - một sơ đồ hoặc một quyết định có thể review;
   - một thay đổi nhỏ có thể lặp lại;
   - một test, migration, benchmark hoặc truy vấn phục hồi quyết định;
   - một kiểm tra merge/deploy/chạy lại.
5. Không đánh dấu hoàn thành chỉ vì test pass. Checklist chỉ hoàn thành khi artifact, lệnh tái hiện và tiêu chí quan sát được kiểm định.

## 2. Bức tranh kiến trúc hiện tại của workspace

### Trạng thái đã xác nhận

- [ ] Hiểu rằng workspace coordination không chứa application code; Backend, CMS và Storefront là ba git repository riêng. [ADR 0001](adr/0001-polyrepo-with-coordination-repo.md)
- [ ] Xác nhận Backend là owner của business data và API, CMS phục vụ quản trị, Storefront phục vụ người mua. [GLOSSARY.md](../GLOSSARY.md)
- [ ] Ghi nhớ điểm tích hợp duy nhất của workspace là API Contract, không dùng git submodule hay monorepo. [ADR 0001](adr/0001-polyrepo-with-coordination-repo.md)
- [ ] Ghi nhớ Contract Version là tag `openapi-vX.Y.Z` trên Backend, khác URI `/api/v1` và khác `OpenAPI 3.0.0` trong document hiện tại. [ADR 0002](adr/0002-automatic-contract-versioning.md), [API Contract workflow](../shared/agents/workspace.md)
- [ ] Chấp nhận thứ tự feature xuyên repo: Backend → release Contract Version → bump PR ở CMS/Storefront → rebase feature PR consumer → merge. [API Contract workflow](../shared/agents/workspace.md)
- [ ] Backend dùng NestJS, Prisma và PostgreSQL; CMS dùng Vue 3/Vite/Nuxt UI; Storefront dùng Next.js App Router. [Backend package.json](../be-demo/package.json), [CMS package.json](../cms/package.json), [Storefront package.json](../fe-ecommerce-nike-style/package.json)
- [ ] Redis đã xuất hiện trong workspace compose; không tự kết luận Redis đang làm cache, distributed lock hoặc source of truth cho Backend nếu source code chưa dùng nó. [docker-compose.yml](../docker-compose.yml)
- [ ] PostgreSQL chạy native trên machine theo hướng dẫn workspace; CI Backend dùng PostgreSQL 17 và migration/e2e riêng. [AGENTS workspace](../AGENTS.md), [Backend CI](../be-demo/.github/workflows/ci.yml)

### Artifact bắt buộc ở vòng đầu

- [ ] Vẽ system context gồm người dùng, CMS, Storefront, Backend, PostgreSQL, Redis và hệ thống ngoài (nếu có).
- [ ] Vẽ hai data-flow theo đúng code hiện tại:
  - CMS/Storefront → API Contract → Backend controller → application/service → Prisma → PostgreSQL;
  - contract file/Contract Version → generated types ở consumer.
- [ ] Ghi ranh giới ownership: dữ liệu nào thuộc Backend; dữ liệu nào chỉ là UI state; dữ liệu nào cần cùng CMS/Storefront thấy và freshness tối đa là bao lâu.
- [ ] Ghi dependency map theo repo: thay đổi contract nào tác động repo nào, thay đổi database nào yêu cầu migration, đổi Redis nào yêu cầu rollout.

**Tiêu chí đạt:** người khác có thể nhìn sơ đồ và chỉ ra đúng owner, trust boundary, data store, API boundary và thứ tự merge mà không cần nghe giải thích miệng.

## 3. Learning loop chuẩn cho mọi chủ đề

Với từng chủ đề, chạy đúng vòng:

1. **Model:** viết invariant hoặc câu hỏi kiến trúc.
2. **Baseline:** chạy test/script hiện có trước khi đổi.
3. **Variant:** làm thay đổi nhỏ; test happy path và ít nhất một failure mode.
4. **Observe:** đọc log, query plan, trace, DB state hoặc generated diff.
5. **Write down:** ghi quyết định, trade-off, rollback và guardrail.
6. **Challenge:** yêu cầu người review trả lời “điều gì làm quyết định này sai?”.
7. **Gate:** thêm test/CI check hoặc runbook để lỗi không lặp lại.

Không kết hợp quá nhiều biến trong một vòng. Ví dụ: thay đổi migration và cache cùng lúc sẽ không cho biết lỗi thuộc tầng nào.

## 4. Workstream A — Ranh giới và ADR

### Checklist

- [ ] Viết architecture context trong 5 phần: users, forces, constraints, quality attributes, out of scope.
- [ ] Viết decisions theo MADR hoặc n-gốc: context; options; rationale; consequences. MADR là template được cộng đồng duy trì; [MADR](https://adr.github.io/madr/), [Nygard ADR](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions.html).
- [ ] Ghi mỗi quyết định nên xem lại dưới điều kiện cụ thể, không ghi “xem lại sau”.
- [ ] Phân biệt architectural decision, implementation detail và temporary workaround.
- [ ] Khi quyết định ảnh hưởng nhiều repo, ghi merge order và thay đổi contract/migration yêu cầu sync.
- [ ] Lưu ADR bằng commit trong đúng repo/workspace; không duplicate ADR app nếu workspace đã có quyết định chung.

### Bài lab bắt buộc

Chọn một thay đổi thực tế nhỏ, ví dụ “thêm trạng thái đơn hàng mới”:

- [ ] Vẽ service/component boundary trước khi mở file.
- [ ] Ghi 3 option và trade-off.
- [ ] Viết 1 ADR và 1 sequence diagram.
- [ ] Đưa ra migration/API/consumer impact.
- [ ] Chạy list/dirty check mỗi repo trước khi bắt đầu đổi.
- [ ] Ghi các gate cần xanh ở mỗi repo.

**Artifact:** một ADR + một sequence diagram + một impact matrix:

| Thay đổi | Backend | CMS | Storefront | Contract | DB  | CI/rollback |
| -------- | ------- | --- | ---------- | -------- | --- | ----------- |

**Tiêu chí đạt:** thay đổi có thể bị từ chối trước code vì thiếu quyết định hoặc gate, không vì tranh luận cá nhân.

## 5. Workstream B — NestJS và dependency boundaries

NestJS tổ chức ứng dụng theo modules/providers/controllers và dependency injection. Xem tài liệu chính thức: [NestJS Modules](https://docs.nestjs.com/modules), [Providers](https://docs.nestjs.com/providers), [Custom Providers](https://docs.nestjs.com/fundamentals/custom-providers), [Testing](https://docs.nestjs.com/fundamentals/testing).

### Checklist

- [ ] Xác định feature module và module cấp hạ tầng: HTTP module không được trở thành nơi chứa tất cả domain logic.
- [ ] Chỉ export provider mà module khác thực sự cần; tránh export toàn bộ implementation như một cách “tắt boundary”.
- [ ] Controller map HTTP request/response và validation; application/service chứa use case; infrastructure adapter chứa DB/cache/external API.
- [ ] Chỉ inject interface/token khi thay implementation là realistic; không abstract mọi thứ.
- [ ] Xác minh startup bằng module wiring test và smoke boot thật.
- [ ] Dùng dependency injection để thay một adapter trong test; không mock toàn bộ service để test controller.
- [ ] Tách validation schema khỏi transport contract nếu app đang xử lý dữ liệu ngoài HTTP. NestJS pipes chạy trên request input trước handler. [Pipes](https://docs.nestjs.com/pipes)
- [ ] Xác định HTTP status mapping cho 400/404/409/422/429/5xx theo behavior của API, không theo exception class một cách ngẫu nhiên.

### Learning loop

Chọn một use case có transaction hoặc external call:

- [ ] Viết test use case với fake adapter.
- [ ] Viết module integration test để kiểm tra DI wiring.
- [ ] Gọi endpoint qua HTTP test.
- [ ] Thử timeout/dependency failure/duplicate request.
- [ ] Ghi policy retry, idempotency, circuit/tripping hoặc no retry rõ ràng.
- [ ] Chứng minh controller không cần biết Prisma/Redis implementation.

**Artifact:** module dependency diagram, provider ownership table, DI test, endpoint test và một ADR nếu đổi kiến trúc module.

**Tiêu chí đạt:** đổi một adapter không cần sửa controller; provider test fail ngay nếu export/wiring sai; failure test không chỉ assert status code mà còn assert DB state.

## 6. Workstream C — Prisma và PostgreSQL

### 6.1 Invariant model

Phân loại mỗi invariant thành một trong ba loại:

- [ ] **DB invariant:** unique, foreign key, check constraint, not-null, index.
- [ ] **Transaction invariant:** nhiều row phải commit/rollback atomically.
- [ ] **Application/workflow invariant:** idempotency, ownership, approval, retry policy.

Prisma Client hỗ trợ transaction; migration được quản lý qua Prisma Migrate. [Prisma ORM transactions](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions), [Prisma Migrate](https://www.prisma.io/docs/orm/v7/prisma-migrate), [Prisma schema v7](https://www.prisma.io/docs/orm/v7/prisma-schema/overview).

### 6.2 Concurrency lab

Dùng inventory reservation hoặc decrement stock:

- [ ] Viết baseline transaction.
- [ ] Chạy hai update đồng thời trên PostgreSQL.
- [ ] Chứng minh kết quả dưới transaction isolation mặc định hoặc cấu hình khác. [PostgreSQL transaction isolation](https://www.postgresql.org/docs/17/transaction-iso.html)
- [ ] Kiểm tra row lock/locking behavior với transaction bị giữ lâu. [Explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html)
- [ ] Dựng duplicate-key/retry/idempotency case.
- [ ] Rollback một bước trong chuỗi create order–reserve inventory–publish event; kiểm tra state không nằm nửa chừng.
- [ ] Ghi selectivity và index cần có; đo query bằng `EXPLAIN`. [EXPLAIN](https://www.postgresql.org/docs/17/sql-explain.html), [Indexes](https://www.postgresql.org/docs/17/indexes.html)

### 6.3 Migration lab

- [ ] Dùng migration trên database rỗng.
- [ ] Dùng migration trên dữ liệu có sẵn.
- [ ] Kiểm tra schema drift.
- [ ] Cho dữ liệu existing violate constraint mới rồi quan sát migration fail.
- [ ] Viết backfill và expand/contract cho thay đổi phá compatibility.
- [ ] Chứng minh migration có rollback/recovery step hoặc lý do không rollback.
- [ ] Tách migration dài khỏi request-critical deploy nếu có.

CI Backend hiện chạy drift check, migration, seed và E2E; giữ đúng gate thay vì suy ra “migration passed” từ unit test. [Backend CI](../be-demo/.github/workflows/ci.yml)

**Artifact:** invariant matrix, concurrency test, migration replay log, `EXPLAIN` snapshot, rollback/runbook.

**Tiêu chí đạt:** mỗi invariant có guard ở đúng tầng; transaction sai không để orphan state; migration replay được trên database có dữ liệu; query plan giải thích workload không chỉ câu “thêm index”.

## 7. Workstream D — Redis

Redis là in-memory data structure store; trước khi chọn dữ liệu vào Redis, ghi source of truth, expiry, staleness và failure behavior. [Redis data types](https://redis.io/docs/latest/develop/data-types/), [SET command](https://redis.io/docs/latest/commands/set/), [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/), [Redis security](https://redis.io/docs/latest/operate/oss_and_stack/management/security/)

### Checklist quyết định

- [ ] Ghi Redis **không** làm source of truth trừ khi một ADR ghi rõ vì sao.
- [ ] Ghi key ownership, key format, TTL và tenant/user scope.
- [ ] Ghi cache miss behavior: stampede; load từ PostgreSQL; timeout; serving stale.
- [ ] Ghi Redis outage behavior: fail closed hay degraded mode; không hiện kết quả sai.
- [ ] Ghi eviction/TTL policy; không giả sử key sống mãi. [Server configuration](https://redis.io/docs/latest/operate/oss_and_stack/management/config/)
- [ ] Ghi atomic operation khi cần; Redis lệnh hoặc Lua phải được review về race. [Transactions](https://redis.io/docs/latest/develop/interact/transactions/)
- [ ] Ghi serialization, connection pool, timeout, retry và idempotency.
- [ ] Ghi secret/network access và ACL. [Redis ACL](https://redis.io/docs/latest/operate/oss_and_stack/management/security/acl/)

### Lab cache

- [ ] Tạo read-through cache cho dữ liệu đổi ít.
- [ ] Thử Redis unavailable.
- [ ] Tạo nhiều cache misses đồng thời.
- [ ] Đổi dữ liệu DB và xác nhận thời điểm cache stale được sửa.
- [ ] Kiểm tra eviction và TTL.
- [ ] Thêm metric hit/miss/error/latency.

### Lab lock/concurrency (chỉ nếu bài toán thật cần)

- [ ] Viết lock hết hạn và owner token; tránh xóa lock của owner khác.
- [ ] So sánh Redis lock với PostgreSQL row lock/advisory lock.
- [ ] Thử crash process khi lock đang giữ.
- [ ] Ghi rõ distributed lock không thay thế database invariant.

**Artifact:** Redis decision table, key catalog, failure-mode test, metric baseline và runbook.

**Tiêu chí đạt:** Redis không làm data silently incorrect; khi Redis down có behavior đoán trước được; stale max-age và recovery được người dùng/nghiệp vụ chấp nhận.

## 8. Workstream E — CMS Vue và Nuxt UI

CMS hiện là Vue 3 + Vite, sử dụng Nuxt UI như component library; cấu hình Vite proxy API tới Backend. Đây không phải app Nuxt framework. [CMS package.json](../cms/package.json), [CMS vite.config.ts](../cms/vite.config.ts), [Nuxt UI Vite support](https://ui.nuxt.com/docs/getting-started)

### Checklist

- [ ] Phân biệt local UI state, shared client state và server data.
- [ ] Với server state, có loading/error/empty/stale/optimistic-update behavior rõ ràng.
- [ ] Không chép domain invariant từ Backend; consumer validate UX nhưng không coi frontend là authority.
- [ ] Không sửa generated API types theo tay.
- [ ] Dùng component boundary để tránh “page monolith”.
- [ ] Kiểm tra keyboard, label, focus, color contrast và accessible component behavior. [Nuxt UI docs](https://ui.nuxt.com/docs)
- [ ] Ghi retry/refetch policy cho mutation và failed request.
- [ ] Mỗi action destructive có confirmation hoặc recovery.

### Learning loop

Chọn một màn quản lý sản phẩm/đơn hàng:

- [ ] Map server state và action.
- [ ] Viết loading/error/empty/success test.
- [ ] Dùng contract type đã regenerate.
- [ ] Chặn endpoint bằng response giả lỗi; xác nhận UI không để stale value giống success.
- [ ] Test same-origin/HTTP reverse proxy theo cấu hình Vite.
- [ ] Chạy lint/typecheck/build theo package scripts.

**Artifact:** component/state diagram, interaction tests, contract-boundary review, generated diff và browser evidence.

**Tiêu chí đạt:** UI không phụ thuộc local contract chưa release; mutation failure không dẫn trạng thái “đã lưu” sai; component state không duplicate server truth.

## 9. Workstream F — Storefront Next.js

Storefront dùng Next.js App Router. Nên đọc đúng mental model: Server Components và Client Components, caching, Route Handlers và revalidation. [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components), [Caching](https://nextjs.org/docs/app/getting-started/caching), [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers), [Revalidating](https://nextjs.org/docs/app/getting-started/revalidating)

### Checklist

- [ ] Xác định component nào chạy server, client nào chạy browser và boundary serialization.
- [ ] Không đưa secret hoặc internal token xuống client bundle.
- [ ] API đi qua integration boundary hiện có; không gọi trực tiếp Backend từ nhiều feature. [Storefront AGENTS.md](../fe-ecommerce-nike-style/AGENTS.md)
- [ ] Ghi freshness/revalidation cho catalog, product detail, cart và order.
- [ ] Chia loading, not found, error và redirect rõ ràng.
- [ ] Xác định Route Handler nào là needed proxy; không tạo route handler chỉ để replicate Backend.
- [ ] Kiểm tra cache option thật sự đang bật trong config trước khi dựa vào Cache Components. Next.js chỉ sử dụng mô hình Cache Components khi `cacheComponents: true`. [Cache Components](https://nextjs.org/docs/app/getting-started/cache-components)
- [ ] Đo Core Web Vitals ảnh hưởng thực tế; không kết luận bằng Lighthouse một lần. [Web Vitals](https://web.dev/articles/vitals)

### Learning loop

Chọn một luồng product detail hoặc cart:

- [ ] Vẽ server/client component tree.
- [ ] Ghi dữ liệu nào có thể render ở server và dữ liệu nào cần browser.
- [ ] Chạy API success/error/empty.
- [ ] Thêm revalidation hoặc mutation và xác nhận UI thay đổi ngay/tối đa freshness đã quyết.
- [ ] Chặn remote contract hoặc Backend để xác nhận error boundary.
- [ ] Chạy build/typecheck/test theo scripts của repo.

**Artifact:** component boundary diagram, data freshness table, route test, API integration test và browser screenshot/trace.

**Tiêu chí đạt:** không leak secret; không import Backend code trực tiếp; cache không làm UI stale ngoài thời hạn đã ghi; route có error/empty/loading behavior.

## 10. Workstream G — API Contract và OpenAPI

### Quy tắc dự án

- [ ] Contract là description published của Backend API; Contract Version là snapshot pinned mà consumer dùng. [GLOSSARY.md](../GLOSSARY.md)
- [ ] URI `/api/v1` không phải semver Contract Version. [ADR 0002](adr/0002-automatic-contract-versioning.md)
- [ ] Không hand-edit generated API types ở CMS/Storefront.
- [ ] Local change dùng `OPENAPI_URL=../be-demo/docs/openapi/openapi.json` trước `gen:api`. [Shared workspace workflow](../shared/agents/workspace.md)
- [ ] Backend PR merge vào `dev` trước, đợi contract-bump PR ở consumer, rebase feature PR consumer trên bump PR rồi merge.

### Mẫu request/response cần review

- [ ] OperationId là ổn định, không phụ thuộc accidental naming.
- [ ] Request có validation, required/optional, format và size limit.
- [ ] Response có schema, field name, enum, pagination, nullable và error shape.
- [ ] Error behavior tách rõ 400/401/403/404/409/429/5xx theo HTTP semantics. [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)
- [ ] Authentication/authorization không chỉ mô tả ở test nhưng ở contract và implementation.
- [ ] Idempotency key được mô tả cho mutation retry khi cần.
- [ ] File hiện tại dùng OAS 3.0.0; không tự chuyển sang 3.1/JSON Schema mới nếu không có quyết định riêng. [OpenAPI Specification 3.0.4](https://spec.openapis.org/oas/v3.0.4.html)

### Learning loop thay đổi contract

1. **Optional additive change**
   - [ ] Thêm optional response/request field.
   - [ ] Generate types ở hai consumer.
   - [ ] Chạy CI và xác nhận không tạo Breaking Change bất ngờ.
2. **Breaking change**
   - [ ] Thêm required field hoặc remove/rename field.
   - [ ] Chạy `oasdiff` trong Backend CI.
   - [ ] Xác nhận minor bump theo quy tắc workspace và `breaking-contract` label ở consumer.
   - [ ] Rework consumer trước khi merge.
3. **Drift**
   - [ ] Regenerate contract và xem git diff.
   - [ ] Chạy consumer với local contract và xa local contract.
   - [ ] Xác nhận pinned Contract Version mới được commit, không chỉ file generated ở working tree.

Backend release flow dùng push `dev`, compare contract bằng `oasdiff`, release git tag và bump workflow ở consumer. [ADR 0002](adr/0002-automatic-contract-versioning.md)

**Artifact:** contract change record, oasdiff output, generated diff ở hai consumer, version bump, PR merge proof.

**Tiêu chí đạt:** generated types reproducible; breaking change dừng consumer trước deployment; contract pin không bị drift; local contract không được merge.

## 11. Workstream H — Testing và quality gates

### Test pyramid theo repo

- [ ] Backend: unit use case/provider, module wiring, HTTP/e2e, migration/drift, PostgreSQL concurrency.
- [ ] CMS: component/interaction, API contract generation, build/typecheck/lint.
- [ ] Storefront: integration route/component, API boundary, build/typecheck/test, browser smoke nếu có tác động UX.
- [ ] Cross-repo: contract generation, pinned version, merge order, failure matrix.

### Gate matrix

| Gate                      | Backend                           | CMS                             | Storefront                      |
| ------------------------- | --------------------------------- | ------------------------------- | ------------------------------- |
| Lint/typecheck            | bắt buộc khi scripts có           | bắt buộc theo app CI            | bắt buộc theo app CI            |
| Unit/integration          | bắt buộc                          | bắt buộc cho logic UI           | bắt buộc cho logic/route        |
| DB migration/e2e          | bắt buộc cho schema/transaction   | không thay PostgreSQL trực tiếp | không thay PostgreSQL trực tiếp |
| Contract generation/drift | phát sinh contract                | regenerate pinned contract      | regenerate pinned contract      |
| Build                     | production build nếu thay runtime | build                           | Next build                      |
| Browser smoke             | API smoke                         | critical staff action           | critical shopper action         |

Backend CI hiện dựng PostgreSQL 17, chạy migration/seed/e2e và contract drift; CMS/Storefront CI có contract check riêng. [Backend CI](../be-demo/.github/workflows/ci.yml), [CMS CI](../cms/.github/workflows/ci.yml), [Storefront CI](../fe-ecommerce-nike-style/.github/workflows/ci.yml)

### CI design checklist

- [ ] Job chỉ fail khi gate liên quan thực sự bị phá.
- [ ] Artifact được upload dưới tên rõ ràng; log không chứa secret.
- [ ] Service container có health check; PostgreSQL version khớp target. [GitHub Actions service containers](https://docs.github.com/en/actions/tutorials/use-containerized-services/use-docker-service-containers)
- [ ] Job dependency đúng thứ tự; không chạy consumer test trên contract chưa pin. [Jobs and dependencies](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-jobs)
- [ ] Concurrency giới hạn deployment hoặc contract bump khi cần. [Concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
- [ ] Secret có scope tối thiểu; workflow fork có policy rõ. [Security hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
- [ ] Ghi generated diff/contract diff để review, không tự commit trong job.

**Tiêu chí đạt:** CI tái tạo kết quả; schema/contract drift không lẫn; merge sai thứ tự bị gate chặn; secret không được in trong log.

## 12. Workstream I — Observability và operational readiness

- [ ] Đặt correlation/request ID hoặc trace context xuyên HTTP và job nền.
- [ ] Ghi structured log có actor, operation, outcome, duration và safe error code; không log password/token/card data.
- [ ] Đặt business metrics thay vì chỉ CPU/memory.
- [ ] Với mỗi endpoint quan trọng: latency, error rate, retry, saturation, dependency error.
- [ ] Với cache: hit/miss, stale, eviction, Redis error.
- [ ] Với PostgreSQL: slow query, lock wait, migration duration, dead transaction.
- [ ] Viết health/readiness khác liveness nếu health đang phụ thuộc DB. Kubernetes/infra dự án không có trong docs hiện tại nên không tự suy ra orchestration.
- [ ] Viết runbook: symptom, check, mitigation, rollback, verify, owner.

**Artifact:** service SLI/SLO draft, dashboard/metric list, alert table và một failure drill.

**Tiêu chí đạt:** một request thất bại có thể trace được qua repo/service; alert chỉ kèm hành động có thể làm; runbook đã qua một thực hành rollback.

## 13. Chuỗi bài lab 12 tuần

> Thời lượng là nhịp học đề xuất, không thay scripts/test của repo. Mỗi tuần kết thúc bằng một PR hoặc review packet.

### Tuần 1 — Bản đồ workspace

- [ ] Vẽ system context và data ownership.
- [ ] Viết glossary và integration impact matrix.
- [ ] Đọc hai ADR và quy trình shared.
- [ ] Chạy status/build nhỏ của ba repo.

**Chứng cứ:** system map, repo status output, impact matrix.

### Tuần 2 — ADR và trade-off

- [ ] Viết một ADR có ít nhất 2 option.
- [ ] Ghi merge/rollback/monitoring consequences.
- [ ] Review bởi người hiểu app; revise.

**Chứng cứ:** ADR + review comments được giải quyết.

### Tuần 3 — NestJS boundary

- [ ] Tách một use case khỏi controller hoặc adapter.
- [ ] Viết unit/module/HTTP test.
- [ ] Chứng minh DI wiring.

**Chứng cứ:** diff nhỏ, test report, module diagram.

### Tuần 4 — Prisma/PostgreSQL invariants

- [ ] Viết invariant matrix.
- [ ] Thêm/kiểm tra unique/FK/index/check phù hợp.
- [ ] Viết concurrency test.

**Chứng cứ:** schema diff, test, EXPLAIN/lock result.

### Tuần 5 — Migration replay

- [ ] Migrate rỗng và có dữ liệu.
- [ ] Tạo một failure và recovery.
- [ ] Viết runbook rollback hoặc just-forward.

**Chứng cứ:** migration log, seed artifact, runbook.

### Tuần 6 — Redis decision

- [ ] Viết Redis decision table cho một use case cụ thể.
- [ ] Thử outage/TTL/concurrency nếu thực sự có Redis integration.
- [ ] Nếu không dùng Redis, ghi “not introduced yet” thay vì giả vờ đã hoàn thành.

**Chứng cứ:** ADR hoặc decision record, failure test.

### Tuần 7 — CMS state

- [ ] Tạo màn state matrix success/loading/error/empty.
- [ ] Generate API types từ pinned/local contract hợp lệ.
- [ ] Viết interaction test.

**Chứng cứ:** UI test, contract diff, screenshot/video.

### Tuần 8 — Storefront boundary

- [ ] Vẽ server/client component tree.
- [ ] Chỉ rõ freshness/cache/revalidation.
- [ ] Viết route/API integration test.

**Chứng cứ:** component diagram, test, browser trace.

### Tuần 9 — Contract additive

- [ ] Đổi optional field.
- [ ] Release local/published Contract Version.
- [ ] Generate types ở consumer.

**Chứng cứ:** contract diff, tag/PR, CI output.

### Tuần 10 — Contract breaking

- [ ] Tạo một change được oasdiff coi là breaking.
- [ ] Xác nhận minor bump/label/consumer gate.
- [ ] Chứng minh consumer fix cần PR.

**Chứng cứ:** oasdiff output, bump PR, consumer fix.

### Tuần 11 — Failure drill

- [ ] Mất PostgreSQL/Redis/API/consumer pin.
- [ ] Quan sát behavior, restore và verify.
- [ ] Cập nhật alert/runbook.

**Chứng cứ:** timeline, logs/metrics, revised runbook.

### Tuần 12 — Architecture review

- [ ] Trình bày một feature end-to-end.
- [ ] Chỉ ra threat, failure, migration, contract, CI, rollback.
- [ ] Có reviewer ghi 3 finding và 1 decision.

**Chứng cứ:** architecture review deck (không quá dài), findings log, follow-up ADR/test.

## 14. Rubric tự đánh giá

### Level 1 — Implementer

- [ ] Chạy đúng app và test.
- [ ] Hiểu API và DB data flow.
- [ ] Thay đổi nhỏ có test.

### Level 2 — Technical owner

- [ ] Thiết kế module/use case rõ ràng.
- [ ] Viết migration testable và reversible.
- [ ] Review contract compatibility.
- [ ] Đưa ra trade-off không dựa trên công cụ yêu thích.

### Level 3 — Hands-on architect

- [ ] Vẽ boundary và data ownership cho thay đổi xuyên repo.
- [ ] Viết ADR, impact matrix, migration and contract strategy.
- [ ] Chạy failure drill và quantify recovery.
- [ ] Chỉ ra gate đúng repo và merge order.
- [ ] Trình bày rõ quyết định sai, dẫn chiếu evidence và rollback.

### Level 4 — Org enabler

- [ ] Rút pattern xuyên repo thành reusable contract/gate.
- [ ] Cải thiện CI/an issue template/runbook mà không làm app coupling lớn.
- [ ] Coach reviewer theo rubric thay vì review khẩu vị cá nhân.
- [ ] Tạo baseline metrics để chứng minh cải tiến.

Không tự cấp Level 3: yêu cầu ít nhất ba artifact có review và ba failure drills qua ba app boundary.

## 15. Ma trận artifact và verification

| Chủ đề            | Artifact                         | Verification tối thiểu                             |
| ----------------- | -------------------------------- | -------------------------------------------------- |
| System boundary   | System/data-flow diagram         | Reviewer chỉ ra owner và trust boundary            |
| ADR               | ADR + option matrix              | Có consequence và revisit trigger                  |
| NestJS            | Module/DI diagram                | Wiring + HTTP + failure test xanh                  |
| Prisma/PostgreSQL | Invariant matrix + migration     | Replay + concurrency + EXPLAIN                     |
| Redis             | Decision/key catalog             | Outage/TTL/concurrency test hoặc ADR “not use yet” |
| CMS               | State/component diagram          | Success/error/empty test + contract drift check    |
| Storefront        | Server/client boundary           | Route test + cache/freshness evidence              |
| Contract          | OAS diff + bump + generated diff | Additive/breaking/drift case                       |
| CI                | Workflow/gate matrix             | Failure injection + artifact/log validation        |
| Operations        | SLI + runbook                    | One restore drill + evidence                       |

## 16. Anti-pattern checklist

- [ ] Không gọi một kỹ thuật “architecture” vì nó xuất hiện trong nhiều blog.
- [ ] Không dùng abstraction trước khi có implementation variant.
- [ ] Không đưa Redis làm source of truth.
- [ ] Không dùng frontend validation thay DB invariant.
- [ ] Không merge consumer chỉ vì types local đã sinh.
- [ ] Không xem `200 OK` là đủ khi DB state sai.
- [ ] Không đổi nhiều migration và contract cùng một lần mà không có bối cảnh.
- [ ] Không dùng “major rewrite” thay vì expand/migrate/contract.
- [ ] Không có alert không có owner/hành động.
- [ ] Không coi build/typecheck pass là sufficient architecture verification.

## 17. Nguồn chính

### Chuẩn và tài liệu framework chính thức

- [NestJS documentation](https://docs.nestjs.com/)
- [NestJS modules](https://docs.nestjs.com/modules)
- [NestJS custom providers](https://docs.nestjs.com/fundamentals/custom-providers)
- [NestJS testing](https://docs.nestjs.com/fundamentals/testing)
- [NestJS pipes](https://docs.nestjs.com/pipes)
- [Prisma schema v7](https://www.prisma.io/docs/orm/v7/prisma-schema/overview)
- [Prisma transactions v7](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions)
- [Prisma Migrate v7](https://www.prisma.io/docs/orm/v7/prisma-migrate)
- [PostgreSQL 17 transaction isolation](https://www.postgresql.org/docs/17/transaction-iso.html)
- [PostgreSQL 17 explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html)
- [PostgreSQL 17 EXPLAIN](https://www.postgresql.org/docs/17/sql-explain.html)
- [PostgreSQL 17 indexes](https://www.postgresql.org/docs/17/indexes.html)
- [Redis data types](https://redis.io/docs/latest/develop/data-types/)
- [Redis SET](https://redis.io/docs/latest/commands/set/)
- [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)
- [Redis server configuration](https://redis.io/docs/latest/operate/oss_and_stack/management/config/)
- [Redis transactions](https://redis.io/docs/latest/develop/interact/transactions/)
- [Redis ACL](https://redis.io/docs/latest/operate/oss_and_stack/management/security/acl/)
- [Vue 3 documentation](https://vuejs.org/guide/)
- [Nuxt UI documentation](https://ui.nuxt.com/docs)
- [Next.js App Router getting started](https://nextjs.org/docs/app/getting-started)
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Next.js caching](https://nextjs.org/docs/app/getting-started/caching)
- [Next.js Cache Components](https://nextjs.org/docs/app/getting-started/cache-components)
- [OpenAPI Specification 3.0.4](https://spec.openapis.org/oas/v3.0.4.html)
- [RFC 9110 HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110)
- [GitHub Actions jobs](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-jobs)
- [GitHub Actions service containers](https://docs.github.com/en/actions/tutorials/use-containerized-services/use-docker-service-containers)
- [GitHub Actions concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
- [GitHub Actions security hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
- [MADR](https://adr.github.io/madr/)
- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions.html)
- [Web Vitals](https://web.dev/articles/vitals)

### Nguồn nội bộ đã dùng

- [AGENTS workspace](../AGENTS.md)
- [GLOSSARY](../GLOSSARY.md)
- [ADR 0001](adr/0001-polyrepo-with-coordination-repo.md)
- [ADR 0002](adr/0002-automatic-contract-versioning.md)
- [Shared API Contract workflow](../shared/agents/workspace.md)
- [Backend package.json](../be-demo/package.json)
- [Backend CI](../be-demo/.github/workflows/ci.yml)
- [CMS package.json](../cms/package.json)
- [CMS vite.config.ts](../cms/vite.config.ts)
- [CMS CI](../cms/.github/workflows/ci.yml)
- [Storefront package.json](../fe-ecommerce-nike-style/package.json)
- [Storefront agent rules](../fe-ecommerce-nike-style/AGENTS.md)
- [Storefront CI](../fe-ecommerce-nike-style/.github/workflows/ci.yml)
- [Workspace compose](../docker-compose.yml)

## 18. Lưu ý validation

- Tài liệu phân biệt **Prisma/Next/nuxt-ui framework version đang dùng** với mặc định docs mới nhất: Prisma follow `/orm/v7/`, Next follow App Router và flag `cacheComponents`, CMS không phải Nuxt app.
- Tài liệu không khẳng định Redis đang được ứng dụng Backend dùng: Redis chỉ được xác nhận xuất hiện trong workspace Compose.
- OpenAPI document hiện ghi `3.0.0`; tài liệu không giả định OAS 3.1.
- Contract Version và URI `/api/v1` không trộn concept.
- Mọi external source trong tài liệu đều là documentation/spec/API official của owner/framework. Internal facts trích repo hoặc ADR nội bộ.
