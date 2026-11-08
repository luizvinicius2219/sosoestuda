# SosoEstuda — espaço pessoal da Sofia

Aplicativo de estudos com missões, cronômetro, edital por tópicos, revisões espaçadas, anotações, caderno de erros, estatísticas e conquistas. Interface responsiva com mascote e XP.

## Hospedagem e privacidade

O código agora usa **Next.js**, **PostgreSQL** e **Better Auth**, preparado para Vercel. Não usa identidade, cabeçalhos, cookies ou login do ChatGPT. A página inicial exige sessão válida e e-mail igual a `SOFIA_EMAIL`; visitantes são enviados a `/login`. Cadastro público desativado. As APIs de dados e IA verificam a mesma identidade no servidor. Não existe acesso de demonstração pela página inicial.

A publicação antiga foi substituída por resposta HTTP 410, sem telas ou APIs. O encerramento não equivale à exclusão de versões anteriores ou histórico da conta compartilhada. A exclusão definitiva deve ser feita pelo titular nas configurações do serviço. Não importe os dados da conta compartilhada para a conta da Sofia sem revisão.

O repositório contém código e exemplos sem credenciais. Nunca adicione senha, token, e-mail pessoal ou dados de estudo ao Git. O histórico antigo contém o código da versão anterior; não contém uma senha da Sofia.

## Preparar na Vercel

1. Importe este repositório como projeto **Next.js**.
2. Conecte um PostgreSQL privado e configure `DATABASE_URL` no painel da Vercel.
3. Configure `BETTER_AUTH_URL` com a URL definitiva do projeto, `BETTER_AUTH_SECRET` com um segredo aleatório de pelo menos 32 caracteres e `SOFIA_EMAIL` com o e-mail autorizado.
4. Em um computador/ambiente privado, crie `.env.local` com essas mesmas variáveis e `SOFIA_INITIAL_PASSWORD` (senha de pelo menos 12 caracteres). Não envie estes valores pelo chat compartilhado.
5. Execute `npm ci` e `npm run db:setup`. O script usa as migrações oficiais do Better Auth e cria a tabela de estudos; se a conta já existe, não muda a senha.
6. Remova `SOFIA_INITIAL_PASSWORD` do ambiente após criar a conta. Essa variável não é necessária na Vercel.
7. Faça o deploy. Sem configuração privada, a tela aparece, mas nenhum acesso aos estudos é liberado.

O banco e a criação real da conta aguardam a escolha do projeto na Vercel. Não há senha padrão ou acesso alternativo. Recuperação por e-mail ainda não configurada; o responsável administra a recuperação.

## Desenvolvimento

Node.js >=22.13.

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

Não use dados de produção para testes. A conta da Sofia só deve ser criada em um ambiente privado controlado pelo responsável.

## IA e fontes oficiais

Opcionalmente configure `OPENAI_API_KEY` + `OPENAI_MODEL`, ou `GEMINI_API_KEY` + `GEMINI_MODEL`, apenas no servidor. Sem estas variáveis a IA permanece desligada. Nenhuma chave é enviada ao navegador.

O radar consulta o [RSS oficial do STJ](https://www.stj.jus.br/sites/portalp/Paginas/RSS.aspx) e usa uma seleção identificada de fontes oficiais verificada em 07/11/2026 quando não há itens adequados. A trilha de matérias é geral e deve ser adaptada ao edital/cargo. Importação inicial por texto, sem extração automática de PDF. Notificações de foco precisam do app aberto.

Referências: [Better Auth](https://better-auth.com/docs/installation), [autenticação por e-mail](https://better-auth.com/docs/authentication/email-password), [PostgreSQL](https://better-auth.com/docs/adapters/postgresql).
