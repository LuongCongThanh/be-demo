import type { PaymentGateway as PaymentGatewayName } from '#src/generated/prisma/enums.js';

export interface PaymentLinkInput {
  gatewayTxnRef: string;
  orderNumber: string;
  amount: bigint;
  expiresAt: Date;
  returnUrl: string;
  ipnUrl: string;
  clientIp: string;
}

export interface PaymentLookup {
  gatewayTxnRef: string;
  orderNumber: string;
  amountRequested: bigint;
  createdAt: Date;
}

export type GatewayPaymentStatus = 'CAPTURED' | 'FAILED' | 'PENDING';

export interface VerifiedPaymentNotification {
  gatewayTxnRef: string;
  dedupKey: string;
  status: GatewayPaymentStatus;
  amountCaptured?: bigint;
  gatewayTxnId?: string;
}

export interface GatewayPaymentResult extends VerifiedPaymentNotification {}

export interface PaymentGateway {
  readonly gateway: PaymentGatewayName;
  createPaymentLink(input: PaymentLinkInput): Promise<string>;
  verifyNotification(payload: unknown): VerifiedPaymentNotification;
  queryPayment(payment: PaymentLookup): Promise<GatewayPaymentResult>;
}

export const PAYMENT_GATEWAYS = Symbol('PAYMENT_GATEWAYS');
export type PaymentGatewayMap = ReadonlyMap<PaymentGatewayName, PaymentGateway>;
