import type { ModeloMensagem } from '../ia/providers/modelo.provider';

const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_CHARS = 6000;

export function selecionarHistorico(
  history: ModeloMensagem[],
): ModeloMensagem[] {
  const selected = history.slice(-MAX_HISTORY_MESSAGES);

  const totalChars = () =>
    selected.reduce((total, message) => total + message.content.length, 0);

  while (selected.length >= 2 && totalChars() > MAX_HISTORY_CHARS) {
    selected.splice(0, 2);
  }

  return selected;
}