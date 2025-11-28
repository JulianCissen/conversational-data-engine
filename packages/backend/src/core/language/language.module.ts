import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LanguageConfigService } from './language.service';

@Module({
  imports: [ConfigModule],
  providers: [LanguageConfigService],
  exports: [LanguageConfigService],
})
export class LanguageModule {}
