import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Zap,
  Plus,
  Search,
  MessageSquare,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ArrowLeft,
} from "lucide-react";
import { ChatSessionAPI } from "@/lib/chatApi";

interface ChatSidebarProps {
  sessions: ChatSessionAPI[];
  currentSessionId: string | null;
  loadingSessions: boolean;
  onNewChat: () => void;
  onLoadSession: (session: ChatSessionAPI) => void;
  onDeleteSession: (e: React.MouseEvent, sessionId: string) => void;
}

// function formatSessionTime(date: string) {
//   const d = new Date(date);
//   const now = new Date();
//   const diff = now.getTime() - d.getTime();
//   const days = Math.floor(diff / (1000 * 60 * 60 * 24));

//   if (days === 0) return "Today";
//   if (days === 1) return "Yesterday";
//   if (days < 7) return `${days} days ago`;
//   return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
// }

export function ChatSidebar({
  sessions,
  currentSessionId,
  loadingSessions,
  onNewChat,
  onLoadSession,
  onDeleteSession,
}: ChatSidebarProps) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside
      className={`
        flex flex-col bg-white border-r border-gray-100
        transition-all duration-300 flex-shrink-0 h-full
        ${collapsed ? "w-14" : "w-64"}
      `}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-gray-100">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "#4F46E5" }}
            >
              <Zap className="w-3.5 h-3.5 text-white" fill="white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">InvoiceOS</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`
            p-1.5 rounded-lg text-gray-400 hover:text-gray-600
            hover:bg-gray-100 transition-all
            ${collapsed ? "mx-auto" : "ml-auto"}
          `}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* ── New Chat button ── */}
      <div className="px-2 py-3">
        <button
          onClick={onNewChat}
          className={`
    w-full flex items-center gap-2 px-3 py-2.5 rounded-xl
    text-sm font-semibold transition-all text-left
    ${
      !currentSessionId
        ? "bg-indigo-50 text-indigo-700"
        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
    }
    ${collapsed ? "justify-center" : ""}
  `}
          title="New Invoice Chat"
        >
          <Plus className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>New Chat</span>}
        </button>
      </div>

      {/* ── Search ── */}
      {!collapsed && (
        <div className="px-2 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400 transition-all"
            />
          </div>
        </div>
      )}

      {/* ── Chat history ── */}
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {!collapsed && filteredSessions.length > 0 && (
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 py-2">
            Recent
          </p>
        )}

        {/* Loading state */}
        {loadingSessions && !collapsed && (
          <div className="flex items-center justify-center py-8">
            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {collapsed ? (
          // Collapsed — icon only
          <div className="flex flex-col items-center gap-1 pt-1">
            {filteredSessions.slice(0, 8).map((session) => (
              <button
                key={session._id}
                onClick={() => onLoadSession(session)}
                title={session.title}
                className={`
                  w-9 h-9 rounded-xl flex items-center justify-center transition-colors
                  ${
                    currentSessionId === session._id
                      ? "bg-indigo-50 text-indigo-600"
                      : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                  }
                `}
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            ))}
          </div>
        ) : !loadingSessions && filteredSessions.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-8 text-center px-3">
            <Clock className="w-8 h-8 text-gray-200 mb-2" />
            <p className="text-xs text-gray-400">No chats yet</p>
            <p className="text-xs text-gray-300 mt-0.5">
              Start a new chat to create invoices
            </p>
          </div>
        ) : (
          // Session list
          filteredSessions.map((session) => (
            <button
              key={session._id}
              onClick={() => onLoadSession(session)}
              className={`
                w-full text-left px-3 py-2.5 rounded-xl transition-all group
                ${
                  currentSessionId === session._id
                    ? "bg-indigo-50"
                    : "hover:bg-gray-50"
                }
              `}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs font-semibold truncate ${
                      currentSessionId === session._id
                        ? "text-indigo-700"
                        : "text-gray-700"
                    }`}
                  >
                    {session.title}
                  </p>
                  {/* <p className="text-xs text-gray-300 mt-1">
                    {formatSessionTime(session.updatedAt)}
                  </p> */}
                </div>
                <button
                  onClick={(e) => onDeleteSession(e, session._id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0 mt-0.5"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </button>
          ))
        )}
      </div>

      {/* ── Bottom ── */}
      <div className="border-t border-gray-100 px-2 py-3">
        <button
          onClick={() => navigate("/dashboard")}
          className={`
            w-full flex items-center gap-2 px-3 py-2.5 rounded-xl
            text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all
            ${collapsed ? "justify-center" : ""}
          `}
          title="Back to Dashboard"
        >
          <ArrowLeft className="w-4 h-4 flex-shrink-0" />
          {!collapsed && (
            <span className="text-xs font-medium">Back to Dashboard</span>
          )}
        </button>
      </div>
    </aside>
  );
}
