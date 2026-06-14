import { Module } from '@nestjs/common';
import { PowService } from './pow.service';

@Module({
  providers: [PowService],
  exports: [PowService],
})
export class PowModule {}
