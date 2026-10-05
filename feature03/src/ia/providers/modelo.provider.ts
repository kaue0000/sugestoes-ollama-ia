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

export interface ModeloProvider {
  gerar(input: GerarRespostaInput): Promise<GerarRespostaOutput>;
  gerarStream(input: GerarStreamInput): AsyncIterable<string>;
  conversar(input: ConversarInput): Promise<GerarRespostaOutput>;
}

export const MODELO_PROVIDER = Symbol('MODELO_PROVIDER');