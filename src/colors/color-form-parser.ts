import { BadRequestException } from '@nestjs/common';

export interface ColorFormInput {
  name: string;
  hexCode: string | null;
  status: boolean;
  /** true when the client explicitly asked to clear the existing image (no replacement uploaded). */
  removeImage: boolean;
}

/**
 * Multipart/form-data bodies arrive as flat string fields (multer/express
 * don't coerce types), same reasoning as product-form-parser.ts.
 */
export function parseColorForm(body: Record<string, string>): ColorFormInput {
  const name = body.name?.trim();
  if (!name) {
    throw new BadRequestException('The name field is required.');
  }

  const status = parseBool(body.status);
  if (status === null) {
    throw new BadRequestException('The status field is required.');
  }

  const hexCode = body.hexCode && body.hexCode.trim() ? body.hexCode.trim() : null;

  return {
    name,
    hexCode,
    status,
    removeImage: body.removeImage === 'true' || body.removeImage === '1',
  };
}

function parseBool(value: string | undefined): boolean | null {
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return null;
}
