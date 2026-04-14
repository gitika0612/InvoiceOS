import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
// import { ModeSwitcher } from "@/components/invoice/ModeSwitcher";
import { ChatMessage } from "@/components/invoice/chat-mode/ChatMessage";
import { ChatInput } from "@/components/invoice/chat-mode/ChatInput";
import { TypingIndicator } from "@/components/invoice/TypingIndicator";
import { parseInvoiceWithAI, saveInvoice } from "@/lib/mockInvoiceParser";
import { ChatSidebar } from "@/components/invoice/chat-mode/ChatSidebar";
import {
  InvoicePanel,
  SessionInvoice,
} from "@/components/invoice/InvoicePanel";
import { InvoiceMiniCard } from "@/components/invoice/InvoiceMiniCard";
import {
  ChatSessionAPI,
  ChatMessageAPI,
  createChatSession,
  getUserChatSessions,
  deleteChatSession,
  getSessionMessages,
  addChatMessage,
  confirmInvoiceInMessage,
} from "@/lib/chatApi";

// type Mode = "chat" | "memory" | "template";

interface UIMessage {
  _id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  // Mini card reference only — no full invoice in chat
  invoiceMessageId?: string;
  isConfirmed?: boolean;
  invoiceNumber?: string;
  dbMessageId?: string;
}

function getTime() {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const WELCOME: UIMessage = {
  _id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm your AI invoice assistant. Describe what you want to invoice and I'll fill everything in. You can create multiple invoices for different clients in one chat!",
  timestamp: getTime(),
};

function toUIMessage(msg: ChatMessageAPI): UIMessage {
  return {
    _id: msg._id,
    role: msg.role,
    content: msg.content,
    timestamp: new Date(msg.createdAt).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    invoiceMessageId: msg.invoice ? msg._id : undefined,
    isConfirmed: msg.invoice?.isConfirmed,
    invoiceNumber: msg.invoice?.invoiceNumber,
    dbMessageId: msg._id,
  };
}

export function CreateInvoicePage() {
  const { user, isLoaded } = useUser();
  // const [mode, setMode] = useState<Mode>("chat");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [sessions, setSessions] = useState<ChatSessionAPI[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([WELCOME]);

  // All invoices in current session
  const [sessionInvoices, setSessionInvoices] = useState<SessionInvoice[]>([]);
  const [selectedPanelMessageId, setSelectedPanelMessageId] = useState<
    string | null
  >(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isLoaded || !user) return;
    loadSessions();
  }, [isLoaded, user]);

  const loadSessions = async () => {
    if (!user) return;
    try {
      const data = await getUserChatSessions(user.id);
      setSessions(data);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleNewChat = async () => {
    if (!user) return;
    try {
      const session = await createChatSession(user.id);
      setSessions((prev) => [session, ...prev]);
      setCurrentSessionId(session._id);
      setMessages([WELCOME]);
      setSessionInvoices([]);
    } catch (err) {
      console.error("Failed to create session:", err);
    }
  };

  const handleDeleteSession = async (
    e: React.MouseEvent,
    sessionId: string
  ) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await deleteChatSession(user.id, sessionId);
      setSessions((prev) => prev.filter((s) => s._id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([WELCOME]);
        setSessionInvoices([]);
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const ensureSession = async (): Promise<string> => {
    if (currentSessionId) return currentSessionId;
    if (!user) throw new Error("No user");
    const session = await createChatSession(user.id);
    setSessions((prev) => [session, ...prev]);
    setCurrentSessionId(session._id);
    return session._id;
  };

  // Scroll to message in chat
  const scrollToMessage = (messageId: string) => {
    const el = messageRefs.current[messageId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleSend = async (prompt: string) => {
    if (!user) return;

    const tempId = Date.now().toString();
    const tempUserMsg: UIMessage = {
      _id: tempId,
      role: "user",
      content: prompt,
      timestamp: getTime(),
    };
    setMessages((prev) =>
      prev.filter((m) => m._id !== "welcome").concat(tempUserMsg)
    );
    setIsLoading(true);

    try {
      const sessionId = await ensureSession();

      const savedUserMsg = await addChatMessage(
        user.id,
        sessionId,
        "user",
        prompt
      );

      setMessages((prev) =>
        prev.map((m) =>
          m._id === tempId
            ? { ...m, _id: savedUserMsg._id, dbMessageId: savedUserMsg._id }
            : m
        )
      );

      const parsed = await parseInvoiceWithAI(prompt);

      const assistantContent = `I've parsed your request! Here's the invoice for **${parsed.clientName}**. Review it in the panel on the right.`;

      const savedAssistantMsg = await addChatMessage(
        user.id,
        sessionId,
        "assistant",
        assistantContent,
        { data: parsed, isConfirmed: false }
      );

      const newUIMsg: UIMessage = {
        _id: savedAssistantMsg._id,
        role: "assistant",
        content: assistantContent,
        timestamp: getTime(),
        invoiceMessageId: savedAssistantMsg._id,
        isConfirmed: false,
        dbMessageId: savedAssistantMsg._id,
      };
      setMessages((prev) => [...prev, newUIMsg]);

      // Add to session invoices
      const newSessionInvoice: SessionInvoice = {
        messageId: savedAssistantMsg._id,
        invoice: parsed,
        isConfirmed: false,
        dbMessageId: savedAssistantMsg._id,
      };
      setSessionInvoices((prev) => [...prev, newSessionInvoice]);
      setSelectedPanelMessageId(savedAssistantMsg._id);

      loadSessions();
    } catch (err) {
      console.error("Failed:", err);
      setMessages((prev) => [
        ...prev,
        {
          _id: Date.now().toString(),
          role: "assistant",
          content:
            "❌ Sorry, I could not parse your invoice. Please try again.",
          timestamp: getTime(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Confirm from panel
  const handleConfirmFromPanel = async (messageId: string) => {
    if (!user || !currentSessionId) return;

    const si = sessionInvoices.find((s) => s.messageId === messageId);
    if (!si) return;

    try {
      const userMessages = messages.filter((m) => m.role === "user");
      const lastPrompt = userMessages[userMessages.length - 1]?.content || "";

      const saved = await saveInvoice(si.invoice, user.id, lastPrompt);

      await confirmInvoiceInMessage(
        currentSessionId,
        messageId,
        saved.invoiceNumber,
        saved.invoiceNumber
      );

      // Update sessionInvoices
      setSessionInvoices((prev) =>
        prev.map((s) =>
          s.messageId === messageId
            ? { ...s, isConfirmed: true, invoiceNumber: saved.invoiceNumber }
            : s
        )
      );

      setSelectedPanelMessageId(messageId);

      // Update message mini card
      setMessages((prev) =>
        prev.map((m) =>
          m.invoiceMessageId === messageId
            ? { ...m, isConfirmed: true, invoiceNumber: saved.invoiceNumber }
            : m
        )
      );

      // Add confirmation message
      const confirmContent = saved.isDuplicate
        ? `⚠️ Invoice **${saved.invoiceNumber}** already exists.`
        : `✅ Invoice **${saved.invoiceNumber}** for ${
            si.invoice.clientName
          } saved! Total: ₹${si.invoice.total.toLocaleString("en-IN")}.`;

      const savedMsg = await addChatMessage(
        user.id,
        currentSessionId,
        "assistant",
        confirmContent
      );

      setMessages((prev) => [
        ...prev,
        {
          _id: savedMsg._id,
          role: "assistant",
          content: confirmContent,
          timestamp: getTime(),
        },
      ]);
    } catch (err) {
      console.error("Failed to confirm:", err);
    }
  };

  // Discard from panel
  const handleDiscardFromPanel = (messageId: string) => {
    setSessionInvoices((prev) => prev.filter((s) => s.messageId !== messageId));
    setMessages((prev) =>
      prev.map((m) =>
        m.invoiceMessageId === messageId
          ? { ...m, invoiceMessageId: undefined }
          : m
      )
    );
  };

  const handleLoadSession = async (session: ChatSessionAPI) => {
    if (!user) return;
    setCurrentSessionId(session._id);
    setLoadingMessages(true);
    setMessages([]);
    setSessionInvoices([]);
    setSelectedPanelMessageId(null); // ← reset selection

    try {
      const msgs = await getSessionMessages(user.id, session._id);
      if (msgs.length === 0) {
        setMessages([WELCOME]);
      } else {
        setMessages(msgs.map(toUIMessage));

        const invoices: SessionInvoice[] = msgs
          .filter((m) => m.invoice?.data)
          .map((m) => ({
            messageId: m._id,
            invoice: m.invoice!.data,
            isConfirmed: m.invoice!.isConfirmed,
            invoiceNumber: m.invoice!.invoiceNumber,
            invoiceId: m.invoice!.invoiceId,
            dbMessageId: m._id,
          }));
        setSessionInvoices(invoices);

        if (invoices.length > 0) {
          // Last invoice in array = newest (DB returns oldest first)
          const newest = invoices[invoices.length - 1];
          setSelectedPanelMessageId(newest.messageId);
        }
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
      setMessages([WELCOME]);
    } finally {
      setLoadingMessages(false);
    }
  };

  return (
    <div className="h-screen bg-[#F9FAFB] flex overflow-hidden">
      {/* ── Left Sidebar ── */}
      <ChatSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        loadingSessions={loadingSessions}
        onNewChat={handleNewChat}
        onLoadSession={handleLoadSession}
        onDeleteSession={handleDeleteSession}
      />

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-sm font-semibold text-gray-900">
              Create Invoice
            </h1>
            <p className="text-xs text-gray-400">
              Describe your invoice in natural language
            </p>
          </div>
          {/* <div className="flex items-center gap-4">
            <ModeSwitcher activeMode={mode} onModeChange={setMode} />
            <button
              onClick={handleNewChat}
              className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              New Chat
            </button>
          </div> */}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {loadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg._id}
                ref={(el) => {
                  messageRefs.current[msg._id] = el;
                }}
              >
                <ChatMessage
                  role={msg.role}
                  content={msg.content}
                  timestamp={msg.timestamp}
                />

                {/* Mini card — only if message has an invoice */}
                {msg.invoiceMessageId && (
                  <div className="ml-11">
                    {(() => {
                      const si = sessionInvoices.find(
                        (s) => s.messageId === msg.invoiceMessageId
                      );
                      if (!si) return null;
                      return (
                        <InvoiceMiniCard
                          clientName={si.invoice.clientName}
                          total={si.invoice.total}
                          isConfirmed={si.isConfirmed}
                          invoiceNumber={si.invoiceNumber}
                          onClick={() => {
                            // Highlight in right panel + scroll to message
                            setSelectedPanelMessageId(si.messageId);
                            scrollToMessage(msg._id);
                          }}
                        />
                      );
                    })()}
                  </div>
                )}
              </div>
            ))
          )}
          {isLoading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        <ChatInput
          onSend={handleSend}
          isLoading={isLoading}
          showSuggestions={messages.length <= 1}
        />
      </div>

      {/* ── Right Invoice Panel ── */}
      <InvoicePanel
        sessionInvoices={sessionInvoices}
        selectedMessageId={selectedPanelMessageId}
        onConfirm={handleConfirmFromPanel}
        onDiscard={handleDiscardFromPanel}
        onEdit={(messageId, updated) => {
          setSessionInvoices((prev) =>
            prev.map((s) =>
              s.messageId === messageId ? { ...s, invoice: updated } : s
            )
          );
        }}
        onSelect={(messageId) => {
          setSelectedPanelMessageId(messageId);
          scrollToMessage(messageId);
        }}
        userName={user?.fullName || user?.firstName || "InvoiceOS User"}
      />
    </div>
  );
}
