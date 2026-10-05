import { Body, Controller, Post } from '@nestjs/common';
import { SugerirRespostaDto } from './dto/sugerir-resposta.dto';
import { SugestaoRespostaService } from './sugestao-resposta.service';

@Controller('chamados')
export class SugestaoRespostaController {
  constructor(private readonly sugestaoResposta: SugestaoRespostaService) {}

  @Post('sugerir-resposta')
  sugerirResposta(@Body() dto: SugerirRespostaDto) {
    return this.sugestaoResposta.sugerirResposta(dto.texto);
  }
}
