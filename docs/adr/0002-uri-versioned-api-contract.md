# Use a URI-versioned API contract

The public HTTP contract will use the `api` global prefix and Nest URI version `1`, producing routes under `/api/v1`. Versioning is being introduced before commerce modules are implemented so future breaking changes can coexist without replacing every route at once; the current unversioned `/auth/*` routes will be migrated rather than maintained as permanent aliases. Swagger will move to `/docs` so documentation is not confused with the API prefix.
