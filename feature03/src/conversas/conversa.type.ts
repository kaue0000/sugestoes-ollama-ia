import type { ModeloMensagem } from '../ia/providers/modelo.provider';

export interface MensagemArmazenada extends ModeloMensagem {
  criadaEm: Date;
}

export interface Conversa {
  id: string;
  mensagens: MensagemArmazenada[];
  criadaEm: Date;
  ultimoAcessoEm: Date;
}