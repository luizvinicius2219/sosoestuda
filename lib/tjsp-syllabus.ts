import type { StudyState, Subject } from "./study.ts";

export const NOTION_SOURCE = "https://western-bromine-962.notion.site/Edital-verticalizado-87e6733adde9823a972001c69a3b4075";
// Snapshot of the user's reference, read on 2026-11-10. This is not an official notice or a live Notion connection.
const sections: [string,string,string[]][] = [
  ["portugues","Língua Portuguesa",[
    "Análise, compreensão e interpretação de diversos tipos de textos verbais, não verbais, literários e não literários.",
    "Informações literais e inferências possíveis.","Ponto de vista do autor.",
    "Estruturação do texto: relações entre ideias, recursos de coesão.","Significação contextual de palavras e expressões.","Sinônimos e antônimos.","Sentido próprio e figurado das palavra.",
    "Classes de palavras: emprego e sentido que imprimem às relações que estabelecem: substantivo, adjetivo, artigo, numeral.",
    "Regência verbal e nominal.","Crase.","Classes de palavras: emprego e sentido que imprimem às relações que estabelecem: pronomes.",
    "Classes de palavras: emprego e sentido que imprimem às relações que estabelecem: verbo, advérbio, preposição, conjunção e interjeição.","Colocação pronominal.","Concordância verbal e nominal.","Pontuação."
  ]],
  ["informatica","Informática",[
    "MS-Word: estrutura básica dos documentos, edição e formatação de textos, cabeçalhos, parágrafos, fontes, colunas, marcadores simbólicos e numéricos.",
    "MS-Word: tabelas, impressão, controle de quebras e numeração de páginas, legendas, índices, inserção de objetos, campos predefinidos, caixas de texto.",
    "Internet: navegação internet, conceitos de URL, links, sites, busca e impressão de páginas.","Correio Eletrônico: uso de correio eletrônico, preparo e envio de mensagens, anexação de arquivos.","OneDrive: armazenamento e compartilhamento de arquivos.",
    "MS Teams: chats, chamadas de áudio e vídeo, criação de grupos, trabalho em equipe: Word, Excel, PowerPoint, SharePoint e OneNote, agendamento de reuniões e gravação.",
    "MS-Windows 10 ou superior: conceito de pastas, diretórios, arquivos e atalhos, área de trabalho.",
    "MS-Windows 10 ou superior: área de transferência, manipulação de arquivos e pastas, uso dos menus, programas e aplicativos, interação com o conjunto de aplicativos do Microsoft-365:",
    "MS-Excel: estrutura básica das planilhas, conceitos de células, linhas, colunas, pastas e gráficos, elaboração de tabelas e gráficos.",
    "MS-Excel: , uso de fórmulas, funções e macros, impressão, inserção de objetos, campos predefinidos, controle de quebras e numeração de páginas, obtenção de dados externos, classificação de dados."
  ]],
  ["matematica","Matemática",["Operações com números reais.","Mínimo múltiplo comum e máximo divisor comum","Razão e proporção.","Regra de três simples e composta.","Porcentagem.","Média aritmética simples e ponderada.","Juros simples.","Equação do 1.º e 2.º graus.","Sistema de equações do 1.º grau.","Relação entre grandezas: tabelas e gráficos.","Sistemas de medidas usuais.","Noções de geometria: forma, perímetro, área, volume, ângulo, teorema de Pitágoras."]],
  ["raciocinio","Raciocínio lógico",["Estruturas lógicas.","Lógicas de argumentação.","Diagramas lógicos.","Sequências lógicas."]],
  ["penal","Direito Penal",[
    "Dos crimes contra a fé pública (art. 293 ao 305, 307 e 308)","Das fraudes em certames de interesse público (art. 311-A)",
    "Dos crimes contra a Adm Pública (funcionário público contra a Administração em geral) (art. 312 a 317 e 319 a 327)",
    "Dos crimes contra a Adm Pública (particular contra a Administração em geral) (art. 328 a 333, 336 e 337)",
    "Dos crimes contra a Adm Pública (administração da justiça) (art. 339 ao 347, 357 e 359)"
  ]],
  ["processual-penal","Direito Processual Penal",[
    "Juizados Especiais Criminais (Lei 9.099/95 artigos 60 a 83, 88 e 89)","Do Juiz e do Ministério Público (art. 251 a 258)",
    "Do acusado e seu defensor (art. 261 a 267) e dos funcionários da justiça (art 274)","Das citações e intimações (art. 351 a 372)","Da instrução criminal (art. 394 a 405)",
    "Procedimento do Tribunal do Júri - Da Acusação e da Instrução Preliminar até Da Função do Jurado (art. 406 a 446)",
    "Procedimento do Tribunal do Júri - Da composição do tribunal do Júri e formação do conselho de sentença até das atribuições do presidente (art. 447 a 497)",
    "Do processo sumário (art. 531 a 538)","Do processo de restauração de autos extraviados ou destruídos (art. 541 a 548)",
    "Dos recursos no processo penal - Disposições gerais. R.E.S.E. Apelação. Processo e julgamento dosrecursos em sentido estrito e apelações nos tribunais.(art. 574 a 618)",
    "Dos recursos no processo penal - Dos embargos, da revisão, do recurso extraordinário, da carta testemunhável, do habeas corpus e seu processo (art. 619 a 667)"
  ]],
  ["processual-civil","Direito Processual Civil",[
    "Juizados Especiais Cíveis (JEC - Lei nº 9.099/95, artigos 3º ao 19)","Juizados Especiais da Fazenda Pública (Lei nº 12.153/09).",
    "Impedimento e suspeição e auxiliares da justiça (art. 144 ao 155)","Forma dos atos processuais (art. 188 ao 211)","Tempo e lugar dos atos processuais (art. 212 ao 217)","Dos prazos processuais (art. 218 ao 235)","Comunicação dos atos processuais (art. 236 ao 275)","Tutelas provisórias (art. 294 ao 311)",
    "Procedimento comum - Das disposições gerais à audiência de instrução e julgamento (art. 318 ao 368)",
    "Procedimento comum - Das provas (disposições gerais até inspeção judicial (art. 369 ao 484)","Sentença e coisa julgada, liquidação e cumprimento de sentença (artigos 485 a 538)","Recursos (artigos 994 a 1026)"
  ]],
  ["constitucional","Direito Constitucional",["Direitos individuais e coletivos (artigo 5º)","Direito sociais (artigos 6º ao 11)","Nacionalidade (artigos 12 e 13)","Administração pública: disposições gerais (artigos 37 e 38)","Administração Pública: servidores públicos (artigos 39 a 41)","Órgãos do Poder Judiciário (artigo 92)"]],
  ["administrativo","Direito Administrativo",[
    "Lei de Improbidade Administrativa (Lei nº 8.429/92 - art. 1° ao 11)","Lei de Improbidade Administrativa (Lei nº 8.429/92 - art. 12 ao 24)",
    "Estatuto dos Funcionários Públicos de SP: Disposições preliminares (art. 1º ao 10)","Estatuto dos Funcionários Públicos de SP: Provimento, exercício e vacância (art. 11 ao 45)","Estatuto dos Funcionários Públicos de SP: Provimento, exercício e vacância (art. 46 ao 86)","Estatuto dos Funcionários Públicos de SP: Acumulações remuneradas (art. 171 ao 175)",
    "Estatuto dos Funcionários Públicos de SP: direito de petição, deveres, proibições, responsabilidades, penalidades e sua aplicação. Das providências preliminares. Das práticas autocompositivas, do termo de ajustamento de conduta e da suspensão condicional da sindicância. (art. 239 ao 267-P)",
    "Estatuto dos Funcionários Públicos de SP: procedimento disciplinar - processo administrativo, processo por inassiduidade, recursos, revisão e disposições finais (artigos 268 ao 323)"
  ]],
  ["legislacao","Legislação Interna",[
    "[NCGJ] Da função correcional. Artigos 5º ao 18.",
    "[NCGJ] Dos ofícios de justiça em geral (Disposições iniciais, Das atribuições, do Sistema Informatizado Oficial, dos Livros e Classificadores Obrigatórios, da Escrituração) (arts. 26 ao 29, 46 ao 86).",
    "[NCGJ] Dos ofícios de justiça em geral - Da ordem dos serviços dos processos em geral (da autuação, abertura de volumes e numeração de feitos, da recepção e juntada de petições, dos atos e termos judiciais e das cotas nos autos, da movimentação dos autos). (Arts. 87 ao 99)",
    "[NCGJ] Dos ofícios de justiça em geral - Dos papéis em andamento ou findos. Das certidões. Dos mandados. Dos ofícios; Das comunicações oficiais, transmissão de informações processuais e prática de atos processuais por meio eletrônico; Das cartas precatórias, rogatórias e arbitrais; Das intimações. (Arts. 103 ao 142)",
    "[NCGJ] Dos Ofícios de Justiça em geral - Das audiências; Da consulta e da carga dos autos; Do desentranhamento de peças e documentos dos autos; Do arquivamento, rearquivamento, desarquivamento de processos e pesquisa histórica de acervo arquivado. (artigos 143 ao 189-G)",
    "[NCGJ] Do Processo Eletrônico - Do Sistema de Processamento Eletrônico, do Peticionamento Eletrônico, da Distribuição, do Protocolo de Petições Intermediárias, da Consulta às Movimentações Processuais e Decisões, da Tramitação dos Processos Eletrônicos - de Disposição inicial até Publicidade de Expedientes e Movimentações. (artigos 1.189 ao 1.244)",
    "[NCGJ] Do Processo Eletrônico - Da Tramitação dos Processos Eletrônicos - Das Citações, Intimações e Notificações. (artigos 1.245 ao 1.301)",
    "Lei Complementar nº 1.111/2010","Resolução TJSP nº 850/2021.","Resolução TJSP nº 963/2025.","Regimento Interno do Tribunal de Justiça de São Paulo."
  ]],
  ["atualidades","Atualidades/PCD",["Artigos 1º ao 13 e 34 ao 38 (Lei nº 13.146/15)","Janeiro/Fevereiro 2026","Março/Abril 2026","Maio/Junho/Julho 2026","Agosto/26","Setembro/26","Outubro/26","Novembro/26","Dezembro/26","Janeiro/27"]],
];
export const tjspSyllabus:Subject[] = sections.map(([id,name,topics])=>({id,name,topics,color:"#8b5cf6",short:name.split(" ").map(w=>w[0]).join("").slice(0,3),source:NOTION_SOURCE}));

/** Append only: old indices, completed topics, planner links and study history remain valid. */
export function ensureTjspSyllabus(state:StudyState):StudyState {
  const subjects=state.subjects.map(s=>({...s,topics:[...s.topics]}));
  for(const section of tjspSyllabus){
    const existing=subjects.find(s=>s.id===section.id);
    if(!existing)subjects.push({...section,topics:[...section.topics]});
    else for(const topic of section.topics)if(!existing.topics.includes(topic))existing.topics.push(topic);
  }
  return {...state,subjects};
}
