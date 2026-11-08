import {getAuth} from "@/lib/auth";
export async function POST(request:Request){if(request.headers.get("origin")!==new URL(request.url).origin)return new Response(null,{status:403});return getAuth().api.signOut({headers:request.headers,asResponse:true});}
