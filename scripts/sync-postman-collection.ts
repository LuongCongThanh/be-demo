import 'dotenv/config';
import { convert } from 'openapi-to-postmanv2';

/**
 * Đồng bộ Postman collection với OpenAPI spec hiện tại của app: fetch spec
 * từ app đang chạy (nguồn chuẩn duy nhất — Swagger decorator trong code),
 * convert sang Postman collection format, rồi PUT đè lên collection đã có
 * qua Postman API. Không tạo request thủ công trong Postman nữa — API mới
 * thêm vào code + Swagger decorator là tự động xuất hiện sau khi chạy script
 * này.
 */

const OPENAPI_URL = process.env.OPENAPI_URL ?? 'http://localhost:3000/api-json';
const POSTMAN_API_KEY = process.env.POSTMAN_API_KEY;
const POSTMAN_COLLECTION_ID = process.env.POSTMAN_COLLECTION_ID;

if (!POSTMAN_API_KEY || !POSTMAN_COLLECTION_ID) {
  console.error('Missing POSTMAN_API_KEY / POSTMAN_COLLECTION_ID in .env — see .env.example.');
  process.exit(1);
}

// Gán lại vào biến đã narrow kiểu (khác scope với guard ở trên) để truyền
// tường minh qua tham số cho các hàm bên dưới, thay vì đọc ngầm từ biến
// module-level — tránh phải ép kiểu `as string` mất an toàn kiểu.
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

function convertToPostmanCollection(openApiSpec: unknown): Promise<object> {
  return new Promise((resolve, reject) => {
    // requestParametersResolution mặc định là 'Schema' — tự sinh giá trị mẫu
    // từ kiểu dữ liệu (vd. "<string>") thay vì dùng `example` khai trong
    // @ApiProperty({ example: ... }), nên request body trên Postman sẽ khác
    // hẳn giá trị hiển thị trên Swagger UI nếu không set option này.
    convert({ type: 'json', data: openApiSpec as never }, { requestParametersResolution: 'Example' }, (err, result) => {
      if (err || !result) {
        reject(err ?? new Error('openapi-to-postmanv2 returned no result'));
        return;
      }
      if (!result.result || !result.output?.[0]) {
        reject(new Error(`openapi-to-postmanv2 conversion failed: ${result.reason}`));
        return;
      }
      resolve(result.output[0].data);
    });
  });
}

async function pushToPostman(collection: object, apiKey: string, collectionId: string): Promise<void> {
  const res = await fetch(`https://api.getpostman.com/collections/${collectionId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({ collection }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Postman API rejected the update (${res.status}): ${body}`);
  }
}

async function main() {
  console.log(`Fetching OpenAPI spec from ${OPENAPI_URL}...`);
  const openApiSpec = await fetchOpenApiSpec();

  console.log('Converting to Postman collection format...');
  const collection = await convertToPostmanCollection(openApiSpec);

  console.log(`Pushing to Postman collection ${postmanCollectionId}...`);
  await pushToPostman(collection, postmanApiKey, postmanCollectionId);

  console.log('Done — Postman collection is in sync with the current API.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
