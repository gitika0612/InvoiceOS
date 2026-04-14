import { useState, KeyboardEvent } from "react";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  showSuggestions?: boolean;
}

const SUGGESTIONS = [
  "Invoice Priya for 5 days of Next.js work at ₹10k/day with 18% GST",
  "Bill Rahul for logo design, 3 revisions, ₹25,000 total",
  "Create invoice for Kartik of React consulting, 40 hours at ₹2,500/hr",
];

export function ChatInput({
  onSend,
  isLoading,
  showSuggestions = false,
}: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (suggestion: string) => {
    onSend(suggestion);
  };

  return (
    <div className="border-t border-gray-100 bg-white px-4 py-4 flex-shrink-0">
      {/* Suggestions — only when parent says so */}
      {showSuggestions && (
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSuggestion(s)}
              className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full border border-indigo-100 hover:bg-indigo-100 transition-colors text-left"
            >
              {s.length > 50 ? s.slice(0, 50) + "..." : s}
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-3">
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Try: "Invoice Priya for 5 days of Next.js at ₹10k/day with 18% GST"'
            rows={1}
            disabled={isLoading}
            className="w-full bg-transparent text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none leading-relaxed"
            style={{ maxHeight: "120px" }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className={`
            w-11 h-11 rounded-xl flex items-center justify-center
            transition-all duration-150 flex-shrink-0
            ${
              input.trim() && !isLoading
                ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }
          `}
          style={
            input.trim() && !isLoading
              ? { boxShadow: "0 4px 12px rgba(79,70,229,0.3)" }
              : {}
          }
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
