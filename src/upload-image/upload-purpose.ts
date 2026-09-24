// Mỗi purpose quyết định Pending Upload nằm dưới prefix nào và role nào được
// xin presign — thêm loại ảnh mới (avatar, ảnh category...) = thêm 1 entry ở
// đây, không đổi API. Prefix `tmp/` là bắt buộc: lifecycle rule của bucket
// tự xoá mọi object dưới `tmp/` sau 1 ngày (docs/adr/0010).
export const UPLOAD_PURPOSES = ['PRODUCT_IMAGE'] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

interface UploadPurposePolicy {
  pendingPrefix: string;
  allowedRoles: readonly string[];
}

export const UPLOAD_PURPOSE_POLICIES: Record<UploadPurpose, UploadPurposePolicy> = {
  PRODUCT_IMAGE: { pendingPrefix: 'tmp/product-image/', allowedRoles: ['STORE_MANAGER', 'MASTER_ADMIN'] },
};
