# Test Code Examples (TypeScript/Jest)

**Trạng thái:** Nháp (tài liệu tham khảo).

## Coverage không đủ

```ts
function calculatePrice(price: number, discount: number) {
  return price - (price * discount) / 100;
}
expect(calculatePrice(100, 20)).toBe(80);
```

Có thể đạt 100% coverage nhưng bỏ sót discount 150, -20, NaN, giá âm. Nếu spec cấm các giá trị đó, cần test từ chối. Kiểm tra discount 0, 100 và rounding theo nghiệp vụ.

## Assertion yếu và mạnh

```ts
// Weak
expect(result).toBeDefined();
// Strong: expected lấy từ business rule
expect(result).toMatchObject({ totalAmount: 200_000, status: 'PENDING' });
```

Với order, integration test cần xác minh persisted order, stock, side effects và không có thay đổi khi thất bại. Không tính expected bằng chính hàm đang test.

## AAA và parameterized test

```ts
function validateQuantity(n: number) {
  return Number.isInteger(n) && n >= 1 && n <= 100;
}
it.each([
  [-1, false],
  [0, false],
  [1, true],
  [2, true],
  [99, true],
  [100, true],
  [101, false],
  [1.5, false],
  [NaN, false],
])('quantity %s is valid: %s', (quantity, expected) => {
  expect(validateQuantity(quantity as number)).toBe(expected);
});
```

Arrange dữ liệu, Act gọi hành vi, Assert kết quả. Test behavior thay vì private methods. Không hard-coded sleep; chờ điều kiện quan sát được.

## Concurrency integration scenario

Stock = 1; hai khách độc lập cùng đặt hàng. Dùng hai request đồng thời, đồng bộ điểm bắt đầu khi cần để tái hiện race. Assert đúng một order thành công, một bị từ chối, stock = 0, không side effect trùng. Kiểm tra bằng PostgreSQL thật; Promise.all đơn thuần không bảo đảm tái hiện mọi interleaving. Giải pháp production có thể dùng transaction, lock hoặc atomic conditional update.

## Mutation example

```ts
function canPurchase(stock: number, quantity: number) {
  return stock >= quantity;
}
it('allows buying exactly the remaining stock', () => {
  expect(canPurchase(1, 1)).toBe(true);
});
```

Nếu đổi >= thành >, test phải fail. Thêm trường hợp stock thiếu và stock dư. Ví dụ chưa chạy trên repository thực tế.

## Pseudocode độc lập ngôn ngữ

```text
TEST rejects unauthorized access:
  GIVEN resource owned by A and authenticated actor B
  WHEN B requests resource
  THEN access is denied according to contract
  AND resource is unchanged
  AND response contains no private information

TEST operation is atomic:
  GIVEN initial persisted state
  WHEN operation fails after first write
  THEN persisted state equals initial state
  AND no success event is published
```

Expected result phải lấy từ đặc tả, không sao chép thuật toán production. Ví dụ áp dụng cho bất kỳ interface nào có hành vi tương ứng.
