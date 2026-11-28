# 2. Roadmap cá nhân hóa: Senior Front-end Developer → Software Architect trong 6 tháng

## 1. Hồ sơ hiện tại

Thông tin đầu vào:

- Vai trò: Senior Front-end Developer.
- Kinh nghiệm: 7 năm với ReactJS, Next.js, Angular.
- Backend: Basic.
- DevOps/Cloud: Chưa có kinh nghiệm.
- Architecture experience: Chủ yếu Front-end Architecture.
- Mục tiêu: Software Architect.

### Định hướng

Phát triển theo mô hình **T-shaped Software Architect**:

- Chiều sâu: phát huy Front-end Architecture, React, Next.js, Performance Engineering.
- Chiều rộng: Backend, Database, Cloud, Infrastructure, Security, Distributed Systems và Business Architecture.

Không cần thành chuyên gia sâu ở mọi lĩnh vực, nhưng phải đủ khả năng hiểu, thiết kế, review và đưa ra quyết định cho toàn hệ thống.

### Đánh giá điểm xuất phát

| Năng lực               | Hiện tại          |
| ---------------------- | ----------------- |
| Front-end Engineering  | Mạnh              |
| Front-end Architecture | Đã có kinh nghiệm |
| Backend                | Cơ bản            |
| Database               | Cần đánh giá sâu  |
| DevOps / Cloud         | Khoảng trống lớn  |
| System Architecture    | Cần mở rộng       |
| Distributed Systems    | Cần học mới       |
| Technical Leadership   | Cần phát triển    |

## 2. Skill Gaps và mức ưu tiên

### P0 – Phải bổ sung trước

- Backend Architecture.
- Database Design và SQL.
- System Design Fundamentals.
- Software Architecture Patterns.
- Cloud và Infrastructure Fundamentals.

### P1 – Architecture core

- Distributed Systems.
- Scalability và High Availability.
- Security Architecture.
- Observability và Reliability.
- Architecture Decision Making.

### P2 – Mở rộng

- Microservices.
- Event-Driven Architecture.
- Kubernetes.
- Infrastructure as Code.
- Cloud Cost Optimization.

### P3 – Nâng cao

- Multi-region Architecture.
- Multi-tenant Architecture.
- CQRS và Event Sourcing.
- Chaos Engineering.
- Platform Engineering.

**Thứ tự học:** Software Architecture Fundamentals → Backend + Database → System Design + Cloud → Distributed Systems + Security → Architecture Leadership.

Không nên bắt đầu bằng Microservices, Kafka, Kubernetes khi chưa nắm Backend, Database, Networking và System Design.

## 3. Roadmap 6 tháng chi tiết

# Tháng 1 – Software Architecture Foundation

**Mục tiêu:** Chuyển từ tư duy thiết kế Front-end sang tư duy thiết kế toàn bộ hệ thống.

### Kiến thức

- SOLID.
- Clean Architecture.
- Hexagonal Architecture (Ports & Adapters).
- DDD: Entity, Value Object, Aggregate, Bounded Context.
- Layered, Modular Monolith, Microservices.
- C4 Model: Context, Container, Component.
- Architecture Decision Record (ADR).

### Checklist

- [ ] Phân biệt Architecture và Design Patterns.
- [ ] Hiểu Layered Architecture.
- [ ] Hiểu Clean Architecture.
- [ ] Hiểu Hexagonal Architecture.
- [ ] Hiểu Modular Monolith.
- [ ] Hiểu cơ bản DDD và Bounded Context.
- [ ] Hiểu Dependency Inversion.
- [ ] Phân tích Coupling và Cohesion.
- [ ] Vẽ C4 Context Diagram.
- [ ] Vẽ C4 Container Diagram.
- [ ] Viết Architecture Decision Record.
- [ ] Đánh giá trade-offs giữa các architecture styles.

### Bài tập

Chọn một ứng dụng thực tế đã từng làm, ví dụ hệ thống quản lý nhân viên:

1. Phân tích business domains.
2. Xác định module.
3. Xác định trách nhiệm từng module.
4. Vẽ C4 diagrams.
5. Thiết kế module boundaries.
6. Đề xuất architecture.
7. Viết 3 ADR giải thích quyết định.

**Deliverables**

- 1 System Architecture Document.
- 3 Architecture Diagrams.
- 3 ADR.
- 1 Architecture Review hệ thống hiện tại.

**Tài liệu**

- Fundamentals of Software Architecture.
- https://c4model.com/
- https://martinfowler.com/architecture/

# Tháng 2 – Backend + Database Architecture

**Mục tiêu:** Hiểu luồng Front-end → API → Backend → Database.

### Stack học tập đề xuất

- Node.js + NestJS + PostgreSQL.
- Redis cho caching.

Lý do: tận dụng TypeScript/JavaScript, giảm thời gian học ngôn ngữ mới; NestJS giúp học module, DI và cấu trúc Backend. Đây là stack học tập, không phải công nghệ bắt buộc cho mọi hệ thống.

### Backend cần học

- Node.js Runtime và Event Loop.
- NestJS Architecture.
- Dependency Injection.
- Middleware, Guards, Interceptors, Pipes.
- REST API Design.
- API Versioning.
- Authentication và Authorization.
- Error Handling, Validation.
- Background Jobs.

### Database cần học

- SQL.
- Database Normalization.
- ERD.
- Indexing.
- Transactions.
- ACID.
- Isolation Levels.
- Locking.
- Query Optimization.
- Redis Caching.

### Checklist

- [ ] Hiểu Node.js Event Loop và asynchronous processing.
- [ ] Xây dựng Backend API với NestJS.
- [ ] Thiết kế module và dependency trong Backend.
- [ ] Thiết kế RESTful API.
- [ ] API Versioning và Error Handling.
- [ ] JWT, Session và OAuth 2.0.
- [ ] Thiết kế Database ERD.
- [ ] Normalization.
- [ ] SQL JOIN và Indexing.
- [ ] ACID và Transaction.
- [ ] Isolation Levels và Locking.
- [ ] EXPLAIN ANALYZE.
- [ ] Redis caching.
- [ ] Pagination và Filtering.
- [ ] Data Migration.

### Bài tập

Xây dựng Task Management API gồm:

- User Management.
- Authentication.
- Project Management.
- Task Management.
- RBAC.
- Comments.
- Activity Logs.

Yêu cầu:

- Modular Backend.
- PostgreSQL.
- Redis.
- REST API.
- JWT hoặc Session Authentication.
- Unit Test và Integration Test.
- Docker Compose.

**Deliverables**

1. Backend Architecture Diagram.
2. Database ERD.
3. API Specification.
4. Authentication Design.
5. API chạy thực tế.

**Tài liệu**

- https://docs.nestjs.com/
- https://www.postgresql.org/docs/
- https://redis.io/docs/latest/

# Tháng 3 – System Design + Cloud Fundamentals

**Mục tiêu:** Thiết kế hệ thống có khả năng mở rộng và vận hành.

### System Design

1. Functional Requirements và NFR.
2. Latency, Throughput, Availability.
3. Vertical và Horizontal Scaling.
4. Load Balancing.
5. Reverse Proxy.
6. CDN.
7. Caching Strategies.
8. Database Replication.
9. Database Partitioning.
10. High Availability và Fault Tolerance.
11. Rate Limiting.
12. API Gateway.

### Networking và Cloud

- Linux fundamentals.
- Process, Port, Socket.
- TCP/IP, DNS, HTTP/HTTPS, TLS.
- Firewall, Reverse Proxy, Load Balancer.
- Virtual Network, Subnet, Public/Private IP.

AWS học theo thứ tự:

- IAM.
- VPC.
- EC2.
- S3.
- RDS.
- CloudFront.
- Application Load Balancer.
- CloudWatch.

### Checklist

- [ ] Phân tích Functional Requirements và NFR.
- [ ] Latency và Throughput.
- [ ] Availability và Reliability.
- [ ] Vertical và Horizontal Scaling.
- [ ] Load Balancing.
- [ ] CDN và Reverse Proxy.
- [ ] Chọn Cache Strategy.
- [ ] Database Replication.
- [ ] Database Partitioning.
- [ ] Rate Limiting.
- [ ] TCP/IP, DNS, HTTP, HTTPS, TLS.
- [ ] Linux Process và Networking cơ bản.
- [ ] Docker và Docker Compose.
- [ ] IAM và VPC.
- [ ] Deploy ứng dụng lên Cloud.
- [ ] Security Group và Public/Private Subnet.

### Bài tập

Deploy Task Management System của tháng 2 lên AWS:

1. Dockerize Backend.
2. Deploy Backend lên EC2.
3. Database lên RDS.
4. S3 lưu trữ file.
5. Cấu hình Domain và HTTPS.
6. Security Groups.
7. CloudWatch.
8. Backup Strategy.
9. Deployment Architecture Document.

**Deliverables**

- Cloud Architecture Diagram.
- Dockerfile và Docker Compose.
- Deployment Guide.
- Cloud Security Configuration.
- Ứng dụng chạy trên Cloud.

**Tài liệu**

- https://aws.amazon.com/training/digital/
- https://docs.docker.com/
- https://roadmap.sh/devops

# Tháng 4 – Distributed Systems + Microservices

**Mục tiêu:** Hiểu hệ thống nhiều thành phần độc lập, giao tiếp và xử lý lỗi.

### Kiến thức

- Distributed Systems Concepts.
- CAP Theorem.
- Consistency Models, Eventual Consistency.
- Replication, Partitioning.
- Distributed Transactions.
- Idempotency.
- Retry, Timeout.
- Circuit Breaker, Bulkhead.
- Service Boundaries, Service Discovery.
- API Gateway.
- Synchronous/Asynchronous Communication.
- Database per Service.
- Saga Pattern.
- Event-Driven Architecture.
- Message Broker.

### Công nghệ

- RabbitMQ trước để học message queue, routing, acknowledgment, retry.
- Kafka sau để hiểu event log, partitions, consumer groups.
- Redis.
- NestJS Microservices.

### Checklist

- [ ] CAP Theorem và giới hạn.
- [ ] Strong Consistency và Eventual Consistency.
- [ ] Replication và Partitioning.
- [ ] Synchronous và Asynchronous Communication.
- [ ] Message Queue và Pub/Sub.
- [ ] RabbitMQ cơ bản.
- [ ] Kafka Topics, Partitions, Consumer Groups.
- [ ] Service Boundaries.
- [ ] API Gateway.
- [ ] Database per Service.
- [ ] Saga Pattern.
- [ ] Idempotency.
- [ ] Retry, Timeout, Circuit Breaker.
- [ ] Fault Tolerance.
- [ ] Failure Scenarios.
- [ ] Biết khi nào không nên dùng Microservices.

### Bài tập

Mở rộng Task Management thành các service:

- Auth Service.
- Project Service.
- Task Service.
- Notification Service.
- API Gateway.
- Message Broker.
- Database riêng cho service phù hợp.

Thực hành:

- Task tạo mới thì gửi Notification.
- Notification Service lỗi nhưng Task Service vẫn hoạt động.
- Event gửi hai lần không tạo hai notification.
- Database service không truy cập được thì xử lý ra sao?
- Project Service chậm có ảnh hưởng service khác không?
- Tạo Project và nhiều Task thì đảm bảo consistency thế nào?

**Deliverables**

- Microservices Architecture Diagram.
- Event Flow Diagram.
- Message Contract.
- ADR về Service Boundaries.
- Failure Scenarios Document.

**Tài liệu**

- Designing Data-Intensive Applications.
- https://microservices.io/
- https://www.rabbitmq.com/tutorials
- https://kafka.apache.org/documentation/

# Tháng 5 – Security, Reliability, Observability và DevOps nâng cao

**Mục tiêu:** Thiết kế hệ thống bảo mật, ổn định và có thể điều tra khi có sự cố.

### Security Architecture

- OWASP Top 10.
- OAuth 2.0, OpenID Connect.
- RBAC và ABAC.
- Threat Modeling.
- Encryption at Rest/In Transit.
- Secret Management.
- API Security.
- Rate Limiting, DDoS Protection.

### Reliability Engineering

- SLI, SLO, SLA.
- Availability, Fault Tolerance.
- Graceful Degradation.
- Health Check, Readiness/Liveness Probe.
- Disaster Recovery.
- RTO, RPO.
- Backup, Restore.
- Incident Management.

### Observability

- Logs: điều gì đã xảy ra?
- Metrics: hệ thống hoạt động thế nào?
- Tracing: request đi qua những đâu?

Công cụ:

- OpenTelemetry.
- Prometheus.
- Grafana.
- Jaeger hoặc Tempo.
- Loki.

### DevOps nâng cao

- CI/CD, GitHub Actions.
- Terraform Fundamentals.
- Kubernetes Fundamentals.
- Blue-Green Deployment.
- Canary Deployment.
- Rollback Strategy.

Không cần thành Kubernetes Administrator; cần hiểu vấn đề Kubernetes giải quyết, cách vận hành và khi nào nên dùng.

### Checklist

- [ ] OWASP Top 10.
- [ ] Threat Model.
- [ ] OAuth 2.0 và OpenID Connect.
- [ ] RBAC và ABAC.
- [ ] Secret Management.
- [ ] Encryption at Rest/In Transit.
- [ ] SLI, SLO, SLA.
- [ ] Health Check.
- [ ] Graceful Degradation.
- [ ] Backup và Restore Strategy.
- [ ] RTO và RPO.
- [ ] Application Logging.
- [ ] Metrics và Distributed Tracing.
- [ ] OpenTelemetry cơ bản.
- [ ] Prometheus và Grafana cơ bản.
- [ ] CI/CD và Rollback.
- [ ] Kubernetes Pod, Deployment, Service, Ingress.
- [ ] Terraform cơ bản.

### Bài tập

Tạo Production Readiness Review và thử các tình huống:

1. Database mất kết nối.
2. RabbitMQ ngừng hoạt động.
3. Backend quá tải.
4. API chậm bất thường.
5. Request đáng ngờ.
6. Bản deploy mới gây lỗi.
7. Database cần restore.

**Deliverables**

- Security Assessment.
- Observability Dashboard.
- SLO Definition.
- CI/CD Pipeline.
- Incident Response Document.
- Production Readiness Checklist.

# Tháng 6 – Architecture Leadership + Capstone Project

**Mục tiêu:** Chứng minh khả năng thiết kế, review và định hướng kiến trúc tổng thể.

### Architecture Leadership

- Architecture Review.
- Architecture Governance.
- Technical Roadmap.
- Technical Debt Management.
- Cost vs Performance Trade-offs.
- Stakeholder Communication.
- Technical Proposal.
- Mentoring.
- Cross-team Collaboration.
- Architecture Decision Making.

### Capstone: Multi-tenant SaaS Platform

Xây dựng nền tảng quản lý công việc cho nhiều doanh nghiệp.

**Business requirements**

- Organization Management.
- Tenant Management.
- User Management.
- Role-based Access Control.
- Project Management.
- Task Management.
- File Management.
- Activity Logs.
- Notification.
- Subscription Management.

**Stack gợi ý**

| Layer          | Công nghệ               |
| -------------- | ----------------------- |
| Front-end      | Next.js                 |
| Backend        | NestJS                  |
| Database       | PostgreSQL              |
| Cache          | Redis                   |
| Message Broker | RabbitMQ                |
| File Storage   | S3                      |
| Cloud          | AWS                     |
| Container      | Docker                  |
| CI/CD          | GitHub Actions          |
| Monitoring     | OpenTelemetry + Grafana |
| Infrastructure | Terraform cơ bản        |

Đây là kiến trúc luyện tập, không bắt buộc đưa toàn bộ công nghệ vào production.

### Capstone Checklist

- [ ] Business Requirements.
- [ ] Functional và Non-functional Requirements.
- [ ] Domain Model.
- [ ] Bounded Context.
- [ ] System Context Diagram.
- [ ] Container Diagram.
- [ ] Component Diagram.
- [ ] Sequence Diagram cho business flows.
- [ ] Database ERD.
- [ ] Multi-tenant Data Isolation.
- [ ] Authentication và Authorization.
- [ ] API Contracts.
- [ ] Cache Strategy.
- [ ] Asynchronous Event Processing.
- [ ] Security Architecture.
- [ ] Cloud Infrastructure.
- [ ] CI/CD Pipeline.
- [ ] Observability.
- [ ] Scalability và Failure Scenarios.
- [ ] Load Testing.
- [ ] Cloud Cost Analysis.
- [ ] ADR cho quyết định quan trọng.
- [ ] Architecture Review.
- [ ] Trình bày và bảo vệ Architecture Design.

**Deliverables cuối tháng 6**

- Complete System Architecture Document.
- C4 Diagrams.
- Database Design.
- API Specification.
- Cloud Architecture.
- Security Architecture.
- ADR Collection.
- Production Readiness Review.
- Technical Roadmap.
- Architecture Presentation.

## 4. Lịch học mỗi tuần: 12 giờ

| Ngày     | Hoạt động                                     | Thời lượng |
| -------- | --------------------------------------------- | ---------: |
| Thứ 2    | Architecture Fundamentals                     |       1.5h |
| Thứ 3    | Backend / Database / Cloud theo tháng         |       1.5h |
| Thứ 4    | Đọc sách và phân tích Architecture Case Study |       1.5h |
| Thứ 5    | Thực hành thiết kế hệ thống                   |       1.5h |
| Thứ 6    | Code và triển khai bài tập                    |         2h |
| Thứ 7    | Project thực hành + Documentation             |         3h |
| Chủ nhật | Review và lập kế hoạch tuần mới               |         1h |

Nguyên tắc:

- 30% lý thuyết.
- 50% thực hành.
- 20% documentation, review và giải thích kiến thức.

Nên luyện viết tài liệu tiếng Anh vì Architecture Documentation và trao đổi kỹ thuật quốc tế thường dùng tiếng Anh.

## 5. Đánh giá năng lực theo 5 level

- **L1 – Understand:** Hiểu khái niệm và giải thích được.
- **L2 – Apply:** Áp dụng được vào project.
- **L3 – Design:** Tự thiết kế giải pháp.
- **L4 – Evaluate:** Đánh giá, so sánh và bảo vệ quyết định.
- **L5 – Lead:** Dẫn dắt team và chịu trách nhiệm kiến trúc.

Ví dụ Database Architecture:

- L1: Hiểu Index là gì.
- L2: Biết tạo Index.
- L3: Thiết kế Index cho workload.
- L4: Phân tích trade-offs read/write performance.
- L5: Định hướng Database Strategy cho hệ thống.

**Mục tiêu sau 6 tháng:** L3–L4 ở năng lực Architecture quan trọng; L2–L3 ở lĩnh vực hạ tầng chuyên sâu. Đây là mục tiêu phát triển, không phải chứng nhận trình độ nghề nghiệp.

## 6. Sách theo thứ tự

| Thời gian | Sách                                  | Mục tiêu                      |
| --------- | ------------------------------------- | ----------------------------- |
| Tháng 1   | Fundamentals of Software Architecture | Tư duy Architect              |
| Tháng 2   | Clean Architecture                    | Thiết kế Software             |
| Tháng 2–3 | Designing Data-Intensive Applications | Database, Distributed Systems |
| Tháng 3–4 | System Design Interview – Alex Xu     | System Design                 |
| Tháng 4–5 | Software Architecture: The Hard Parts | Trade-offs                    |
| Tháng 5–6 | Domain-Driven Design – Eric Evans     | Domain Modeling               |

Không cần đọc hết từng cuốn trong tháng tương ứng. Đọc chương liên quan và áp dụng ngay.

## 7. Những điều nên tránh

1. Không học quá nhiều công nghệ cùng lúc. Chọn một stack chính.
2. Không mặc định Microservices tốt hơn. Modular Monolith có thể phù hợp hơn.
3. Không chỉ tập trung vẽ diagram; cần hiểu transaction, database, network và failure handling.
4. Không bỏ qua business. Kiến trúc phải giải quyết business problem và cân đối chi phí.
5. Không bỏ lợi thế Front-end. Rendering, caching, API contracts, performance, security và UX là nền tảng hữu ích.

## 8. Portfolio nên có sau 6 tháng

### Architecture Documentation

- 1–2 System Architecture Documents.
- 10–15 ADR.
- C4 Diagrams.
- Architecture Review Reports.

### Technical Projects

- 1 Backend Modular Monolith.
- 1 Cloud Deployment.
- 1 Distributed System Prototype.
- 1 Multi-tenant SaaS Capstone.

### Architecture Competencies

- Thiết kế End-to-end System.
- Hiểu Backend và Database.
- Thiết kế Cloud Architecture.
- Hiểu Security và Reliability.
- Phân tích Architecture Trade-offs.

### Leadership

- Trình bày Architecture Proposal.
- Dẫn dắt Architecture Review.
- Hướng dẫn Developer.
- Xây dựng Technical Roadmap.

## 9. Career Transition

1. **Senior Front-end Engineer:** tiếp tục phát huy React, Next.js, Angular và Front-end Architecture.
2. **Full-system Technical Ownership:** tham gia Backend, Database, API, Cloud và chịu trách nhiệm một module xuyên suốt.
3. **Software Design / Technical Leadership:** thiết kế hệ thống, viết ADR, review architecture, quyết định kỹ thuật và dẫn dắt team.
4. **Software Architect:** định hướng kiến trúc tổng thể, đảm bảo quality attributes, quản lý rủi ro kỹ thuật và định hướng sự phát triển hệ thống.

Đừng chờ học xong 6 tháng mới bắt đầu làm công việc Architect. Ngay project tiếp theo, hãy chủ động tham gia thiết kế API, database, deployment, architecture review và technical decisions.

Mục tiêu cuối cùng: có thể trả lời và chứng minh bằng dự án thực tế rằng với một business problem, bạn thiết kế hệ thống thế nào, tại sao chọn kiến trúc đó, trade-offs là gì, hệ thống sẽ phát triển ra sao và làm sao đảm bảo vận hành ổn định.
