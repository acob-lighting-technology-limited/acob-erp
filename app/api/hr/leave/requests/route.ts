/**
 * /api/hr/leave/requests — each method lives in _lib/ (this file was 1,600
 * lines; audit 5.10). Shared schemas and guards are in _lib/shared.ts.
 */
export { GET } from "./_lib/get"
export { POST } from "./_lib/post"
export { PATCH, PATCH as PUT } from "./_lib/patch"
export { DELETE } from "./_lib/delete"
