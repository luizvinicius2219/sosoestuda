// Run locally with private credentials. This file contains no course content or personal identifiers.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {Pool} from 'pg';
import {createInitialState,studyStateSchema} from '../lib/study.ts';
import {importPlanner} from '../lib/planner.ts';
export async function importPrivatePlanner(file){
 if(!file||!process.env.DATABASE_URL||!process.env.SOFIA_EMAIL)throw new Error('Configure o banco privado e a conta autorizada; informe o arquivo do plano.');
 const raw=await readFile(file,'utf8');if(Buffer.byteLength(raw)>180000)throw new Error('Plano acima do limite de 180 KB.');
 const plan=JSON.parse(raw);const pool=new Pool({connectionString:process.env.DATABASE_URL,max:2});
 try{
  const user=await pool.query('SELECT id FROM "user" WHERE lower(email)=lower($1)',[process.env.SOFIA_EMAIL]);if(user.rows.length!==1)throw new Error('Crie primeiro a conta privada da Sofia.');
  const owner=user.rows[0].id;const rows=await pool.query('SELECT state_json,version FROM user_study_state WHERE owner_id=$1',[owner]);
  const current=rows.rows[0];const state=studyStateSchema.parse(importPlanner(current?studyStateSchema.parse(JSON.parse(current.state_json)):createInitialState(false),plan));
  const result=current?await pool.query('UPDATE user_study_state SET state_json=$1,version=version+1,updated_at=$2 WHERE owner_id=$3 AND version=$4 RETURNING version',[JSON.stringify(state),new Date().toISOString(),owner,current.version]):await pool.query('INSERT INTO user_study_state(owner_id,state_json,version,updated_at) VALUES($1,$2,1,$3) ON CONFLICT DO NOTHING RETURNING version',[owner,JSON.stringify(state),new Date().toISOString()]);
  if(!result.rowCount)throw new Error('Outro dispositivo alterou o caderno. Tente importar novamente.');
  console.log('Plano privado importado. Histórico de estudos preservado.');
 }finally{await pool.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await importPrivatePlanner(process.argv[2]||process.env.PLANNER_IMPORT_FILE);
