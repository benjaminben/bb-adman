Recorded responses for the S3 storage adapter (SPEC 6.5, Phase 2 slice F).

Built by hand from the response shapes in AWS's public Amazon S3 API Reference
(ListObjectsV2, DeleteObjects, CreateMultipartUpload, CompleteMultipartUpload and the
"Error responses" page). No real call was made to get them. Every value is made up: the
bucket is `made-up-bucket`, the root prefix is `made-up-prefix`, and the access key ID in
`error-invalid-access-key-id.xml` is the tests' made-up value.
