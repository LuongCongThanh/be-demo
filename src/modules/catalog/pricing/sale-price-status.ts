/** Trạng thái của Giá khuyến mãi tại thời điểm `at`; khoảng hiệu lực là [startsAt, endsAt). */
export const SALE_PRICE_STATUSES = ['UPCOMING', 'ACTIVE', 'ENDED'] as const;
export type SalePriceStatus = (typeof SALE_PRICE_STATUSES)[number];

export function salePriceStatus({ startsAt, endsAt }: { startsAt: Date; endsAt: Date }, at: Date): SalePriceStatus {
  if (at < startsAt) return 'UPCOMING';
  return at < endsAt ? 'ACTIVE' : 'ENDED';
}

/** Giá từ % giảm, làm tròn xuống đến đồng; số nguyên, không dùng số thực. */
export function priceAfterPercentOff(price: bigint, percentOff: number): bigint {
  return (price * BigInt(100 - percentOff)) / 100n;
}
