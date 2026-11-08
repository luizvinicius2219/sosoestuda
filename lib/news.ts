export type NewsItem = {
  tribunal: string;
  date: string;
  category: string;
  title: string;
  summary: string;
  url: string;
};

export type NewsResponse = {
  items: NewsItem[];
  mode: "live" | "curated";
  checkedAt: string;
  verifiedAt: "2026-11-07";
  message: string;
};

// Sources were read and verified on this date. These dates describe publications,
// not an assertion that an application period remains open when the app is used.
export const NEWS_VERIFIED_AT = "2026-11-07" as const;
export const STJ_RSS_URL = "https://res.stj.jus.br/hrestp-c-portalp/RSS.xml";
// The official STJ directory lists the feed above:
// https://www.stj.jus.br/sites/portalp/Paginas/RSS.aspx
export const CURATED_NEWS: NewsItem[] = [
  {
    tribunal: "TRF3", date: "2026-11-04", category: "Inscrições",
    title: "TRF3 abre inscrições para concurso de servidores",
    summary: "A publicação informa inscrições até 23 de novembro de 2026 e provas previstas para 31 de janeiro de 2027. Confira o edital e suas retificações.",
    url: "https://web.trf3.jus.br/noticias-intranet-sjms/Noticiar/ExibirNoticia/1439-inscricoes-abertas-para-concurso-de-servidores-da",
  },
  {
    tribunal: "TRF3", date: "2026-11-04", category: "Retificação",
    title: "Edital nº 02/2026 retifica o concurso do TRF3",
    summary: "O documento atualiza regras de inscrição, pagamento, provas e recursos do concurso de servidores.",
    url: "https://www.trf3.jus.br/documentos/sege/RING_-_Concursos/2026/Editais/Edital_2_2026_completo.pdf",
  },
  {
    tribunal: "STJ", date: "2026-10-14", category: "Resultado",
    title: "STJ retifica resultados de cargos de analista",
    summary: "O Edital nº 38/2026 altera resultados de Engenharia Mecânica e Suporte em Tecnologia da Informação por decisões judiciais.",
    url: "https://www.stj.jus.br/sites/portalp/SiteAssets/Paginas/Institucional/Concursos/Edt_38_2026_STJ.pdf",
  },
  {
    tribunal: "TSE", date: "2026-10-08", category: "Movimentação",
    title: "Justiça Eleitoral publica os Editais 52 e 53",
    summary: "As atualizações incluem candidatos sub judice em resultados do concurso unificado e mantêm as homologações anteriores.",
    url: "https://www.tse.jus.br/institucional/sobre-o-tse/concurso-publico",
  },
  {
    tribunal: "TRT6", date: "2026-10-08", category: "Acompanhamento",
    title: "Acompanhe as nomeações do concurso do TRT6",
    summary: "A página oficial, atualizada em outubro, reúne documentos e relação de nomeados com referência até 17 de julho de 2026.",
    url: "https://www.trt6.jus.br/portal/concurso-servidores-e-servidoras-2024",
  },
];

function decodeXml(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, number: string) => {
      const code = number.toLowerCase().startsWith("x") ? parseInt(number.slice(1), 16) : Number(number);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

function field(item: string, name: string): string {
  const match = item.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match ? decodeXml(match[1]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
}

function publicationDate(raw: string, url: string): string | null {
  // STJ's RSS uses Portuguese weekdays and month abbreviations; its article URLs
  // also contain an explicit DDMMYYYY publication date.
  const datedUrl = url.match(/\/(20\d{2})\/(\d{2})(\d{2})(20\d{2})-/);
  let value: Date;
  if (datedUrl && datedUrl[1] === datedUrl[4]) {
    value = new Date(`${datedUrl[4]}-${datedUrl[3]}-${datedUrl[2]}T12:00:00-03:00`);
  } else {
    const months: Record<string, string> = { jan: "Jan", fev: "Feb", mar: "Mar", abr: "Apr", mai: "May", jun: "Jun", jul: "Jul", ago: "Aug", set: "Sep", out: "Oct", nov: "Nov", dez: "Dec" };
    const normalized = raw.replace(/^[^,]+,\s*/, "").replace(/\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/gi, month => months[month.toLowerCase()]);
    value = new Date(normalized);
  }
  if (!Number.isFinite(value.getTime()) || value.getTime() > Date.now() + 86400000) return null;
  return value.toISOString().slice(0, 10);
}

export function parseStjRecruitmentFeed(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  for (const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const title = field(match[1], "title");
    const url = field(match[1], "link");
    const summary = field(match[1], "description");
    // Institutional events and judgments involving public employees are not
    // recruitment news. Require a recruitment term in the headline itself.
    const recruitment = /concurso\s+p[uú]blico|certame/i.test(title)
      || (/concurso|edital/i.test(title) && /servidor|judici[aá]ri|cargo|analista|t[eé]cnico/i.test(title))
      || (/nomea[cç][aã]o|nomeados|convoca[cç][aã]o/i.test(title) && /servidor|analista|t[eé]cnico/i.test(title));
    if (!recruitment || title.length < 12) continue;
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "www.stj.jus.br") continue;
    } catch { continue; }
    const date = publicationDate(field(match[1], "pubDate"), url);
    if (!date) continue;
    const category = /retifica/i.test(title) ? "Retificação" : /resultado|homologa/i.test(title) ? "Resultado" : /nomea|convoca/i.test(title) ? "Nomeações" : "Concurso";
    items.push({ tribunal: "STJ", date, category, title: title.slice(0, 240), summary: (summary || "Consulte a publicação oficial do Superior Tribunal de Justiça.").slice(0, 360), url });
  }
  return Array.from(new Map(items.map(item => [item.url, item])).values())
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
}

export async function fetchOfficialNews(): Promise<NewsResponse> {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(STJ_RSS_URL, {
      headers: { Accept: "application/rss+xml, application/xml, text/xml" },
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    if (!response.ok) throw new Error("Official feed unavailable");
    const xml = await response.text();
    if (xml.length > 2_000_000) throw new Error("Feed exceeds size limit");
    const items = parseStjRecruitmentFeed(xml);
    if (items.length) return {
      items, mode: "live", checkedAt, verifiedAt: NEWS_VERIFIED_AT,
      message: "Publicações de concursos consultadas no RSS oficial do STJ. As datas abaixo são as datas das publicações.",
    };
  } catch {
    // An unavailable or empty feed must never masquerade as a fresh selection.
  }
  return {
    items: CURATED_NEWS, mode: "curated", checkedAt, verifiedAt: NEWS_VERIFIED_AT,
    message: "Seleção de fontes oficiais verificada em 07/11/2026. O RSS não retornou novas publicações de concursos nesta consulta; confira atualizações na fonte.",
  };
}
