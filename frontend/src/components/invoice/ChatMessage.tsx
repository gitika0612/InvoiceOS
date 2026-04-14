interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  const isUser = role === "user";

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
              isUser
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 border border-gray-200"
            }
          `}
      >
        {isUser ? "G" : "⚡"}
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
              ${
                isUser
                  ? "bg-indigo-600 text-white rounded-br-sm"
                  : "bg-white text-gray-800 border border-gray-100 shadow-soft rounded-bl-sm"
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
