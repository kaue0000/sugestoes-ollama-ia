import { writeFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { AvaliadorClassificacaoService } from './avaliador-classificacao.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const avaliador = app.get(AvaliadorClassificacaoService);
    const relatorio = await avaliador.executar();

    await writeFile(
      'resultado-avaliacao.json',
      JSON.stringify(relatorio, null, 2),
    );

    console.table(relatorio.resultados);
    console.log({
      total: relatorio.total,
      acuracia: relatorio.acuracia,
      conformidadeFormato: relatorio.conformidadeFormato,
    });
  } finally {
    await app.close();
  }
}

void main();