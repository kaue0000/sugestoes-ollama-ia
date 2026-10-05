import { ResponderDto } from './dto/responder.dto';
import { IaService } from './ia.service';
import {
  Body,
  Controller,
  HttpCode,
  Post,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Response } from 'express';

@Controller('ia')
export class IaController {
  constructor(private readonly iaService: IaService) {}

  @Post('responder')
  async responder(@Body() dto: ResponderDto) {
    const resultado = await this.iaService.responder(dto.mensagem);

    return {
      resposta: resultado.resposta,
      modelo: resultado.modelo,
      uso: {
        tokensEntrada: resultado.tokensEntrada,
        tokensSaida: resultado.tokensSaida,
      },
    };
  }
  @Post('responder-stream')
  @HttpCode(200)
  async responderStream(
    @Body() dto: ResponderDto,
    @Res() response: Response,
  ): Promise<void> {
    const abortController = new AbortController();

    response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('X-Accel-Buffering', 'no');

    response.on('close', () => {
      if (!response.writableEnded) {
        abortController.abort();
      }
    });

    try {
      const stream = this.iaService.gerarStream(
        dto.mensagem,
        abortController.signal,
      );

      for await (const content of stream) {
        response.write(`${JSON.stringify({ type: 'delta', content })}\n`);
      }

      response.write(`${JSON.stringify({ type: 'done' })}\n`);
      response.end();
    } catch {
      if (response.headersSent) {
        response.write(
          `${JSON.stringify({
            type: 'error',
            message: 'A geração foi interrompida',
          })}\n`,
        );
        response.end();
        return;
      }

      throw new ServiceUnavailableException(
        'Não foi possível iniciar a geração',
      );
    }
  }
}