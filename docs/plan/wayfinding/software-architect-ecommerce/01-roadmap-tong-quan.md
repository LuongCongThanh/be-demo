# 1. Roadmap tổng quan: Senior Front-end Developer → Software Architect

## Bối cảnh và mục tiêu

Với 7 năm kinh nghiệm ReactJS, Next.js và Angular, bạn đã có nền tảng Front-end tốt. Bước tiếp theo không phải bỏ Front-end để học lại từ đầu, mà là mở rộng từ thiết kế ứng dụng sang thiết kế toàn bộ hệ thống.

- **Senior Developer:** xây dựng feature tốt, maintainable, performant.
- **Tech Lead:** giúp team thống nhất kỹ thuật và giao hàng hiệu quả.
- **Software Architect:** thiết kế hệ thống đáp ứng business requirements, scalability, security, reliability, maintainability và cost trong dài hạn.

Software Architect không nhất thiết code giỏi nhất team, nhưng cần hiểu đủ sâu để đưa ra quyết định kiến trúc, giải thích lý do, đánh giá trade-offs và chịu trách nhiệm với hệ quả.

## 1. Competency map

### Software Engineering Foundation

- Clean Code, SOLID, DRY, KISS, YAGNI.
- Design Patterns, refactoring, testing.
- Cohesion cao, coupling thấp, quản lý technical debt.

### System Design & Architecture

- Layered, Clean, Hexagonal, Modular Monolith, Microservices.
- DDD, Event-Driven Architecture, Distributed Systems.
- Scalability, high availability, consistency, failure handling.

### Backend & Data Architecture

- API design, authentication/authorization.
- SQL, NoSQL, data modeling, transactions.
- Caching, messaging, data ownership.

### Cloud & Infrastructure

- Linux, networking, Docker, CI/CD.
- AWS/Azure/GCP, Kubernetes, IaC.
- Deployment, autoscaling, cloud cost.

### Security & Reliability

- OWASP, threat modeling, encryption, secrets.
- SLI/SLO/SLA, observability, incident response.
- Backup, disaster recovery, resilience.

### Business & Communication

- Requirement analysis, NFRs, trade-offs, ROI.
- ADR, architecture documentation, technical leadership.
- Stakeholder communication, mentoring, roadmap.

## 2. Checklist tự đánh giá

Đánh dấu một mục khi bạn có thể thực hiện và giải thích nó, không chỉ vì đã đọc hoặc từng dùng một thư viện.

### 2.1 Software Engineering Foundation

**Clean Code & Design Principles**

- [ ] Hiểu và áp dụng SOLID.
- [ ] Hiểu DRY, KISS, YAGNI và không áp dụng máy móc.
- [ ] Phân biệt abstraction tốt với over-engineering.
- [ ] Thiết kế module có cohesion cao, coupling thấp.
- [ ] Refactor code lớn mà không đổi behavior.
- [ ] Thiết kế code dễ test và maintain.
- [ ] Nhận diện code smell và technical debt.

**Design Patterns**

- [ ] Factory, Builder, Strategy, Adapter, Decorator.
- [ ] Observer, Pub/Sub, Command, State.
- [ ] Dependency Injection và Inversion of Control.
- [ ] Repository, Unit of Work, Specification.
- [ ] Chọn pattern theo vấn đề, không theo thói quen.

**Software Testing**

- [ ] Unit Test có ý nghĩa.
- [ ] Integration Test.
- [ ] E2E Test.
- [ ] Test Pyramid và testing strategy.
- [ ] Mock, Stub, Fake, Test Double.
- [ ] Kiểm soát regression khi refactor.

### 2.2 System Design & Software Architecture

**Architecture Fundamentals**

- [ ] Layered Architecture.
- [ ] Clean Architecture.
- [ ] Hexagonal Architecture (Ports & Adapters).
- [ ] Domain-Driven Design.
- [ ] Modular Monolith.
- [ ] Microservices Architecture.
- [ ] Event-Driven Architecture.
- [ ] Chọn architecture phù hợp quy mô business.

**System Design**

- [ ] Phân tích Functional Requirements và Non-functional Requirements.
- [ ] High Availability.
- [ ] Horizontal và Vertical Scaling.
- [ ] Load Balancing.
- [ ] Stateless và Stateful Services.
- [ ] API Gateway.
- [ ] CDN và Edge Computing.
- [ ] Caching Strategy.
- [ ] Database Replication và Sharding.
- [ ] Eventual Consistency.
- [ ] Thiết kế hệ thống chịu tải cao.
- [ ] Xác định Single Point of Failure.

**Architecture Documentation**

- [ ] System Context Diagram.
- [ ] Container Diagram.
- [ ] Component Diagram.
- [ ] Sequence Diagram.
- [ ] C4 Model.
- [ ] Architecture Decision Record (ADR).
- [ ] Document trade-offs của quyết định.
- [ ] Tài liệu đủ rõ để developer khác triển khai.

### 2.3 Backend & API Architecture

- [ ] RESTful API Design.
- [ ] GraphQL và khi nào nên dùng.
- [ ] gRPC và Protocol Buffers.
- [ ] API Versioning và Backward Compatibility.
- [ ] Session, JWT, OAuth 2.0, OpenID Connect.
- [ ] RBAC và ABAC.
- [ ] Rate Limiting và Throttling.
- [ ] Idempotency.
- [ ] Retry, Timeout, Circuit Breaker.
- [ ] Backend Architecture với Node.js hoặc ngôn ngữ khác.
- [ ] Background jobs và scheduled jobs.
- [ ] RabbitMQ, Kafka, SQS.
- [ ] Event-driven communication.
- [ ] API Contract giữa Front-end và Back-end.

### 2.4 Database & Data Architecture

- [ ] SQL và Database Normalization.
- [ ] Indexing và Query Optimization.
- [ ] Execution Plan.
- [ ] ACID và Transaction Isolation Levels.
- [ ] Locking và Deadlocks.
- [ ] Optimistic và Pessimistic Locking.
- [ ] Database Schema cho domain phức tạp.
- [ ] PostgreSQL hoặc MySQL chuyên sâu.
- [ ] MongoDB và NoSQL trade-offs.
- [ ] Redis và caching strategies.
- [ ] Database Replication.
- [ ] Sharding và Partitioning.
- [ ] CAP Theorem và Consistency Models.
- [ ] Data migration an toàn.
- [ ] Backup, restore và disaster recovery.

### 2.5 Cloud, DevOps & Infrastructure

- [ ] Linux fundamentals.
- [ ] TCP/IP, DNS, HTTP/HTTPS, TLS.
- [ ] Docker và Docker Compose.
- [ ] CI/CD Pipeline.
- [ ] AWS, Azure hoặc GCP.
- [ ] VPC, Subnet, Security Group, IAM.
- [ ] Deploy hệ thống lên Cloud.
- [ ] Kubernetes: Pod, Deployment, Service, Ingress.
- [ ] Terraform hoặc Pulumi.
- [ ] Load Balancer và Reverse Proxy.
- [ ] Blue-Green và Canary Deployment.
- [ ] Dev, Staging, Production environments.
- [ ] Autoscaling và Cloud Cost Optimization.
- [ ] Logging, Metrics, Distributed Tracing.

### 2.6 Security, Reliability & Observability

- [ ] OWASP Top 10.
- [ ] XSS, CSRF, SQL Injection.
- [ ] CORS, CSP, Secure Cookies.
- [ ] Secret Management.
- [ ] Encryption at Rest và In Transit.
- [ ] Authentication và Authorization an toàn.
- [ ] Rate Limiting và DDoS Protection.
- [ ] SLI, SLO, SLA.
- [ ] Health Check và Readiness Probe.
- [ ] Graceful Shutdown.
- [ ] Fault Tolerance và Disaster Recovery.
- [ ] Logging, Metrics, Tracing.
- [ ] OpenTelemetry.
- [ ] Production incident analysis và Postmortem.

### 2.7 Business, Leadership & Decision Making

- [ ] Phân tích business requirements.
- [ ] Đặt câu hỏi làm rõ yêu cầu.
- [ ] Chuyển business requirements thành technical requirements.
- [ ] Xác định NFR: performance, security, scalability, availability.
- [ ] Technical feasibility.
- [ ] Cost và ROI.
- [ ] Trình bày và bảo vệ architecture decisions.
- [ ] Đánh giá trade-offs.
- [ ] Review architecture của team khác.
- [ ] Coding standards và engineering guidelines.
- [ ] Mentoring developer.
- [ ] Làm việc với PM, QA, DevOps, Backend và Business.
- [ ] Quản lý Technical Debt.
- [ ] Dẫn dắt technical discussion và xử lý bất đồng.
- [ ] Lập technical roadmap.

## 3. Học gì trong project hiện tại?

### 3.1 Phân tích hệ thống trước khi code

Với mỗi feature, hãy hỏi:

- Business problem thực sự là gì?
- Ai sử dụng?
- Functional Requirements và NFR là gì?
- Feature phụ thuộc service nào?
- Dữ liệu được tạo, đọc, cập nhật, xóa ở đâu?
- Nếu user tăng 10 lần, bottleneck ở đâu?
- Nếu một service lỗi thì feature phản ứng thế nào?
- Có ảnh hưởng feature hiện tại không?

Ví dụ với Order Management:

- Order Service chịu trách nhiệm gì?
- Inventory Service xử lý tồn kho thế nào?
- Payment có idempotency không?
- Nếu thanh toán thành công nhưng cập nhật order thất bại thì sao?
- Làm sao tránh xử lý một order hai lần?
- Notification đồng bộ hay bất đồng bộ?
- Có cần audit log hoặc event-driven architecture không?

### 3.2 Thiết kế architecture cho project

- [ ] Vẽ System Context Diagram.
- [ ] Vẽ Container Diagram.
- [ ] Vẽ Component Diagram.
- [ ] Vẽ Sequence Diagram cho business flow quan trọng.
- [ ] Phân tích module boundaries và trách nhiệm.
- [ ] Xác định coupling quá chặt.
- [ ] Xác định phần có thể tái sử dụng.
- [ ] Đề xuất module boundaries và dependency rules.
- [ ] So sánh Monolith, Modular Monolith, Microservices.
- [ ] Document As-Is architecture.
- [ ] Đề xuất To-Be architecture.

Nên dùng C4 Model thay vì chỉ vẽ một sơ đồ tổng quan nhiều mũi tên.

### 3.3 Front-end Architecture ở cấp hệ thống

| Chủ đề                   | Câu hỏi Architect                                |
| ------------------------ | ------------------------------------------------ |
| Application Architecture | Monolith Front-end hay Micro Frontends?          |
| Rendering                | SSR, SSG, ISR, CSR phù hợp business nào?         |
| Performance              | Làm sao đạt Core Web Vitals ở quy mô lớn?        |
| State Management         | Server State và Client State quản lý thế nào?    |
| Module Design            | Làm sao tránh circular dependencies?             |
| Scalability              | Codebase lớn và nhiều team được tổ chức thế nào? |
| Security                 | Bảo vệ session, token và dữ liệu ra sao?         |
| Design System            | Quản lý UI consistency giữa nhiều team thế nào?  |
| BFF                      | Khi nào cần Backend for Frontend?                |
| Deployment               | Deploy độc lập các phần thế nào?                 |

Chủ đề nên học sâu:

- Next.js rendering architecture và caching.
- React Server Components.
- Micro Frontends và Module Federation.
- Monorepo: Nx, Turborepo.
- Design System Architecture.
- Front-end Observability.
- Web Performance Engineering.
- BFF Pattern.

Không mặc định hệ thống lớn là phải dùng Micro Frontends.

### 3.4 Chủ động tham gia Backend và Database

- [ ] Tham gia thiết kế API Contract.
- [ ] Review API Design.
- [ ] Đọc và hiểu Backend code.
- [ ] Review Database Schema.
- [ ] Phân tích query chậm.
- [ ] Tìm hiểu transaction.
- [ ] Tìm hiểu authentication.
- [ ] Debug từ Front-end đến Database.
- [ ] Thiết kế caching strategy.
- [ ] Phân tích luồng bất đồng bộ.

Khi trang load chậm, phân tích network latency, API processing, DB query, serialization, payload, rendering/hydration; không vội kết luận do React.

### 3.5 Tham gia Infrastructure và Deployment

- [ ] Tự deploy project lên Cloud.
- [ ] Viết Dockerfile và Docker Compose.
- [ ] Đọc CI/CD Pipeline.
- [ ] Hiểu Environment Variables và Secrets.
- [ ] Hiểu Domain, DNS, HTTPS, Reverse Proxy.
- [ ] Hiểu Load Balancer và CDN.
- [ ] Theo dõi Production logs.
- [ ] Thiết lập monitoring và alerting.
- [ ] Phân tích deployment failure và rollback.
- [ ] Đánh giá cloud cost.

### 3.6 Luyện Architecture Decision

Khi cân nhắc Monolith và Microservices, phải phân tích deployment complexity, operational cost, scaling, data consistency, observability, team autonomy và nhu cầu thực tế.

Ví dụ ADR:

**ADR-001: Choosing a Modular Monolith Architecture**

- **Context:** Nhiều business modules, team nhỏ, chưa cần deploy độc lập.
- **Decision:** Modular Monolith, phân chia theo business domain.
- **Alternatives:** Traditional Layered Monolith, Microservices.
- **Trade-offs:** Giảm operational complexity, transaction dễ quản lý hơn; cần enforce module boundaries.
- **Consequences:** Module có interface rõ ràng, không truy cập trực tiếp internal implementation của module khác.

## 4. Sau project: Architecture Review

Đánh giá:

- Architecture có phù hợp business không?
- Nếu traffic tăng 10–100 lần, bottleneck ở đâu?
- Single Point of Failure là gì?
- Coupling quá chặt ở đâu?
- Quyết định nào tạo technical debt?
- Có thể giảm infrastructure cost không?
- Module/service nào nên tách?
- Database và caching strategy có phù hợp?
- Monitoring có đủ để điều tra sự cố?
- Rủi ro kiến trúc lớn nhất là gì?

### Tài liệu cần tạo

1. System Architecture Document.
2. C4 Architecture Diagrams.
3. Architecture Decision Records.
4. Non-functional Requirements.
5. Database Design Document.
6. API Design Document.
7. Security Assessment.
8. Infrastructure & Deployment Architecture.
9. Performance & Scalability Report.
10. Technical Debt & Improvement Roadmap.

Có thể đưa vào GitHub/portfolio sau khi loại bỏ thông tin nhạy cảm của công ty.

## 5. Kiến thức mới cần học

### Ưu tiên cao

- System Design: HA, scalability, load balancing, caching.
- Clean Architecture: dependency rule, ports & adapters.
- DDD: bounded context, aggregate, entity, value object.
- Distributed Systems: consistency, partitioning, replication, failure.
- Database: SQL, indexing, transactions, optimization.
- API Architecture: REST, GraphQL, gRPC, BFF.
- Security: OWASP, OAuth2, OIDC, threat modeling.
- Cloud Architecture: AWS/Azure/GCP, networking, IAM.
- Observability: logs, metrics, tracing, OpenTelemetry.

### Ưu tiên trung bình

- Event-Driven Architecture.
- Microservices.
- Kubernetes.
- Terraform/Pulumi.
- Resilience Engineering.
- Performance Engineering.
- Cloud Cost Optimization.
- Architecture Governance.

### Nâng cao

- Multi-region Architecture.
- Multi-tenant Architecture.
- CQRS và Event Sourcing.
- Saga Pattern.
- Distributed Transactions.
- Zero Trust.
- Service Mesh.
- Data Mesh.
- Platform Engineering.
- Chaos Engineering.
- AI/LLM System Architecture.

Không học tất cả cùng lúc; học theo vấn đề thực tế.

## 6. Roadmap tổng quan 6 tháng

### Tháng 1 – Software Architecture Foundation

- SOLID, Clean Architecture, DDD.
- Layered, Hexagonal, Modular Monolith.
- C4 Model và ADR.
- Review project hiện tại.
- **Deliverable:** Architecture Document + C4 Diagrams.

### Tháng 2 – System Design

- High Availability, Scalability.
- Load Balancing, Caching, CDN.
- API Gateway, BFF.
- Rate Limiting, Retry, Circuit Breaker.
- Thiết kế một hệ thống thực tế.
- **Deliverable:** System Design Case Study.

### Tháng 3 – Backend & Database

- Backend Architecture.
- PostgreSQL, Redis.
- Indexing, Transactions.
- Message Queue.
- REST, GraphQL, gRPC.
- **Deliverable:** API + Database Architecture.

### Tháng 4 – Cloud & DevOps

- Docker, CI/CD.
- AWS hoặc Azure.
- Networking, IAM.
- Kubernetes fundamentals.
- Deployment và IaC.
- **Deliverable:** Cloud Deployment Architecture.

### Tháng 5 – Distributed Systems & Reliability

- Microservices.
- Event-Driven Architecture.
- Kafka hoặc RabbitMQ.
- Distributed Transactions.
- Observability và Security.
- Fault Tolerance.
- **Deliverable:** Distributed System Design.

### Tháng 6 – Architecture Leadership

- Architecture Review.
- Technical Decision Making.
- Cost Optimization.
- Technical Roadmap.
- Mentoring và Leadership.
- Trình bày và bảo vệ Architecture.
- **Deliverable:** Complete Architecture Portfolio.

## 7. Phân bổ 10 giờ học mỗi tuần

- 3 giờ System Design & Architecture.
- 4 giờ project thực hành.
- 2 giờ Backend, Cloud & Database.
- 1 giờ Documentation & Review.

## 8. Sách và nguồn học

### Sách

1. **Fundamentals of Software Architecture** – Mark Richards & Neal Ford: architectural styles, quality attributes, trade-offs.
2. **Designing Data-Intensive Applications** – Martin Kleppmann: distributed systems, database, replication, partitioning, consistency.
3. **Clean Architecture** – Robert C. Martin: boundaries, dependency rule, architecture independence.
4. **Domain-Driven Design** – Eric Evans: domain modeling, bounded context, ubiquitous language.
5. **Software Architecture: The Hard Parts** – Neal Ford & Mark Richards: trade-offs, distributed architecture, data ownership.
6. **System Design Interview** – Alex Xu: system design case studies.

### Website

- Martin Fowler: https://martinfowler.com/
- Azure Architecture Center: https://learn.microsoft.com/en-us/azure/architecture/
- C4 Model: https://c4model.com/
- Microservices.io: https://microservices.io/
- Twelve-Factor App: https://12factor.net/
- Software Architect Roadmap: https://roadmap.sh/software-architect
- AWS Architecture Center: https://aws.amazon.com/architecture/
- OWASP Top 10: https://owasp.org/www-project-top-ten/

## 9. Bài tập thực chiến

### Bài tập 1: E-commerce System

Product Catalog, Cart, Order, Payment, Inventory, Notification.
Học: DDD, Microservices, Database, Event-driven.

### Bài tập 2: Real-time Chat System

WebSocket, Message Queue, Online Presence, Message Persistence, Delivery Status.
Học: Distributed Systems, Real-time Architecture, Scaling.

### Bài tập 3: Multi-tenant SaaS

Tenant Management, RBAC, Data Isolation, Subscription, Billing.
Học: Multi-tenancy, Security, Database Architecture.

### Bài tập 4: Analytics Platform

Data Ingestion, Event Processing, Aggregation, Dashboard, Data Pipeline.
Học: Event-driven, Data Architecture, Distributed Processing.

Với mỗi bài:

1. Phân tích business requirements.
2. Xác định functional và non-functional requirements.
3. Vẽ C4 diagrams.
4. Thiết kế Database.
5. Thiết kế API.
6. Chọn architecture style và giải thích.
7. Phân tích scalability, security, reliability.
8. Viết ADR.
9. Implement một phần quan trọng.
10. Load test và review kiến trúc.

## 10. Các cấp độ năng lực

- **Senior Engineer:** thiết kế và triển khai feature phức tạp, giải quyết technical problems.
- **Tech Lead / Solution Architect:** thiết kế giải pháp cho hệ thống/domain, dẫn dắt team và quyết định kỹ thuật.
- **Software Architect:** định hướng architecture tổng thể, quản lý trade-offs, quality attributes, governance và technical evolution.

Dấu hiệu tiến gần Architect:

- [ ] Hiểu toàn hệ thống, không chỉ code mình viết.
- [ ] Thiết kế hệ thống từ business requirements.
- [ ] Giải thích vì sao chọn architecture.
- [ ] Phát hiện bottleneck trước production.
- [ ] Đánh giá tác động quyết định tới nhiều team.
- [ ] Đánh giá security, scalability, performance, cost.
- [ ] Review architecture và đề xuất cải tiến.
- [ ] Viết tài liệu kiến trúc rõ ràng.
- [ ] Thuyết phục stakeholders bằng lập luận kỹ thuật.
- [ ] Chịu trách nhiệm với quyết định kiến trúc.

## 11. Kế hoạch bắt đầu ngay: 30 ngày

### Tuần 1: Audit kiến thức

- Hoàn thành checklist.
- Phân loại: Chưa biết / Đã học / Đã thực hành / Thành thạo.
- Chọn 5 khoảng trống lớn nhất.

### Tuần 2: Architecture Analysis

- Vẽ C4 Context và Container Diagram.
- Phân tích architecture hiện tại.
- Xác định module và dependencies.
- Viết 3 vấn đề kiến trúc cần cải thiện.

### Tuần 3: System Design

- Học functional và non-functional requirements.
- Thiết kế lại một business flow.
- Phân tích API, Database, Caching.
- Viết ít nhất 2 ADR.

### Tuần 4: Architecture Review

- Đánh giá scalability, security, reliability.
- Đề xuất architecture cải tiến.
- Thảo luận với Tech Lead hoặc Backend Lead.
- Lập roadmap 3 tháng tiếp theo.

## 12. Kết luận

Đừng chờ học xong mới bắt đầu làm công việc Architect. Ngay project tiếp theo, hãy chủ động tham gia thiết kế API, database, deployment, architecture review và technical decisions.

Mục tiêu không phải biết thật nhiều công nghệ, mà là trả lời được: Với business problem này, hệ thống nên được thiết kế thế nào, tại sao chọn kiến trúc đó, trade-offs là gì, hệ thống sẽ phát triển ra sao và làm sao đảm bảo vận hành ổn định?
