import 'dotenv/config';

/**
 * Đồng bộ Postman collection với OpenAPI spec hiện tại của app: fetch spec
 * từ app đang chạy (nguồn chuẩn duy nhất — Swagger decorator trong code),
 * để Postman API tự convert sang collection, rồi PUT đè lên collection đã có.
 * Không tạo request thủ công trong Postman nữa — API mới thêm vào code +
 * Swagger decorator là tự động xuất hiện sau khi chạy script này.
 *
 * Convert phía server Postman (`POST /import/openapi`) thay vì thư viện
 * `openapi-to-postmanv2`: thư viện đó kéo theo `@faker-js/faker@5` có lỗ hổng
 * (GHSA-qxc2-j82w-r537) mà upstream chưa vá. Endpoint import luôn tạo
 * collection MỚI, nên script import vào một collection tạm, chép nội dung đè
 * lên collection hiện có (giữ nguyên ID mà team đang dùng), rồi xoá bản tạm.
 */

const POSTMAN_API = 'https://api.getpostman.com';

// SWAGGER_PATH trong src/bootstrap/openapi.ts quyết định path này — JSON
// spec luôn nằm ở `{path}-json`, không phải `/api-json` mặc định của Nest.
const OPENAPI_URL = process.env.OPENAPI_URL || 'http://localhost:3000/docs-json';
const POSTMAN_API_KEY = process.env.POSTMAN_API_KEY;
const POSTMAN_COLLECTION_ID = process.env.POSTMAN_COLLECTION_ID;
// Tuỳ chọn: workspace chứa collection tạm. Bỏ trống → Postman dùng workspace
// cá nhân cũ nhất của chủ API key.
const POSTMAN_WORKSPACE_ID = process.env.POSTMAN_WORKSPACE_ID;

if (!POSTMAN_API_KEY || !POSTMAN_COLLECTION_ID) {
  console.error('Missing POSTMAN_API_KEY / POSTMAN_COLLECTION_ID in .env — see .env.example.');
  process.exit(1);
}

// Gán lại vào biến đã narrow kiểu để truyền tường minh qua tham số, tránh ép
// kiểu `as string` mất an toàn kiểu.
const postmanApiKey: string = POSTMAN_API_KEY;
const postmanCollectionId: string = POSTMAN_COLLECTION_ID;

async function fetchOpenApiSpec(): Promise<unknown> {
  const res = await fetch(OPENAPI_URL);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch OpenAPI spec from ${OPENAPI_URL} (${res.status}). Is the app running (npm run start:dev)?`,
    );
  }
  return res.json();
}

async function postman<T>(apiKey: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${POSTMAN_API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Postman API ${method} ${path} failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as T;
}

/** Postman convert spec thành một collection mới; trả về uid của collection tạm đó. */
async function importAsTemporaryCollection(apiKey: string, openApiSpec: unknown): Promise<string> {
  const query = POSTMAN_WORKSPACE_ID ? `?workspace=${encodeURIComponent(POSTMAN_WORKSPACE_ID)}` : '';
  const result = await postman<{ collections?: { uid?: string; id?: string }[] }>(
    apiKey,
    'POST',
    `/import/openapi${query}`,
    {
      type: 'json',
      input: openApiSpec,
      // Mặc định là 'Schema' — sinh giá trị mẫu kiểu "<string>" thay vì dùng
      // `example` khai trong @ApiProperty, làm body trên Postman khác hẳn
      // Swagger UI. 'Example' giữ đúng giá trị mẫu của code.
      options: { requestParametersResolution: 'Example' },
    },
  );
  const temp = result.collections?.[0];
  const uid = temp?.uid ?? temp?.id;
  if (!uid) {
    throw new Error(`Postman import returned no collection: ${JSON.stringify(result)}`);
  }
  return uid;
}

async function main() {
  console.log(`Fetching OpenAPI spec from ${OPENAPI_URL}...`);
  const openApiSpec = await fetchOpenApiSpec();

  console.log('Converting via Postman import API...');
  const tempUid = await importAsTemporaryCollection(postmanApiKey, openApiSpec);

  try {
    const { collection } = await postman<{ collection: { info: Record<string, unknown> } }>(
      postmanApiKey,
      'GET',
      `/collections/${tempUid}`,
    );
    // Bỏ định danh của bản tạm để PUT không đổi ID/tên collection đích.
    const { _postman_id: _id, uid: _uid, ...info } = collection.info;

    console.log(`Pushing to Postman collection ${postmanCollectionId}...`);
    await postman(postmanApiKey, 'PUT', `/collections/${postmanCollectionId}`, {
      collection: { ...collection, info },
    });
  } finally {
    // Luôn dọn bản tạm, kể cả khi PUT lỗi, để không rác collection trong workspace.
    await postman(postmanApiKey, 'DELETE', `/collections/${tempUid}`).catch((err: unknown) =>
      console.error(`Could not delete temporary collection ${tempUid}: ${err instanceof Error ? err.message : err}`),
    );
  }

  console.log('Done — Postman collection is in sync with the current API.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
