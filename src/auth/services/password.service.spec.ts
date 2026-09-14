import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  it('hashes the same password to two different strings (random salt)', async () => {
    const hash1 = await service.hash('Abc@1234');
    const hash2 = await service.hash('Abc@1234');

    expect(hash1).not.toBe(hash2);
  });

  it('verifies a password against its own hash', async () => {
    const hash = await service.hash('Abc@1234');

    await expect(service.verify(hash, 'Abc@1234')).resolves.toBe(true);
  });

  it('rejects the wrong password against a hash', async () => {
    const hash = await service.hash('Abc@1234');

    await expect(service.verify(hash, 'wrong-password')).resolves.toBe(false);
  });
});
