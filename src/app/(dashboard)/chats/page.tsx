import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import ChatsClient from "./ChatsClient";

export default async function ChatsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  // Get current user profile name to use in the client
  const { data: profile } = await supabase
    .from("perfiles")
    .select("nombre_completo")
    .eq("email", user.email)
    .single();

  return (
    <ChatsClient 
      userEmail={user.email!} 
      userName={profile?.nombre_completo || user.email!.split("@")[0]} 
    />
  );
}
