import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import {
  MODELO_PROVIDER,
} from '../ia/providers/modelo.provider';
import { ChamadosService } from './chamados.service';

describe('ChamadosService', () => {
  const gerar = jest.fn();
  let service: ChamadosService;

  beforeEach(async () => {
    gerar.mockReset();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChamadosService,
        {
          provide: MODELO_PROVIDER,
          useValue: { gerar },
        },
      ],
    }).compile();

    service = moduleRef.get(ChamadosService);
  });

  it('aceita uma categoria permitida', async () => {
    gerar.mockResolvedValue({
      resposta: ' acesso ',
      modelo: 'modelo-controlado',
    });

    await expect(
      service.classificar('Minha senha foi bloqueada.'),
    ).resolves.toMatchObject({ categoria: 'ACESSO' });
  });

  it('rejeita categoria inventada', async () => {
    gerar.mockResolvedValue({
      resposta: 'SUPORTE_TECNICO',
      modelo: 'modelo-controlado',
    });

    await expect(
      service.classificar('O computador está lento.'),
    ).rejects.toThrow('categoria inválida');
  });

  it('rejeita explicação junto da categoria', async () => {
    gerar.mockResolvedValue({
      resposta: 'ACESSO porque a senha expirou',
      modelo: 'modelo-controlado',
    });

    await expect(
      service.classificar('Minha senha expirou.'),
    ).rejects.toThrow('categoria inválida');
  });

});
