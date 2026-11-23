import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export type VnpayPayload = Record<string, string | number | undefined>;

export interface MomoNotificationPayload {
  accessKey?: string;
  amount?: number | string;
  extraData?: string;
  message?: string;
  orderId?: string;
  orderInfo?: string;
  orderType?: string;
  partnerCode?: string;
  payType?: string;
  requestId?: string;
  responseTime?: number | string;
  resultCode?: number | string;
  transId?: number | string;
  signature?: string;
}

export interface MomoCreateRequestFields {
  accessKey: string;
  amount: string;
  extraData: string;
  ipnUrl: string;
  orderId: string;
  orderInfo: string;
  partnerCode: string;
  redirectUrl: string;
  requestId: string;
  requestType: string;
}

export interface MomoQueryRequestFields {
  accessKey: string;
  orderId: string;
  partnerCode: string;
  requestId: string;
}

export function createPaymentDedupKey(...parts: string[]): string {
  return createHash('sha256').update(JSON.stringify(parts), 'utf8').digest('hex');
}

export function createVnpaySignature(payload: VnpayPayload, secret: string): string {
  const signedFields = Object.entries(payload)
    .filter(([key, value]) => value !== undefined && key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType')
    .sort(([left], [right]) => left.localeCompare(right));
  const signData = new URLSearchParams(signedFields.map(([key, value]) => [key, String(value)])).toString();
  return createHmac('sha512', secret).update(signData, 'utf8').digest('hex');
}

export function verifyVnpaySignature(payload: VnpayPayload, signature: string, secret: string): boolean {
  return matchesSignature(createVnpaySignature(payload, secret), signature);
}

export function createMomoNotificationSignature(payload: MomoNotificationPayload, secret: string): string {
  const signData = [
    `accessKey=${payload.accessKey ?? ''}`,
    `amount=${payload.amount ?? ''}`,
    `extraData=${payload.extraData ?? ''}`,
    `message=${payload.message ?? ''}`,
    `orderId=${payload.orderId ?? ''}`,
    `orderInfo=${payload.orderInfo ?? ''}`,
    `orderType=${payload.orderType ?? ''}`,
    `partnerCode=${payload.partnerCode ?? ''}`,
    `payType=${payload.payType ?? ''}`,
    `requestId=${payload.requestId ?? ''}`,
    `responseTime=${payload.responseTime ?? ''}`,
    `resultCode=${payload.resultCode ?? ''}`,
    `transId=${payload.transId ?? ''}`,
  ].join('&');
  return createHmac('sha256', secret).update(signData, 'utf8').digest('hex');
}

export function verifyMomoNotificationSignature(
  payload: MomoNotificationPayload,
  accessKey: string,
  secret: string,
): boolean {
  if (payload.accessKey !== accessKey) return false;
  return matchesSignature(createMomoNotificationSignature(payload, secret), payload.signature);
}

export function createMomoRequestSignature(fields: MomoCreateRequestFields, secret: string): string {
  const signData = [
    `accessKey=${fields.accessKey}`,
    `amount=${fields.amount}`,
    `extraData=${fields.extraData}`,
    `ipnUrl=${fields.ipnUrl}`,
    `orderId=${fields.orderId}`,
    `orderInfo=${fields.orderInfo}`,
    `partnerCode=${fields.partnerCode}`,
    `redirectUrl=${fields.redirectUrl}`,
    `requestId=${fields.requestId}`,
    `requestType=${fields.requestType}`,
  ].join('&');
  return createHmac('sha256', secret).update(signData, 'utf8').digest('hex');
}

export function createMomoQuerySignature(fields: MomoQueryRequestFields, secret: string): string {
  const signData = [
    `accessKey=${fields.accessKey}`,
    `orderId=${fields.orderId}`,
    `partnerCode=${fields.partnerCode}`,
    `requestId=${fields.requestId}`,
  ].join('&');
  return createHmac('sha256', secret).update(signData, 'utf8').digest('hex');
}

function matchesSignature(expected: string, actual: string | undefined): boolean {
  if (!actual || !/^[a-f\d]+$/i.test(actual)) return false;
  const expectedBytes = Buffer.from(expected, 'hex');
  const actualBytes = Buffer.from(actual, 'hex');
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}
