import Link from "next/link";
import { 
  Activity, 
  Cloud, 
  Headphones, 
  Shield, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  Zap, 
  ExternalLink,
  Mic2,
  Brain,
  TrendingUp
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#05080F] text-slate-200 selection:bg-[#00F0FF]/30 font-sans overflow-x-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#00F0FF]/10 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[150px] mix-blend-screen" />
      </div>

      <main className="relative z-10">
        {/* Navigation */}
        <nav className="container mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
            <Activity className="w-8 h-8 text-[#00F0FF]" />
            SoulStudio
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <Link href="#features" className="hover:text-white transition-colors">Features</Link>
            <Link href="#creators" className="hover:text-white transition-colors">Use Cases</Link>
            <Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium hover:text-[#00F0FF] transition-colors">
              Sign In
            </Link>
            <Link 
              href="/login" 
              className="text-sm font-semibold bg-[#00F0FF] text-[#05080F] px-5 py-2.5 rounded-full hover:bg-white hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all duration-300"
            >
              Start Free Trial
            </Link>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="container mx-auto px-6 pt-24 md:pt-32 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm mb-8 backdrop-blur-md animate-fade-in">
            <Sparkles className="w-4 h-4 text-[#00F0FF]" />
            <span className="text-slate-300">SoulStudio v2.0: The Future of Neuro-Acoustics</span>
          </div>
          
          <h1 className="text-5xl md:text-8xl font-extrabold text-white tracking-tight mb-8 max-w-5xl mx-auto leading-[1.1]">
            The Neuro-Acoustic Power of FL Studio. <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] via-cyan-400 to-purple-400">
              The Simplicity of Canva.
            </span>
          </h1>
          
          <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Engineer brainwave entrainment, subliminals, and frequency protocols in your browser. No DSP degree required.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-24">
            <Link 
              href="/login" 
              className="w-full sm:w-auto text-lg font-bold bg-[#00F0FF] text-[#05080F] px-10 py-5 rounded-full hover:bg-white hover:scale-105 hover:shadow-[0_0_30px_rgba(0,240,255,0.5)] transition-all duration-300 flex items-center justify-center gap-2"
            >
              Start 7-Day Free Trial <ArrowRight className="w-5 h-5" />
            </Link>
          </div>

          {/* STEP 1: Hero Dashboard Mockup */}
          <div className="relative max-w-5xl mx-auto group">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#00F0FF]/20 to-purple-500/20 rounded-2xl blur-2xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>
            <div className="relative aspect-video w-full rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-3xl overflow-hidden shadow-2xl flex flex-col items-center justify-center group-hover:border-[#00F0FF]/30 transition-all duration-500">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
              
              {/* Studio Interface Preview Placeholder */}
              <div className="flex flex-col items-center gap-4 animate-pulse">
                <div className="w-20 h-20 bg-[#00F0FF]/10 rounded-full flex items-center justify-center">
                  <Activity className="w-10 h-10 text-[#00F0FF]" />
                </div>
                <p className="text-[#00F0FF] font-mono text-sm tracking-[0.2em] uppercase">Studio Interface Preview</p>
                <div className="flex gap-2 mt-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-1.5 w-12 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-[#00F0FF]/40 w-1/2"></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Decorative elements */}
              <div className="absolute top-4 left-4 flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/50" />
              </div>
            </div>
          </div>
        </section>

        {/* STEP 2: Authority Ticker */}
        <section className="w-full bg-black/40 py-8 border-y border-white/5 backdrop-blur-sm">
          <div className="container mx-auto px-6 overflow-hidden">
            <div className="flex flex-wrap items-center justify-around gap-8 text-xs md:text-sm font-mono font-bold text-slate-500 tracking-widest uppercase">
              <span className="flex items-center gap-2"><Zap className="w-4 h-4" /> Powered by Web Audio API</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Lossless Binaural DSP</span>
              <span className="flex items-center gap-2"><Activity className="w-4 h-4" /> Zero-Latency Entrainment</span>
              <span className="flex items-center gap-2"><Shield className="w-4 h-4" /> Commercial Licensing</span>
            </div>
          </div>
        </section>

        {/* STEP 3: "BUILT FOR CREATORS" Section */}
        <section id="creators" className="container mx-auto px-6 py-32">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6">Engineered for the Pioneers of Mind Tech.</h2>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
              Whether you are healing souls or optimizing biological hardware, SoulStudio provides the surgical precision you need.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-10 max-w-6xl mx-auto">
            {/* Persona 1 */}
            <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-10 backdrop-blur-xl hover:translate-y-[-8px] transition-all duration-500">
              <Mic2 className="w-12 h-12 text-[#00F0FF] mb-8" />
              <h3 className="text-2xl font-bold text-white mb-4">Hypnotherapists</h3>
              <p className="text-slate-400 leading-relaxed italic">
                "Embed your voice over precision-engineered Theta waves. No sound engineer required."
              </p>
              <div className="mt-8 pt-8 border-t border-white/5">
                <p className="text-sm text-slate-500">Perfect for: Deep sleep induction, addiction recovery, and trauma work.</p>
              </div>
            </div>

            {/* Persona 2 */}
            <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-10 backdrop-blur-xl hover:translate-y-[-8px] transition-all duration-500">
              <Brain className="w-12 h-12 text-purple-400 mb-8" />
              <h3 className="text-2xl font-bold text-white mb-4">Biohackers</h3>
              <p className="text-slate-400 leading-relaxed italic">
                "Build custom frequency protocols to optimize deep sleep, focus, and autonomic nervous system regulation."
              </p>
              <div className="mt-8 pt-8 border-t border-white/5">
                <p className="text-sm text-slate-500">Perfect for: ADHD focus tracks, HRV optimization, and longevity protocols.</p>
              </div>
            </div>

            {/* Persona 3 */}
            <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-10 backdrop-blur-xl hover:translate-y-[-8px] transition-all duration-500">
              <TrendingUp className="w-12 h-12 text-cyan-300 mb-8" />
              <h3 className="text-2xl font-bold text-white mb-4">Manifestation Coaches</h3>
              <p className="text-slate-400 leading-relaxed italic">
                "Create and sell high-ticket subliminal bundles with professional audio ducking and masking."
              </p>
              <div className="mt-8 pt-8 border-t border-white/5">
                <p className="text-sm text-slate-500">Perfect for: Digital products, Spotify publishing, and membership bonuses.</p>
              </div>
            </div>
          </div>
        </section>

        {/* STEP 4: ROI / COMMERCIAL Section */}
        <section className="container mx-auto px-6 py-24 bg-gradient-to-b from-transparent via-[#00F0FF]/5 to-transparent">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-8 leading-tight">
                Create. Export. <br />
                <span className="text-[#00F0FF]">Monetize.</span>
              </h2>
              <p className="text-xl text-slate-300 mb-8 leading-relaxed">
                SoulStudio isn&apos;t just a DAW; it&apos;s your product factory. Every .wav file you export comes with a <strong>full commercial license</strong>.
              </p>
              <p className="text-lg text-slate-400 mb-10 leading-relaxed">
                Upload your neuro-acoustic creations to Spotify, sell them on Digistore24, or provide them as premium bonuses in your coaching programs. You own the IP, forever.
              </p>
              <div className="space-y-4 mb-12 text-slate-300">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-6 h-6 text-[#00F0FF]" /> Lifetime Commercial License</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-6 h-6 text-[#00F0FF]" /> No Royalty Share. Ever.</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-6 h-6 text-[#00F0FF]" /> Professional-Grade 48kHz WAV Export</div>
              </div>
              <Link 
                href="/login" 
                className="inline-flex items-center gap-3 text-lg font-bold bg-[#00F0FF] text-[#05080F] px-8 py-4 rounded-full hover:bg-white transition-all shadow-xl shadow-[#00F0FF]/20"
              >
                Start Building Your Empire <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
            
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-[#00F0FF]/10 to-transparent blur-3xl opacity-50"></div>
              <div className="relative border border-white/10 bg-white/5 rounded-3xl p-8 backdrop-blur-2xl">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#00F0FF]/20 rounded-xl flex items-center justify-center">
                      <ExternalLink className="w-5 h-5 text-[#00F0FF]" />
                    </div>
                    <div>
                      <p className="text-white font-bold">Creator Dashboard</p>
                      <p className="text-xs text-slate-500">Live Revenue Syncing</p>
                    </div>
                  </div>
                  <div className="text-[#00F0FF] font-mono font-bold">$12,480.00</div>
                </div>
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-white/5 rounded-xl border border-white/5 flex items-center px-4 gap-4">
                      <div className="w-2 h-2 rounded-full bg-[#00F0FF]" />
                      <div className="flex-1 h-2 bg-white/10 rounded-full" />
                      <div className="w-12 h-2 bg-white/10 rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STEP 5: PRICING TIERS */}
        <section id="pricing" className="container mx-auto px-6 py-32 mb-24">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6">Simple, Transparent Pricing</h2>
            <p className="text-slate-400 text-xl">Join the elite community of consciousness engineers.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Explorer (Free) */}
            <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-12 backdrop-blur-xl relative flex flex-col hover:border-white/20 transition-all">
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">Explorer</h3>
                <p className="text-slate-400">Test the engine.</p>
              </div>
              <div className="mb-8 flex items-baseline gap-2">
                <span className="text-5xl font-extrabold text-white">$0</span>
                <span className="text-slate-400">/mo</span>
              </div>
              <ul className="space-y-5 mb-12 flex-1">
                <li className="flex items-center gap-3 text-slate-300">
                  <CheckCircle2 className="w-5 h-5 text-slate-600" /> Web Audio Sandbox
                </li>
                <li className="flex items-center gap-3 text-slate-300">
                  <CheckCircle2 className="w-5 h-5 text-slate-600" /> Basic Frequencies
                </li>
                <li className="flex items-center gap-3 text-slate-500 line-through">
                   Lossless .wav Export
                </li>
                <li className="flex items-center gap-3 text-slate-500 line-through">
                   Commercial License
                </li>
              </ul>
              <Link 
                href="/login" 
                className="w-full block text-center font-bold bg-white/5 text-white border border-white/10 px-6 py-4 rounded-2xl hover:bg-white/10 transition-all"
              >
                Sign Up Free
              </Link>
            </div>

            {/* Creator Pro */}
            <div className="bg-gradient-to-b from-[#00F0FF]/10 to-transparent border border-[#00F0FF] rounded-3xl p-12 backdrop-blur-xl relative flex flex-col shadow-[0_0_50px_rgba(0,240,255,0.15)] group">
              <div className="absolute top-0 right-12 transform -translate-y-1/2 bg-[#00F0FF] text-[#05080F] text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-tighter">
                Build your business
              </div>
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">Creator Pro</h3>
                <p className="text-[#00F0FF]">High-Performance Creator Suite.</p>
              </div>
              <div className="mb-8 flex items-baseline gap-2">
                <span className="text-6xl font-extrabold text-white">$49</span>
                <span className="text-slate-400 font-medium">/mo</span>
              </div>
              <ul className="space-y-5 mb-12 flex-1">
                <li className="flex items-center gap-3 text-white font-medium">
                  <Zap className="w-5 h-5 text-[#00F0FF] fill-[#00F0FF]/20" /> Lossless .wav Export
                </li>
                <li className="flex items-center gap-3 text-white font-medium">
                  <Zap className="w-5 h-5 text-[#00F0FF] fill-[#00F0FF]/20" /> Full Commercial License
                </li>
                <li className="flex items-center gap-3 text-slate-300">
                  <CheckCircle2 className="w-5 h-5 text-[#00F0FF]" /> Cloud Project Saving
                </li>
                <li className="flex items-center gap-3 text-slate-300">
                  <CheckCircle2 className="w-5 h-5 text-[#00F0FF]" /> Subliminal Masking Engine
                </li>
                <li className="flex items-center gap-3 text-slate-300">
                  <CheckCircle2 className="w-5 h-5 text-[#00F0FF]" /> Priority Rendering
                </li>
              </ul>
              <Link 
                href="/login" 
                className="w-full block text-center font-bold bg-[#00F0FF] text-[#05080F] px-6 py-5 rounded-2xl hover:bg-white hover:shadow-[0_0_30px_rgba(0,240,255,0.5)] transition-all transform group-hover:scale-[1.02]"
              >
                Start 7-Day Free Trial
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="container mx-auto px-6 py-12 border-t border-white/5 text-center text-slate-500 text-sm">
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-2 text-white font-bold">
              <Activity className="w-5 h-5 text-[#00F0FF]" />
              SoulStudio
            </div>
            <p>&copy; 2026 SoulTune Ecosystem. All Rights Reserved. Engineered for Consciousness.</p>
            <div className="flex gap-8">
              <Link href="#" className="hover:text-white">Terms</Link>
              <Link href="#" className="hover:text-white">Privacy</Link>
              <Link href="#" className="hover:text-white">Commercial License</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}