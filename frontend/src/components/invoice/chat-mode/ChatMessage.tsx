import { useUser } from "@clerk/clerk-react";
import { Zap } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
      {isUser ? (
        <Avatar className="w-8 h-8 flex-shrink-0 border border-gray-200">
          <AvatarImage src={user?.imageUrl} />
          <AvatarFallback className="bg-gray-100 text-gray-600 text-xs font-bold">
            {userInitial}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "#4F46E5" }}
        >
          <Zap className="w-3.5 h-3.5 text-white" fill="white" />
        </div>
      )}

      {/* Bubble */}
      <div
        className={`max-w-[75%] flex flex-col gap-1 ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        <div
          className={`
          px-4 py-3 rounded-2xl text-sm leading-relaxed
          ${
            isUser
              ? "bg-indigo-600 text-white rounded-br-sm"
              : "bg-white text-gray-800 border border-gray-100 shadow-sm rounded-bl-sm"
          }
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
