Recorded answers for the Adobe Firefly stub (P4-6, `spec/providers-adapters.md`, "Adobe Firefly (stub)").

Written by hand from the examples in Adobe's public Firefly Services documentation: the token
answer in the Firefly API quickstart, the job, status and result shapes in "Using the
Asynchronous Adobe Firefly APIs", and the error bodies in Adobe's published Firefly OpenAPI file
(`@adobe/firefly-apis` 2.0.1). No call was made to Adobe to get them. Every token, job ID and
address path is made up; the hosts are the documented ones.

`status-failed.json` is not shown in the documentation, which names the `failed` status only.
Its `error_code` reuses a documented code. `errors.json` holds one error body per HTTP status,
keyed by status (and by cause for the 422 bodies).
