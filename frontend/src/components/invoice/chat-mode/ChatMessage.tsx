import { useUser } from "@clerk/clerk-react";
import { Zap } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  const isUser = role === "user";
  const { user } = useUser();

  const userInitial =
    user?.firstName?.[0]?.toUpperCase() ||
    user?.fullName?.[0]?.toUpperCase() ||
    "U";

  return (
    <div
      className={`flex items-end gap-3 ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Avatar */}
      <div
        className={`
        w-8 h-8 rounded-full flex items-center justify-center
        text-xs font-bold flex-shrink-0
        ${
          !isUser
            ? "bg-indigo-600 text-white"
            : "bg-gray-100 text-gray-600 border border-gray-200"
        }
      `}
      >
        {isUser ? (
          userInitial
        ) : (
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "#4F46E5" }}
          >
            <Zap className="w-3.5 h-3.5 text-white" fill="white" />
          </div>
        )}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[75%] ${
          isUser ? "items-end" : "items-start"
        } flex flex-col gap-1`}
      >
        <div
          className={`
          px-4 py-3 rounded-2xl text-sm leading-relaxed
         bg-white text-gray-800 border border-gray-100 shadow-soft rounded-bl-sm
        `}
        >
          {content}
        </div>
        {timestamp && (
          <span className="text-xs text-gray-400 px-1">{timestamp}</span>
        )}
      </div>
    </div>
  );
}
