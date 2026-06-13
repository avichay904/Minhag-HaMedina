import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import type { UploadImageResponse } from '@mhm/contracts';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

@Injectable()
export class UploadService {
  constructor(private readonly config: ConfigService) {}

  storeImage(file: Express.Multer.File): UploadImageResponse {
    // Validate MIME type
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Only image/* types are accepted.`,
      );
    }

    // Validate size (belt-and-suspenders; multer limits are also set)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File too large: ${file.size} bytes. Maximum allowed is ${MAX_FILE_SIZE_BYTES} bytes (5 MB).`,
      );
    }

    const uploadsDir = this.resolveUploadsDir();
    this.ensureDir(uploadsDir);

    const ext = extname(file.originalname).toLowerCase() || '.bin';
    const filename = `${randomUUID()}${ext}`;
    const filePath = join(uploadsDir, filename);

    writeFileSync(filePath, file.buffer);

    const publicBase = this.config.get<string>('uploads.publicBaseUrl') ?? '';
    const url = `${publicBase}/uploads/${filename}`;

    return { url };
  }

  /** Resolve uploads directory, supporting both absolute and relative paths. */
  private resolveUploadsDir(): string {
    const dir = this.config.get<string>('uploads.dir') ?? './uploads';
    if (dir.startsWith('/')) return dir;
    // Relative to CWD (process working directory)
    return join(process.cwd(), dir);
  }

  private ensureDir(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}
