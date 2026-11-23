import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PaymentGateway } from '#src/generated/prisma/enums.js';
import {
  createPaymentDedupKey,
  createVnpaySignature,
  verifyVnpaySignature,
  type VnpayPayload,
} from '#src/infrastructure/payment/payment-signatures.js';
import { postForm } from '#src/infrastructure/payment/payment-http.js';
import type {
  PaymentGateway as PaymentGatewayContract,
  PaymentLinkInput,
  PaymentLookup,
  VerifiedPaymentNotification,
} from '#src/modules/payment/payment-gateway.js';

@Injectable()
export class VnpayGateway implements PaymentGatewayContract {
  readonly gateway = PaymentGateway.VNPAY;

  constructor(private readonly config: ConfigService) {}

  async createPaymentLink(input: PaymentLinkInput): Promise<string> {
    const tmnCode = this.required('VNPAY_TMN_CODE');
    const hashSecret = this.required('VNPAY_HASH_SECRET');
    const paymentUrl =
      this.config.get<string>('VNPAY_PAYMENT_URL')?.trim() || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    const params: VnpayPayload = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Amount: (input.amount * 100n).toString(),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: input.gatewayTxnRef,
      vnp_OrderInfo: `Thanh toan don hang ${input.orderNumber}`,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: input.returnUrl,
      vnp_IpAddr: input.clientIp,
      vnp_CreateDate: formatVnpayDate(new Date()),
      vnp_ExpireDate: formatVnpayDate(input.expiresAt),
    };
    const url = parseProviderUrl(paymentUrl, 'VNPAY_PAYMENT_URL');
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    url.searchParams.set('vnp_SecureHash', createVnpaySignature(params, hashSecret));
    return url.toString();
  }

  verifyNotification(payload: unknown): VerifiedPaymentNotification {
    const params = asVnpayPayload(payload);
    const signature = requiredString(params, 'vnp_SecureHash');
    const hashSecret = this.required('VNPAY_HASH_SECRET');
    const tmnCode = this.required('VNPAY_TMN_CODE');
    if (params.vnp_TmnCode !== tmnCode || !verifyVnpaySignature(params, signature, hashSecret)) {
      throw new BadRequestException('VNPay callback signature is invalid');
    }

    const gatewayTxnRef = requiredString(params, 'vnp_TxnRef');
    const transactionNo = String(params.vnp_TransactionNo ?? '');
    const responseCode = String(params.vnp_ResponseCode ?? '');
    const transactionStatus = String(params.vnp_TransactionStatus ?? '');
    const amountRaw = parseVnpayAmount(requiredString(params, 'vnp_Amount'));
    if (amountRaw % 100n !== 0n) throw new BadRequestException('VNPay callback amount is invalid');
    const status =
      responseCode === '00' && transactionStatus === '00'
        ? 'CAPTURED'
        : responseCode === '09' || transactionStatus === '01'
          ? 'PENDING'
          : 'FAILED';

    return {
      gatewayTxnRef,
      dedupKey: createPaymentDedupKey(gatewayTxnRef, transactionNo, responseCode, transactionStatus),
      status,
      amountCaptured: amountRaw / 100n,
      ...(transactionNo ? { gatewayTxnId: transactionNo } : {}),
    };
  }

  async queryPayment(payment: PaymentLookup): Promise<VerifiedPaymentNotification> {
    const tmnCode = this.required('VNPAY_TMN_CODE');
    const hashSecret = this.required('VNPAY_HASH_SECRET');
    const apiUrl =
      this.config.get<string>('VNPAY_API_URL')?.trim() ||
      'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction';
    const params: VnpayPayload = {
      vnp_RequestId: randomUUID(),
      vnp_Version: '2.1.0',
      vnp_Command: 'querydr',
      vnp_TmnCode: tmnCode,
      vnp_TxnRef: payment.gatewayTxnRef,
      vnp_OrderInfo: `Truy van don hang ${payment.orderNumber}`,
      vnp_TransactionDate: formatVnpayDate(payment.createdAt),
      vnp_CreateDate: formatVnpayDate(new Date()),
      vnp_IpAddr: '127.0.0.1',
    };
    params.vnp_SecureHash = createVnpaySignature(params, hashSecret);
    const response = await postForm(
      parseProviderUrl(apiUrl, 'VNPAY_API_URL').toString(),
      toSearchParams(params),
      'VNPay',
    );
    const responseSignature = optionalString(response.vnp_SecureHash);
    if (!responseSignature || !verifyVnpaySignature(asVnpayPayload(response), responseSignature, hashSecret)) {
      throw new BadRequestException('VNPay reconciliation response signature is invalid');
    }
    if (response.vnp_TmnCode !== tmnCode || response.vnp_TxnRef !== payment.gatewayTxnRef) {
      throw new BadRequestException('VNPay reconciliation response does not match the payment');
    }

    const responseCode = optionalString(response.vnp_ResponseCode) ?? '';
    const transactionStatus = optionalString(response.vnp_TransactionStatus) ?? '';
    const status =
      responseCode === '00' && transactionStatus === '00'
        ? 'CAPTURED'
        : responseCode === '09' || transactionStatus === '01'
          ? 'PENDING'
          : 'FAILED';
    const amountRaw = response.vnp_Amount === undefined ? undefined : parseVnpayAmount(String(response.vnp_Amount));
    if (amountRaw !== undefined && amountRaw % 100n !== 0n) {
      throw new BadRequestException('VNPay reconciliation amount is invalid');
    }
    return {
      gatewayTxnRef: payment.gatewayTxnRef,
      dedupKey: createPaymentDedupKey(
        payment.gatewayTxnRef,
        optionalString(response.vnp_TransactionNo) ?? '',
        responseCode,
        transactionStatus,
      ),
      status,
      ...(amountRaw !== undefined ? { amountCaptured: amountRaw / 100n } : {}),
      ...(optionalString(response.vnp_TransactionNo)
        ? { gatewayTxnId: optionalString(response.vnp_TransactionNo) }
        : {}),
    };
  }

  private required(name: string): string {
    const value = this.config.get<string>(name)?.trim();
    if (!value) throw new ServiceUnavailableException(`Payment gateway configuration is missing: ${name}`);
    return value;
  }
}

function parseVnpayAmount(value: string): bigint {
  if (!/^\d+$/.test(value)) throw new BadRequestException('VNPay callback amount is invalid');
  return BigInt(value);
}

function parseProviderUrl(value: string, configName: string): URL {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') throw new Error('Unsupported protocol');
    return url;
  } catch {
    throw new ServiceUnavailableException(`${configName} must be an absolute HTTPS URL`);
  }
}

function formatVnpayDate(date: Date): string {
  const values = new Map(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map(({ type, value }) => [type, value]),
  );
  return `${values.get('year')}${values.get('month')}${values.get('day')}${values.get('hour')}${values.get('minute')}${values.get('second')}`;
}

function toSearchParams(payload: VnpayPayload): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) params.set(key, String(value));
  }
  return params;
}

function asVnpayPayload(value: unknown): VnpayPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('VNPay callback is invalid');
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      typeof item === 'string' || typeof item === 'number' ? item : undefined,
    ]),
  );
}

function requiredString(payload: VnpayPayload, key: string): string {
  const value = payload[key];
  if (value === undefined || String(value).length === 0)
    throw new BadRequestException(`VNPay callback is missing ${key}`);
  return String(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}
