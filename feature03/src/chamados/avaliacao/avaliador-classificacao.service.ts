import { Injectable } from '@nestjs/common';
import { ChamadosService } from '../chamados.service';
import { CASOS_AVALIACAO } from './casos-avaliacao';

@Injectable()
export class AvaliadorClassificacaoService {
  constructor(private readonly chamados: ChamadosService) {}

  async executar() {
    const resultados = [];

    for (const caso of CASOS_AVALIACAO) {
      const inicio = performance.now();

      try {
        const resposta = await this.chamados.classificar(caso.texto);

        resultados.push({
          ...caso,
          obtido: resposta.categoria,
          formatoValido: true,
          correto: resposta.categoria === caso.esperado,
          duracaoMs: Math.round(performance.now() - inicio),
          erro: null,
        });
      } catch (error) {
        resultados.push({
          ...caso,
          obtido: null,
          formatoValido: false,
          correto: false,
          duracaoMs: Math.round(performance.now() - inicio),
          erro: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }

    const total = resultados.length;
    const corretos = resultados.filter((item) => item.correto).length;
    const formatosValidos = resultados.filter(
      (item) => item.formatoValido,
    ).length;

    return {
      modelo: process.env.OLLAMA_MODEL ?? 'não informado',
      total,
      acuracia: corretos / total,
      conformidadeFormato: formatosValidos / total,
      resultados,
    };
  }
}