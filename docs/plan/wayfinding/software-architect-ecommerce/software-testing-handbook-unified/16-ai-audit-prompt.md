# Software Testing Quality Audit

**Trạng thái:** Nháp (tài liệu tham khảo).

Act as a Senior Software Engineer, Software Quality Architect, and Testing Specialist.
Perform a comprehensive, technology-agnostic audit of the project's entire testing system.

## Objective

Evaluate whether the existing test suite can effectively detect real defects, protect business requirements, control critical risks, and remain reliable, maintainable, and efficient. Do not evaluate quality solely based on code coverage, test count, or passing CI/CD pipelines.

## Assessment Criteria

Use all 15 dimensions and weights in `03-quality-assessment.md`: Requirement Coverage 10%, Risk Coverage 10%, Fault Detection 12%, Assertion Quality 10%, Test Design Quality 8%, Test Architecture 6%, Code Coverage 4%, Integration Fidelity 8%, Test Reliability 7%, Test Maintainability 5%, Test Efficiency 5%, Non-functional Testing 5%, Test Data Quality 3%, CI/CD Quality Gates 4%, Production Feedback 3%.

## Audit Requirements

- Analyze business requirements, architecture, and existing testing documentation.
- Identify critical business rules and system risks.
- Build a requirement-risk-test traceability matrix.
- Identify missing, weak, redundant, obsolete, and brittle tests.
- Evaluate assertion quality and mocking strategy.
- Evaluate whether tests are implemented at the lowest effective testing level.
- Identify over-testing and under-testing.
- Execute existing tests when the environment permits.
- Analyze coverage and mutation testing results when available.
- Evaluate flaky tests and execution costs.
- Evaluate security, concurrency, data integrity, performance, and resilience risks.
- Evaluate frontend and backend responsibilities where applicable.
- Verify critical quality gates.
- Provide evidence for every significant finding.

## Required Deliverables

1. Executive Summary.
2. Existing Testing Architecture.
3. Test Inventory.
4. Requirement Coverage Analysis.
5. Risk Coverage Analysis.
6. Missing Test Scenarios.
7. Weak Assertion Analysis.
8. Mocking and Integration Analysis.
9. Duplicate and Redundant Test Analysis.
10. Test Reliability Analysis.
11. Coverage and Mutation Analysis.
12. Frontend Testing Assessment, if applicable.
13. Backend Testing Assessment, if applicable.
14. CI/CD Assessment.
15. Testing Quality Score out of 100.
16. Testing Maturity Level.
17. Critical Quality Gate Results.
18. Prioritized Findings: P0, P1, P2, P3.
19. Recommended Tests to Add, Improve, Merge, Replace, or Remove.
20. Testing Improvement Roadmap.
21. Remaining Risks, Assumptions, and Limitations.

## Constraints

- Do not modify production code or test code during the audit.
- Do not fabricate test results or metrics.
- Do not claim unexecuted tests have passed.
- Do not assign high scores without supporting evidence.
- Mark unavailable evidence as Not Assessed.
- Mark non-applicable criteria as N/A with justification.
- Do not recommend adding tests solely to increase coverage.
- Do not recommend removing tests without evaluating the risks they protect.
- Critical quality gate failures must not be hidden by a high aggregate score.
- Focus on defect detection, business correctness, risk reduction, maintainability, and testing efficiency.

Produce a detailed Markdown audit report with file references, supporting evidence, actionable recommendations, and a prioritized implementation roadmap.
