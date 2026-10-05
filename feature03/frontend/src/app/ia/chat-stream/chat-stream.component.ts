import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IaStreamService } from '../ia-stream.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  informacoesAdicionais?: string[];
  revisaoHumanaObrigatoria?: boolean;
  status?: 'RASCUNHO';
}

@Component({
  selector: 'app-chat-stream',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './chat-stream.component.html',
  styleUrl: './chat-stream.component.css',
})
export class ChatStreamComponent {
  private readonly ia = inject(IaStreamService);
  private abortController?: AbortController;
  private readonly messageList = viewChild<ElementRef<HTMLElement>>('messageList');

  mensagem = '';
  mensagens = signal<ChatMessage[]>([]);
  status = signal<'idle' | 'loading' | 'done' | 'error' | 'cancelled'>('idle');

  async enviar(): Promise<void> {
    const mensagem = this.mensagem.trim();
    if (!mensagem || this.status() === 'loading') return;

    this.mensagem = '';
    this.mensagens.update((current) => [
      ...current,
      { role: 'user', text: mensagem },
      { role: 'assistant', text: '' },
    ]);
    this.abortController = new AbortController();
    this.status.set('loading');
    this.scrollToLatest();

    try {
      const sugestao = await this.ia.sugerirResposta(
        mensagem,
        this.abortController.signal,
      );
      this.updateLatest({
        text: sugestao.rascunho,
        informacoesAdicionais: sugestao.informacoesAdicionais,
        revisaoHumanaObrigatoria: sugestao.revisaoHumanaObrigatoria,
        status: sugestao.status,
      });
      this.status.set('done');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        this.status.set('cancelled');
        this.updateLatest({ text: 'Geração interrompida.' });
      } else {
        this.status.set('error');
        this.updateLatest({
          text:
            error instanceof Error
              ? error.message
              : 'Não foi possível gerar a sugestão. Verifique se a API local está disponível.',
        });
      }
    } finally {
      this.abortController = undefined;
    }
  }

  cancelar(): void {
    this.abortController?.abort();
  }

  novaConversa(): void {
    if (this.status() === 'loading') this.cancelar();
    this.mensagens.set([]);
    this.status.set('idle');
    this.mensagem = '';
  }

  usarSugestao(sugestao: string): void {
    this.mensagem = sugestao;
  }

  enviarComEnter(event: Event): void {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.shiftKey || event.isComposing) return;
    event.preventDefault();
    void this.enviar();
  }

  private updateLatest(update: Partial<ChatMessage>): void {
    this.mensagens.update((current) => {
      const latest = current.at(-1);
      if (!latest || latest.role !== 'assistant') return current;
      return [...current.slice(0, -1), { ...latest, ...update }];
    });
    this.scrollToLatest();
  }

  private scrollToLatest(): void {
    requestAnimationFrame(() => {
      const element = this.messageList()?.nativeElement;
      if (element) element.scrollTop = element.scrollHeight;
    });
  }
}