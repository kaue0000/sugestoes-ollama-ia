import { Module } from '@nestjs/common';
import { IaModule } from '../../ia/ia.module';
import { SugestaoRespostaController } from './sugestao-resposta.controller';
import { SugestaoRespostaService } from './sugestao-resposta.service';

@Module({
  imports: [IaModule],
  controllers: [SugestaoRespostaController],
  providers: [SugestaoRespostaService],
})
export class SugestaoRespostaModule {}
