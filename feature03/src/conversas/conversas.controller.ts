import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { EnviarMensagemDto } from './dto/enviar-mensagem.dto';
import { ConversasRepository } from './conversas.repository';
import { ConversasService } from './conversas.service';

@Controller('conversas')
export class ConversasController {
  constructor(
    private readonly service: ConversasService,
    private readonly repository: ConversasRepository,
  ) {}

  @Post()
  criar() {
    const conversation = this.service.criar();
    return { sessionId: conversation.id, expiraEmMinutos: 30 };
  }

  @Post(':sessionId/mensagens')
  enviar(
    @Param('sessionId') sessionId: string,
    @Body() dto: EnviarMensagemDto,
  ) {
    return this.service.enviar(sessionId, dto.mensagem);
  }

  @Get(':sessionId/mensagens')
  listar(@Param('sessionId') sessionId: string) {
    return this.repository.buscar(sessionId)?.mensagens ?? [];
  }

  @Delete(':sessionId')
  excluir(@Param('sessionId') sessionId: string) {
    return { removida: this.repository.excluir(sessionId) };
  }
}