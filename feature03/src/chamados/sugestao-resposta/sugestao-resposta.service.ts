import {
  BadRequestException,
  BadGatewayException,
  Inject,
  Injectable,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import {
  MODELO_PROVIDER,
  type ModeloProvider,
} from '../../ia/providers/modelo.provider';
import {
  buildSugestaoRespostaPrompt,
  protegerDadosSensiveis,
} from './sugestao-resposta.prompt';
import pdfParse from 'pdf-parse';

const TIPOS_IMAGEM = new Set(['image/png', 'image/jpeg', 'image/webp']);
const LIMITE_CARACTERES_DOCUMENTO = 20000;

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
const PERGUNTA_SEM_INFORMACOES_ADICIONAIS =
  'O modelo retornou uma pergunta sem informações adicionais correspondentes';
const TEMPO_INVENTADO = 'O modelo retornou tempo inventado';
const PADROES_TEMPO =
  /\b(?:desde\s+ontem|ontem|hoje|anteontem|semana\s+passada|mês\s+passado|ano\s+passado|há\s+\d+\s+dias?|nos\s+últimos\s+\d+\s+dias?|nos\s+últimos\s+\d+\s+meses?)\b/i;

function removerPedidoDeDadosAdicionais(rascunho: string): string {
  const frases = rascunho.split(/(?<=[.!?])\s+/);
  const frasesSemPedidos = frases.filter(
    (frase) => !PEDIDO_DADOS_ADICIONAIS.test(frase),
  );

  return frasesSemPedidos.length
    ? frasesSemPedidos.join(' ').trim()
    : 'Reconhecemos o problema relatado. A resolução ainda não foi confirmada.';
}

function mascararDadosSensiveis(texto: string): string {
  if (!/\b(?:senha|password|token|secret|código\s+de\s+verificação|codigo\s+de\s+verificacao|código\s+de\s+autenticação|codigo\s+de\s+autenticacao)\b/i.test(texto)) {
    return texto;
  }

  const mascarado = texto.replace(
    /\b(?:senha|password|token|secret|código\s+de\s+verificação|codigo\s+de\s+verificacao|código\s+de\s+autenticação|codigo\s+de\s+autenticacao)\b[\s\S]{0,80}(?=[.!?]|$)/gi,
    '[DADO SENSÍVEL OMITIDO]',
  );

  if (/[.!?]$/.test(texto) && !/[.!?]$/.test(mascarado)) {
    return `${mascarado}${texto.at(-1)}`;
  }

  return mascarado;
}

function parseSugestaoResposta(
  resposta: string,
  textoOriginal: string,
  verificarTempo: boolean = true,
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

  const rascunhoNormalizado = rascunho.trim();
  const rascunhoSemPedidos = informacoesAdicionais.length
    ? rascunhoNormalizado
    : removerPedidoDeDadosAdicionais(rascunhoNormalizado);
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

  if (
    verificarTempo &&
    PADROES_TEMPO.test(rascunhoNormalizado) &&
    !PADROES_TEMPO.test(textoOriginal)
  ) {
    throw new BadGatewayException(TEMPO_INVENTADO);
  }

  if (!informacoesAdicionais.length && rascunhoNormalizado.includes('?')) {
    throw new BadGatewayException(PERGUNTA_SEM_INFORMACOES_ADICIONAIS);
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
    @Inject(MODELO_PROVIDER) private readonly modelo: ModeloProvider) {}

  async sugerirResposta(
    textoOriginal?: string,
    arquivo?: Express.Multer.File,
  ): Promise<SugestaoRespostaResultado> {
    const texto = textoOriginal?.trim() ?? '';

    if (!texto && !arquivo) {
      throw new BadRequestException(
        'Informe o texto do chamado ou envie um arquivo',
      );
    }

    const mensagem = buildSugestaoRespostaPrompt(
      texto ||
        'O solicitante enviou apenas o arquivo anexado como descrição do chamado. Use o conteúdo do arquivo como contexto.',
    );
    let textoDocumento = '';

    if (arquivo) {
      if (TIPOS_IMAGEM.has(arquivo.mimetype)) {
        return this.sugerirComArquivo(
          mensagem,
          texto,
          texto,
          arquivo.buffer.toString('base64'),
        );
      }

      if (arquivo.mimetype === 'text/plain') {
        textoDocumento = arquivo.buffer.toString('utf8').trim();
      } else if (arquivo.mimetype === 'application/pdf') {
        try {
          textoDocumento = (await pdfParse(arquivo.buffer)).text.trim();
        } catch {
          throw new BadRequestException('Não foi possível ler o arquivo PDF');
        }
      } else {
        throw new UnsupportedMediaTypeException(
          'Envie PNG, JPEG, WebP, PDF ou TXT',
        );
      }

      if (!textoDocumento) {
        throw new BadRequestException('O documento enviado está vazio');
      }

      if (textoDocumento.length > LIMITE_CARACTERES_DOCUMENTO) {
        throw new BadRequestException(
          'O documento ultrapassa o limite de caracteres',
        );
      }

      textoDocumento = protegerDadosSensiveis(textoDocumento);

      return this.sugerirComArquivo(
        mensagem,
        texto,
        `${texto}\n${textoDocumento}`,
        undefined,
        textoDocumento,
      );
    }

    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      const resultado = await this.modelo.gerar({ mensagem, format: 'json' });

      try {
        const sugestao = parseSugestaoResposta(resultado.resposta, texto);

        return {
          texto: mascararDadosSensiveis(texto),
          ...sugestao,
          modelo: resultado.modelo,
          status: 'RASCUNHO',
        };
      } catch (error) {
        if (
          tentativa === 0 &&
          error instanceof BadGatewayException &&
          error.message === PERGUNTA_SEM_INFORMACOES_ADICIONAIS
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new BadGatewayException(PERGUNTA_SEM_INFORMACOES_ADICIONAIS);
  }

  private async sugerirComArquivo(
    mensagem: string,
    textoOriginal: string,
    textoParaValidacao: string,
    imagemBase64?: string,
    documento?: string,
  ): Promise<SugestaoRespostaResultado> {
    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      const resultado = await this.modelo.analisarArquivo({
        prompt: mensagem,
        ...(imagemBase64 ? { imagemBase64 } : {}),
        ...(documento ? { textoDocumento: documento } : {}),
        format: 'json',
      });

      try {
        const sugestao = parseSugestaoResposta(
          resultado.resposta,
          textoParaValidacao,
          !imagemBase64,
        );

        return {
          texto: mascararDadosSensiveis(textoOriginal),
          ...sugestao,
          modelo: resultado.modelo,
          status: 'RASCUNHO',
        };
      } catch (error) {
        if (
          tentativa === 0 &&
          error instanceof BadGatewayException &&
          error.message === PERGUNTA_SEM_INFORMACOES_ADICIONAIS
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new BadGatewayException(PERGUNTA_SEM_INFORMACOES_ADICIONAIS);
  }
}
