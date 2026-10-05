import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import {
  MODELO_PROVIDER,
  type ModeloProvider,
} from '../../ia/providers/modelo.provider';
import { buildSugestaoRespostaPrompt } from './sugestao-resposta.prompt';

export interface SugestaoRespostaResultado {
  texto: string;
  rascunho: string;
  informacoesAdicionais: string[];
  revisaoHumanaObrigatoria: true;
  modelo: string;
  status: 'RASCUNHO';
}

const MENCIONA_CREDENCIAL =
  /\b(?:senha|password|token|código\s+de\s+autenticação|codigo\s+de\s+autenticacao|código\s+de\s+verificação|codigo\s+de\s+verificacao|secret)\b/i;
const AVISO_CREDENCIAL =
  /\b(?:não|nao|nunca|jamais)\s+(?:compartilhe|compartilhar|informe|informar|envie|enviar|forneça|forneca|fornecer|passe|passar|solicite|solicitar|peça|peca|pedir)\b.{0,50}\b(?:senha|password|token|código\s+de\s+autenticação|codigo\s+de\s+autenticacao|código\s+de\s+verificação|codigo\s+de\s+verificacao|secret)\b/i;

const CONTEUDO_PROIBIDO = [
  /\b(?:senha|password|token|secret)\s*[:=]\s*(?!\[DADO SENSÍVEL OMITIDO\])[^\s,;.]+/i,
  /\b(?:prometemos|garantimos)\b.{0,35}\b(?:resolver|resolvido|prazo|solução|solucao)\b/i,
  /\b(?:será|sera|vai ser)\s+(?:resolvido|solucionado|concluído|concluido|finalizado)\s+(?:em|até|ate|dentro de)\s+\d+\s+(?:dia|dias|hora|horas)\b/i,
  /\b(?:resolução|resolucao)\s+garantida\b/i,
  /https?:\/\//i,
];

function mencionaCredencialInsegura(texto: string): boolean {
  return texto
    .split(/(?<=[.!?;])\s+/)
    .some(
      (frase) =>
        MENCIONA_CREDENCIAL.test(frase) && !AVISO_CREDENCIAL.test(frase),
    );
}

const DECISAO_NAO_AUTORIZADA = [
  /\b(?:seu\s+)?(?:reembolso|acesso|benefício|beneficio)\s+(?:foi|está|esta|será|sera)\s+(?:aprovado|aprovada|autorizado|autorizada|concedido|concedida|liberado|liberada)\b/i,
  /\b(?:aprovamos|autorizamos|concedemos|liberamos|vamos\s+aprovar|iremos\s+aprovar|vamos\s+autorizar|iremos\s+autorizar|vamos\s+liberar|iremos\s+liberar)\b.{0,40}\b(?:reembolso|acesso|benefício|beneficio)\b/i,
];

const PEDIDO_DADOS_ADICIONAIS =
  /\b(?:mais\s+(?:informa(?:ção|ções)|dados|detalhes)|(?:precisa|precisamos|necessita|necessitamos)\s+(?:saber\s+mais|fornecer|enviar|informar)|(?:pode|poderia)\s+(?:fornecer|enviar|informar)|(?:envie|informe|forneça|compartilhe)\b.{0,40}\b(?:dados?|informa(?:ção|ções)|detalhes?|mensagem)|(?:qual|quais|quando|desde\s+quando)\s+(?:sistema|página|pagina|serviço|servico|mensagem|erro|problema|isso|o\s+problema))\b/i;

function removerPedidoDeDadosAdicionais(rascunho: string): string {
  const frases = rascunho.split(/(?<=[.!?])\s+/);
  const frasesSemPedidos = frases.filter(
    (frase) => !PEDIDO_DADOS_ADICIONAIS.test(frase),
  );

  return frasesSemPedidos.length
    ? frasesSemPedidos.join(' ').trim()
    : 'Reconhecemos o problema relatado. A resolução ainda não foi confirmada.';
}

function parseSugestaoResposta(
  resposta: string,
): Pick<
  SugestaoRespostaResultado,
  'rascunho' | 'informacoesAdicionais' | 'revisaoHumanaObrigatoria'
> {
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
      (item): item is string =>
        typeof item === 'string' && Boolean(item.trim()),
    ) ||
    objeto.revisaoHumanaObrigatoria !== true
  ) {
    throw new BadGatewayException(
      'O modelo retornou uma sugestão de resposta inválida',
    );
  }

  const rascunhoSemPedidos = informacoesAdicionais.length
    ? rascunho.trim()
    : removerPedidoDeDadosAdicionais(rascunho.trim());
  const textos = [rascunhoSemPedidos, ...informacoesAdicionais];
  if (
    informacoesAdicionais.some((item) => MENCIONA_CREDENCIAL.test(item)) ||
    textos.some(
      (texto) =>
        mencionaCredencialInsegura(texto) ||
        CONTEUDO_PROIBIDO.some((regra) => regra.test(texto)) ||
        DECISAO_NAO_AUTORIZADA.some((regra) => regra.test(texto)),
    )
  ) {
    throw new BadGatewayException(
      'O modelo retornou conteúdo proibido na sugestão de resposta',
    );
  }

  return {
    rascunho: rascunhoSemPedidos,
    informacoesAdicionais: informacoesAdicionais.map((item) => item.trim()),
    revisaoHumanaObrigatoria: true,
  };
}

@Injectable()
export class SugestaoRespostaService {
  constructor(
    @Inject(MODELO_PROVIDER)
    private readonly modelo: ModeloProvider,
  ) {}

  async sugerirResposta(
    textoOriginal: string,
  ): Promise<SugestaoRespostaResultado> {
    const texto = textoOriginal.trim();
    const resultado = await this.modelo.gerar({
      mensagem: buildSugestaoRespostaPrompt(texto),
      format: 'json',
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
