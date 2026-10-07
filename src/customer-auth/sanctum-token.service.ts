import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { crc32 } from 'node:zlib';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../customers/customer.entity.js';
import { PersonalAccessToken } from './personal-access-token.entity.js';

/** The morph class Laravel stored for customer tokens. */
export const CUSTOMER_TOKENABLE_TYPE = 'App\\Models\\Customer';

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export interface ResolvedToken {
  customer: Customer;
  tokenId: number;
}

/**
 * Issues and validates customer bearer tokens exactly like Laravel Sanctum 4
 * (no prefix, no expiry configured): the plain token is `{id}|{40 random
 * chars}{crc32b of them}` and the table stores sha256 of the part after `|`.
 */
@Injectable()
export class SanctumTokenService {
  constructor(
    @InjectRepository(PersonalAccessToken)
    private readonly tokens: Repository<PersonalAccessToken>,
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
  ) {}

  async issue(customerId: number, name = 'mobile-app'): Promise<string> {
    let entropy = '';
    for (let i = 0; i < 40; i++)
      entropy += ALPHABET[randomInt(ALPHABET.length)];
    const plain = entropy + crc32(entropy).toString(16).padStart(8, '0');

    const token = await this.tokens.save(
      this.tokens.create({
        tokenableType: CUSTOMER_TOKENABLE_TYPE,
        tokenableId: customerId,
        name,
        token: sha256(plain),
        abilities: '["*"]',
      }),
    );

    return `${token.id}|${plain}`;
  }

  /** PersonalAccessToken::findToken + Sanctum's guard checks. Null when invalid. */
  async resolve(
    bearer: string | null | undefined,
  ): Promise<ResolvedToken | null> {
    if (!bearer) return null;

    let token: PersonalAccessToken | null;
    if (bearer.includes('|')) {
      const [id, plain] = bearer.split('|', 2);
      if (!/^\d+$/.test(id)) return null;
      token = await this.tokens.findOneBy({ id: Number(id) });
      if (!token) return null;
      const expected = Buffer.from(token.token);
      const actual = Buffer.from(sha256(plain));
      if (
        expected.length !== actual.length ||
        !timingSafeEqual(expected, actual)
      )
        return null;
    } else {
      token = await this.tokens.findOneBy({ token: sha256(bearer) });
    }

    if (!token || token.tokenableType !== CUSTOMER_TOKENABLE_TYPE) return null;
    if (token.expiresAt && token.expiresAt.getTime() <= Date.now()) return null;

    const customer = await this.customers.findOneBy({ id: token.tokenableId });
    if (!customer) return null;

    await this.tokens.update(token.id, { lastUsedAt: new Date() });

    return { customer, tokenId: token.id };
  }

  async revoke(tokenId: number) {
    await this.tokens.delete(tokenId);
  }
}
