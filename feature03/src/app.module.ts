import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChamadosModule } from './chamados/chamados.module';
import { SugestaoRespostaModule } from './chamados/sugestao-resposta/sugestao-resposta.module';
import { IaModule } from './ia/ia.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    IaModule,
    ChamadosModule,
    SugestaoRespostaModule,
  ],
})
export class AppModule {}
