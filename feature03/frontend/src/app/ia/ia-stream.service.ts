import { Injectable } from '@angular/core';

export interface StreamEvent {
  type: 'delta' | 'done' | 'error';
  content?: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class IaStreamService {
  async *responder(
    mensagem: string,
    signal: AbortSignal,
  ): AsyncIterable<StreamEvent> {
    const response = await fetch(
      'http://localhost:3000/ia/responder-stream',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem }),
        signal,
      },
    );

    if (!response.ok) {
      throw new Error(`Falha ao iniciar: HTTP ${response.status}`);
    }

    if (!response.body) {
      throw new Error('O navegador não disponibilizou o corpo incremental');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.trim()) yield JSON.parse(line) as StreamEvent;
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) yield JSON.parse(buffer) as StreamEvent;
    } finally {
      reader.releaseLock();
    }
  }
}