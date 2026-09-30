import {
  BadRequestException,
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MODELO_PROVIDER,
  type ModeloProvider,
  type ModeloMensagem,
} from '../ia/providers/modelo.provider';
import { selecionarHistorico } from './contexto.policy';
import { ConversasRepository } from './conversas.repository';

const SESSION_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class ConversasService {
  private readonly processing = new Set<string>();

  constructor(
    private readonly repository: ConversasRepository,
    @Inject(MODELO_PROVIDER)
    private readonly model: ModeloProvider,
  ) {}

  criar() {
    return this.repository.criar();
  }

  async enviar(sessionId: string, rawMessage: string) {
    const conversation = this.repository.buscar(sessionId);
    if (!conversation) throw new NotFoundException('Sessão não encontrada');

    const inactiveFor = Date.now() - conversation.ultimoAcessoEm.getTime();
    if (inactiveFor > SESSION_TTL_MS) {
      this.repository.excluir(sessionId);
      throw new GoneException('Sessão expirada');
    }

    if (this.processing.has(sessionId)) {
      throw new ConflictException('Já existe uma geração nesta sessão');
    }

    const message = rawMessage.trim();
    if (!message) throw new BadRequestException('Mensagem vazia');

    const history = selecionarHistorico(conversation.mensagens);
    const messages: ModeloMensagem[] = [
      {
        role: 'system',
        content: 'Responda de forma objetiva e não invente informações.',
      },
      ...history,
      { role: 'user', content: message },
    ];

    this.processing.add(sessionId);

    try {
      const result = await this.model.conversar({ messages });
      const now = new Date();

      this.repository.adicionarPar(
        sessionId,
        { role: 'user', content: message, criadaEm: now },
        { role: 'assistant', content: result.resposta, criadaEm: now },
      );

      return {
        sessionId,
        resposta: result.resposta,
        modelo: result.modelo,
        historicoUtilizado: history.length,
      };
    } finally {
      this.processing.delete(sessionId);
    }
  }
}