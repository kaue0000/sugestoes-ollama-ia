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

  it('retorna um rascunho estruturado quando há informação suficiente', async () => {
    gerar.mockResolvedValue({
      resposta: JSON.stringify({
        rascunho: 'Olá. Reconhecemos a dificuldade relatada e vamos analisar o caso.',
        informacoesAdicionais: [],
        revisaoHumanaObrigatoria: true,
      }),
      modelo: 'modelo-controlado',
    });

    await expect(
      service.sugerirResposta('Não consigo acessar o portal desde hoje.'),
    ).resolves.toMatchObject({
      rascunho: expect.any(String),
      informacoesAdicionais: [],
      revisaoHumanaObrigatoria: true,
    });
  });

  it('aceita no máximo três informações adicionais pertinentes', async () => {
    gerar.mockResolvedValue({
      resposta: JSON.stringify({
        rascunho: 'Olá. Para analisar o chamado, precisamos de alguns dados.',
        informacoesAdicionais: ['nome completo', 'e-mail cadastrado'],
        revisaoHumanaObrigatoria: true,
      }),
      modelo: 'modelo-controlado',
    });

    await expect(
      service.sugerirResposta('Meu cadastro apresenta um problema.'),
    ).resolves.toMatchObject({
      informacoesAdicionais: ['nome completo', 'e-mail cadastrado'],
    });
  });

  it('rejeita promessa ou decisão não autorizada', async () => {
    gerar.mockResolvedValue({
      resposta: JSON.stringify({
        rascunho: 'O reembolso está aprovado e será resolvido em 2 dias.',
        informacoesAdicionais: [],
        revisaoHumanaObrigatoria: true,
      }),
      modelo: 'modelo-controlado',
    });

    await expect(
      service.sugerirResposta('Peço confirmação do prazo do reembolso.'),
    ).rejects.toThrow('conteúdo proibido');
  });

  it('rejeita solicitação de segredo na resposta', async () => {
    gerar.mockResolvedValue({
      resposta: JSON.stringify({
        rascunho: 'Informe sua senha para continuarmos.',
        informacoesAdicionais: [],
        revisaoHumanaObrigatoria: true,
      }),
      modelo: 'modelo-controlado',
    });

    await expect(
      service.sugerirResposta('Não consigo entrar na minha conta.'),
    ).rejects.toThrow('conteúdo proibido');
  });

  it('rejeita resposta sem a revisão humana obrigatória', async () => {
    gerar.mockResolvedValue({
      resposta: JSON.stringify({
        rascunho: 'Olá. Vamos analisar o problema relatado.',
        informacoesAdicionais: [],
        revisaoHumanaObrigatoria: false,
      }),
      modelo: 'modelo-controlado',
    });

    await expect(
      service.sugerirResposta('O sistema apresenta uma falha.'),
    ).rejects.toThrow('sugestão de resposta inválida');
  });

  it('rejeita decisão não autorizada sobre reembolso ou acesso', async () => {
    gerar.mockResolvedValue({
      resposta: JSON.stringify({
        rascunho: 'Seu reembolso foi aprovado e o acesso foi liberado.',
        informacoesAdicionais: [],
        revisaoHumanaObrigatoria: true,
      }),
      modelo: 'modelo-controlado',
    });

    await expect(
      service.sugerirResposta('Aprove meu reembolso e libere meu acesso.'),
    ).rejects.toThrow('conteúdo proibido');
  });

  it('rejeita confirmação de prazo inventado', async () => {
    gerar.mockResolvedValue({
      resposta: JSON.stringify({
        rascunho: 'Confirmamos que o problema será resolvido em 2 dias.',
        informacoesAdicionais: [],
        revisaoHumanaObrigatoria: true,
      }),
      modelo: 'modelo-controlado',
    });

    await expect(
      service.sugerirResposta('Pode confirmar o prazo?'),
    ).rejects.toThrow('conteúdo proibido');
  });

  it('rejeita link inventado', async () => {
    gerar.mockResolvedValue({
      resposta: JSON.stringify({
        rascunho: 'Consulte https://exemplo.com para resolver o problema.',
        informacoesAdicionais: [],
        revisaoHumanaObrigatoria: true,
      }),
      modelo: 'modelo-controlado',
    });

    await expect(
      service.sugerirResposta('Preciso de orientação.'),
    ).rejects.toThrow('conteúdo proibido');
  });

  it('rejeita segredo nas informações adicionais', async () => {
    gerar.mockResolvedValue({
      resposta: JSON.stringify({
        rascunho: 'Olá. Precisamos de uma informação para analisar o caso.',
        informacoesAdicionais: ['senha da conta'],
        revisaoHumanaObrigatoria: true,
      }),
      modelo: 'modelo-controlado',
    });

    await expect(
      service.sugerirResposta('Não consigo acessar minha conta.'),
    ).rejects.toThrow('conteúdo proibido');
  });

  it('rejeita mais de três perguntas adicionais', async () => {
    gerar.mockResolvedValue({
      resposta: JSON.stringify({
        rascunho: 'Olá. Precisamos de mais informações para analisar o caso.',
        informacoesAdicionais: ['um', 'dois', 'três', 'quatro'],
        revisaoHumanaObrigatoria: true,
      }),
      modelo: 'modelo-controlado',
    });

    await expect(
      service.sugerirResposta('Preciso de ajuda com meu chamado.'),
    ).rejects.toThrow('sugestão de resposta inválida');
  });
});
