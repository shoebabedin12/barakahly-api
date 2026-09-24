import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity.js';

function serializeUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role ? { id: user.role.id, name: user.role.name, slug: user.role.slug } : null,
  };
}

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  /** Mirrors LoginRequest::authenticate(): email + bcrypt password check
   * against the `users` table (admin/staff, not `customers`). */
  async login(email: string, password: string) {
    const user = await this.users.findOne({
      where: { email },
      relations: { role: true },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        roleId: true,
        role: { id: true, name: true, slug: true },
      },
    });

    const valid = user ? await bcrypt.compare(password, user.password) : false;

    if (!user || !valid) {
      throw new UnauthorizedException('These credentials do not match our records.');
    }

    const token = await this.jwt.signAsync({ sub: user.id, email: user.email });

    return { token, user: serializeUser(user) };
  }

  async me(userId: number) {
    const user = await this.users.findOne({ where: { id: userId }, relations: { role: true } });

    if (!user) {
      throw new UnauthorizedException();
    }

    return serializeUser(user);
  }
}
