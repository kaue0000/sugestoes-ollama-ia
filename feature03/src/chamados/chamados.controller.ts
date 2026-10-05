import { Body, Controller, Post } from '@nestjs/common';
import { ClassificarChamadoDto } from './dto/classificar-chamado.dto';
import { ChamadosService } from './chamados.service';

@Controller('chamados')
export class ChamadosController {
  constructor(private readonly chamados: ChamadosService) {}

  @Post('classificar')
  classificar(@Body() dto: ClassificarChamadoDto) {
    return this.chamados.classificar(dto.texto);
  }
}
