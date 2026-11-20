Type: grilling
Status: resolved

## Question

How should the per-file responsibility inventory stay accurate as the source tree changes?

Choose between a manually curated inventory updated with related code changes, a generated file/symbol listing with manually maintained responsibility notes, or another approach. Consider that generated output can keep paths complete but cannot reliably explain architectural responsibility. Prefer the least machinery that keeps the documentation trustworthy.

## Answer

Keep the file inventory and responsibility descriptions manually curated, updating them alongside related source changes. Verify the documented file coverage against the repository when updating the architecture docs; do not add a generator unless recurring staleness shows the manual process is insufficient.
