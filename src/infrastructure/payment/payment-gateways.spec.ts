import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MomoGateway } from '#src/infrastructure/payment/momo.gateway.js';
import {
  createMomoNotificationSignature,
  createMomoQuerySignature,
  createMomoRequestSignature,
  createVnpaySignature,
  verifyVnpaySignature,
} from '#src/infrastructure/payment/payment-signatures.js';
import { VnpayGateway } from '#src/infrastructure/payment/vnpay.gateway.js';

const secret = 'gateway-test-secret';

describe('payment gateway adapters', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates a VNPay link with signed VND amount and configured expiry', async () => {
    const config = configMock({
      VNPAY_TMN_CODE: 'merchant',
      VNPAY_HASH_SECRET: secret,
      VNPAY_PAYMENT_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    });
    const gateway = new VnpayGateway(config);
    const url = new URL(
      await gateway.createPaymentLink({
        gatewayTxnRef: 'txn-1',
        orderNumber: 'FS2611-7K3QZD',
        amount: 230_000n,
        expiresAt: new Date('2026-11-22T12:10:00.000Z'),
        returnUrl: 'https://shop.example.test/payment/return',
        ipnUrl: 'https://api.example.test/api/v1/payments/webhooks/vnpay',
        clientIp: '203.0.113.1',
      }),
    );
    const params = Object.fromEntries(url.searchParams);

    expect(params.vnp_Amount).toBe('23000000');
    expect(params.vnp_TxnRef).toBe('txn-1');
    expect(params.vnp_ReturnUrl).toBe('https://shop.example.test/payment/return');
    expect(params.vnp_ExpireDate).toBe('20261122191000');
    expect(verifyVnpaySignature(params, params.vnp_SecureHash, secret)).toBe(true);
  });

  it('maps signed VNPay callbacks and rejects malformed amounts', () => {
    const config = configMock({ VNPAY_TMN_CODE: 'merchant', VNPAY_HASH_SECRET: secret });
    const gateway = new VnpayGateway(config);
    const payload = {
      vnp_TmnCode: 'merchant',
      vnp_TxnRef: 'txn-1',
      vnp_TransactionNo: 'gateway-1',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_Amount: '23000000',
    };
    const validPayload = { ...payload, vnp_SecureHash: createVnpaySignature(payload, secret) };

    expect(gateway.verifyNotification(validPayload)).toMatchObject({
      gatewayTxnRef: 'txn-1',
      status: 'CAPTURED',
      amountCaptured: 230_000n,
      gatewayTxnId: 'gateway-1',
    });
    expect(() =>
      gateway.verifyNotification({
        ...validPayload,
        vnp_Amount: 'invalid',
        vnp_SecureHash: createVnpaySignature({ ...payload, vnp_Amount: 'invalid' }, secret),
      }),
    ).toThrow(BadRequestException);
  });

  it('authenticates VNPay reconciliation responses before mapping capture status', async () => {
    const responseFields = {
      vnp_TmnCode: 'merchant',
      vnp_TxnRef: 'txn-1',
      vnp_TransactionNo: 'gateway-1',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_Amount: '23000000',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ...responseFields,
            vnp_SecureHash: createVnpaySignature(responseFields, secret),
          }),
          { status: 200 },
        ),
      ),
    );
    const gateway = new VnpayGateway(
      configMock({
        VNPAY_TMN_CODE: 'merchant',
        VNPAY_HASH_SECRET: secret,
        VNPAY_API_URL: 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
      }),
    );

    await expect(
      gateway.queryPayment({
        gatewayTxnRef: 'txn-1',
        orderNumber: 'FS2611-7K3QZD',
        amountRequested: 230_000n,
        createdAt: new Date('2026-11-22T12:00:00.000Z'),
      }),
    ).resolves.toMatchObject({
      gatewayTxnRef: 'txn-1',
      status: 'CAPTURED',
      amountCaptured: 230_000n,
      gatewayTxnId: 'gateway-1',
    });
  });

  it('signs MoMo create requests and accepts only correlated provider links', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          partnerCode: 'partner',
          requestId: 'txn-1',
          orderId: 'txn-1',
          amount: 230000,
          resultCode: 0,
          payUrl: 'https://test-payment.momo.vn/v2/gateway/pay',
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const gateway = new MomoGateway(
      configMock({
        MOMO_PARTNER_CODE: 'partner',
        MOMO_ACCESS_KEY: 'access',
        MOMO_SECRET_KEY: secret,
        MOMO_ENDPOINT: 'https://test-payment.momo.vn',
      }),
    );

    const paymentUrl = await gateway.createPaymentLink({
      gatewayTxnRef: 'txn-1',
      orderNumber: 'FS2611-7K3QZD',
      amount: 230_000n,
      expiresAt: new Date('2026-11-22T12:10:00.000Z'),
      returnUrl: 'https://shop.example.test/payment/return',
      ipnUrl: 'https://api.example.test/api/v1/payments/webhooks/momo',
      clientIp: '203.0.113.1',
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as Record<string, string | number>;

    expect(paymentUrl).toBe('https://test-payment.momo.vn/v2/gateway/pay');
    expect(body.amount).toBe(230000);
    expect(body.signature).toBe(
      createMomoRequestSignature(
        {
          accessKey: 'access',
          amount: String(body.amount),
          extraData: String(body.extraData),
          ipnUrl: String(body.ipnUrl),
          orderId: String(body.orderId),
          orderInfo: String(body.orderInfo),
          partnerCode: String(body.partnerCode),
          redirectUrl: String(body.redirectUrl),
          requestId: String(body.requestId),
          requestType: String(body.requestType),
        },
        secret,
      ),
    );
  });

  it('maps signed MoMo captures and pending notifications', () => {
    const gateway = new MomoGateway(
      configMock({
        MOMO_PARTNER_CODE: 'partner',
        MOMO_ACCESS_KEY: 'access',
        MOMO_SECRET_KEY: secret,
      }),
    );
    const payload = {
      accessKey: 'access',
      amount: 230_000,
      extraData: '',
      message: 'Success',
      orderId: 'txn-1',
      orderInfo: 'Order FS',
      orderType: 'momo_wallet',
      partnerCode: 'partner',
      payType: 'qr',
      requestId: 'request-1',
      responseTime: '1700000000000',
      resultCode: 0,
      transId: 'transaction-1',
    };
    const signedPayload = {
      ...payload,
      signature: createMomoNotificationSignature(payload, secret),
    };
    const pendingPayload = {
      ...signedPayload,
      resultCode: 7000,
      signature: createMomoNotificationSignature({ ...payload, resultCode: 7000 }, secret),
    };

    expect(gateway.verifyNotification(signedPayload)).toMatchObject({
      gatewayTxnRef: 'txn-1',
      status: 'CAPTURED',
      amountCaptured: 230_000n,
    });
    expect(gateway.verifyNotification(pendingPayload).status).toBe('PENDING');
    const wrongMerchantPayload = { ...payload, partnerCode: 'different-merchant' };
    expect(() =>
      gateway.verifyNotification({
        ...wrongMerchantPayload,
        signature: createMomoNotificationSignature(wrongMerchantPayload, secret),
      }),
    ).toThrow(BadRequestException);
  });

  it('signs MoMo reconciliation queries and verifies the provider response', async () => {
    const responseFields = {
      accessKey: 'access',
      amount: 230_000,
      extraData: '',
      message: 'Success',
      orderId: 'txn-1',
      orderInfo: 'Order FS',
      orderType: 'momo_wallet',
      partnerCode: 'partner',
      payType: 'qr',
      requestId: 'response-1',
      responseTime: '1700000000000',
      resultCode: 0,
      transId: 'transaction-1',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ...responseFields,
            signature: createMomoNotificationSignature(responseFields, secret),
          }),
          { status: 200 },
        ),
      ),
    );
    const gateway = new MomoGateway(
      configMock({
        MOMO_PARTNER_CODE: 'partner',
        MOMO_ACCESS_KEY: 'access',
        MOMO_SECRET_KEY: secret,
        MOMO_ENDPOINT: 'https://test-payment.momo.vn',
      }),
    );

    const result = await gateway.queryPayment({
      gatewayTxnRef: 'txn-1',
      orderNumber: 'FS2611-7K3QZD',
      amountRequested: 230_000n,
      createdAt: new Date('2026-11-22T12:00:00.000Z'),
    });
    const requestUrl = String(vi.mocked(fetch).mock.calls[0][0]);
    const requestBody = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body)) as Record<string, string>;

    expect(result).toMatchObject({
      gatewayTxnRef: 'txn-1',
      status: 'CAPTURED',
      amountCaptured: 230_000n,
      gatewayTxnId: 'transaction-1',
    });
    expect(requestUrl).toContain('/v2/gateway/api/query');
    expect(requestBody.signature).toBe(
      createMomoQuerySignature(
        {
          accessKey: 'access',
          orderId: 'txn-1',
          partnerCode: 'partner',
          requestId: requestBody.requestId,
        },
        secret,
      ),
    );
  });

  it('rejects MoMo links that do not belong to the provider', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            partnerCode: 'partner',
            requestId: 'txn-1',
            orderId: 'txn-1',
            amount: 230000,
            resultCode: 0,
            payUrl: 'https://attacker.example.test/pay',
          }),
          { status: 200 },
        ),
      ),
    );
    const gateway = new MomoGateway(
      configMock({
        MOMO_PARTNER_CODE: 'partner',
        MOMO_ACCESS_KEY: 'access',
        MOMO_SECRET_KEY: secret,
      }),
    );

    await expect(
      gateway.createPaymentLink({
        gatewayTxnRef: 'txn-1',
        orderNumber: 'FS2611-7K3QZD',
        amount: 230_000n,
        expiresAt: new Date(),
        returnUrl: 'https://shop.example.test/payment/return',
        ipnUrl: 'https://api.example.test/api/v1/payments/webhooks/momo',
        clientIp: '203.0.113.1',
      }),
    ).rejects.toThrow('MoMo returned an invalid payment link');
  });
});

function configMock(values: Record<string, string>): ConfigService {
  return new ConfigService(values);
}
