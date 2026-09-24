-- ADR 0011: mã Option Value duy nhất trên cả màu lẫn size — nếu không, "màu X"
-- và "size X" ghép ra cùng SKU `<Product Code>-X`. Tạo index mới sẽ fail nếu DB
-- dev đang có mã trùng giữa hai loại; khi đó đổi mã một bên rồi chạy lại.

-- DropIndex
DROP INDEX "option_values_type_code_key";

-- CreateIndex
CREATE UNIQUE INDEX "option_values_code_key" ON "option_values"("code");
