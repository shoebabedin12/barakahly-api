import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/** RFC 6238 TOTP, same parameters as Laravel's TotpService (SHA1, 6 digits, 30s, ±1 step). */
const PERIOD = 30;
const DIGITS = 6;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(data: Buffer) {
  let bits = '';
  for (const byte of data) bits += byte.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i < bits.length; i += 5)
    out += ALPHABET[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return out;
}

function base32Decode(text: string) {
  let bits = '';
  for (const char of text.toUpperCase()) {
    const index = ALPHABET.indexOf(char);
    if (index >= 0) bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function generateSecret() {
  return base32Encode(randomBytes(20));
}

export function otpauthUri(
  email: string,
  secret: string,
  issuer = 'Barakahly',
) {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(PERIOD),
  });
  return `otpauth://totp/${label}?${params}`;
}

export function totpCode(secret: string, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hash = createHmac('sha1', base32Decode(secret))
    .update(counter)
    .digest();
  const offset = hash[hash.length - 1] & 0x0f;
  const value = hash.readUInt32BE(offset) & 0x7fffffff;
  return String(value % 10 ** DIGITS).padStart(DIGITS, '0');
}

export function verifyTotp(secret: string, code: string, now = Date.now()) {
  const clean = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  const step = Math.floor(now / 1000 / PERIOD);
  for (let i = -1; i <= 1; i++) {
    const expected = Buffer.from(totpCode(secret, step + i));
    if (timingSafeEqual(expected, Buffer.from(clean))) return true;
  }
  return false;
}

export function generateRecoveryCodes(count = 8) {
  return Array.from({ length: count }, () =>
    randomBytes(5).toString('hex').toUpperCase(),
  );
}

/**
 * The secret and recovery codes are stored encrypted (AES-256-GCM), with a
 * key derived from ADMIN_JWT_SECRET. Values Laravel encrypted with its own
 * APP_KEY can't be read here and are treated as "2FA not set up".
 */
const PREFIX = 'n1:';
const key = () =>
  createHash('sha256')
    .update(`two-factor:${process.env.ADMIN_JWT_SECRET ?? ''}`)
    .digest();

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return (
    PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64')
  );
}

export function decrypt(value: string | null | undefined): string | null {
  if (!value?.startsWith(PREFIX)) return null;
  try {
    const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key(),
      raw.subarray(0, 12),
    );
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([
      decipher.update(raw.subarray(28)),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}
