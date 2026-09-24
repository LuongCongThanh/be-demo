// Mỗi purpose quyết định Pending Upload nằm dưới prefix nào và role nào được
// xin presign — thêm loại ảnh mới (avatar, ảnh category...) = thêm 1 entry ở
// đây, không đổi API. Prefix `tmp/` là bắt buộc: lifecycle rule của bucket
// tự xoá mọi object dưới `tmp/` sau 1 ngày (docs/adr/0010).
export const UPLOAD_PURPOSES = ['PRODUCT_IMAGE'] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

interface UploadPurposePolicy {
  pendingPrefix: string;
  allowedRoles: readonly string[];
  // Số file tối đa mỗi request presign — PRODUCT_IMAGE = số ảnh tối đa của 1 Product.
  maxFiles: number;
}

export const UPLOAD_PURPOSE_POLICIES: Record<UploadPurpose, UploadPurposePolicy> = {
  PRODUCT_IMAGE: { pendingPrefix: 'tmp/product-image/', allowedRoles: ['STORE_MANAGER', 'MASTER_ADMIN'], maxFiles: 5 },
};

// DTO chỉ biết giới hạn lớn nhất; hiện chỉ có 1 purpose nên đây chính là giới
// hạn của PRODUCT_IMAGE. Thêm purpose có maxFiles khác → phải kiểm thêm theo
// purpose ở UploadImageService.presign().
export const MAX_PRESIGN_BATCH_SIZE = Math.max(...Object.values(UPLOAD_PURPOSE_POLICIES).map((p) => p.maxFiles));
