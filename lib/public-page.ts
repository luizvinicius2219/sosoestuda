import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request } from "node:https";

export function publicAddress(address:string):boolean{
  const family=isIP(address);
  if(family===6)return /^[23][0-9a-f]{3}:/i.test(address)&&!/^2001:0?db8:/i.test(address);
  if(family!==4)return false;
  const [a,b,c]=address.split(".").map(Number);
  return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===2))||(a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113));
}
export function publicUrl(value:string):URL{
  const url=new URL(value);
  if(url.protocol!=="https:"||url.username||url.password||(url.port&&url.port!=="443")||isIP(url.hostname.replace(/^\[|\]$/g,""))||!url.hostname.includes(".")||/\.(localhost|local|internal|test|invalid)$/i.test(url.hostname))throw new Error("Use um endereço HTTPS público, sem credenciais ou portas especiais.");
  return url;
}
function decode(value:string){return value.replace(/&#(x[\da-f]+|\d+);/gi,(_,code:string)=>{const n=code[0].toLowerCase()==="x"?parseInt(code.slice(1),16):Number(code);return n>0&&n<=0x10ffff?String.fromCodePoint(n):"";}).replace(/&nbsp;/gi," ").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&amp;/gi,"&");}
export function pageText(html:string){
  const title=decode(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]*>/g," ")||"Página consultada").trim().slice(0,300);
  const text=decode(html.replace(/<(script|style|svg|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi," ").replace(/<!--[\s\S]*?-->/g," ").replace(/<\/(p|div|section|article|h[1-6]|li|tr)>|<br\s*\/?>/gi,"\n").replace(/<[^>]*>/g," ")).replace(/[ \t]+/g," ").replace(/\n\s*\n/g,"\n").trim().slice(0,15000);
  return {title,text};
}

export async function readPublicPage(value:string,signal?:AbortSignal,redirects=0):Promise<{title:string;text:string;url:string;checkedAt:string}>{
  const url=publicUrl(value);
  const addresses=await lookup(url.hostname,{all:true});
  if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw new Error("Esse endereço não pode ser consultado pela assistente.");
  signal?.throwIfAborted();const selected=addresses[0];
  const result=await new Promise<{status:number;location?:string;html:string}>((resolve,reject)=>{
    const req=request(url,{method:"GET",signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(9000)]),headers:{Accept:"text/html, text/plain, application/xhtml+xml","Accept-Encoding":"identity","User-Agent":"SosoEstuda-Lia/1.0"},lookup:(_hostname,_options,callback)=>{callback(null,[{address:selected.address,family:selected.family}]);}},res=>{
      const status=res.statusCode||0;
      if([301,302,303,307,308].includes(status)){res.resume();resolve({status,location:res.headers.location,html:""});return;}
      if(status!==200||!/(text\/html|text\/plain|application\/xhtml\+xml)/i.test(res.headers["content-type"]||"")){res.resume();reject(new Error("Não consegui ler essa página de texto. Confira o link ou envie o trecho que deseja estudar."));return;}
      let size=0;const chunks:Buffer[]=[];
      res.on("data",chunk=>{size+=chunk.length;if(size>512*1024){req.destroy(new Error("A página excede o limite de leitura. Envie um trecho específico."));return;}chunks.push(chunk);});
      res.on("error",reject);res.on("end",()=>resolve({status,html:Buffer.concat(chunks).toString("utf8")}));
    });
    req.on("error",reject);req.end();
  });
  if(result.location){if(redirects>=3)throw new Error("O link redireciona muitas vezes.");return readPublicPage(new URL(result.location,url).toString(),signal,redirects+1);}
  const content=pageText(result.html);if(content.text.length<80||/^(just a moment|access denied|enable javascript|verificando se voc[eê])/i.test(content.text))throw new Error("A página não retornou conteúdo legível ou exige verificação no navegador.");
  return {...content,url:url.toString(),checkedAt:new Date().toISOString()};
}
