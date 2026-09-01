"use client";

import { useRef, useState, useTransition, type CSSProperties, type ReactNode, type TouchEvent } from "react";
import { useRouter } from "next/navigation";
import { tr, type AppLocale } from "@/lib/i18n";

const REFRESH_THRESHOLD = 72;
const MAX_PULL = 104;

export function PullToRefresh({ children, locale }: { children: ReactNode; locale: AppLocale }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const activeRefresh = refreshing || isPending;
  const ready = pullDistance >= REFRESH_THRESHOLD;

  function onTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (activeRefresh || window.scrollY > 0) return;
    startYRef.current = event.touches[0]?.clientY ?? null;
  }

  function onTouchMove(event: TouchEvent<HTMLDivElement>) {
    const startY = startYRef.current;
    if (startY === null || window.scrollY > 0) return;
    const currentY = event.touches[0]?.clientY ?? startY;
    const delta = Math.max(0, currentY - startY);
    if (delta === 0) return;
    setPullDistance(Math.min(MAX_PULL, delta * 0.48));
  }

  function resetPull() {
    startYRef.current = null;
    setPullDistance(0);
  }

  function onTouchEnd() {
    if (startYRef.current === null) return;
    if (pullDistance < REFRESH_THRESHOLD) {
      resetPull();
      return;
    }

    setRefreshing(true);
    startYRef.current = null;
    setPullDistance(REFRESH_THRESHOLD);

    rootRef.current?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((details) => {
      details.open = false;
    });
    window.dispatchEvent(new Event("vmeste:collapse-disclosures"));

    startTransition(() => {
      router.refresh();
    });

    window.setTimeout(() => {
      setRefreshing(false);
      setPullDistance(0);
    }, 700);
  }

  const label = activeRefresh
    ? tr(locale, "Обновляю…", "Refreshing…")
    : ready
      ? tr(locale, "Отпусти, чтобы обновить", "Release to refresh")
      : tr(locale, "Потяни вниз, чтобы обновить", "Pull down to refresh");

  return (
    <div
      ref={rootRef}
      className={`pull-refresh-surface${pullDistance > 0 || activeRefresh ? " is-active" : ""}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={resetPull}
      style={{ "--pull-distance": `${pullDistance}px` } as CSSProperties}
    >
      <div className={`pull-refresh-indicator${ready ? " is-ready" : ""}${activeRefresh ? " is-refreshing" : ""}`} aria-live="polite" aria-hidden={pullDistance === 0 && !activeRefresh}>
        <span className="pull-refresh-icon" aria-hidden="true">↻</span>
        <span>{label}</span>
      </div>
      <div className="pull-refresh-content">{children}</div>
    </div>
  );
}
