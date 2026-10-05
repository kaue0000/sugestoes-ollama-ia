import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { MODELO_PROVIDER } from "./providers/modelo.provider";
import type { GerarRespostaOutput, ModeloProvider } from "./providers/modelo.provider";

@Injectable()
export class IaService {
    constructor(
        @Inject(MODELO_PROVIDER)
        private readonly modelo: ModeloProvider,
    ) {}
    responder(mensagem: string): Promise<GerarRespostaOutput> {
        const mensagemNormalizada = mensagem.trim();
        if (!mensagemNormalizada) {
            throw new BadRequestException('Mensagem não pode ser vazia');
        }
        return this.modelo.gerar({ mensagem: mensagemNormalizada });
    }
    gerarStream(mensagem: string, signal: AbortSignal): AsyncIterable<string> {
        const mensagemNormalizada = mensagem.trim();

        if (!mensagemNormalizada) {
            throw new BadRequestException('A mensagem não pode conter apenas espaços');
        }

        return this.modelo.gerarStream({
            mensagem: mensagemNormalizada,
            signal,
        });
    }
}