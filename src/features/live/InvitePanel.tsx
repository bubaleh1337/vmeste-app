"use client";

import { useActionState } from "react";
import { createInvitationAction, type InvitationState } from "@/app/goals/[goalId]/actions";
import { tr, type AppLocale } from "@/lib/i18n";

const initialState: InvitationState = { url: null, error: null };

export function InvitePanel({ goalId, locale = "ru" }: { goalId: string; locale?: AppLocale }) {
  const action = createInvitationAction.bind(null, goalId);
  const [state, formAction, pending] = useActionState(action, initialState);
  return <div className="invite-maker"><form action={formAction}><button className="secondary-button" type="submit" disabled={pending}>{pending ? tr(locale,"Создаю…","Creating…") : tr(locale,"Создать ссылку-приглашение","Create invitation link")}</button></form>{state.url && <div className="invite-result"><label>{tr(locale,"Ссылка действует 7 дней","Link is valid for 7 days")}<input readOnly value={state.url} onFocus={(event)=>event.currentTarget.select()} /></label><small>{tr(locale,"Скопируй её и отправь человеку удобным способом. После принятия эта ссылка больше не сработает.","Copy and send it however you like. After acceptance the link can no longer be used.")}</small></div>}{state.error && <p className="form-error" role="alert">{state.error === "invalid_goal" ? tr(locale,"Некорректная цель.","Invalid goal.") : tr(locale,"Не удалось создать ссылку. Создавать приглашения может только владелец активной цели.","Could not create the link. Only the owner of an active goal can create invitations.")}</p>}</div>;
}
