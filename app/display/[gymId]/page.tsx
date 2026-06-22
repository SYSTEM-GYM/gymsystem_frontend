import { DisplayClient } from "./DisplayClient";

export default async function GymDisplayPage({
  params,
}: {
  params: Promise<{ gymId: string }>;
}) {
  const { gymId } = await params;
  return <DisplayClient gymId={gymId} />;
}
