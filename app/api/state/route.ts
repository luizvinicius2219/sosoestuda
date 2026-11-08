import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getSofiaUser } from "@/lib/auth";
import { getDb } from "@/db";
import { userStudyState } from "@/db/schema";
import { createInitialState, studyStateSchema } from "@/lib/study";

export const dynamic = "force-dynamic";
const MAX_BYTES = 512 * 1024;
const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const mutationSchema = z.object({ state: studyStateSchema, version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1) }).strict();

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: privateHeaders });
}

export async function GET() {
  const user = await getSofiaUser();
  if (!user) return json({ error: "Entre na sua conta para sincronizar seus estudos." }, 401);
  try {
    const row = await getDb().select().from(userStudyState).where(eq(userStudyState.ownerId, user.userId)).then(rows => rows[0]);
    const state = row ? studyStateSchema.parse(JSON.parse(row.stateJson)) : createInitialState(false);
    if (!row) state.profile.name = (user.name).slice(0, 80);
    return json({ state, version: row?.version ?? 0, user: { name: user.name, email: user.email } });
  } catch {
    return json({ error: "Não foi possível carregar seus estudos. Tente novamente." }, 503);
  }
}

async function boundedBody(request: Request): Promise<unknown> {
  const advertisedLength = Number(request.headers.get("content-length"));
  if (advertisedLength > MAX_BYTES) throw new RangeError("Payload too large");
  if (!request.body) throw new SyntaxError("Empty body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw new RangeError("Payload too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(body));
}

export async function PUT(request: Request) {
  const user = await getSofiaUser();
  if (!user) return json({ error: "Entre na sua conta para sincronizar seus estudos." }, 401);
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return json({ error: "Origem de solicitação inválida." }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return json({ error: "Envie os dados em formato JSON." }, 415);

  let input: z.infer<typeof mutationSchema>;
  try { input = mutationSchema.parse(await boundedBody(request)); }
  catch (error) {
    if (error instanceof RangeError) return json({ error: "Seu caderno excedeu o limite de 512 KiB. Exporte uma cópia antes de continuar." }, 413);
    return json({ error: "Confira os dados de estudo antes de salvar." }, 400);
  }

  try {
    const db = getDb();
    const nextVersion = input.version + 1;
    const values = { stateJson: JSON.stringify(input.state), version: nextVersion, updatedAt: new Date().toISOString() };
    const result = input.version === 0
      ? await db.insert(userStudyState).values({ ownerId: user.userId, ...values }).onConflictDoNothing().returning({ version: userStudyState.version }).then(rows => rows[0])
      : await db.update(userStudyState).set(values).where(and(eq(userStudyState.ownerId, user.userId), eq(userStudyState.version, input.version))).returning({ version: userStudyState.version }).then(rows => rows[0]);
    if (!result) return json({ error: "Seus estudos foram alterados em outra janela. Recarregue para obter a versão mais recente." }, 409);
    return json({ version: result.version });
  } catch {
    return json({ error: "Não foi possível salvar agora. Seus dados locais foram preservados." }, 503);
  }
}
