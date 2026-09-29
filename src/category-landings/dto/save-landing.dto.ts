import { IsBoolean, IsObject } from 'class-validator';

/** `content` is deep-sanitized by sanitizeLandingContent(), so it's only
 * checked for being an object here. */
export class SaveLandingDto {
  @IsBoolean()
  isActive: boolean;

  @IsObject()
  content: Record<string, unknown>;
}
