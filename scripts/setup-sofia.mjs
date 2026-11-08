// Execute only in a trusted private environment. Never commit .env.local.
import {betterAuth} from "better-auth";
import {getMigrations} from "better-auth/db/migration";
import {Pool} from "pg";
import {randomBytes} from "node:crypto";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
const {DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, SOFIA_EMAIL, SOFIA_INITIAL_PASSWORD, SOFIA_INITIAL_PASSWORD_HASH}=process.env;
const initialPassword=SOFIA_INITIAL_PASSWORD_HASH?randomBytes(24).toString("hex"):SOFIA_INITIAL_PASSWORD;
if(SOFIA_INITIAL_PASSWORD_HASH && !/^[a-f0-9]{32}:[a-f0-9]{128}$/i.test(SOFIA_INITIAL_PASSWORD_HASH))throw new Error("Formato de credencial protegida inválido.");
if(!DATABASE_URL || !BETTER_AUTH_SECRET || BETTER_AUTH_SECRET.length<32 || !BETTER_AUTH_URL || !SOFIA_EMAIL || !initialPassword || initialPassword.length<10) throw new Error("Configure as variáveis privadas e uma senha inicial de ao menos 10 caracteres.");
const pool=new Pool({connectionString:DATABASE_URL,max:2});
try {
 const options={database:pool,secret:BETTER_AUTH_SECRET,baseURL:BETTER_AUTH_URL,emailAndPassword:{enabled:true,minPasswordLength:10,...(SOFIA_INITIAL_PASSWORD_HASH?{password:{hash:async()=>SOFIA_INITIAL_PASSWORD_HASH}}:{})},rateLimit:{enabled:true,storage:"database",window:60,max:20}};
 const migrations=await getMigrations(options);await migrations.runMigrations();
 await pool.query(`CREATE TABLE IF NOT EXISTS user_study_state (owner_id TEXT PRIMARY KEY,state_json TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL)`);
 const existing=await pool.query('SELECT id FROM "user" WHERE lower(email)=lower($1)',[SOFIA_EMAIL]);
 if(existing.rows.length){console.log("A conta autorizada já existe. Nenhuma senha foi alterada.");}
 else {const auth=betterAuth(options);await auth.api.signUpEmail({body:{email:SOFIA_EMAIL,password:initialPassword,name:"Sofia"}});console.log("Conta pessoal criada. Remova SOFIA_INITIAL_PASSWORD do ambiente.");}
} finally {await pool.end();}

if(process.env.PLANNER_IMPORT_FILE){const {importPrivatePlanner}=await import("./import-planner.mjs");await importPrivatePlanner(process.env.PLANNER_IMPORT_FILE);}

if(process.env.PLANNER_IMPORT_JSON){
 const dir=await mkdtemp(join(tmpdir(),"sofia-plan-"));
 try{const file=join(dir,"plan.json");await writeFile(file,process.env.PLANNER_IMPORT_JSON,{mode:0o600});const {importPrivatePlanner}=await import("./import-planner.mjs");await importPrivatePlanner(file);}finally{await rm(dir,{recursive:true,force:true});}
}
