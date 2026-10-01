import { LogoutAction } from "./logout/logout-action";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <nav className="flex items-center justify-between">
          <div className="text-xl font-bold tracking-tight">
            Professional Identity
          </div>

          {/* Task #107: shows `Sign in` when anonymous and `Log out` when the
              protected boundary reports an active session. */}
          <LogoutAction />
        </nav>

        <div className="flex flex-1 items-center">
          <div className="max-w-3xl py-20">
            <p className="mb-6 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              AI-powered professional identity
            </p>

            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
              Your professional story,
              <span className="block text-slate-500">
                presented beautifully.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Build your professional identity once. Improve it with AI,
              choose how you want to present it, and publish a portfolio
              you can share anywhere.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <button className="rounded-xl bg-slate-950 px-6 py-3 font-medium text-white hover:bg-slate-800">
                Create your portfolio
              </button>

              <button className="rounded-xl border border-slate-200 px-6 py-3 font-medium hover:bg-slate-50">
                Explore how it works
              </button>
            </div>

            <div className="mt-12 grid max-w-2xl gap-4 sm:grid-cols-3">
              <Feature
                title="One profile"
                description="Keep your professional information structured in one place."
              />

              <Feature
                title="AI-assisted"
                description="Improve summaries, experience, and project descriptions."
              />

              <Feature
                title="Publish anywhere"
                description="Turn your profile into a professional public portfolio."
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Feature({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}