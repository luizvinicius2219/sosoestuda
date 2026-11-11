import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { Pool } from 'pg';
import { createInitialState, reconcileStudyState, studyStateSchema } from '../lib/study.ts';
import { importNotebook } from '../lib/notebook.ts';

export async function importPrivateNotebook(file) {
  if (!process.env.DATABASE_URL || !process.env.SOFIA_EMAIL) throw new Error('Configure o banco e a conta privada antes de importar.');
  const raw = file ? await readFile(file, 'utf8') : process.env.NOTEBOOK_IMPORT_JSON;
  if (!raw || Buffer.byteLength(raw) > 400000) throw new Error('Informe um caderno JSON de até 400 KB.');
  const input = JSON.parse(raw);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const users = await pool.query('SELECT id FROM "user" WHERE lower(email)=lower($1)', [process.env.SOFIA_EMAIL]);
    if (users.rows.length !== 1) throw new Error('Conta privada não encontrada.');
    const owner = users.rows[0].id;
    const rows = await pool.query('SELECT state_json,version FROM user_study_state WHERE owner_id=$1', [owner]);
    const row = rows.rows[0];
    const before = row ? studyStateSchema.parse(JSON.parse(row.state_json)) : createInitialState(false);
    const after = studyStateSchema.parse(reconcileStudyState(importNotebook(reconcileStudyState(before), input)));
    const json = JSON.stringify(after);
    if (Buffer.byteLength(json) > 510000) throw new Error('O caderno completo excede o limite de sincronização.');
    if (row && json === row.state_json) { console.log('Caderno já importado; nenhum registro alterado.'); return; }
    const result = row
      ? await pool.query('UPDATE user_study_state SET state_json=$1,version=version+1,updated_at=$2 WHERE owner_id=$3 AND version=$4 RETURNING version', [json,new Date().toISOString(),owner,row.version])
      : await pool.query('INSERT INTO user_study_state(owner_id,state_json,version,updated_at) VALUES($1,$2,1,$3) ON CONFLICT DO NOTHING RETURNING version', [owner,json,new Date().toISOString()]);
    if (result.rowCount !== 1) throw new Error('Os estudos foram alterados durante a importação. Tente novamente.');
    const verify = await pool.query('SELECT state_json FROM user_study_state WHERE owner_id=$1', [owner]);
    const saved = studyStateSchema.parse(JSON.parse(verify.rows[0].state_json));
    const imported = new Set((saved.questionRecords || []).map(q=>q.sourceKey || q.id));
    if (input.records.some(q=>!imported.has(q.sourceKey || q.id))) throw new Error('A verificação da importação falhou.');
    console.log(`Caderno verificado no banco: ${(after.questionRecords?.length || 0) - (before.questionRecords?.length || 0)} novos registros. Histórico preservado.`);
  } finally { await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await importPrivateNotebook(process.argv[2]);
