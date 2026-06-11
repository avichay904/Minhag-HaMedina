import { Module } from '@nestjs/common';

import { QUESTION_SERVICE } from '../../common/facades';

import { QuestionController } from './question.controller';
import { QuestionService } from './question.service';

@Module({
  controllers: [QuestionController],
  providers: [
    QuestionService,
    { provide: QUESTION_SERVICE, useExisting: QuestionService },
  ],
  exports: [QUESTION_SERVICE],
})
export class QuestionModule {}
