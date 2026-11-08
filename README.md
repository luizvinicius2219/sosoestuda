# SosoEstuda

Aplicativo de estudos para concursos judiciários, com uma jornada visual gamificada: missões diárias, XP, níveis, conquistas e uma mascote que acompanha a preparação.

Construído com **React 19, TypeScript e Vinext**, usando rotas compatíveis com o App Router, **Cloudflare Workers**, **D1** e **Drizzle ORM**. A publicação está preparada para **Sites**.

## O que já funciona

- Início com metas, planejamento do dia, constância, desempenho e radar de concursos.
- Registro de sessões, tempo, questões e acertos; cronômetro de foco com pausa.
- Planejamento por data e disciplina, com conclusão de missões.
- Matérias e tópicos marcáveis; inclusão manual do conteúdo programático, um tópico por linha, com link para o edital oficial.
- Revisões agendadas após estudos e registros no caderno de erros; reagendamento conforme a dificuldade informada.
- Anotações por disciplina, com edição, e caderno de erros com resposta, motivo e resolução.
- Estatísticas, XP e conquistas calculados a partir dos registros de estudo.
- Perfil, objetivos, data da prova, metas e exportação dos dados em JSON.
- Consulta ao RSS oficial do STJ e seleção identificada de publicações oficiais quando o feed não fornece itens confiáveis sobre concursos.
- Integração opcional com OpenAI ou Gemini, executada no servidor.

## Conta e demonstração

Em Sites, o acesso usa **Entrar com ChatGPT**, com a identidade validada pela infraestrutura de hospedagem. Os estudos da conta são armazenados no D1, associados ao identificador autenticado. As gravações usam versões para detectar alterações concorrentes entre janelas.

Sem autenticação, o app oferece uma **demonstração identificada**, com exemplos e dados salvos apenas no navegador. Essa demonstração é separada dos dados da conta e não é importada automaticamente ao entrar. A visualização local não substitui a validação do login em Sites; eventuais identidades simuladas de desenvolvimento não são contas de produção.

As rotas autenticadas dependem dos cabeçalhos confiáveis inseridos pelo Sites. Para hospedar fora desse ambiente, adapte a autenticação antes de expor as rotas de dados.

## Desenvolvimento local

Requisitos: **Node.js 22.13 ou superior**, npm e acesso à rede para instalar dependências.

Na raiz do projeto:

```sh
npm ci
npm run build
```

O build gera a configuração local em `dist/server/wrangler.json`. Em um banco local novo, aplique a migração existente **uma vez**:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_fuzzy_wrecking_crew.sql
```

Depois, inicie o app:

```sh
npm run dev
```

Abra o endereço informado pelo servidor, normalmente `http://localhost:5173`. Para visualizar o Worker já compilado, use `npm start`. Os bancos local e de produção são separados; `.wrangler/state` guarda apenas o estado local.

Verificação:

```sh
npm test
npm run build
```

Após alterações de schema em `db/schema.ts`, gere uma nova migração com `npm run db:generate`, revise o SQL e aplique somente as migrações pendentes. Preserve migrações já aplicadas.

## IA opcional

O tutor permanece desativado até que **a chave e o modelo de pelo menos um provedor** sejam configurados no runtime do servidor:

| Provedor | Chave | Modelo |
| --- | --- | --- |
| OpenAI | `OPENAI_API_KEY` | `OPENAI_MODEL` |
| Gemini | `GEMINI_API_KEY` | `GEMINI_MODEL` |

Não há modelo padrão. Escolha um modelo disponível na conta do provedor e adequado à sua aplicação. Com ambos configurados, a seleção padrão prioriza OpenAI; a API também aceita a escolha explícita do provedor.

Use a gestão de **secrets/variáveis de runtime do Sites** para configurar produção. Em desenvolvimento, use os bindings locais do Wrangler, por exemplo em `.dev.vars`, que é ignorado pelo Git. `.env.example` contém somente o inventário dos nomes; não contém credenciais nem ativa a integração por si só. Nunca coloque chaves em código, variáveis `NEXT_PUBLIC_*` ou arquivos versionados.

Sem credenciais e modelo configurados, o app não realiza chamadas aos provedores nem gera custos nessas APIs. Quando habilitado, o tutor exige login, limita o tamanho das solicitações e da resposta e envia ao provedor o contexto exibido no app: objetivo, matérias e até cinco anotações. As consultas podem gerar cobrança conforme a conta do provedor.

O tutor trabalha com o contexto recebido, trata textos de editais como dados e informa lacunas. Ele não realiza pesquisa jurídica ou consulta automática à internet.

## Notícias, lembretes e conteúdo

O radar tenta consultar o [RSS oficial de notícias do STJ](https://res.stj.jus.br/hrestp-c-portalp/RSS.xml), listado na [página oficial de feeds](https://www.stj.jus.br/sites/portalp/Paginas/RSS.aspx). O servidor filtra notícias de concursos e nomeações e mantém cache por até **15 minutos**. A homepage consulta o radar ao abrir, e há atualização manual.

Se não houver resultado confiável ou o feed estiver indisponível, a resposta usa uma **seleção verificada em 07/11/2026**, identificada como tal. A data da consulta não representa uma nova verificação dessa seleção. Confira inscrições, retificações e cronogramas na publicação oficial vinculada.

Os lembretes de revisão aparecem no app. O cronômetro pode emitir notificação, com permissão do navegador, enquanto o app está aberto. **Não há push de revisão com o app fechado**, envio de e-mails ou tarefa agendada de monitoramento nesta versão.

As matérias iniciais formam uma **trilha geral de preparação**. Não representam todos os editais, o programa completo de um cargo ou aconselhamento jurídico. A inclusão do edital é manual por tópicos; não há extração automática de PDF ou rastreamento de todas as bancas nesta versão.

## Estrutura e publicação

| Caminho | Responsabilidade |
| --- | --- |
| `components/study-app.tsx` | Interface e fluxos de estudo |
| `components/Mascot.tsx` | Mascote |
| `lib/study.ts` | Tipos, validação, datas, revisões e indicadores |
| `lib/news.ts` | RSS e seleção de fontes verificadas |
| `app/api/state/route.ts` | Leitura e gravação dos estudos da conta |
| `app/api/news/route.ts` | Consulta e cache do radar |
| `app/api/assistant/route.ts` | Integrações opcionais com IA |
| `app/chatgpt-auth.ts` | Identidade e caminhos de login do Sites |
| `db/` e `drizzle/` | Schema e migrações do D1 |
| `.openai/hosting.json` | Identidade do Site e binding `DB` |

O manifesto usa `d1: "DB"`, sem armazenamento R2. O build produz o Worker em `dist/server/index.js` e os arquivos estáticos correspondentes. A publicação pelo fluxo de Sites sincroniza a versão de código, empacota o build e aplica as migrações de produção. Preserve o `project_id` existente e a configuração de acesso do Site.

## Fontes e documentação

- [TRF3: página oficial dos editais de servidores de 2026](https://www.trf3.jus.br/sege/concurso-servidores/2026/editais).
- [TRF3: abertura das inscrições, publicação de 04/11/2026](https://web.trf3.jus.br/noticias-intranet-sjms/Noticiar/ExibirNoticia/1439-inscricoes-abertas-para-concurso-de-servidores-da).
- [STJ: concursos e movimentações oficiais](https://www.stj.jus.br/sites/portalp/Paginas/Institucional/Concursos.aspx).
- [TSE: documentos do concurso unificado da Justiça Eleitoral](https://www.tse.jus.br/institucional/sobre-o-tse/concurso-publico).
- [TRT6: acompanhamento do concurso de servidores de 2024](https://www.trt6.jus.br/portal/concurso-servidores-e-servidoras-2024).
- [Official OpenAI documentation: geração de texto com Responses](https://developers.openai.com/api/docs/guides/text).
- [Gemini API: geração de conteúdo](https://ai.google.dev/api/generate-content).
