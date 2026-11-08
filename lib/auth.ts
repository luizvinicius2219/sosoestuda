import { betterAuth } from "better-auth";
import { headers } from "next/headers";
import { getPool } from "@/db";
let instance: ReturnType<typeof buildAuth> | undefined;
export function getAuth() { return instance ??= buildAuth(); }
function buildAuth() {
 if (!process.env.BETTER_AUTH_SECRET || !process.env.BETTER_AUTH_URL || !process.env.SOFIA_EMAIL) throw new Error("Acesso privado ainda não configurado.");
 return betterAuth({
  database:getPool(), secret:process.env.BETTER_AUTH_SECRET, baseURL:process.env.BETTER_AUTH_URL,
  emailAndPassword:{enabled:true, disableSignUp:true, minPasswordLength:10},
  rateLimit:{enabled:true, storage:"database", window:60, max:20},
  session:{expiresIn:60*60*24, updateAge:60*60},
 });
}
export async function getSofiaUser() {
 if (!process.env.DATABASE_URL || !process.env.SOFIA_EMAIL || !process.env.BETTER_AUTH_SECRET || !process.env.BETTER_AUTH_URL) return null;
 const session = await getAuth().api.getSession({headers:await headers()});
 if (!session || session.user.email.toLowerCase() !== process.env.SOFIA_EMAIL.toLowerCase()) return null;
 return {userId:session.user.id, name:"Sofia", email:session.user.email};
}
