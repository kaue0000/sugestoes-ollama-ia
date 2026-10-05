import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import {
  MODELO_PROVIDER,
  type ModeloProvider,
} from '../ia/providers/modelo.provider';
import { isChamadoCategoria, type ChamadoCategoria } from './chamado-categoria';
import { buildClassificacaoPrompt } from './classificacao.prompt';

export interface ClassificacaoResultado {
  texto: string;
  categoria: ChamadoCategoria;
  modelo: string;
}

@Injectable()
export class ChamadosService {
  constructor(
    @Inject(MODELO_PROVIDER)
    private readonly modelo: ModeloProvider,
  ) {}

  async classificar(textoOriginal: string): Promise<ClassificacaoResultado> {
    const texto = textoOriginal.trim();
    const prompt = buildClassificacaoPrompt(texto);
    const resultado = await this.modelo.gerar({ mensagem: prompt });
    const categoria = resultado.resposta.trim().toUpperCase();

    if (!isChamadoCategoria(categoria)) {
      throw new BadGatewayException('O modelo retornou uma categoria inválida');
    }

    return {
      texto,
      categoria,
      modelo: resultado.modelo,
    };
  }
}
