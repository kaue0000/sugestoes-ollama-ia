import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Conversa, MensagemArmazenada } from './conversa.type';

@Injectable()
export class ConversasRepository {
  private readonly items = new Map<string, Conversa>();

  criar(): Conversa {
    const now = new Date();
    const conversa: Conversa = {
      id: randomUUID(),
      mensagens: [],
      criadaEm: now,
      ultimoAcessoEm: now,
    };

    this.items.set(conversa.id, conversa);
    return conversa;
  }

  buscar(id: string): Conversa | undefined {
    return this.items.get(id);
  }

  adicionarPar(
    id: string,
    user: MensagemArmazenada,
    assistant: MensagemArmazenada,
  ): void {
    const conversa = this.items.get(id);
    if (!conversa) return;

    conversa.mensagens.push(user, assistant);
    conversa.ultimoAcessoEm = new Date();
  }

  excluir(id: string): boolean {
    return this.items.delete(id);
  }
}