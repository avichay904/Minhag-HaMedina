import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';

import { PrismaModule } from './common/prisma/prisma.module';
import { IdentityModule } from './common/identity/identity.module';
import { AuthGuard } from './common/guards/auth.guard';
import { TrustContextInterceptor } from './common/interceptors/trust-context.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

// Feature modules — pre-registered so worker agents only fill in their own folder.
import { AuthModule } from './modules/auth/auth.module';
import { ExternalModule } from './modules/external/external.module';
import { SurveyModule } from './modules/survey/survey.module';
import { CycleModule } from './modules/cycle/cycle.module';
import { QuestionModule } from './modules/question/question.module';
import { ResponseModule } from './modules/response/response.module';
import { RespondentModule } from './modules/respondent/respondent.module';
import { ResultsModule } from './modules/results/results.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { AntifraudModule } from './modules/antifraud/antifraud.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: ['.env'],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: (config.get<number>('rateLimit.ttlSec') ?? 60) * 1000,
            limit: config.get<number>('rateLimit.max') ?? 120,
          },
        ],
      }),
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: config.get<string>('jwt.expiresIn') ?? '30d' },
      }),
    }),
    PrismaModule,
    IdentityModule,
    AuthModule,
    ExternalModule,
    SurveyModule,
    CycleModule,
    QuestionModule,
    ResponseModule,
    RespondentModule,
    ResultsModule,
    GamificationModule,
    AntifraudModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: TrustContextInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
