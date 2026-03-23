import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  Plus, 
  Settings, 
  Trash2, 
  ExternalLink, 
  Activity, 
  LogOut, 
  User,
  Clock,
  CreditCard,
  Zap,
  Loader2
} from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch projects and subscription in parallel
  const [projectsRes, subRes] = await Promise.all([
    supabase.from("projects").select("*").order("created_at", { ascending: false }),
    supabase.from("subscriptions").select("status").eq("user_id", user.id).single()
  ]);

  const projects = projectsRes.data;
  const subscriptionStatus = subRes.data?.status || 'free';

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[#05080F] text-slate-200 selection:bg-[#00F0FF]/30 font-sans">
      {/* Sidebar Nav */}
      <aside className="fixed left-0 top-0 h-full w-20 border-r border-white/5 bg-black/40 flex flex-col items-center py-8 z-30">
        <Activity className="w-8 h-8 text-[#00F0FF] mb-12" />
        <div className="flex flex-col gap-8 flex-1">
          <Link href="/studio" className="p-3 bg-[#00F0FF]/10 rounded-xl text-[#00F0FF]"><Activity className="w-6 h-6" /></Link>
          <button className="p-3 hover:bg-white/5 rounded-xl transition-colors"><Settings className="w-6 h-6" /></button>
        </div>
        <form action={signOut}>
          <button type="submit" className="p-3 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-colors">
            <LogOut className="w-6 h-6" />
          </button>
        </form>
      </aside>

      <main className="pl-20">
        {/* Top Header */}
        <header className="border-b border-white/5 px-12 py-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Your Projects</h1>
            <p className="text-slate-500 text-sm mt-1">Manage your neuro-acoustic creations.</p>
          </div>
          <div className="flex items-center gap-6">
             {/* Subscription Badge */}
             <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-tighter shadow-sm
               ${subscriptionStatus === 'active' 
                 ? 'bg-cyan/10 border-cyan/30 text-cyan shadow-cyan/10' 
                 : 'bg-white/5 border-white/10 text-slate-400'}`}>
               {subscriptionStatus === 'active' ? <Zap size={12} fill="currentColor" /> : null}
               {subscriptionStatus === 'active' ? 'Creator Pro' : 'Free Tier'}
             </div>

             <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/10">
               <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center">
                 <User className="w-3.5 h-3.5 text-purple-400" />
               </div>
               <span className="text-xs font-medium text-slate-300">{user.email}</span>
             </div>

             {subscriptionStatus === 'active' && (
               <form action="/api/billing" method="POST">
                 <button type="submit" className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white" title="Billing Portal">
                   <CreditCard size={20} />
                 </button>
               </form>
             )}

             <Link 
               href="/studio/new"
               className="bg-[#00F0FF] text-[#05080F] font-bold px-6 py-2.5 rounded-full hover:bg-white transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(0,240,255,0.2)]"
             >
               <Plus className="w-4 h-4" /> New Project
             </Link>
          </div>
        </header>

        {/* Project Grid */}
        <section className="px-12 py-12">
          {projects && projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {projects.map((project) => (
                <div key={project.id} className="group relative bg-white/[0.03] border border-white/10 rounded-2xl p-6 hover:border-[#00F0FF]/40 hover:bg-white/[0.05] transition-all">
                  <div className="flex justify-between items-start mb-12">
                    <div className="p-3 bg-white/5 rounded-xl">
                      <Activity className="w-6 h-6 text-slate-400 group-hover:text-[#00F0FF] transition-colors" />
                    </div>
                    <button className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[#00F0FF] transition-colors">{project.name || "Untitled Project"}</h3>
                  
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {new Date(project.created_at).toLocaleDateString()}</span>
                  </div>

                  <Link 
                    href={`/studio/${project.id}`}
                    className="absolute inset-0 z-10 rounded-2xl"
                    aria-label="Open Project"
                  />
                  
                  <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all">
                    <ExternalLink className="w-5 h-5 text-[#00F0FF]" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-white/5 rounded-3xl">
              <div className="p-6 bg-white/5 rounded-full mb-6 text-slate-500">
                <Activity className="w-12 h-12" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No projects yet.</h3>
              <p className="text-slate-500 mb-8">Start your first neuro-acoustic engineering project today.</p>
              <Link 
                 href="/studio/new"
                 className="bg-white/10 text-white border border-white/10 px-8 py-3 rounded-full hover:bg-white/20 transition-all font-bold"
               >
                 Create Your First Project
               </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}