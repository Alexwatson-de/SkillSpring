"use client";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="wrap section" id="main">
      <h1>Something interrupted this page.</h1>
      <p>Your saved work is still in your account. Please try again.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
