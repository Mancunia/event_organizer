"use client";

import { useActionState } from "react";
import { login } from "@/app/admin/actions";
import { FormStatus } from "./FormStatus";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="card space-y-4">
      <label className="block">
        <span className="label">Password</span>
        <input name="password" type="password" className="input" autoComplete="current-password" required />
      </label>
      <FormStatus state={state} />
      <button className="btn w-full" disabled={pending}>
        Sign in
      </button>
    </form>
  );
}
