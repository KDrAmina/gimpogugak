import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "인증 필요", status: 401, supabase: null };

  const { data: profile } = await supabase
    .from("profiles").select("role, status").eq("id", user.id).single();
  if (profile?.role !== "admin" || profile?.status !== "active") {
    return { error: "관리자 권한 필요", status: 403, supabase: null };
  }
  return { error: null, status: 200, supabase };
}

// GET /api/admin/settings?key=bank_account
// GET /api/admin/settings  (전체 조회)
export async function GET(req: NextRequest) {
  const { error, status, supabase } = await verifyAdmin();
  if (error || !supabase) return NextResponse.json({ error }, { status });

  const key = req.nextUrl.searchParams.get("key");

  if (key) {
    const { data, error: dbErr } = await supabase
      .from("settings").select("value").eq("key", key).single();
    if (dbErr && dbErr.code !== "PGRST116") {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }
    return NextResponse.json({ key, value: data?.value ?? "" });
  }

  const { data, error: dbErr } = await supabase.from("settings").select("*");
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ settings: data ?? [] });
}

// POST /api/admin/settings
// body: { key: string, value: string }
export async function POST(req: NextRequest) {
  const { error, status, supabase } = await verifyAdmin();
  if (error || !supabase) return NextResponse.json({ error }, { status });

  const { key, value } = await req.json();
  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "key 필수" }, { status: 400 });
  }

  const { error: dbErr } = await supabase
    .from("settings")
    .upsert({ key, value: value ?? "", updated_at: new Date().toISOString() });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
