import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { MODELO_PROVIDER } from '../../ia/providers/modelo.provider';
import { SugestaoRespostaModule } from './sugestao-resposta.module';

describe('SugestaoRespostaController', () => {
  const gerar = jest.fn();
  let app: INestApplication;

  beforeEach(async () => {
    gerar.mockReset();
    gerar.mockResolvedValue({
      resposta: JSON.stringify({
        rascunho: 'Olá. Reconhecemos a dificuldade relatada.',
        informacoesAdicionais: [],
        revisaoHumanaObrigatoria: true,
      }),
      modelo: 'modelo-controlado',
      tokensEntrada: 0,
      tokensSaida: 0,
    });

    const moduleRef = await Test.createTestingModule({
      imports: [SugestaoRespostaModule],
    })
      .overrideProvider(MODELO_PROVIDER)
      .useValue({ gerar })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('atende a rota preservada e retorna o rascunho estruturado', async () => {
    await request(app.getHttpServer())
      .post('/chamados/sugerir-resposta')
      .send({ texto: 'Não consigo acessar o portal.' })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          texto: 'Não consigo acessar o portal.',
          rascunho: 'Olá. Reconhecemos a dificuldade relatada.',
          informacoesAdicionais: [],
          revisaoHumanaObrigatoria: true,
          modelo: 'modelo-controlado',
          status: 'RASCUNHO',
        });
      });

    expect(gerar).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'json' }),
    );
  });

  it('rejeita entrada inválida antes de consultar o modelo', async () => {
    await request(app.getHttpServer())
      .post('/chamados/sugerir-resposta')
      .send({ texto: 'curto' })
      .expect(400);

    expect(gerar).not.toHaveBeenCalled();
  });
});
