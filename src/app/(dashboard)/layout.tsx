import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-200 text-slate-900">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden transition-all duration-300">
        <Navbar user={user} />
        <main className="flex-1 overflow-y-auto bg-slate-200 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
