import { Module } from '@nestjs/common';
import { OpenApiController } from './openapi.controller.js';
import { OpenApiService } from './openapi.service.js';

@Module({
  controllers: [OpenApiController],
  providers: [OpenApiService],
  exports: [OpenApiService],
})
export class OpenApiModule {}
