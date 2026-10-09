# Sugestão de resposta para chamados

## O que a aplicação resolve

A aplicação ajuda atendentes a redigir respostas para chamados. Ela gera um rascunho com base no relato recebido e, quando faltam dados importantes, sugere informações que podem ser solicitadas ao usuário. A resposta é sempre apresentada como rascunho e precisa ser revisada por uma pessoa antes do envio.

## Como funciona

1. O atendente informa o texto do chamado pela interface web (idealmente, pois na apresentação por exemplo fizemos a demonstração com a requisição feita utilizando o postman).
2. A API envia o texto ao modelo local Ollama, usando `llama3.2:latest`.
3. O modelo retorna um rascunho e uma lista de informações adicionais, se necessárias.
4. A API verifica o formato e o conteúdo da resposta, além de omitir credenciais identificadas no chamado.
5. A interface exibe o resultado para revisão humana.

A aplicação orienta o modelo a não inventar informações, prometer prazos ou confirmar decisões. Essas verificações não substituem a revisão do atendente.

## Como executar

É necessário ter Docker com Docker Compose instalado. Execute os comandos a partir deste diretório, que contém o arquivo `docker-compose.yml`.


Temos dois caminhos possíveis: Iniciar o docker compose de uma vez, ou cada uma das partes da aplicação por vez.


## Iniciando tudo de uma vez
   ```bash
   docker compose up -d
   ```

## Iniciando por partes
1. Inicie o Ollama:

   ```bash
   docker compose up -d ollama
   ```

2. Baixe o modelo usado pela aplicação:

   ```bash
   docker compose exec ollama ollama pull llama3.2:latest
   ```

3. Inicie a API e a interface:

   ```bash
   docker compose up --build -d backend frontend
   ```

4. Acesse a interface em <http://localhost:4200> e informe o texto de um chamado. O texto deve ter entre 10 e 2.000 caracteres.

A API fica disponível em `http://localhost:3000`. A rota usada pela interface é `POST /chamados/sugerir-resposta`.

Para encerrar os serviços:

```bash
docker compose down
```
