import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UploadImageResponse } from '@mhm/contracts';

import { Public } from '../../common/decorators/auth.decorators';
import { AdminGuard } from '../../common/guards/admin.guard';
import { UploadService } from './upload.service';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB — also enforced in UploadService

@ApiTags('uploads')
@Controller('uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * POST /uploads/image
   *
   * Admin-only. Accepts a multipart/form-data file field named `file`.
   * Returns the public URL where the stored image can be accessed.
   */
  @Public()
  @UseGuards(AdminGuard)
  @Post('image')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: undefined, // undefined → multer defaults to memory storage
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  @ApiOperation({ summary: 'Upload an image (admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({ description: 'The public URL of the stored image' })
  uploadImage(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): UploadImageResponse {
    if (!file) {
      throw new BadRequestException(
        'No file provided. Send a multipart/form-data request with a "file" field.',
      );
    }
    return this.uploadService.storeImage(file);
  }
}
