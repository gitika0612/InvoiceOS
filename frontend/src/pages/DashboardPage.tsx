import { useEffect } from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { useAuth } from "@/hooks/useAuth";
import { Zap, LogOut, FileText, Upload, BarChart3, Bot } from "lucide-react";

export function DashboardPage() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { syncUser } = useAuth();

  useEffect(() => {
    syncUser();
  }, [syncUser]);

  const modules = [
    {
      icon: FileText,
      title: "Create Invoice",
      desc: "Generate invoices using AI chat",
      color: "bg-indigo-50 text-indigo-600",
      soon: false,
    },
    {
      icon: Upload,
      title: "Scan Invoice",
      desc: "Extract data from PDF or image",
      color: "bg-emerald-50 text-emerald-600",
      soon: true,
    },
    {
      icon: BarChart3,
      title: "Insights",
      desc: "Ask your financial data anything",
      color: "bg-violet-50 text-violet-600",
      soon: true,
    },
    {
      icon: Bot,
      title: "AI Agent",
      desc: "Automate invoice follow-ups",
      color: "bg-orange-50 text-orange-600",
      soon: true,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Navbar */}
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "#4F46E5" }}
            >
              <Zap className="w-4 h-4 text-white" fill="white" />
            </div>
            <span className="text-lg font-bold text-gray-900">InvoiceOS</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">
                {user?.fullName}
              </p>
              <p className="text-xs text-gray-400">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-sm">
              {user?.firstName?.[0] || "U"}
            </div>
            <button
              onClick={() => signOut()}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Welcome */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Welcome back, {user?.firstName} 👋
          </h1>
          <p className="text-gray-500 mt-1.5">
            Your AI-powered invoice operating system is ready.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Total Invoices", value: "0", sub: "Get started below" },
            { label: "Pending Payment", value: "₹0", sub: "No outstanding" },
            { label: "Paid This Month", value: "₹0", sub: "No data yet" },
            { label: "Overdue", value: "0", sub: "All clear" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5"
            >
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                {stat.label}
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1.5">
                {stat.value}
              </p>
              <p className="text-xs text-gray-400 mt-1">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Modules */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            AI Modules
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {modules.map((mod) => (
              <div
                key={mod.title}
                className={`bg-white rounded-2xl border border-gray-100 shadow-soft p-6 transition-all duration-200 ${
                  mod.soon
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:shadow-card hover:-translate-y-0.5 cursor-pointer"
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${mod.color}`}
                >
                  <mod.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">
                  {mod.title}
                </h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  {mod.desc}
                </p>
                {mod.soon && (
                  <span className="inline-block mt-3 text-xs font-medium text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                    Coming soon
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
