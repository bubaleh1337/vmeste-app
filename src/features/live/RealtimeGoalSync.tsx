"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const REFRESH_DEBOUNCE_MS = 220;

export function RealtimeGoalSync({ goalId }: { goalId: string }) {
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connectionProblem, setConnectionProblem] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const scheduleRefresh = () => {
      if (!active) return;
      if (process.env.NODE_ENV === "development") {
        console.debug("[Realtime] Goal change received", goalId);
      }
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    };

    const start = async () => {
      // The SSR browser client stores the Supabase session in cookies.
      // Postgres Changes with RLS must receive the user's access token on
      // the Realtime connection as well, otherwise the socket can connect
      // successfully while row events are silently filtered out.
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;

      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[Realtime] No authenticated session available", sessionError);
        }
        setConnectionProblem(true);
        return;
      }

      await supabase.realtime.setAuth(accessToken);
      if (!active) return;

      channel = supabase
        .channel(`goal-live:${goalId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "savings_transactions", filter: `goal_id=eq.${goalId}` }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `goal_id=eq.${goalId}` }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "expense_categories", filter: `goal_id=eq.${goalId}` }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "expense_category_overrides", filter: `goal_id=eq.${goalId}` }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "categorization_rules", filter: `goal_id=eq.${goalId}` }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "goal_members", filter: `goal_id=eq.${goalId}` }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "audit_log", filter: `goal_id=eq.${goalId}` }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "goals", filter: `id=eq.${goalId}` }, scheduleRefresh)
        .subscribe((status, error) => {
          if (!active) return;
          if (process.env.NODE_ENV === "development") {
            console.debug("[Realtime] Subscription status", status, error ?? "");
          }
          if (status === "SUBSCRIBED") setConnectionProblem(false);
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setConnectionProblem(true);
          }
        });
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active || !session?.access_token) return;
      void supabase.realtime.setAuth(session.access_token);
    });

    void start();

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [goalId, router]);

  if (!connectionProblem) return null;

  return (
    <div className="realtime-warning" role="status">
      Автообновление временно недоступно. Данные можно обновить перезагрузкой страницы.
    </div>
  );
}
