import { getAuth } from "@/lib/auth";
export const runtime="nodejs";
async function handle(request:Request) {
 try { return await getAuth().handler(request); }
 catch { return Response.json({error:{message:"O acesso privado ainda não foi configurado pelo responsável."}},{status:503}); }
}
export {handle as GET,handle as POST};
