export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold">Você está offline</h1>
      <p className="text-gray-500">
        Verifique sua conexão com a internet e tente novamente.
      </p>
    </main>
  );
}
