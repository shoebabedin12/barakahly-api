import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface.js';
import { diskStorage } from 'multer';

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.svg',
  '.ico',
]);

/**
 * Root of the public uploads disk (Laravel's storage/app/public), served at
 * /storage. PUBLIC_STORAGE_PATH wins; otherwise it's the parent of the
 * per-folder product path the app was already configured with.
 */
export function publicStorageRoot() {
  if (process.env.PUBLIC_STORAGE_PATH) return process.env.PUBLIC_STORAGE_PATH;
  if (process.env.LARAVEL_PUBLIC_STORAGE_PATH)
    return dirname(process.env.LARAVEL_PUBLIC_STORAGE_PATH);
  return '../Barakahly/storage/app/public';
}

/** Multer options writing images to `<root>/<folder>/<uuid>.<ext>`. */
export function publicImageUpload(
  folder: string,
  maxKb = 2048,
  extensions: string[] = [...IMAGE_EXTENSIONS],
): MulterOptions {
  const allowed = new Set(extensions);
  return {
    storage: diskStorage({
      destination: join(publicStorageRoot(), folder),
      filename: (_req, file, callback) => {
        callback(
          null,
          `${randomUUID()}${extname(file.originalname).toLowerCase()}`,
        );
      },
    }),
    limits: { fileSize: maxKb * 1024 },
    fileFilter: (_req, file, callback) => {
      if (allowed.has(extname(file.originalname).toLowerCase()))
        callback(null, true);
      else
        callback(
          new BadRequestException(
            `Please upload a ${[...allowed].map((ext) => ext.slice(1).toUpperCase()).join(', ')} image.`,
          ),
          false,
        );
    },
  };
}

/** The path stored in the database for an uploaded file ("banners/<file>"). */
export function storedPath(folder: string, file: Express.Multer.File) {
  return `${folder}/${file.filename}`;
}

/** Storage::disk('public')->delete($path) - ignores missing files. */
export async function deletePublicFile(path: string | null | undefined) {
  if (!path) return;
  const root = normalize(publicStorageRoot());
  const target = normalize(join(root, path));
  if (!target.startsWith(root)) return;
  await unlink(target).catch(() => undefined);
}
