import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import {
  MODELO_PROVIDER,
  type ModeloProvider,
} from '../ia/providers/modelo.provider';
import {
  isChamadoCategoria,
  type ChamadoCategoria,
} from './chamado-categoria';
import { buildClassificacaoPrompt } from './classificacao.prompt';
import { buildSugestaoRespostaPrompt } from './sugestao-resposta.prompt';

export interface ClassificacaoResultado {
  texto: string;
  categoria: ChamadoCategoria;
  modelo: string;
}

export interface SugestaoRespostaResultado {
  texto: string;
  rascunho: string;
  informacoesAdicionais: string[];
  revisaoHumanaObrigatoria: true;
  modelo: string;
  status: 'RASCUNHO';
}

const CONTEUDO_PROIBIDO = [
  /\b(?:senha|password|token|código\s+de\s+autenticação|codigo\s+de\s+autenticacao|código\s+de\s+verificação|codigo\s+de\s+verificacao|secret)\b/i,
  /\b(?:prometemos|garantimos|garantia|será\s+resolvido|sera\s+resolvido|resolução\s+garantida|resolucao\s+garantida|prazo\s+de|até\s+\d+\s+(?:dia|dias|hora|horas)|ate\s+\d+\s+(?:dia|dias|hora|horas))\b/i,
  /\b(?:reembolso|acesso|aprovação|aprovado|aprovada|autorizado|autorizada)\b.{0,35}\b(?:aprovado|aprovada|confirmado|confirmada|concedido|concedida|autorizado|autorizada|liberado|liberada)\b/i,
  /\b(?:aprovado|aprovada|confirmado|confirmada|concedido|concedida|autorizado|autorizada|liberado|liberada)\b.{0,35}\b(?:reembolso|acesso|aprovação)\b/i,
  /https?:\/\//i,
];

const DECISAO_NAO_AUTORIZADA = [
  /\b(?:aprov(?:e|ar|ado|ada)|autorizar|conceder|liberar)\b.{0,40}\b(?:reembolso|acesso|benefício|beneficio)\b/i,
  /\b(?:reembolso|acesso)\b.{0,40}\b(?:aprov(?:e|ar)|autorizar|conceder|liberar)\b/i,
];

function parseSugestaoResposta(
  resposta: string,
): Pick<SugestaoRespostaResultado, 'rascunho' | 'informacoesAdicionais' | 'revisaoHumanaObrigatoria'> {
  let valor: unknown;

  try {
    valor = JSON.parse(resposta);
  } catch {
    throw new BadGatewayException(
      'O modelo retornou uma sugestão de resposta inválida',
    );
  }

  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    throw new BadGatewayException(
      'O modelo retornou uma sugestão de resposta inválida',
    );
  }

  const objeto = valor as Record<string, unknown>;
  const rascunho = objeto.rascunho;
  const informacoesAdicionais = objeto.informacoesAdicionais;
  const camposEsperados = [
    'rascunho',
    'informacoesAdicionais',
    'revisaoHumanaObrigatoria',
  ];

  if (
    Object.keys(objeto).some((campo) => !camposEsperados.includes(campo)) ||
    typeof rascunho !== 'string' ||
    !rascunho.trim() ||
    !Array.isArray(informacoesAdicionais) ||
    informacoesAdicionais.length > 3 ||
    !informacoesAdicionais.every(
      (item): item is string => typeof item === 'string' && Boolean(item.trim()),
    ) ||
    objeto.revisaoHumanaObrigatoria !== true
  ) {
    throw new BadGatewayException(
      'O modelo retornou uma sugestão de resposta inválida',
    );
  }

  const textos = [rascunho, ...informacoesAdicionais];
  if (
    textos.some(
      (texto) =>
        CONTEUDO_PROIBIDO.some((regra) => regra.test(texto)) ||
        DECISAO_NAO_AUTORIZADA.some((regra) => regra.test(texto)),
    )
  ) {
    throw new BadGatewayException(
      'O modelo retornou conteúdo proibido na sugestão de resposta',
    );
  }

  return {
    rascunho: rascunho.trim(),
    informacoesAdicionais: informacoesAdicionais.map((item) => item.trim()),
    revisaoHumanaObrigatoria: true,
  };
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
      throw new BadGatewayException(
        'O modelo retornou uma categoria inválida',
      );
    }

    return {
      texto,
      categoria,
      modelo: resultado.modelo,
    };
  }

  async sugerirResposta(
    textoOriginal: string,
  ): Promise<SugestaoRespostaResultado> {
    const texto = textoOriginal.trim();
    const resultado = await this.modelo.gerar({
      mensagem: buildSugestaoRespostaPrompt(texto),
    });
    const sugestao = parseSugestaoResposta(resultado.resposta);

    return {
      texto,
      ...sugestao,
      modelo: resultado.modelo,
      status: 'RASCUNHO',
    };
  }
}
