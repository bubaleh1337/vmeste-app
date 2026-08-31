"use client";

import { useActionState } from "react";
import { createInvitationAction, type InvitationState } from "@/app/goals/[goalId]/actions";

const initialState: InvitationState = { url: null, error: null };

export function InvitePanel({ goalId }: { goalId: string }) {
  const action = createInvitationAction.bind(null, goalId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="invite-maker">
      <form action={formAction}>
        <button className="secondary-button" type="submit" disabled={pending}>{pending ? "Создаю…" : "Создать ссылку-приглашение"}</button>
      </form>
      {state.url && <div className="invite-result"><label>Ссылка действует 7 дней<input readOnly value={state.url} onFocus={(event) => event.currentTarget.select()} /></label><small>Скопируй её и отправь человеку удобным способом. После принятия эта ссылка больше не сработает.</small></div>}
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
    </div>
  );
}
