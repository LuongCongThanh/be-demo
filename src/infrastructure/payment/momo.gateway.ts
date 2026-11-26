import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PaymentGateway } from '#src/generated/prisma/enums.js';
import {
  createPaymentDedupKey,
  createMomoQuerySignature,
  createMomoRequestSignature,
  verifyMomoNotificationSignature,
  type MomoNotificationPayload,
} from '#src/infrastructure/payment/payment-signatures.js';
import { postJson } from '#src/infrastructure/payment/payment-http.js';
import type {
  PaymentGateway as PaymentGatewayContract,
  PaymentLinkInput,
  PaymentLookup,
  VerifiedPaymentNotification,
} from '#src/modules/payment/payment-gateway.js';

@Injectable()
export class MomoGateway implements PaymentGatewayContract {
  readonly gateway = PaymentGateway.MOMO;

  constructor(private readonly config: ConfigService) {}

  async createPaymentLink(input: PaymentLinkInput): Promise<string> {
    const partnerCode = this.required('MOMO_PARTNER_CODE');
    const accessKey = this.required('MOMO_ACCESS_KEY');
    const secretKey = this.required('MOMO_SECRET_KEY');
    const endpoint = this.endpoint();
    const requestId = input.gatewayTxnRef;
    const requestType = 'captureWallet';
    const fields = {
      partnerCode,
      requestId,
      amount: input.amount.toString(),
      orderId: input.gatewayTxnRef,
      orderInfo: `Thanh toan don hang ${input.orderNumber}`,
      redirectUrl: input.returnUrl,
      ipnUrl: input.ipnUrl,
      lang: 'vi',
      requestType,
      extraData: '',
      accessKey,
    };
    const response = await postJson(
      new URL('/v2/gateway/api/create', endpoint).toString(),
      {
        partnerCode: fields.partnerCode,
        requestId: fields.requestId,
        amount: toSafeProviderAmount(input.amount),
        orderId: fields.orderId,
        orderInfo: fields.orderInfo,
        redirectUrl: fields.redirectUrl,
        ipnUrl: fields.ipnUrl,
        lang: fields.lang,
        requestType: fields.requestType,
        extraData: fields.extraData,
        signature: createMomoRequestSignature(fields, secretKey),
      },
      'MoMo',
    );
    if (
      Number(response.resultCode) !== 0 ||
      response.partnerCode !== partnerCode ||
      response.requestId !== requestId ||
      response.orderId !== input.gatewayTxnRef ||
      String(response.amount) !== input.amount.toString() ||
      typeof response.payUrl !== 'string'
    ) {
      throw new ServiceUnavailableException('MoMo could not create the payment link');
    }
    let payUrl: URL;
    try {
      payUrl = new URL(response.payUrl);
    } catch {
      throw new ServiceUnavailableException('MoMo returned an invalid payment link');
    }
    if (payUrl.protocol !== 'https:' || !payUrl.hostname.endsWith('.momo.vn')) {
      throw new ServiceUnavailableException('MoMo returned an invalid payment link');
    }
    return payUrl.toString();
  }

  verifyNotification(payload: unknown): VerifiedPaymentNotification {
    const notification = asMomoNotification(payload);
    const accessKey = this.required('MOMO_ACCESS_KEY');
    const partnerCode = this.required('MOMO_PARTNER_CODE');
    const secretKey = this.required('MOMO_SECRET_KEY');
    if (!verifyMomoNotificationSignature(notification, accessKey, secretKey)) {
      throw new BadRequestException('MoMo callback signature is invalid');
    }
    if (notification.partnerCode !== partnerCode) {
      throw new BadRequestException('MoMo callback belongs to a different merchant');
    }
    if (!notification.orderId || notification.amount === undefined || notification.resultCode === undefined) {
      throw new BadRequestException('MoMo callback is missing required payment fields');
    }

    const resultCode = Number(notification.resultCode);
    const transactionId = optionalString(notification.transId);
    const amountCaptured = parseAmount(notification.amount);
    return {
      gatewayTxnRef: notification.orderId,
      dedupKey: createPaymentDedupKey(notification.orderId, transactionId ?? '', String(resultCode)),
      status: resultCode === 0 ? 'CAPTURED' : resultCode === 7000 ? 'PENDING' : 'FAILED',
      amountCaptured,
      ...(transactionId ? { gatewayTxnId: transactionId } : {}),
    };
  }

  async queryPayment(payment: PaymentLookup): Promise<VerifiedPaymentNotification> {
    const partnerCode = this.required('MOMO_PARTNER_CODE');
    const accessKey = this.required('MOMO_ACCESS_KEY');
    const secretKey = this.required('MOMO_SECRET_KEY');
    const requestId = randomUUID();
    const fields = { accessKey, orderId: payment.gatewayTxnRef, partnerCode, requestId };
    const response = await postJson(
      new URL('/v2/gateway/api/query', this.endpoint()).toString(),
      {
        partnerCode,
        requestId,
        orderId: payment.gatewayTxnRef,
        lang: 'vi',
        signature: createMomoQuerySignature(fields, secretKey),
      },
      'MoMo',
    );
    const notification = asMomoNotification(response);
    if (!verifyMomoNotificationSignature(notification, accessKey, secretKey)) {
      throw new BadRequestException('MoMo reconciliation response signature is invalid');
    }
    if (notification.orderId !== payment.gatewayTxnRef || notification.partnerCode !== partnerCode) {
      throw new BadRequestException('MoMo reconciliation response does not match the payment');
    }
    if (notification.amount === undefined || notification.resultCode === undefined) {
      throw new BadRequestException('MoMo reconciliation response is missing payment fields');
    }
    const resultCode = Number(notification.resultCode);
    const transactionId = optionalString(notification.transId);
    return {
      gatewayTxnRef: payment.gatewayTxnRef,
      dedupKey: createPaymentDedupKey(payment.gatewayTxnRef, transactionId ?? '', String(resultCode)),
      status: resultCode === 0 ? 'CAPTURED' : resultCode === 7000 ? 'PENDING' : 'FAILED',
      amountCaptured: parseAmount(notification.amount),
      ...(transactionId ? { gatewayTxnId: transactionId } : {}),
    };
  }

  private required(name: string): string {
    const value = this.config.get<string>(name)?.trim();
    if (!value) throw new ServiceUnavailableException(`Payment gateway configuration is missing: ${name}`);
    return value;
  }

  private endpoint(): string {
    const endpoint = this.config.get<string>('MOMO_ENDPOINT', 'https://test-payment.momo.vn')?.trim();
    if (!endpoint) throw new ServiceUnavailableException('Payment gateway configuration is missing: MOMO_ENDPOINT');
    try {
      const url = new URL(endpoint);
      if (url.protocol !== 'https:') throw new Error('Unsupported protocol');
      return url.toString();
    } catch {
      throw new ServiceUnavailableException('MOMO_ENDPOINT must be an absolute URL');
    }
  }
}

function asMomoNotification(value: unknown): MomoNotificationPayload {
  if (!isRecord(value)) {
    throw new BadRequestException('MoMo callback is invalid');
  }
  const record = value;
  const stringValue = (key: string) => (typeof record[key] === 'string' ? record[key] : undefined);
  const numericValue = (key: string) => {
    const item = record[key];
    return typeof item === 'number' || typeof item === 'string' ? item : undefined;
  };
  return {
    accessKey: stringValue('accessKey'),
    amount: numericValue('amount'),
    extraData: stringValue('extraData'),
    message: stringValue('message'),
    orderId: stringValue('orderId'),
    orderInfo: stringValue('orderInfo'),
    orderType: stringValue('orderType'),
    partnerCode: stringValue('partnerCode'),
    payType: stringValue('payType'),
    requestId: stringValue('requestId'),
    responseTime: numericValue('responseTime'),
    resultCode: numericValue('resultCode'),
    transId: numericValue('transId'),
    signature: stringValue('signature'),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function parseAmount(value: number | string): bigint {
  if (!/^\d+$/.test(String(value))) throw new BadRequestException('MoMo callback amount is invalid');
  return BigInt(value);
}

function toSafeProviderAmount(value: bigint): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new BadRequestException('MoMo payment amount is outside the supported range');
  }
  return amount;
}

function optionalString(value: number | string | undefined): string | undefined {
  return value === undefined ? undefined : String(value);
}
