import { afterEach, describe, expect, it, vi } from 'vitest';
import { IaStreamService } from './ia-stream.service';

describe('IaStreamService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mantém JSON para sugestões sem anexo', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          rascunho: 'Olá.',
          informacoesAdicionais: [],
          revisaoHumanaObrigatoria: true,
          status: 'RASCUNHO',
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const signal = new AbortController().signal;

    await new IaStreamService().sugerirResposta('Chamado de teste', signal);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/chamados/sugerir-resposta',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: 'Chamado de teste' }),
        signal,
      }),
    );
  });

  it('usa multipart para enviar o anexo junto ao chamado', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          rascunho: 'Olá.',
          informacoesAdicionais: [],
          revisaoHumanaObrigatoria: true,
          status: 'RASCUNHO',
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const arquivo = new File(['conteúdo'], 'detalhe.txt', {
      type: 'text/plain',
    });

    await new IaStreamService().sugerirResposta(
      'Chamado de teste',
      new AbortController().signal,
      arquivo,
    );

    const options = fetchMock.mock.calls[0][1];
    expect(options?.headers).toEqual({});
    expect(options?.body).toBeInstanceOf(FormData);
    expect((options?.body as FormData).get('texto')).toBe('Chamado de teste');
    expect((options?.body as FormData).get('arquivo')).toBe(arquivo);
  });
});
