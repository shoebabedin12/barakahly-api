import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface.js';

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_SIZE_BYTES = 4096 * 1024; // banners are wider than product shots

/**
 * Writes into the Laravel app's public storage disk
 * (storage/app/public/category-landings), same convention as the product and
 * color image storage, so `${APP_URL}/storage/category-landings/<file>` works.
 */
export function landingImageMulterOptions(): MulterOptions {
  const destination =
    process.env.LARAVEL_CATEGORY_LANDING_STORAGE_PATH || '../Barakahly/storage/app/public/category-landings';

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
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        callback(new BadRequestException('Image must be a JPG, PNG or WebP file.'), false);
        return;
      }
      callback(null, true);
    },
  };
}
