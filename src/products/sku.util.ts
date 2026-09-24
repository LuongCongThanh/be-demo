// SKU không bao giờ do staff nhập — luôn ghép từ Product Code + mã Option
// Value màu/size (docs/adr/0011). Đoạn thuộc tính không có thì bỏ, nên product
// không có biến thể có SKU = Product Code.
export function composeSku(productCode: string, colorCode: string | undefined, sizeCode: string | undefined): string {
  return [productCode, colorCode, sizeCode].filter(Boolean).join('-');
}
