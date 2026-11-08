import { and, eq } from "drizzle-orm";
import { getSofiaUser } from "@/lib/auth";
import { getDb } from "@/db";
import { userStudyState } from "@/db/schema";
import { assistantRequestSchema, type AssistantMessage } from "@/lib/assistant-schema";
import { createInitialState, reconcileStudyState, studyStateSchema } from "@/lib/study";
import { liaError, runLia } from "@/lib/lia";

export const dynamic="force-dynamic";
export const maxDuration=120;
const headers={"Cache-Control":"private, no-store",Vary:"Cookie"};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers});

export async function GET(){
  if(!await getSofiaUser())return json({error:"Entre na sua conta para conversar com a Lia."},401);
  return json({configured:!!process.env.GEMINI_API_KEY,name:"Lia",provider:"gemini",capabilities:["chat","research","study","planning","notes","errors","calendar"]});
}

async function readBody(request:Request){
  if(Number(request.headers.get("content-length"))>16000)throw new RangeError();
  if(!request.body)throw new Error();
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>16000){await reader.cancel();throw new RangeError();}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return assistantRequestSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
}

export async function POST(request:Request){
  const user=await getSofiaUser();if(!user)return json({error:"Entre na sua conta para conversar com a Lia."},401);
  if(request.headers.get("origin")!==new URL(request.url).origin||request.headers.get("sec-fetch-site")==="cross-site")return json({error:"Origem da solicitação inválida."},403);
  if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))return json({error:"Envie a mensagem em JSON."},415);
  let body;try{body=await readBody(request);}catch(error){return json({error:error instanceof RangeError?"Mensagem muito grande.":"Envie uma mensagem de até 3 mil caracteres."},error instanceof RangeError?413:400);}
  if(!process.env.GEMINI_API_KEY)return json({error:"A Lia ainda precisa ser conectada ao Gemini pelo responsável pelo app."},503);
  const db=getDb();
  try{
    const row=await db.select().from(userStudyState).where(eq(userStudyState.ownerId,user.userId)).then(rows=>rows[0]);
    const state=reconcileStudyState(row?studyStateSchema.parse(JSON.parse(row.stateJson)):createInitialState(false));
    const version=row?.version||0;
    const replay=state.assistantMessages?.find(m=>m.requestId===body.requestId&&m.role==="assistant");
    if(replay){
      if(!state.assistantMessages?.some(m=>m.requestId===body.requestId&&m.role==="user"&&m.content===body.message))return json({error:"Este identificador já pertence a outra mensagem."},409);
      return json({state,version,answer:replay.content,requestId:body.requestId,replayed:true});
    }
    if(body.version!==version)return json({error:"Seus estudos mudaram em outra janela. Recarregue antes de conversar para preservar as alterações."},409);
    const last=state.assistantMessages?.filter(m=>m.role==="user").at(-1);
    if(last&&Date.now()-Date.parse(last.createdAt)<2500)return json({error:"Só um instante entre as mensagens, para a Lia conseguir acompanhar."},429);
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(85000)]);
    const result=await runLia({state,message:body.message,web:body.web,actions:body.actions,signal});
    signal.throwIfAborted();
    const createdAt=new Date().toISOString();
    const messages:AssistantMessage[]=[...(state.assistantMessages||[]),
      {id:crypto.randomUUID(),requestId:body.requestId,role:"user",content:body.message,createdAt},
      {id:crypto.randomUUID(),requestId:body.requestId,role:"assistant",content:result.answer,createdAt,...(result.sources.length?{sources:result.sources}:{}),...(result.searchHtml?{searchHtml:result.searchHtml}:{}),...(result.receipts.length?{actions:result.receipts}:{})}];
    let next=studyStateSchema.parse(reconcileStudyState({...result.state,assistantMessages:messages.slice(-40)}));
    while(Buffer.byteLength(JSON.stringify(next))>512*1024&&(next.assistantMessages?.length||0)>2)next={...next,assistantMessages:next.assistantMessages!.slice(2)};
    const stateJson=JSON.stringify(next);
    if(Buffer.byteLength(stateJson)>512*1024)return json({error:"Seu caderno está cheio. Exporte uma cópia e libere espaço antes de continuar. Nada foi alterado."},413);
    const values={stateJson,version:version+1,updatedAt:createdAt};
    const saved=version===0
      ?await db.insert(userStudyState).values({ownerId:user.userId,...values}).onConflictDoNothing().returning({version:userStudyState.version}).then(rows=>rows[0])
      :await db.update(userStudyState).set(values).where(and(eq(userStudyState.ownerId,user.userId),eq(userStudyState.version,version))).returning({version:userStudyState.version}).then(rows=>rows[0]);
    if(!saved)return json({error:"Seus estudos foram alterados durante a conversa. Nada desta solicitação foi aplicado. Recarregue e tente novamente."},409);
    return json({state:next,version:saved.version,answer:result.answer,requestId:body.requestId});
  }catch(error){const problem=liaError(error);return json({error:problem.message},problem.status);}
}
