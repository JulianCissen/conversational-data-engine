import { Module } from '@nestjs/common';
import { BlueprintService } from './blueprint.service';

@Module({
  providers: [BlueprintService],
  exports: [BlueprintService],
})
export class BlueprintModule {}
