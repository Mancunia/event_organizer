"use client";

import { useActionState } from "react";
import { clientLogin } from "@/app/[slug]/guests/actions";

export function ClientLoginForm({ slug }: { slug: string }) {
  const [error, action, pending] = useActionState(clientLogin.bind(null, slug), null);
  return (
    <form action={action} className="card space-y-4">
      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" className="input" required />
      </div>
      {error && <p role="alert" className="alert">{error}</p>}
      <button className="btn w-full" disabled={pending}>
        {pending ? "Checking…" : "See your guest list"}
      </button>
    </form>
  );
}
