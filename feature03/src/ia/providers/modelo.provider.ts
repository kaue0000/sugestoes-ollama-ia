export interface GerarRespostaInput {
    mensagem: string;
  format?: 'json';
}

export interface GerarRespostaOutput {
    resposta: string;
    modelo: string;
    tokensEntrada: number;
    tokensSaida: number;
}

export interface GerarStreamInput {
  mensagem: string;
  signal?: AbortSignal;
}

export type ModeloRole = 'system' | 'user' | 'assistant';

export interface ModeloMensagem {
  role: ModeloRole;
  content: string;
}

export interface ConversarInput {
  messages: ModeloMensagem[];
}

export interface AnalisarArquivoInput {
  prompt: string;
  imagemBase64?: string;
  textoDocumento?: string;
}

export interface AnalisarArquivoOutput {
  resposta: string;
  modelo: string;
  tokensEntrada?: number;
  tokensSaida?: number;
}

export abstract class ModeloProvider {
  abstract gerar(input: GerarRespostaInput): Promise<GerarRespostaOutput>;
  abstract gerarStream(input: GerarStreamInput): AsyncIterable<string>;
  abstract conversar(input: ConversarInput): Promise<GerarRespostaOutput>;

  abstract analisarArquivo(
    input: AnalisarArquivoInput,
  ): Promise<AnalisarArquivoOutput>;
}

export const MODELO_PROVIDER = Symbol('MODELO_PROVIDER');