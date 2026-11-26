import { describe, expect, it } from 'vitest';
import {
  verifyMomoNotificationSignature,
  verifyVnpaySignature,
  type MomoNotificationPayload,
} from '#src/infrastructure/payment/payment-signatures.js';

describe('payment callback signatures', () => {
  it('verifies VNPay HMAC-SHA512 and rejects modified callback fields', () => {
    const params = {
      vnp_Amount: '23000000',
      vnp_ResponseCode: '00',
      vnp_TxnRef: 'txn-1',
    };
    const signature =
      '4cac93cf129400e4ab44ccf99d59206f27a1a7dc0b463c79dfe5cada0a2232fa34486196f780a3704636ea43ae59633b2d1e4ab52928876468e2ee6b7fa00ad4';

    expect(verifyVnpaySignature(params, signature, 'test-secret')).toBe(true);
    expect(verifyVnpaySignature({ ...params, vnp_Amount: '23000001' }, signature, 'test-secret')).toBe(false);
    expect(verifyVnpaySignature(params, 'not-a-hex-signature', 'test-secret')).toBe(false);
  });

  it('verifies MoMo callback HMAC-SHA256 and rejects modified callback fields', () => {
    const payload: MomoNotificationPayload = {
      accessKey: 'access',
      amount: 230_000,
      extraData: '',
      message: 'Success',
      orderId: 'order-1',
      orderInfo: 'Order FS',
      orderType: 'momo_wallet',
      partnerCode: 'partner',
      payType: 'qr',
      requestId: 'req-1',
      responseTime: '1700000000000',
      resultCode: 0,
      transId: 'trans-1',
      signature: 'f268be7cc918426e32049977924aecd7a7c7038d67b4b65c4e3e47d2a359aee6',
    };

    expect(verifyMomoNotificationSignature(payload, 'access', 'test-secret')).toBe(true);
    expect(verifyMomoNotificationSignature({ ...payload, amount: 230_001 }, 'access', 'test-secret')).toBe(false);
    expect(verifyMomoNotificationSignature({ ...payload, accessKey: 'other' }, 'access', 'test-secret')).toBe(false);
  });
});
