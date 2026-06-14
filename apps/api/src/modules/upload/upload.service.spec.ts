import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';

// We mock fs so no actual files are written during tests.
// Hoisted vi.mock is resolved before imports, but the module object is accessed
// via the return value of vi.mock to avoid top-level await issues.
vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Import the mocked fs module (synchronous – the mock is already registered).
import * as fs from 'node:fs';

import { UploadService } from './upload.service';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeMockFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'photo.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('fake-image-data'),
    destination: '',
    filename: '',
    path: '',
    stream: null as unknown as NodeJS.ReadableStream,
    ...overrides,
  };
}

function buildConfigMock(uploadsDir = './uploads', publicBaseUrl = '') {
  return {
    get: vi.fn((key: string) => {
      if (key === 'uploads.dir') return uploadsDir;
      if (key === 'uploads.publicBaseUrl') return publicBaseUrl;
      return undefined;
    }),
  };
}

async function buildService(
  configMock: ReturnType<typeof buildConfigMock> = buildConfigMock(),
): Promise<UploadService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      UploadService,
      { provide: ConfigService, useValue: configMock },
    ],
  }).compile();
  return module.get(UploadService);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('UploadService.storeImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: directory already exists, so mkdirSync should NOT be called.
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  it('returns a url for a valid JPEG file', async () => {
    const service = await buildService();
    const result = service.storeImage(makeMockFile());
    expect(result.url).toMatch(/\/uploads\/.+\.jpg$/);
  });

  it('includes publicBaseUrl in the returned url when configured', async () => {
    const service = await buildService(buildConfigMock('./uploads', 'https://example.com'));
    const result = service.storeImage(makeMockFile());
    expect(result.url.startsWith('https://example.com/uploads/')).toBe(true);
  });

  it('uses a UUID-based filename (unique per call)', async () => {
    const service = await buildService();
    const r1 = service.storeImage(makeMockFile());
    const r2 = service.storeImage(makeMockFile());
    expect(r1.url).not.toBe(r2.url);
  });

  it('preserves the file extension from originalname', async () => {
    const service = await buildService();
    const result = service.storeImage(
      makeMockFile({ originalname: 'banner.png', mimetype: 'image/png' }),
    );
    expect(result.url).toMatch(/\.png$/);
  });

  it('rejects files with a non-image MIME type', async () => {
    const service = await buildService();
    const file = makeMockFile({ mimetype: 'application/pdf', originalname: 'doc.pdf' });
    expect(() => service.storeImage(file)).toThrow(BadRequestException);
  });

  it('rejects files that exceed 5 MB', async () => {
    const service = await buildService();
    const oversized = makeMockFile({ size: 6 * 1024 * 1024 });
    expect(() => service.storeImage(oversized)).toThrow(BadRequestException);
  });

  it('creates the uploads directory when it does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const service = await buildService();
    service.storeImage(makeMockFile());

    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });

  it('accepts files with image/webp MIME type', async () => {
    const service = await buildService();
    const result = service.storeImage(
      makeMockFile({ mimetype: 'image/webp', originalname: 'image.webp' }),
    );
    expect(result.url).toMatch(/\.webp$/);
  });
});
