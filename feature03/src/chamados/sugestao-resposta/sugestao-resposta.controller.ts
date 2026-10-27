import {
  Body,
  Controller,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SugerirRespostaDto } from './dto/sugerir-resposta.dto';
import { SugestaoRespostaService } from './sugestao-resposta.service';

@Controller('chamados')
export class SugestaoRespostaController {
  constructor(private readonly sugestaoResposta: SugestaoRespostaService) {}

  @Post('sugerir-resposta')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('arquivo', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
      },
    }),
  )
  sugerirResposta(
    @Body() dto: SugerirRespostaDto,
    @UploadedFile() arquivo?: Express.Multer.File,
  ) {
    return this.sugestaoResposta.sugerirResposta(dto.texto, arquivo);
  }
}
