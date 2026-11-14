import {
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { Repository } from 'typeorm';
import { ActivityLogService } from '../activity-log/activity-log.service.js';
import { User } from '../users/user.entity.js';
import {
  decrypt,
  encrypt,
  generateRecoveryCodes,
  generateSecret,
  otpauthUri,
  verifyTotp,
} from './totp.js';

/** Short-lived tokens for the steps of a 2FA login/setup. AdminJwtGuard refuses any token with a purpose. */
type StepPurpose = '2fa-challenge' | '2fa-setup';
interface StepPayload {
  sub: number;
  purpose: StepPurpose;
  s?: string;
}

function serializeUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
      ? { id: user.role.id, name: user.role.name, slug: user.role.slug }
      : null,
    twoFactorEnabled: Boolean(user.twoFactorEnabledAt),
  };
}

const unprocessable = (message: string) =>
  new UnprocessableEntityException({ message });

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly activity: ActivityLogService,
  ) {}

  private withSecrets(where: { id: number } | { email: string }) {
    return this.users.findOne({
      where,
      relations: { role: true },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        roleId: true,
        twoFactorSecret: true,
        twoFactorRecoveryCodes: true,
        twoFactorEnabledAt: true,
        role: { id: true, name: true, slug: true },
      },
    });
  }

  /** The decrypted secret, or null when 2FA is off (or was set up by Laravel and can't be read). */
  private activeSecret(user: User) {
    return user.twoFactorEnabledAt ? decrypt(user.twoFactorSecret) : null;
  }

  private async session(user: User) {
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email });
    return { token, user: serializeUser(user) };
  }

  private async stepToken(payload: StepPayload, expiresIn: '5m' | '15m') {
    return this.jwt.signAsync(payload, { expiresIn });
  }

  private async readStep(token: string, purpose: StepPurpose) {
    try {
      const payload = await this.jwt.verifyAsync<StepPayload>(token);
      if (payload.purpose === purpose) return payload;
    } catch {
      /* fall through */
    }
    throw new UnauthorizedException(
      'This step has expired. Please start again.',
    );
  }

  /** LoginRequest::authenticate() + the 2FA redirect in Admin\Auth\LoginController. */
  async login(email: string, password: string) {
    const user = await this.withSecrets({ email });
    const valid = user ? await bcrypt.compare(password, user.password) : false;
    if (!user || !valid) {
      throw new UnauthorizedException(
        'These credentials do not match our records.',
      );
    }

    if (this.activeSecret(user)) {
      return {
        twoFactorRequired: true,
        challengeToken: await this.stepToken(
          { sub: user.id, purpose: '2fa-challenge' },
          '5m',
        ),
      };
    }
    return this.session(user);
  }

  /** TwoFactorController::verifyChallenge - an authenticator code or a one-time recovery code. */
  async challenge(challengeToken: string, code: string) {
    const { sub } = await this.readStep(challengeToken, '2fa-challenge');
    const user = await this.withSecrets({ id: sub });
    const secret = user ? this.activeSecret(user) : null;
    if (!user || !secret)
      throw new UnauthorizedException('Please sign in again.');

    if (verifyTotp(secret, code)) return this.session(user);

    const codes = JSON.parse(
      decrypt(user.twoFactorRecoveryCodes) ?? '[]',
    ) as string[];
    const index = codes.indexOf(code.replace(/\s+/g, '').toUpperCase());
    if (index >= 0) {
      codes.splice(index, 1);
      await this.users.update(user.id, {
        twoFactorRecoveryCodes: encrypt(JSON.stringify(codes)),
      });
      await this.activity.record(
        '2fa_recovery_used',
        { model: 'User', id: user.id, label: user.email },
        `Logged in using a two-factor recovery code (${codes.length} left)`,
      );
      return this.session(user);
    }
    throw unprocessable('Invalid code. Please try again.');
  }

  async status(userId: number) {
    const user = await this.withSecrets({ id: userId });
    return { enabled: Boolean(user && this.activeSecret(user)) };
  }

  /** TwoFactorController::edit - a fresh secret, held in a signed token until confirmed. */
  async setup(userId: number) {
    const user = await this.withSecrets({ id: userId });
    if (!user) throw new UnauthorizedException();
    if (this.activeSecret(user))
      throw unprocessable('Two-factor authentication is already on.');

    const secret = generateSecret();
    const uri = otpauthUri(user.email, secret);
    return {
      secret,
      otpauthUri: uri,
      qrCode: await QRCode.toDataURL(uri, { margin: 1, width: 220 }),
      setupToken: await this.stepToken(
        { sub: user.id, purpose: '2fa-setup', s: encrypt(secret) },
        '15m',
      ),
    };
  }

  /** TwoFactorController::enable - confirm with a code, then hand back recovery codes once. */
  async enable(userId: number, setupToken: string, code: string) {
    const step = await this.readStep(setupToken, '2fa-setup');
    const secret = step.sub === userId ? decrypt(step.s) : null;
    if (!secret)
      throw new UnauthorizedException(
        'This step has expired. Please start again.',
      );
    if (!verifyTotp(secret, code))
      throw unprocessable('Invalid code. Please try again.');

    const recoveryCodes = generateRecoveryCodes();
    await this.users.update(userId, {
      twoFactorSecret: encrypt(secret),
      twoFactorRecoveryCodes: encrypt(JSON.stringify(recoveryCodes)),
      twoFactorEnabledAt: new Date(),
    });
    await this.activity.record(
      '2fa_enabled',
      { model: 'User', id: userId },
      'Enabled two-factor authentication',
    );
    return { enabled: true, recoveryCodes };
  }

  /** TwoFactorController::disable - needs the account password. */
  async disable(userId: number, password: string) {
    const user = await this.withSecrets({ id: userId });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw unprocessable('The password is incorrect.');
    }
    await this.users.update(userId, {
      twoFactorSecret: null,
      twoFactorRecoveryCodes: null,
      twoFactorEnabledAt: null,
    });
    await this.activity.record(
      '2fa_disabled',
      { model: 'User', id: userId },
      'Disabled two-factor authentication',
    );
    return { enabled: false };
  }

  async me(userId: number) {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { role: true },
    });
    if (!user) throw new UnauthorizedException();
    return serializeUser(user);
  }
}
