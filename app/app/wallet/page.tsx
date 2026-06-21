import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStudentWalletData, getPlansForCheckout } from "./actions";
import { WalletClient } from "./WalletClient";

export const revalidate = 0;

export default async function WalletPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [wallet, plans] = await Promise.all([
    getStudentWalletData(),
    getPlansForCheckout(),
  ]);

  return <WalletClient wallet={wallet} plans={plans} />;
}
