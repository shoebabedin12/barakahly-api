import { BadRequestException } from '@nestjs/common';

export interface VariantInput {
  id?: number;
  colorId: number | null;
  sizeId: number | null;
  sku: string | null;
  price: number | null;
  discountPrice: number | null;
  stock: number;
  /** Index into the multipart `variantImages` files array, when this row got a new image. */
  imageIndex: number | null;
  /** An already-uploaded product image path to reuse, instead of uploading a duplicate file. */
  reuseImagePath: string | null;
  /** True when the client explicitly cleared the existing image without picking a replacement. */
  removeImage: boolean;
}

export interface ProductFormInput {
  categoryId: number;
  brandId: number | null;
  name: string;
  sourceReference: string | null;
  price: number;
  discountPrice: number | null;
  stock: number;
  description: string | null;
  status: boolean;
  variants: VariantInput[];
}

/**
 * Multipart/form-data bodies arrive as flat string fields (multer/express
 * don't coerce types), and the variants array is sent as a single JSON-
 * encoded field. This mirrors ProductRequest's validation rules while
 * doing that parsing by hand, rather than fighting class-validator's
 * DTO binding over a multipart body.
 */
export function parseProductForm(body: Record<string, string>): ProductFormInput {
  const categoryId = requiredInt(body.categoryId, 'category_id');
  const name = requiredString(body.name, 'name');
  const price = requiredDecimal(body.price, 'price');
  const stock = requiredInt(body.stock, 'stock');
  const status = parseBool(body.status);

  if (status === null) {
    throw new BadRequestException('The status field is required.');
  }

  let variants: VariantInput[] = [];

  if (body.variants) {
    let raw: unknown;
    try {
      raw = JSON.parse(body.variants);
    } catch {
      throw new BadRequestException('The variants field must be valid JSON.');
    }

    if (!Array.isArray(raw)) {
      throw new BadRequestException('The variants field must be an array.');
    }

    variants = raw.map((row: Record<string, unknown>) => ({
      id: row.id ? Number(row.id) : undefined,
      colorId: row.colorId ? Number(row.colorId) : null,
      sizeId: row.sizeId ? Number(row.sizeId) : null,
      sku: typeof row.sku === 'string' && row.sku ? row.sku : null,
      price: row.price !== undefined && row.price !== '' && row.price !== null ? Number(row.price) : null,
      discountPrice:
        row.discountPrice !== undefined && row.discountPrice !== '' && row.discountPrice !== null
          ? Number(row.discountPrice)
          : null,
      stock: row.stock !== undefined && row.stock !== '' ? Number(row.stock) : 0,
      imageIndex:
        row.imageIndex !== undefined && row.imageIndex !== null && row.imageIndex !== ''
          ? Number(row.imageIndex)
          : null,
      reuseImagePath: typeof row.reuseImagePath === 'string' && row.reuseImagePath ? row.reuseImagePath : null,
      removeImage: row.removeImage === true,
    }));
  }

  return {
    categoryId,
    brandId: optionalInt(body.brandId),
    name,
    sourceReference: optionalString(body.sourceReference),
    price,
    discountPrice: optionalDecimal(body.discountPrice),
    stock,
    description: optionalString(body.description),
    status,
    variants,
  };
}

function requiredString(value: string | undefined, field: string): string {
  if (!value || !value.trim()) {
    throw new BadRequestException(`The ${field} field is required.`);
  }
  return value.trim();
}

function optionalString(value: string | undefined): string | null {
  return value && value.trim() ? value.trim() : null;
}

function requiredInt(value: string | undefined, field: string): number {
  const n = value !== undefined ? Number(value) : NaN;
  if (value === undefined || value === '' || !Number.isInteger(n) || n < 0) {
    throw new BadRequestException(`The ${field} field must be a valid non-negative integer.`);
  }
  return n;
}

function optionalInt(value: string | undefined): number | null {
  if (value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function requiredDecimal(value: string | undefined, field: string): number {
  const n = value !== undefined ? Number(value) : NaN;
  if (value === undefined || value === '' || Number.isNaN(n) || n < 0) {
    throw new BadRequestException(`The ${field} field must be a valid non-negative number.`);
  }
  return n;
}

function optionalDecimal(value: string | undefined): number | null {
  if (value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function parseBool(value: string | undefined): boolean | null {
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return null;
}
