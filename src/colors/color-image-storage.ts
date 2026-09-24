import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { diskStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface.js';

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_SIZE_BYTES = 2048 * 1024; // 2048 KB, same limit as product images

/**
 * Writes into the Laravel app's public storage disk (storage/app/public/colors),
 * same convention as product-image-storage.ts, so both backends read/write the
 * same files and the storefront's `${APP_URL}/storage/colors/<file>` URLs work
 * regardless of which backend served the upload.
 */
export function colorImageMulterOptions(): MulterOptions {
  const destination =
    process.env.LARAVEL_COLOR_STORAGE_PATH ?? '../barakahly-commerce/storage/app/public/colors';

  return {
    storage: diskStorage({
      destination,
      filename: (_req, file, callback) => {
        callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
      },
    }),
    limits: { fileSize: MAX_SIZE_BYTES },
    fileFilter: (_req, file, callback) => {
      const ext = extname(file.originalname).toLowerCase();
      callback(null, ALLOWED_EXTENSIONS.has(ext));
    },
  };
}
