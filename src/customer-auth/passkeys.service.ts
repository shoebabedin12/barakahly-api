import { randomBytes } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  type AuthenticationResponseJSON,
  type AuthenticatorTransport,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type RegistrationResponseJSON,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { Repository } from 'typeorm';
import { LaravelValidationException } from '../common/laravel-validation.js';
import { iso8601 } from '../common/iso-date.js';
import { Customer } from '../customers/customer.entity.js';
import { Passkey } from './passkey.entity.js';

const TICKET_TTL_MS = 5 * 60 * 1000;

/** A few well-known AAGUIDs, so the account page can say where a passkey lives. */
const AUTHENTICATORS: Record<string, string> = {
  'fbfc3007-154e-4ecc-8c0b-6e020557d7bd': 'iCloud Keychain',
  'dd4ec289-e01d-41c9-bb89-70fa845d4bf2': 'iCloud Keychain (Managed)',
  'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': 'Google Password Manager',
  'adce0002-35bc-c60a-648b-0b25f1f05503': 'Chrome on Mac',
  '08987058-cadc-4b81-b6e1-30de50dcbe96': 'Windows Hello',
  '9ddd1817-af5a-4672-a2b9-3e3dd95000a9': 'Windows Hello',
  '6028b017-b1d4-4c02-b4b3-afcdafc96bb2': 'Windows Hello',
  'bada5566-a7aa-401f-bd96-45619a55120d': '1Password',
  'd548826e-79b4-db40-a3d8-11116f7e8349': 'Bitwarden',
  '53414d53-554e-4700-0000-000000000000': 'Samsung Pass',
  '531126d6-e717-415c-9320-3d9aa6981239': 'Dashlane',
};

interface PendingCeremony {
  challenge: string;
  customerId: number | null;
  expiresAt: number;
}

/**
 * Passkey (WebAuthn) registration and sign-in, replacing laravel/passkeys.
 * The API is stateless, so each ceremony's challenge is kept server-side
 * under a short-lived random ticket the client echoes back - same contract
 * as the Laravel version.
 */
@Injectable()
export class PasskeysService {
  private readonly pending = new Map<string, PendingCeremony>();

  constructor(
    @InjectRepository(Passkey)
    private readonly passkeys: Repository<Passkey>,
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
  ) {}

  private get rpId() {
    return process.env.PASSKEYS_RELYING_PARTY_ID ?? 'localhost';
  }

  private get origins() {
    return (
      process.env.PASSKEYS_ALLOWED_ORIGINS ??
      'http://localhost:3000,http://localhost:3001'
    )
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  private remember(
    prefix: string,
    ceremony: Omit<PendingCeremony, 'expiresAt'>,
  ) {
    const now = Date.now();
    for (const [key, value] of this.pending)
      if (value.expiresAt <= now) this.pending.delete(key);

    const ticket = randomBytes(30).toString('base64url');
    this.pending.set(`${prefix}.${ticket}`, {
      ...ceremony,
      expiresAt: now + TICKET_TTL_MS,
    });
    return ticket;
  }

  private pull(prefix: string, ticket: string) {
    const key = `${prefix}.${ticket}`;
    const ceremony = this.pending.get(key);
    this.pending.delete(key);
    if (!ceremony || ceremony.expiresAt <= Date.now()) {
      throw LaravelValidationException.field(
        'ticket',
        'This passkey request has expired. Please try again.',
      );
    }
    return ceremony;
  }

  present(passkey: Passkey) {
    return {
      id: passkey.id,
      name: passkey.name,
      authenticator: passkey.credential.aaguid
        ? (AUTHENTICATORS[passkey.credential.aaguid] ?? null)
        : null,
      created_at: iso8601(passkey.createdAt),
      last_used_at: iso8601(passkey.lastUsedAt),
    };
  }

  async list(customer: Customer) {
    const passkeys = await this.passkeys.find({
      where: { customerId: customer.id },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return { passkeys: passkeys.map((passkey) => this.present(passkey)) };
  }

  async registrationOptions(customer: Customer) {
    const existing = await this.passkeys.find({
      where: { customerId: customer.id },
    });
    const options = await generateRegistrationOptions({
      rpName: process.env.APP_NAME ?? 'Barakahly',
      rpID: this.rpId,
      userID: new TextEncoder().encode(`customer:${customer.id}`),
      userName: customer.email ?? customer.phone,
      userDisplayName: customer.name,
      attestationType: 'none',
      excludeCredentials: existing.map((passkey) => ({
        id: passkey.credentialId,
        transports: passkey.credential.transports as
          AuthenticatorTransport[] | undefined,
      })),
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      },
    });

    return {
      ticket: this.remember('registration', {
        challenge: options.challenge,
        customerId: customer.id,
      }),
      options,
    };
  }

  async register(
    customer: Customer,
    name: string,
    ticket: string,
    credential: Record<string, unknown>,
  ) {
    const ceremony = this.pull('registration', ticket);
    const failed = () =>
      LaravelValidationException.field(
        'credential',
        'Could not register this passkey. Please try again.',
      );
    if (ceremony.customerId !== customer.id) throw failed();

    let info;
    try {
      const result = await verifyRegistrationResponse({
        response: credential as unknown as RegistrationResponseJSON,
        expectedChallenge: ceremony.challenge,
        expectedOrigin: this.origins,
        expectedRPID: this.rpId,
        requireUserVerification: false,
      });
      if (!result.verified || !result.registrationInfo) throw failed();
      info = result.registrationInfo;
    } catch {
      throw failed();
    }

    if (await this.passkeys.existsBy({ credentialId: info.credential.id }))
      throw failed();

    const passkey = await this.passkeys.save(
      this.passkeys.create({
        customerId: customer.id,
        name,
        credentialId: info.credential.id,
        credential: {
          publicKey: Buffer.from(info.credential.publicKey).toString(
            'base64url',
          ),
          counter: info.credential.counter,
          transports: info.credential.transports,
          aaguid: info.aaguid,
        },
      }),
    );

    return { passkey: this.present(passkey) };
  }

  async destroy(customer: Customer, id: number) {
    const passkey = await this.passkeys.findOneBy({ id });
    if (!passkey || passkey.customerId !== customer.id)
      throw new NotFoundException({ message: 'Not Found' });
    await this.passkeys.delete(passkey.id);
    return { message: 'Passkey removed.' };
  }

  async loginOptions() {
    const options = await generateAuthenticationOptions({
      rpID: this.rpId,
      userVerification: 'preferred',
    });
    return {
      ticket: this.remember('login', {
        challenge: options.challenge,
        customerId: null,
      }),
      options,
    };
  }

  /** Verifies a sign-in assertion and returns the passkey's customer. */
  async verifyLogin(
    ticket: string,
    credential: Record<string, unknown>,
  ): Promise<Customer> {
    const ceremony = this.pull('login', ticket);
    const failed = () =>
      LaravelValidationException.field(
        'credential',
        'Could not sign in with this passkey. Please try again.',
      );

    const response = credential as unknown as AuthenticationResponseJSON;
    const passkey =
      typeof response?.id === 'string'
        ? await this.passkeys.findOneBy({ credentialId: response.id })
        : null;
    if (!passkey) throw failed();

    try {
      const result = await verifyAuthenticationResponse({
        response,
        expectedChallenge: ceremony.challenge,
        expectedOrigin: this.origins,
        expectedRPID: this.rpId,
        credential: {
          id: passkey.credentialId,
          publicKey: new Uint8Array(
            Buffer.from(passkey.credential.publicKey, 'base64url'),
          ),
          counter: passkey.credential.counter,
          transports: passkey.credential.transports as
            AuthenticatorTransport[] | undefined,
        },
        requireUserVerification: false,
      });
      if (!result.verified) throw failed();

      passkey.credential = {
        ...passkey.credential,
        counter: result.authenticationInfo.newCounter,
      };
      passkey.lastUsedAt = new Date();
      await this.passkeys.save(passkey);
    } catch {
      throw failed();
    }

    return this.customers.findOneByOrFail({ id: passkey.customerId });
  }
}
