import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { IaController } from './ia.controller';
import { IaService } from './ia.service';
import { MODELO_PROVIDER } from './providers/modelo.provider';
import { OllamaProvider } from './providers/ollama.provider';

@Module({
  imports: [HttpModule],
  controllers: [IaController],
  providers: [
    IaService,
    {
      provide: MODELO_PROVIDER,
      useClass: OllamaProvider,
    },
  ],
  exports: [MODELO_PROVIDER],
})
export class IaModule {}