# Vietnam personal-data obligations for the Fashion Store MVP

**Legal snapshot and access date:** 2026-11-21 (Asia/Ho_Chi_Minh) · **Ticket context:** [Issue #02 in PR #100](https://github.com/LuongCongThanh/be-demo/blob/92d4d5291a3c9fbb715c924f2b9e4f3e5164684d/docs/plan/wayfinding/fashion-store-mvp-implementation/issues/02-vietnam-data-protection-obligations.md)
**Scope:** personal data in business-document fields `raw_payload`, `creation_input`, and order addresses; deletion/anonymization, incident notices, retention, consent/legal bases, and transfers to Singapore.

> **Bottom line.** The controlling framework for this snapshot is the Personal Data Protection Law 91/2025/QH15 and Decree 356/2025/NĐ-CP, both effective 1 January 2026. A valid deletion request is not an unlimited right to erase records that another law requires to be retained. Decree 356 sets request-processing deadlines, including 20 days for a deletion request and 30 days where a processor or third party must act. A qualifying personal-data violation must be reported to the competent authority within 72 hours; the Decree separately requires notice to affected people within 72 hours for incidents involving location or biometric data. Singapore hosting or processing of Vietnamese customer data is generally a cross-border transfer: the impact-assessment dossier is due within 60 days after the first transfer, not as a general pre-transfer approval.

This is a docs/research summary, not a Vietnamese legal opinion. Statements labeled **Binding** describe the cited instruments; **Interpretation** applies them to the proposed MVP; **Recommendation** is an implementation control rather than statutory wording.

## 1. Governing law and transition

### Binding

- **Law 91/2025/QH15 (Personal Data Protection Law)** took effect on **1 January 2026** (Article 38(1)). [Official Government record](https://vanban.chinhphu.vn/?pageid=27160&docid=214590) · [signed law](https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/7/91qh.signed.pdf).
- **Decree 356/2025/NĐ-CP** took effect on **1 January 2026**; Article 42(2) ends the effect of Decree 13/2023/NĐ-CP on that date. [Official Government record](https://vanban.chinhphu.vn/?pageid=27160&docid=216387) · [signed decree](https://datafiles.chinhphu.vn/cpp/files/vbpq/2026/01/356-nd.signed.pdf).
- Existing processing that already had consent or an agreement under Decree 13 before the Law took effect may continue without obtaining consent or an agreement again (Law Article 39(1)). Existing impact-assessment dossiers accepted before the Law took effect continue to be used; subsequent updates follow the new Law (Article 39(2)).
- Small and start-up enterprises may opt out for five years of the specific processing-impact-assessment and related provisions listed in Law Article 38(2), subject to exceptions for data-processing service businesses, direct processing of sensitive data, or processing at least 100,000 data subjects. Decree 356 Article 41 further addresses small and micro businesses. **This exception does not waive the separate cross-border-transfer assessment in Law Article 20.** Confirm the company’s legal classification and thresholds with counsel before relying on it.

### Interpretation

Do not use Decree 13/2023 as the current general rulebook after 1 January 2026. The transition clauses preserve qualifying pre-existing consent/agreements and accepted assessment dossiers; they do not automatically validate new purposes, new recipients, or an inaccurate old notice.

## 2. Collection, consent, and lawful processing

### Binding

- The Law treats consent as the default basis, with specific no-consent cases in **Article 19**. These include emergency/life-and-health and other urgent protective cases, national-security/emergency or law-enforcement cases, state functions, performing an agreement made by the data subject with a relevant organization/person, and other cases provided by law. The organization relying on a no-consent case must still establish controls and monitor processing (Article 19(2)).
- Consent is governed by **Law Article 9**; Decree 356 Article 6 requires a consent method that can be verified as to who consented, when, and to what content. Decree 356 also prescribes the permitted ways to express consent. A consent event should therefore be evidenced, not inferred from silence or from the mere presence of data in a payload.
- For cloud processing, Decree 356 Article 12 requires the contract to address compliance with Vietnamese law, data flows and roles, security, deletion/destruction, and data-subject rights.

### Interpretation for checkout

Law Article 19(1)(d)—performing an agreement made by the data subject—may support processing the minimum order and delivery information needed to perform a customer’s purchase. That is a purpose-limited interpretation, not a general “legitimate interests” basis and not a blanket basis for marketing, profiling, or unrelated product analytics. A marketing opt-in should be separate and optional. Whether the checkout contract and specific post-sale uses fit Article 19(1)(d) should be confirmed by Vietnamese counsel.

**Recommendation:** record the purpose, basis, notice/consent version, timestamp, channel, and withdrawal status separately from `raw_payload`. Do not treat a raw request body or a checkout checkbox as evidence of consent unless it records the actual notice and deliberate consent action.

## 3. Deletion, anonymization, and response deadlines

### Binding

- Data subjects have a right to request deletion (Law Article 4); **Article 14** governs deletion/destruction. The right is not an unconditional instruction to erase information whose continued retention or processing is required under another law or falls within a statutory exception. When the purpose and any lawful retention basis end, identifiable data should no longer remain in active processing; anonymization must prevent identification, not merely replace a name with a reversible ID.
- For a properly submitted deletion request, **Decree 356 Article 5(4)** requires the controller or controller/processor to:
  - respond and explain the procedure within **2 working days**;
  - carry out deletion within **20 days**;
  - where it must ask a processor or third party to provide/delete/restrict data, carry that out within **30 days**; and
  - if necessary, use at most one extension of no more than **20 additional days**, notify the data subject of the reason, and be able to justify why the extension was necessary and reasonable.
- These are request-response deadlines, not a universal automatic retention period for every order. A request to stop processing/withdraw consent may not end processing where Article 19 authorizes processing without consent (Decree 356 Article 5(2)); deletion is separately assessed under Law Article 14 and any statutory retention rule. The request must still be assessed and answered rather than silently ignored.

### Recommendation for the MVP

Implement a request workflow with identity verification, a legal-hold/mandatory-retention check, a documented decision, downstream deletion instructions, a deadline clock, and a response to the requester. Remove data from live systems and processor copies where required; define how backups expire and how a restored backup re-applies deletion tombstones. Keep only a minimal record of the request and outcome, with a separate legal basis and retention period.

## 4. Breach and incident notification

### Binding

- Under **Law Article 23(1)**, a controller, controller-and-processor, or third party that discovers a violation capable of harming national defence/security, social order/public safety, or a data subject’s life, health, honor, dignity, or property must notify the competent personal-data-protection authority **no later than 72 hours after discovery**. A processor that discovers the violation must notify the controller/controller-and-processor promptly. The controller/controller-and-processor must document the violation and cooperate with the authority (Article 23(2)).
- **Do not generalize this as an unconditional 72-hour notice to every affected person for every breach.** Decree 356 **Article 29(1)** separately requires a controller/controller-processor to notify affected data subjects within **72 hours** for an incident involving **location data or biometric data**, report it under Article 28, and keep the incident record for at least **5 years after remediation** (Article 29(1)(c)). Other sector-specific rules or an authority’s direction may add duties.
- Article 23’s 72 hours starts at **discovery**, not at the time the incident began. The statutory trigger is the potential harm described in Article 23(1), not just “any incident that might have exposed data.”

### Recommendation

Run a rapid incident process: preserve evidence, identify affected data and subjects, determine whether the statutory harm threshold or a special data-category rule applies, notify the competent authority on time, and record the decision. For location/biometric incidents, prepare affected-person notice within the Decree’s 72-hour period. Ask counsel whether any e-commerce, payment, consumer-protection, or cybersecurity rule independently requires broader or faster notice.

## 5. Retention of business and order records

### Binding

- The Law’s processing principles require purpose limitation and retention no longer than appropriate to the processing purpose, except where another law requires otherwise (Law Article 3). The deletion right and its exceptions are in Articles 4 and 14.
- There is **no single general “delete all order data after N days” rule** in the cited Personal Data Protection Law. Conversely, data-protection law does not cancel separate recordkeeping requirements. Decree 123/2020/NĐ-CP on invoices and records, Article 6, requires invoice/record preservation in accordance with accounting law. [Official Decree 123 record](https://vanban.chinhphu.vn/?pageid=27160&docid=201365); it has been amended, including by [Decree 70/2025/NĐ-CP](https://vanban.chinhphu.vn/?pageid=27160&docid=213179).
- The five-year incident-file period in Decree 356 Article 29(1)(c) is specific to the location/biometric incident rule; it is **not** a blanket five-year retention rule for all order data.

### Interpretation and recommendation

Separate the accounting/tax invoice record from the operational customer profile, raw API/webhook payloads, shipping address, support history, and analytics copy. Keep only the fields needed for each documented purpose, protect any records that must be archived, and expire or irreversibly anonymize the rest when the purpose and any legal hold end. Do not keep a whole `raw_payload` indefinitely merely because it is useful for debugging. Do not delete an invoice or other record subject to mandatory accounting retention in response to a privacy request without checking the applicable retention rule.

The precise retention period for a particular invoice, accounting document, shipping proof, return, chargeback, and tax record depends on the seller’s role and record category. Confirm that classification and the applicable periods with a Vietnamese accountant/tax adviser and data-protection counsel; this report does not assign an unverified universal accounting period.

## 6. Transfers to Singapore

### Binding

- **Law Article 20(1)** treats as cross-border transfer, among other things: moving Vietnamese-stored personal data to storage outside Vietnam; transferring it to a foreign organization/person; or using a platform outside Vietnam to process data collected in Vietnam. A Singapore-hosted database, cloud service, support tool, or processor that receives customer data can therefore trigger the rule even if the shop itself is Vietnamese.
- For an in-scope transfer, the transferring organization must prepare the cross-border impact-assessment dossier and submit one original to the competent authority **within 60 days from the first transfer** (Law Article 20(2); Decree 356 Articles 17–18). It is a post-first-transfer filing deadline in the text, not a general requirement to wait for advance approval. The authority’s review period under Decree 356 Article 18 is **15 days**; where the dossier is incomplete, the sender may be required to complete it within **30 days**.
- The assessment is made once for the activity and updated under Law Article 22. Updates are due periodically every **6 months when there is a change** (Article 22(1)); Decree 356 Article 20(2) requires updates within **10 days** for its listed organizational, service-provider, or business changes. The authority may inspect and may require a transfer to stop in the national-defence/security circumstances set out in Law Article 20(4)–(5).
- **Law Article 20(6)** exempts certain categories from the transfer-assessment requirement, including competent-state-authority transfers, an organization’s employee data stored in cloud, and a data subject’s own transfer. Do not assume the employee-cloud exception applies to customer order addresses or order payloads. Decree 356 Article 18(3) also lists other specific exceptions; check the actual transfer against the text rather than treating Singapore or a vendor DPA as an exemption.

### Recommendation

Before enabling Singapore storage/processing, map each data flow and recipient/subprocessor; identify the transferer, receiver, purpose, fields, access locations, onward transfers, retention/deletion path, and security controls. Put Vietnamese-law, confidentiality, breach cooperation, data-subject assistance, deletion/return, and subprocessor terms in the contract. Prepare the impact-assessment dossier before launch even though the statutory filing window runs from the first transfer; otherwise the business may begin a regulated transfer before it has a defensible assessment and evidence.

## 7. Field-by-field application

| Field            | Likely data and legal treatment                                                                                                                                                                                                                                                              | MVP treatment                                                                                                                                                                                                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `raw_payload`    | May contain names, phone numbers, delivery address, account/order identifiers, and unnecessary fields. If it identifies or can be linked to a person, the Law applies. A whole-payload copy may exceed the stated purpose and complicate deletion, transfer assessments, and breach scoping. | Parse and persist only necessary fields; avoid raw payloads in logs; redact secrets and unrelated PII; set a purpose-based TTL; encrypt/restrict access; include all copies and vendor sinks in deletion and transfer maps.                                                           |
| `creation_input` | Treat any customer-provided value that identifies or can identify an individual as personal data. Product/customization text may also reveal sensitive facts, depending on content and use.                                                                                                  | Keep inputs needed to create/fulfil the order separate from optional analytics/marketing; restrict free-text collection; avoid copying input into error logs; delete or anonymize after the documented purpose and lawful retention end.                                              |
| Order addresses  | Names, phone numbers, and delivery addresses identify or relate to a customer/recipient. They are needed for shipping, returns, and some transaction records, but not necessarily for every future use.                                                                                      | Restrict access to fulfillment/support; pass only necessary data to the carrier; define retention for delivery proof, returns, disputes, and accounting separately; remove the active address from customer profiles when no longer needed, subject to mandatory records/legal holds. |

These are field-level applications, not a conclusion that every value in either JSON field is personal or sensitive. Classify by actual contents and whether an individual can be identified. If a field includes sensitive data (for example credentials/payment-account data, health data, or precise location), apply the stricter statutory and security controls and obtain counsel’s review.

## 8. MVP checklist

**Binding implementation prerequisites:** record each purpose and processing basis; make consent/notice evidence retrievable; implement the Article 5 response clock (2 working-day response, 20-day deletion, 30-day third-party action, possible single 20-day extension); provide a qualifying-incident reporting path with a 72-hour clock; maintain processing and transfer maps; and assess whether Singapore storage/processing requires a filed impact-assessment dossier within 60 days of first transfer.

**Recommended controls:** data inventory by field and copy; retention schedule with separate legal-hold rules; deletion/anonymization queue that propagates to processors and backups; access restrictions/encryption for raw payloads and addresses; separate opt-in for marketing; incident log and exercises; and a vendor register covering locations and subprocessors.

## 9. Questions for qualified Vietnamese counsel

1. For the seller’s actual legal form and transaction flow, which order fields must be retained for tax/accounting, invoice, consumer, shipping, return, chargeback, and dispute purposes, and for how long?
2. Does Article 19(1)(d) cover each proposed use of order address and creation input after delivery (returns, support, fraud/chargeback), or is another basis/consent required?
3. Does the company meet the small/start-up or micro-enterprise exception and data-volume conditions in Law Article 38(2) and Decree 356 Article 41? Which assessment duties remain, particularly the cross-border filing?
4. Is the planned Singapore provider a processor, independent recipient, or both; which exact Article 20/Decree 356 exception, if any, applies; and what dossier, contract, and update process is required?
5. For the expected breach scenarios, when is the Law Article 23 harm threshold met, which authority channel applies, and do other laws or contracts require notice to affected customers in addition to Decree 356 Article 29’s location/biometric rule?
6. How should the business operationalize deletion from immutable backups, logs, warehouses, and downstream carriers while preserving legally required records and evidence of the request?

## Primary sources (official; all accessed 2026-11-21)

1. **Law 91/2025/QH15, Personal Data Protection Law**, especially Articles 2–4, 9, 14, 19–23, 38–39. [Government record](https://vanban.chinhphu.vn/?pageid=27160&docid=214590) · [signed PDF](https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/7/91qh.signed.pdf).
2. **Decree 356/2025/NĐ-CP**, especially Articles 5–6, 12, 17–20, 29, 41–42. [Government record](https://vanban.chinhphu.vn/?pageid=27160&docid=216387) · [signed PDF](https://datafiles.chinhphu.vn/cpp/files/vbpq/2026/01/356-nd.signed.pdf).
3. **Decree 123/2020/NĐ-CP**, invoices and records, Article 6. [Government record](https://vanban.chinhphu.vn/?pageid=27160&docid=201365).
4. **Decree 70/2025/NĐ-CP**, amending Decree 123/2020/NĐ-CP. [Government record](https://vanban.chinhphu.vn/?pageid=27160&docid=213179).

The Government’s signed PDFs for Law 91 and Decree 356 are image scans. Article references and deadlines above were checked against those official signed texts; links point to the controlling official record and document.
