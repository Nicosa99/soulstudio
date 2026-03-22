import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Activity, Loader2 } from "lucide-react";

export default async function NewProjectPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Create a new project and redirect
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: "New Frequency Protocol",
      state_json: { blocks: [], tracks: [] }
    })
    .select()
    .single();

  if (project) {
    redirect(`/studio/${project.id}`);
  }

  return (
    <div className="min-h-screen bg-[#05080F] flex flex-col items-center justify-center gap-6">
      <Activity className="w-12 h-12 text-[#00F0FF] animate-pulse" />
      <div className="flex items-center gap-3 text-white font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-[#00F0FF]" />
        Initializing Neural Workspace...
      </div>
      {error && <p className="text-red-400 text-sm">{error.message}</p>}
    </div>
  );
}