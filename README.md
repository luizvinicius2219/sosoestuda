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

## Organização por ciclos

A aba **Meu ciclo** recebe um plano JSON privado e oferece calendário Padrão, Flex, Speed, Intensivo e opções de recomeço; carga padrão ou essencial; blocos de estudo; tempo por bloco; etapas de diagnóstico, estudo, questões, erros e revisão; agenda de redação, simulados e mentorias; resultados; e revisão final. A data da prova precisa ser conferida pelo aluno no edital oficial.

As semanas e os compromissos recorrentes são calculados a partir das datas. Gerar missões é idempotente: repetir a ação preserva missões existentes e o histórico. A carga é sugerida e o app sinaliza excesso em relação à meta diária. O modo essencial omite blocos de Matemática; não omite blocos jurídicos que substituem matérias em um ciclo específico. Atualizar um plano da mesma fonte preserva o andamento; ajustar o conteúdo de um bloco reinicia somente suas etapas. Sessões anteriores são preservadas.

Dados privados não fazem parte deste repositório. O arquivo `.private/plano-sofia.json` foi preparado apenas no computador do responsável e é excluído por `.gitignore` e `.vercelignore`. O app não hospeda o PDF original ou o material do curso. Há duas formas de importar:

- Na conta autenticada, em **Meu ciclo → Importar meu plano**, selecionar o JSON privado, conferir a prévia e confirmar.
- Em um computador privado com `.env.local`: `npm run planner:import -- .private/plano-sofia.json`. Opcionalmente, definir `PLANNER_IMPORT_FILE` no preparo inicial da conta, para importar logo após criar o usuário. Essa variável não é necessária na Vercel.

Não use a tela de importação para abrir o PDF: ela recebe o JSON organizacional já extraído e revisado. Não há cópia das aulas ou dos bancos de questões. As datas são as previstas no material de origem, com confirmação manual de mudanças e sem promessa de atualização automática da plataforma do curso.

### Banco e recorrência

O app e as APIs rodam na Vercel. Para persistência entre dispositivos, conecte PostgreSQL pelo Marketplace da Vercel, por exemplo Neon, e configure `DATABASE_URL`. O código já usa PostgreSQL e Better Auth; Supabase não é necessário. Escolha o plano no painel e confira seus limites antes de contratar. Não use arquivos do sistema ou memória das Functions como banco permanente.

Não é necessário um cron para criar uma revisão, calcular a semana atual ou manter o ciclo: o calendário é determinístico e os registros são salvos no PostgreSQL. Notícias são consultadas ao abrir a página. Notificações fora do app e atualizações externas agendadas exigiriam um envio/agendamento próprio e não foram ativadas. Nunca coloque senha ou dados do curso no GitHub, na URL pública ou na conversa compartilhada.
