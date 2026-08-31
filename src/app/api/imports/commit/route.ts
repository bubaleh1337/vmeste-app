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
  fileName: z.string().trim().min(1).max(255),
  fileType: z.enum(["csv", "xlsx"]),
  fileHash: z.string().regex(/^[0-9a-f]{64}$/),
  mapping: z.record(z.string(), z.unknown()),
  rows: z.array(rowSchema).min(1).max(1000),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Некорректные данные импорта." }, { status: 400 });

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const { data, error } = await supabase.rpc("commit_financial_import", {
    p_goal_id: parsed.data.goalId,
    p_target_kind: parsed.data.targetKind,
    p_file_name: parsed.data.fileName,
    p_file_type: parsed.data.fileType,
    p_file_sha256: parsed.data.fileHash,
    p_mapping: parsed.data.mapping,
    p_rows: parsed.data.rows,
  });
  if (error) {
    if (process.env.NODE_ENV === "development") console.error("[Import commit]", error.code, error.message);
    const duplicateFile = error.message.includes("file_already_imported");
    return NextResponse.json({
      error: duplicateFile ? "Этот файл уже был импортирован. Повторная загрузка заблокирована." : "Импорт отклонён. Ни одна финансовая операция не была записана.",
    }, { status: 400 });
  }
  return NextResponse.json(data);
}
