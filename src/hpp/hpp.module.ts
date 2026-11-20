import { Module } from '@nestjs/common';
import { HppController } from './hpp.controller.js';
import { HppService } from './hpp.service.js';
import { ProductHppController } from './product-hpp.controller.js';

@Module({
  controllers: [HppController, ProductHppController],
  providers: [HppService],
  exports: [HppService],
})
export class HppModule {}
