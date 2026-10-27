import { jest } from '@jest/globals';
import { Readable } from 'node:stream';
import { Test } from '@nestjs/testing';
import { MODELO_PROVIDER } from '../../ia/providers/modelo.provider';
import { SugestaoRespostaService } from './sugestao-resposta.service';

describe('Feature 3 - sugestão de resposta', () => {
  const gerar = jest.fn();
  const analisarArquivo = jest.fn();
  let service: SugestaoRespostaService;

  const resposta = (rascunho: string, informacoesAdicionais: string[] = []) =>
    JSON.stringify({
      rascunho,
      informacoesAdicionais,
      revisaoHumanaObrigatoria: true,
    });

  const criarArquivo = (
    mimetype: string,
    buffer: Buffer,
  ): Express.Multer.File => ({
    fieldname: 'arquivo',
    originalname: 'anexo',
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    destination: '',
    filename: '',
    path: '',
    buffer,
    stream: Readable.from(buffer),
  });

  const criarPdf = (texto: string): Buffer => {
    const stream = `BT /F1 12 Tf 72 720 Td (${texto}) Tj ET`;
    const objetos = [
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj',
      `4 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj`,
      '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];

    for (const objeto of objetos) {
      offsets.push(Buffer.byteLength(pdf));
      pdf += `${objeto}\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets.slice(1)) {
      pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf);
  };

  beforeEach(async () => {
    gerar.mockReset();
    analisarArquivo.mockReset();
    analisarArquivo.mockResolvedValue({
      resposta: resposta('Olá. Reconhecemos a dificuldade relatada.'),
      modelo: 'llama3.2:latest',
    });
    const moduleRef = await Test.createTestingModule({
      providers: [
        SugestaoRespostaService,
        { provide: MODELO_PROVIDER, useValue: { gerar, analisarArquivo } },
      ],
    }).compile();
    service = moduleRef.get(SugestaoRespostaService);
  });

  it('usa o provider multimodal para anexos de imagem', async () => {
    const imagem = Buffer.from('conteúdo da imagem');

    await expect(
      service.sugerirResposta(
        'Não consigo acessar o portal.',
        criarArquivo('image/png', imagem),
      ),
    ).resolves.toMatchObject({
      texto: 'Não consigo acessar o portal.',
      status: 'RASCUNHO',
    });
    expect(analisarArquivo).toHaveBeenCalledWith(
      expect.objectContaining({
        imagemBase64: imagem.toString('base64'),
        format: 'json',
      }),
    );
    expect(gerar).not.toHaveBeenCalled();
  });

  it('inclui o conteúdo TXT no contexto sem expô-lo no texto retornado', async () => {
    await expect(
      service.sugerirResposta(
        'Não consigo acessar o portal.',
        criarArquivo(
          'text/plain',
          Buffer.from('Mensagem de erro: falha. Minha senha: exemplo123.'),
        ),
      ),
    ).resolves.toMatchObject({
      texto: 'Não consigo acessar o portal.',
      status: 'RASCUNHO',
    });
    expect(analisarArquivo).toHaveBeenCalledWith(
      expect.objectContaining({
        textoDocumento:
          'Mensagem de erro: falha. Minha senha: [DADO SENSÍVEL OMITIDO]',
        format: 'json',
      }),
    );
  });

  it('extrai o texto de PDFs e o inclui no contexto do chamado', async () => {
    await service.sugerirResposta(
      'Não consigo acessar o portal.',
      criarArquivo(
        'application/pdf',
        criarPdf('Mensagem de erro: falha.'),
      ),
    );

    expect(analisarArquivo).toHaveBeenCalledWith(
      expect.objectContaining({
        textoDocumento: expect.stringContaining('Mensagem de erro: falha.'),
        format: 'json',
      }),
    );
  });

  it('rejeita formatos de arquivo não aceitos', async () => {
    await expect(
      service.sugerirResposta(
        'Não consigo acessar o portal.',
        criarArquivo('application/octet-stream', Buffer.from('dados')),
      ),
    ).rejects.toThrow('Envie PNG, JPEG, WebP, PDF ou TXT');
    expect(analisarArquivo).not.toHaveBeenCalled();
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

  it('rejeita pergunta no rascunho quando a lista adicional está vazia', async () => {
    gerar.mockResolvedValue({
      resposta: resposta(
        'Olá. Para entendermos melhor, poderia descrever o problema ou a solicitação que você deseja encaminhar?',
      ),
      modelo: 'llama3.2:latest',
    });

    await expect(
      service.sugerirResposta('Meu cadastro apresenta um problema.'),
    ).rejects.toThrow('pergunta sem informações adicionais');
    expect(gerar).toHaveBeenCalledTimes(2);
  });

  it('rejeita rascunho que inventa período temporal ausente no chamado', async () => {
    gerar.mockResolvedValue({
      resposta: resposta(
        'Olá. Reconhecemos a dificuldade para entrar no sistema. Desde ontem, não foi possível acessar a conta. Poderia informar a mensagem de erro exibida?',
      ),
      modelo: 'llama3.2:latest',
    });

    await expect(
      service.sugerirResposta('Não consigo entrar no sistema.'),
    ).rejects.toThrow('tempo inventado');
  });

  it('mascara dados sensíveis no campo texto retornado', async () => {
    gerar.mockResolvedValue({
      resposta: resposta('Olá. Reconhecemos a dificuldade de acesso.'),
      modelo: 'llama3.2:latest',
    });

    await expect(
      service.sugerirResposta('Meu login e senha são admin e Abc123.'),
    ).resolves.toMatchObject({
      texto: 'Meu login e [DADO SENSÍVEL OMITIDO].',
    });
  });

  it('tenta novamente quando a pergunta não corresponde à lista adicional', async () => {
    gerar
      .mockResolvedValueOnce({
        resposta: resposta(
          'Olá. Para entendermos melhor, poderia descrever o problema ou a solicitação que você deseja encaminhar?',
        ),
        modelo: 'llama3.2:latest',
      })
      .mockResolvedValueOnce({
        resposta: resposta(
          'Olá. Para entendermos melhor, poderia descrever o problema ou a solicitação que você deseja encaminhar?',
          ['Descrição do problema ou da solicitação'],
        ),
        modelo: 'llama3.2:latest',
      });

    await expect(
      service.sugerirResposta('Meu cadastro apresenta um problema.'),
    ).resolves.toMatchObject({
      rascunho:
        'Olá. Para entendermos melhor, poderia descrever o problema ou a solicitação que você deseja encaminhar?',
      informacoesAdicionais: ['Descrição do problema ou da solicitação'],
    });
    expect(gerar).toHaveBeenCalledTimes(2);
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
