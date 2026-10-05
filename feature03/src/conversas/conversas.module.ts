import { Module } from '@nestjs/common';
import { IaModule } from '../ia/ia.module';
import { ConversasController } from './conversas.controller';
import { ConversasRepository } from './conversas.repository';
import { ConversasService } from './conversas.service';

@Module({
  imports: [IaModule],
  controllers: [ConversasController],
  providers: [ConversasService, ConversasRepository],
})
export class ConversasModule {}