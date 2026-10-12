export function FormStatus({ state }: { state: { error?: string; message?: string } | null }) {
  if (!state) return null;
  return (
    <>
      {state.message && <p className="text-sm text-sage-ink">{state.message}</p>}
      {state.error && (
        <p role="alert" className="alert whitespace-pre-line">
          {state.error}
        </p>
      )}
    </>
  );
}
