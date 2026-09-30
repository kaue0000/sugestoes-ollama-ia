import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { MODELO_PROVIDER } from '../ia/providers/modelo.provider';
import { ChamadosService } from './chamados.service';

describe('Feature 3 - sugestão de resposta', () => {
  const gerar = jest.fn();
  let service: ChamadosService;

  const resposta = (rascunho: string, informacoesAdicionais: string[] = []) =>
    JSON.stringify({
      rascunho,
      informacoesAdicionais,
      revisaoHumanaObrigatoria: true,
    });

  beforeEach(async () => {
    gerar.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChamadosService,
        { provide: MODELO_PROVIDER, useValue: { gerar } },
      ],
    }).compile();
    service = moduleRef.get(ChamadosService);
  });

  it('gera rascunho quando há informação suficiente', async () => {
    gerar.mockResolvedValue({
      resposta: resposta('Olá. Reconhecemos a dificuldade relatada e vamos analisar o caso.'),
      modelo: 'llama3.2:latest',
    });

    await expect(service.sugerirResposta('Não consigo acessar o portal.')).resolves.toMatchObject({
      status: 'RASCUNHO',
      revisaoHumanaObrigatoria: true,
      informacoesAdicionais: [],
    });
    expect(gerar).toHaveBeenCalledWith(expect.objectContaining({ format: 'json' }));
  });

  it('não solicita dados já informados ao relatar erro na emissão do histórico', async () => {
    const texto =
      'Sou o João Silva, matrícula 20231234. Ontem, 29/09, tentei emitir meu histórico escolar pelo portal e apareceu o erro "Falha ao gerar documento". Tentei três vezes pelo Chrome e o erro se repetiu.';
    gerar.mockResolvedValue({
      resposta: resposta(
        'Olá, João. Reconhecemos o problema ao emitir seu histórico escolar e vamos analisar o erro relatado.',
      ),
      modelo: 'llama3.2:latest',
    });

    await expect(service.sugerirResposta(texto)).resolves.toMatchObject({
      rascunho: expect.stringContaining('Reconhecemos o problema'),
      informacoesAdicionais: [],
      revisaoHumanaObrigatoria: true,
    });
  });

  it('remove pedidos de dados do rascunho quando a lista adicional está vazia', async () => {
    gerar.mockResolvedValue({
      resposta: resposta(
        'Olá, João. Reconhecemos o problema relatado. Precisamos saber mais sobre o mesmo.',
      ),
      modelo: 'llama3.2:latest',
    });

    await expect(
      service.sugerirResposta('O erro ocorreu ao emitir meu histórico escolar.'),
    ).resolves.toMatchObject({
      rascunho: 'Olá, João. Reconhecemos o problema relatado.',
      informacoesAdicionais: [],
      revisaoHumanaObrigatoria: true,
    });
  });

  it('remove perguntas diretas quando a lista adicional está vazia', async () => {
    gerar.mockResolvedValue({
      resposta: resposta(
        'Olá. Reconhecemos o problema no cadastro. Qual sistema apresenta o problema?',
      ),
      modelo: 'llama3.2:latest',
    });

    await expect(
      service.sugerirResposta('Meu cadastro apresenta um problema.'),
    ).resolves.toMatchObject({
      rascunho: 'Olá. Reconhecemos o problema no cadastro.',
      informacoesAdicionais: [],
    });
  });

  it('preserva pedidos de dados quando a lista adicional está preenchida', async () => {
    const rascunho =
      'Olá. Para entendermos melhor, poderia informar qual sistema apresenta o problema?';
    gerar.mockResolvedValue({
      resposta: resposta(rascunho, ['Qual sistema apresenta o problema?']),
      modelo: 'llama3.2:latest',
    });

    await expect(
      service.sugerirResposta('Meu cadastro apresenta um problema.'),
    ).resolves.toMatchObject({
      rascunho,
      informacoesAdicionais: ['Qual sistema apresenta o problema?'],
    });
  });

  it('permite no máximo três informações adicionais', async () => {
    gerar.mockResolvedValue({
      resposta: resposta('Olá. Para analisar o caso, precisamos de alguns dados.', [
        'qual sistema apresentou o problema?',
        'qual mensagem de erro foi exibida?',
        'quando o problema começou?',
      ]),
      modelo: 'llama3.2:latest',
    });

    await expect(service.sugerirResposta('Meu cadastro apresenta um problema.')).resolves.toMatchObject({
      informacoesAdicionais: [
        'qual sistema apresentou o problema?',
        'qual mensagem de erro foi exibida?',
        'quando o problema começou?',
      ],
      status: 'RASCUNHO',
    });
  });

  it('rejeita mais de três informações adicionais', async () => {
    gerar.mockResolvedValue({
      resposta: resposta('Precisamos de mais informações.', ['1', '2', '3', '4']),
      modelo: 'llama3.2:latest',
    });

    await expect(service.sugerirResposta('Preciso de ajuda.')).rejects.toThrow('sugestão de resposta inválida');
  });

  it('rejeita confirmação de prazo não informado', async () => {
    gerar.mockResolvedValue({
      resposta: resposta('Confirmamos que o problema será resolvido em 2 dias.'),
      modelo: 'llama3.2:latest',
    });

    await expect(service.sugerirResposta('Confirme o prazo para resolver meu chamado.')).rejects.toThrow('conteúdo proibido');
  });

  it('rejeita solicitação de segredo', async () => {
    gerar.mockResolvedValue({
      resposta: resposta('Informe sua senha e seu token para continuarmos.'),
      modelo: 'llama3.2:latest',
    });

    await expect(service.sugerirResposta('Não consigo acessar minha conta.')).rejects.toThrow('conteúdo proibido');
  });

  it('rejeita valor de credencial exposto no rascunho', async () => {
    gerar.mockResolvedValue({
      resposta: resposta('Sua senha: ExemploFicticio-123 deve ser mantida em sigilo.'),
      modelo: 'llama3.2:latest',
    });

    await expect(service.sugerirResposta('Não consigo acessar minha conta.')).rejects.toThrow('conteúdo proibido');
  });

  it('rejeita rascunho que comenta ou valida uma credencial', async () => {
    gerar.mockResolvedValue({
      resposta: resposta('Sua senha está correta, mas tivemos problemas em processá-la. Poderia confirmar se já tentou redefini-la?'),
      modelo: 'llama3.2:latest',
    });

    await expect(service.sugerirResposta('Não consigo acessar minha conta.')).rejects.toThrow('conteúdo proibido');
  });

  it('permite alertar o solicitante para não compartilhar credenciais', async () => {
    gerar.mockResolvedValue({
      resposta: resposta('Olá. Nunca compartilhe sua senha conosco; não precisamos dela.'),
      modelo: 'llama3.2:latest',
    });

    await expect(service.sugerirResposta('Não consigo acessar minha conta.')).resolves.toMatchObject({
      informacoesAdicionais: [],
      revisaoHumanaObrigatoria: true,
    });
  });

  it('permite informar que um prazo não pode ser confirmado', async () => {
    gerar.mockResolvedValue({
      resposta: resposta('Olá. Não é possível confirmar o prazo de resolução neste momento.'),
      modelo: 'llama3.2:latest',
    });

    await expect(service.sugerirResposta('Quando meu chamado será resolvido?')).resolves.toMatchObject({
      informacoesAdicionais: [],
      revisaoHumanaObrigatoria: true,
    });
  });

  it('rejeita aprovação de reembolso ou acesso', async () => {
    gerar.mockResolvedValue({
      resposta: resposta('Seu reembolso foi aprovado e o acesso foi liberado.'),
      modelo: 'llama3.2:latest',
    });

    await expect(service.sugerirResposta('Aprove meu reembolso e libere meu acesso.')).rejects.toThrow('conteúdo proibido');
  });

  it('permite recusar confirmação de aprovação sem decidir pelo atendente', async () => {
    gerar.mockResolvedValue({
      resposta: resposta('Olá. Não podemos confirmar a aprovação do seu reembolso por esta mensagem; a decisão exige revisão humana.'),
      modelo: 'llama3.2:latest',
    });

    await expect(service.sugerirResposta('Aprove meu reembolso.')).resolves.toMatchObject({
      informacoesAdicionais: [],
      revisaoHumanaObrigatoria: true,
    });
  });

  it('rejeita saída sem revisão humana obrigatória', async () => {
    gerar.mockResolvedValue({
      resposta: JSON.stringify({
        rascunho: 'Olá. Vamos analisar o problema.',
        informacoesAdicionais: [],
        revisaoHumanaObrigatoria: false,
      }),
      modelo: 'llama3.2:latest',
    });

    await expect(service.sugerirResposta('O sistema apresenta uma falha.')).rejects.toThrow('sugestão de resposta inválida');
  });

  it('rejeita JSON inválido retornado pelo modelo', async () => {
    gerar.mockResolvedValue({ resposta: 'não é json', modelo: 'llama3.2:latest' });

    await expect(service.sugerirResposta('Preciso de ajuda com o sistema.')).rejects.toThrow('sugestão de resposta inválida');
  });

  it('rejeita URL inventada na resposta', async () => {
    gerar.mockResolvedValue({
      resposta: resposta('Acesse https://exemplo.com para continuar.'),
      modelo: 'llama3.2:latest',
    });

    await expect(service.sugerirResposta('Preciso de orientação.')).rejects.toThrow('conteúdo proibido');
  });
});
