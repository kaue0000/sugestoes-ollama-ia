import { Injectable } from '@angular/core';

export interface SugestaoResposta {
  rascunho: string;
  informacoesAdicionais: string[];
  revisaoHumanaObrigatoria: true;
  status: 'RASCUNHO';
}

@Injectable({ providedIn: 'root' })
export class IaStreamService {
  async sugerirResposta(
    texto: string,
    signal: AbortSignal,
  ): Promise<SugestaoResposta> {
    let response: Response;
    try {
      response = await fetch('http://localhost:3000/chamados/sugerir-resposta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
        signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new Error('Não foi possível conectar à API local. Verifique se o backend está disponível.');
    }

    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const mensagemApi =
        typeof body === 'object' && body !== null && 'message' in body
          ? body.message
          : undefined;
      const mensagem = Array.isArray(mensagemApi)
        ? mensagemApi.join(' ')
        : typeof mensagemApi === 'string'
          ? mensagemApi
          : '';

      if (response.status === 502 && mensagem.includes('conteúdo proibido')) {
        throw new Error(
          'A sugestão gerada não passou pela validação de segurança. Tente novamente ou encaminhe o chamado para revisão manual.',
        );
      }
      if (response.status === 502 && mensagem.includes('sugestão de resposta inválida')) {
        throw new Error('O modelo retornou uma sugestão em formato inválido. Tente novamente.');
      }
      if (response.status === 504) {
        throw new Error('O modelo demorou demais para responder. Tente novamente.');
      }
      if (response.status === 503) {
        throw new Error('O serviço de IA local está indisponível. Verifique se o modelo está conectado.');
      }

      throw new Error(`Não foi possível gerar a sugestão (HTTP ${response.status}).`);
    }

    return (await response.json()) as SugestaoResposta;
  }
}