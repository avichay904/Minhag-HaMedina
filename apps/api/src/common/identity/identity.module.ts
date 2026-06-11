import { Global, Module } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { DevVerifier } from './verifiers/dev.verifier';
import { GoogleVerifier } from './verifiers/google.verifier';
import { AppleVerifier } from './verifiers/apple.verifier';

@Global()
@Module({
  providers: [IdentityService, DevVerifier, GoogleVerifier, AppleVerifier],
  exports: [IdentityService],
})
export class IdentityModule {}
