import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { ArrowLeft, Zap } from "lucide-react";
import { ModeSwitcher } from "@/components/invoice/ModeSwitcher";
import { ChatMessage } from "@/components/invoice/ChatMessage";
import { ChatInput } from "@/components/invoice/ChatInput";
import {
  InvoicePreviewCard,
  ParsedInvoice,
} from "@/components/invoice/InvoicePreviewCard";
import { TypingIndicator } from "@/components/invoice/TypingIndicator";
import { parseInvoiceWithAI, saveInvoice } from "@/lib/mockInvoiceParser";

type Mode = "chat" | "memory" | "template";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  invoice?: ParsedInvoice;
  invoiceNumber?: string;
  isConfirmed?: boolean;
}

function getTime() {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CreateInvoicePage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [mode, setMode] = useState<Mode>("chat");
  const [lastPrompt, setLastPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load messages from localStorage on first render
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem("invoiceos_chat");
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      {
        id: "1",
        role: "assistant",
        content:
          "Hi! I'm your AI invoice assistant. Describe what you want to invoice and I'll fill everything in for you. Try: \"Invoice Priya for 5 days of Next.js work at ₹10k/day with 18% GST\"",
        timestamp: getTime(),
      },
    ];
  });

  // Save messages to localStorage whenever they change
  useEffect(() => {
    try {
      // Only save last 20 messages to avoid storage limits
      const toSave = messages.slice(-20);
      localStorage.setItem("invoiceos_chat", JSON.stringify(toSave));
    } catch {
      // ignore
    }
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ── Send message and parse with LangChain ──
  const handleSend = async (prompt: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: prompt,
      timestamp: getTime(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setLastPrompt(prompt);

    try {
      const parsed = await parseInvoiceWithAI(prompt);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `I've parsed your request! Here's the invoice for **${parsed.clientName}**. Review the details and confirm or edit anything.`,
        timestamp: getTime(),
        invoice: parsed,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "❌ Sorry, I could not parse your invoice. Please try again with more details.",
        timestamp: getTime(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      console.error("Invoice parsing failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (invoice: ParsedInvoice) => {
    if (!user) return;

    try {
      const saved = await saveInvoice(invoice, user.id, lastPrompt);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.invoice === invoice
            ? { ...msg, isConfirmed: true, invoiceNumber: saved.invoiceNumber }
            : msg
        )
      );

      const confirmMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: saved.isDuplicate
          ? `⚠️ An identical invoice already exists as **${saved.invoiceNumber}**. I've linked it here — you can download it or go to your Invoice List to edit it.`
          : `✅ Invoice **${saved.invoiceNumber}** for ${
              invoice.clientName
            } saved! Total: ₹${invoice.total.toLocaleString("en-IN")}.`,
        timestamp: getTime(),
      };
      setMessages((prev) => [...prev, confirmMessage]);
    } catch (err) {
      console.error("Failed to save invoice:", err);
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "❌ Failed to save invoice. Please try again.",
        timestamp: getTime(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const handleEdit = (messageId: string, updatedInvoice: ParsedInvoice) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, invoice: updatedInvoice } : msg
      )
    );

    // Notify user in chat
    const editMessage: Message = {
      id: Date.now().toString(),
      role: "assistant",
      content: `✏️ Invoice updated! New total: ₹${updatedInvoice.total.toLocaleString(
        "en-IN"
      )}. Click Confirm when ready.`,
      timestamp: getTime(),
    };
    setMessages((prev) => [...prev, editMessage]);
  };

  const handleDiscard = (messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, invoice: undefined } : msg
      )
    );

    const discardMessage: Message = {
      id: Date.now().toString(),
      role: "assistant",
      content: "No problem! Feel free to describe a new invoice anytime.",
      timestamp: getTime(),
    };
    setMessages((prev) => [...prev, discardMessage]);
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      {/* Navbar */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Left — back button + title */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "#4F46E5" }}
              >
                <Zap className="w-3.5 h-3.5 text-white" fill="white" />
              </div>
              <span className="font-semibold text-gray-900">
                Create Invoice
              </span>
            </div>
          </div>

          {/* Right — clear chat button */}
          <button
            onClick={() => {
              localStorage.removeItem("invoiceos_chat");
              setMessages([
                {
                  id: "1",
                  role: "assistant",
                  content:
                    "Hi! I'm your AI invoice assistant. Start fresh — describe an invoice to get started.",
                  timestamp: getTime(),
                },
              ]);
            }}
            className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Clear chat
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-6 overflow-hidden">
        {/* Mode switcher */}
        <div className="mb-6 flex-shrink-0">
          <ModeSwitcher activeMode={mode} onModeChange={setMode} />
        </div>

        {/* Chat area */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-soft flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {messages.map((msg) => (
              <div key={msg.id}>
                <ChatMessage
                  role={msg.role}
                  content={msg.content}
                  timestamp={msg.timestamp}
                />
                {msg.invoice && (
                  <div className="mt-4 ml-11">
                    <InvoicePreviewCard
                      invoice={msg.invoice}
                      onConfirm={handleConfirm}
                      onEdit={(updated) => handleEdit(msg.id, updated)}
                      onDiscard={() => handleDiscard(msg.id)}
                      isConfirmed={msg.isConfirmed}
                      invoiceNumber={msg.invoiceNumber}
                      userName={
                        user?.fullName || user?.firstName || "InvoiceOS User"
                      }
                    />
                  </div>
                )}
              </div>
            ))}

            {isLoading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <ChatInput onSend={handleSend} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
