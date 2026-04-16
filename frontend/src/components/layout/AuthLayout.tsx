import { ReactNode } from "react";
import { Zap, Sparkles, Shield, TrendingUp, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const features = [
  {
    icon: Sparkles,
    title: "AI-powered creation",
    desc: "Generate invoices from a single sentence",
  },
  {
    icon: Shield,
    title: "Smart validation",
    desc: "Anomaly detection before you send",
  },
  {
    icon: TrendingUp,
    title: "Revenue insights",
    desc: "Ask your data anything, in plain English",
  },
  {
    icon: CheckCircle2,
    title: "Automated follow-ups",
    desc: "Never chase a payment manually again",
  },
];

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex font-sans">
      {/* ── Left Panel ── */}
      <div className="hidden lg:flex lg:w-[55%] gradient-mesh relative overflow-hidden flex-col justify-between p-14">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-white/5 blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-white/5 blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
            <Zap className="w-5 h-5 text-white" fill="white" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">
            InvoiceOS
          </span>
        </div>

        {/* Hero */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-5">
            <Badge className="glass rounded-full px-4 py-2 border-0 bg-white/10 text-white/90 hover:bg-white/10 gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              AI-native invoicing platform
            </Badge>

            <h1 className="text-5xl font-bold text-white leading-[1.1] tracking-tight">
              Smart invoicing
              <br />
              <span className="text-gradient">powered by AI</span>
            </h1>
            <p className="text-lg text-white/65 max-w-md leading-relaxed">
              Create, scan, validate, and track invoices with the power of
              artificial intelligence.
            </p>
          </div>

          <div className="space-y-3.5">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="flex items-center gap-3"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0 border border-white/10">
                  <f.icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-white">
                    {f.title}
                  </span>
                  <span className="text-sm text-white/55 ml-2">— {f.desc}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4">
            <Separator className="bg-white/10 mb-6" />
            <div className="flex items-center gap-10">
              {[
                { value: "2 min", label: "avg invoice time" },
                { value: "98%", label: "payment capture" },
                { value: "10k+", label: "businesses" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="text-2xl font-bold text-white">{s.value}</div>
                  <div className="text-xs text-white/45 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Testimonial */}
        <div className="relative z-10 glass rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              G
            </div>
            <div>
              <p className="text-sm text-white/85 leading-relaxed">
                "InvoiceOS cut my invoicing time from 30 minutes to under 2
                minutes. The AI just gets what I need."
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs font-semibold text-white">
                  Gitika S.
                </span>
                <span className="text-xs text-white/45">
                  · Freelance Developer
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 flex flex-col justify-center items-center bg-[#F9FAFB] py-12 px-6 sm:px-12">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "#4F46E5" }}
          >
            <Zap className="w-5 h-5 text-white" fill="white" />
          </div>
          <span className="text-xl font-bold text-gray-900">InvoiceOS</span>
        </div>
        <div className="w-full max-w-[420px]">{children}</div>
      </div>
    </div>
  );
}
