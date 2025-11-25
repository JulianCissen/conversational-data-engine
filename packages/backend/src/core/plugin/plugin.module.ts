import { Module } from '@nestjs/common';
import { PluginManagerService } from './plugin.service';

@Module({
  providers: [PluginManagerService],
  exports: [PluginManagerService],
})
export class PluginModule {}
