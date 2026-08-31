import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const rowSchema = z.object({
  rowNumber: z.number().int().positive(),
  normalizedDate: z.string().nullable(),
  amountMinor: z.string().regex(/^-?\d+$/).nullable(),
  description: z.string().max(500),
  participantUserId: z.uuid(),
  savingsType: z.enum(["contribution", "interest", "withdrawal", "fee", "adjustment_plus", "adjustment_minus"]).nullable(),
  categoryId: z.uuid().nullable(),
  isDiscretionary: z.boolean(),
  analyticsStatus: z.enum(["included", "excluded", "needs_review"]),
  selected: z.boolean(),
  errorCode: z.string().max(120).nullable(),
});

const requestSchema = z.object({
  goalId: z.uuid(),
  targetKind: z.enum(["savings", "expenses"]),
  fileHash: z.string().regex(/^[0-9a-f]{64}$/),
  rows: z.array(rowSchema).min(1).max(1000),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Некорректные данные предварительной проверки." }, { status: 400 });

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const { data, error } = await supabase.rpc("preview_financial_import", {
    p_goal_id: parsed.data.goalId,
    p_target_kind: parsed.data.targetKind,
    p_file_sha256: parsed.data.fileHash,
    p_rows: parsed.data.rows,
  });
  if (error) {
    if (process.env.NODE_ENV === "development") console.error("[Import preview]", error.code, error.message);
    return NextResponse.json({ error: "Не удалось проверить дубли. Финансовые данные не были изменены." }, { status: 400 });
  }
  return NextResponse.json(data);
}
