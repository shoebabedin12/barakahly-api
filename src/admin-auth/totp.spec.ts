import {
  decrypt,
  encrypt,
  generateSecret,
  otpauthUri,
  totpCode,
  verifyTotp,
} from './totp.js';

describe('totp', () => {
  // RFC 6238 test vector: secret "12345678901234567890" (base32 GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ), T=59s -> 287082.
  const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  it('matches the RFC 6238 SHA1 test vector', () => {
    expect(totpCode(rfcSecret, Math.floor(59 / 30))).toBe('287082');
    expect(verifyTotp(rfcSecret, '287082', 59_000)).toBe(true);
    expect(verifyTotp(rfcSecret, '287 082', 59_000)).toBe(true);
  });

  it('accepts one step of clock drift but not two', () => {
    const now = 1_800_000_000_000;
    const step = Math.floor(now / 30_000);
    expect(verifyTotp(rfcSecret, totpCode(rfcSecret, step - 1), now)).toBe(
      true,
    );
    expect(verifyTotp(rfcSecret, totpCode(rfcSecret, step + 2), now)).toBe(
      false,
    );
    expect(verifyTotp(rfcSecret, 'abcdef', now)).toBe(false);
  });

  it('builds an otpauth URI and a 32-char base32 secret', () => {
    const secret = generateSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(otpauthUri('a@b.com', secret)).toContain(`secret=${secret}`);
  });

  it('round-trips encryption and rejects tampered or Laravel-encrypted values', () => {
    process.env.ADMIN_JWT_SECRET = 'test-secret';
    const sealed = encrypt('hello');
    expect(decrypt(sealed)).toBe('hello');
    expect(decrypt(sealed.slice(0, -2) + 'AA')).toBeNull();
    expect(decrypt('eyJpdiI6Ik...laravel')).toBeNull();
    expect(decrypt(null)).toBeNull();
  });
});
