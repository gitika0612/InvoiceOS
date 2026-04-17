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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

interface ChatSidebarProps {
  sessions: ChatSessionAPI[];
  currentSessionId: string | null;
  loadingSessions: boolean;
  onNewChat: () => void;
  onLoadSession: (session: ChatSessionAPI) => void;
  onDeleteSession: (e: React.MouseEvent, sessionId: string) => void;
}

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
            <span className="font-bold text-gray-900 text-sm">Ledger</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={`w-7 h-7 text-gray-400 hover:text-gray-600 ${
            collapsed ? "mx-auto" : "ml-auto"
          }`}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* ── New Chat button ── */}
      <div className="px-2 py-3">
        <Button
          onClick={onNewChat}
          variant="ghost"
          className={`
            w-full justify-start gap-2 text-sm font-semibold rounded-xl
            ${
              !currentSessionId
                ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }
            ${collapsed ? "justify-center px-0" : ""}
          `}
          title="New Invoice Chat"
        >
          <Plus className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>New Chat</span>}
        </Button>
      </div>

      {/* ── Search ── */}
      {!collapsed && (
        <div className="px-2 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs bg-gray-50 border-gray-200 rounded-xl h-8 focus-visible:ring-indigo-400"
            />
          </div>
        </div>
      )}

      <Separator className="mx-2 w-auto" />

      {/* ── Chat history ── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="py-2 px-2 space-y-0.5">
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
            <div className="flex flex-col items-center gap-1 pt-1">
              {filteredSessions.slice(0, 8).map((session) => (
                <Button
                  key={session._id}
                  variant="ghost"
                  size="icon"
                  onClick={() => onLoadSession(session)}
                  title={session.title}
                  className={`w-9 h-9 rounded-xl ${
                    currentSessionId === session._id
                      ? "bg-indigo-50 text-indigo-600"
                      : "text-gray-400"
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                </Button>
              ))}
            </div>
          ) : !loadingSessions && filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center px-3">
              <Clock className="w-8 h-8 text-gray-200 mb-2" />
              <p className="text-xs text-gray-400">No chats yet</p>
              <p className="text-xs text-gray-300 mt-0.5">
                Start a new chat to create invoices
              </p>
            </div>
          ) : (
            filteredSessions.map((session) => (
              <div key={session._id} className="relative group mx-1">
                <button
                  onClick={() => onLoadSession(session)}
                  className={`
                    w-full text-left px-3 py-2 rounded-xl transition-all
                    flex items-center gap-2 overflow-hidden
                    ${
                      currentSessionId === session._id
                        ? "bg-indigo-50"
                        : "hover:bg-gray-50"
                    }
                  `}
                >
                  <MessageSquare
                    className={`w-3.5 h-3.5 flex-shrink-0 ${
                      currentSessionId === session._id
                        ? "text-indigo-500"
                        : "text-gray-400"
                    }`}
                  />
                  <p
                    className={`text-xs font-medium truncate flex-1 min-w-0 pr-6 ${
                      currentSessionId === session._id
                        ? "text-indigo-700"
                        : "text-gray-600"
                    }`}
                  >
                    {session.title}
                  </p>
                </button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => onDeleteSession(e, session._id)}
                  className="absolute right-1 top-1/2 -translate-y-1/2
                             opacity-0 group-hover:opacity-100
                             w-6 h-6 rounded-lg
                             text-gray-400 hover:text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <Separator />

      {/* ── Bottom ── */}
      <div className="px-2 py-3">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className={`
            w-full justify-start gap-2 text-gray-500 hover:text-gray-700
            rounded-xl text-xs font-medium
            ${collapsed ? "justify-center px-0" : ""}
          `}
          title="Back to Dashboard"
        >
          <ArrowLeft className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Back to Dashboard</span>}
        </Button>
      </div>
    </aside>
  );
}
