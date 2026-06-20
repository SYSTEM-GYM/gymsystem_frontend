export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-base flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <span className="text-4xl font-black tracking-tighter text-primary">
            SIMP
          </span>
          <p className="mt-1 text-xs text-zinc-600 uppercase tracking-widest">
            Academia
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface-1 border border-white/5 rounded-3xl p-8 shadow-2xl">
          {children}
        </div>
      </div>
    </main>
  );
}
