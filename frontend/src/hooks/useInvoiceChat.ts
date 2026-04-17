import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import {
  parseInvoiceWithAI,
  saveDraftInvoice,
  confirmInvoice,
  deleteInvoice,
  MatchResult,
} from "@/lib/mockInvoiceParser";
import { parseClientDetailsFromText, ClientAPI } from "@/lib/clientApi";
import { ParsedInvoice } from "@/components/invoice/InvoicePreviewCard";
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
import { SessionInvoice } from "@/components/invoice/InvoicePanel";

export interface UIMessage {
  _id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  invoiceMessageId?: string;
  isConfirmed?: boolean;
  invoiceNumber?: string;
  dbMessageId?: string;
}

type PendingStatus =
  | "awaiting_confirm"
  | "awaiting_details"
  | "awaiting_multi_details";

interface PendingInvoiceClient {
  clientName: string;
  invoice: ParsedInvoice;
  matchedClient?: ClientAPI | null;
  needsConfirm?: boolean;
}

interface PendingClientState {
  status: PendingStatus;
  clientName?: string;
  matchedClient?: ClientAPI | null;
  invoiceData?: ParsedInvoice;
  pendingClients?: PendingInvoiceClient[];
  sessionId: string;
}

function getTime() {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const WELCOME: UIMessage = {
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

function extractClientSection(text: string, clientName: string): string | null {
  const regex = new RegExp(
    `${clientName}\\s*[-:]\\s*(.+?)(?=\\b[A-Z][a-z]+\\s*[-:]|$)`,
    "is"
  );
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

export function useInvoiceChat() {
  const { user, isLoaded } = useUser();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sessions, setSessions] = useState<ChatSessionAPI[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([WELCOME]);
  const [sessionInvoices, setSessionInvoices] = useState<SessionInvoice[]>([]);
  const [selectedPanelMessageId, setSelectedPanelMessageId] = useState<
    string | null
  >(null);
  const [pendingClientState, setPendingClientState] =
    useState<PendingClientState | null>(null);

  const pendingClientStateRef = useRef<PendingClientState | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const updatePendingClientState = (val: PendingClientState | null) => {
    pendingClientStateRef.current = val;
    setPendingClientState(val);
  };

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

  const ensureSession = async (): Promise<string> => {
    if (currentSessionId) return currentSessionId;
    if (!user) throw new Error("No user");
    const session = await createChatSession(user.id);
    setSessions((prev) => [session, ...prev]);
    setCurrentSessionId(session._id);
    return session._id;
  };

  const addAndShowAIMessage = async (
    content: string,
    sessionId: string
  ): Promise<ChatMessageAPI> => {
    if (!user) throw new Error("No user");
    const saved = await addChatMessage(
      user.id,
      sessionId,
      "assistant",
      content
    );
    setMessages((prev) => [
      ...prev,
      {
        _id: saved._id,
        role: "assistant",
        content,
        timestamp: getTime(),
        dbMessageId: saved._id,
      },
    ]);
    return saved;
  };

  const addUserMessageToUI = (content: string, tempId: string) => {
    setMessages((prev) =>
      prev
        .filter((m) => m._id !== "welcome")
        .concat({
          _id: tempId,
          role: "user",
          content,
          timestamp: getTime(),
        })
    );
  };

  // ── Final step: save draft to DB + show in panel ──
  const proceedWithInvoice = async (
    invoice: ParsedInvoice,
    client: ClientAPI | null,
    sessionId: string,
    originalPrompt?: string
  ) => {
    if (!user) return;

    // 1. Save to DB immediately as draft (isConfirmed: false)
    let savedDraft = null;
    try {
      savedDraft = await saveDraftInvoice(
        invoice,
        user.id,
        originalPrompt || "",
        client?._id
      );
    } catch (err) {
      console.error("Failed to save draft:", err);
    }

    const assistantContent = `Here's the invoice for **${invoice.clientName}**. Review it in the panel on the right.`;

    // 2. Save chat message with invoice data
    const savedAssistantMsg = await addChatMessage(
      user.id,
      sessionId,
      "assistant",
      assistantContent,
      { data: invoice, isConfirmed: false }
    );

    setMessages((prev) => [
      ...prev,
      {
        _id: savedAssistantMsg._id,
        role: "assistant",
        content: assistantContent,
        timestamp: getTime(),
        invoiceMessageId: savedAssistantMsg._id,
        isConfirmed: false,
        dbMessageId: savedAssistantMsg._id,
      },
    ]);

    // 3. Add to session invoices with DB id
    const newSessionInvoice: SessionInvoice = {
      messageId: savedAssistantMsg._id,
      invoice,
      isConfirmed: false,
      dbMessageId: savedAssistantMsg._id,
      invoiceId: savedDraft?._id, // ← DB invoice _id
      invoiceNumber: savedDraft?.invoiceNumber, // ← invoice number from DB
    };

    setSessionInvoices((prev) => [...prev, newSessionInvoice]);
    setSelectedPanelMessageId(savedAssistantMsg._id);
  };

  // ── Single: Handle "same" / "different" reply ──
  const handleClientConfirmReply = async (reply: string, sessionId: string) => {
    const current = pendingClientStateRef.current;
    if (!current || !user || !current.invoiceData) return;

    const { invoiceData, matchedClient, clientName } = current;

    const isSame =
      reply.toLowerCase().includes("same") ||
      reply.toLowerCase().includes("yes") ||
      reply.toLowerCase().includes("haan");

    if (isSame && matchedClient) {
      updatePendingClientState(null);
      await addAndShowAIMessage(
        `Got it! Using **${matchedClient.name}**'s saved details ✓`,
        sessionId
      );
      await proceedWithInvoice(invoiceData, matchedClient, sessionId);
    } else {
      updatePendingClientState({ ...current, status: "awaiting_details" });
      await addAndShowAIMessage(
        `Got it! **${clientName}** is a new client. Could you share their email? *(Optional: phone, GSTIN, city)*\n\nOr just say **skip**.`,
        sessionId
      );
    }
  };

  // ── Single: Handle client details reply ──
  const handleClientDetailsReply = async (reply: string, sessionId: string) => {
    const current = pendingClientStateRef.current;
    if (!current || !user || !current.invoiceData) return;

    const { invoiceData, clientName } = current;
    const isSkip =
      reply.toLowerCase().trim() === "skip" ||
      reply.toLowerCase().includes("skip");

    updatePendingClientState(null);

    if (isSkip) {
      await addAndShowAIMessage(
        `No problem! Creating invoice without client details. You can add them later when sending.`,
        sessionId
      );
      await proceedWithInvoice(invoiceData, null, sessionId);
    } else {
      try {
        const result = await parseClientDetailsFromText(
          user.id,
          reply,
          clientName!
        );
        const aiMsg = result?.client
          ? `Saved **${clientName}**'s details ✓ Creating invoice now!`
          : `Creating invoice! You can add more client details later when sending.`;
        await addAndShowAIMessage(aiMsg, sessionId);
        await proceedWithInvoice(
          invoiceData,
          result?.client || null,
          sessionId
        );
      } catch (err) {
        console.error("Failed to parse client details:", err);
        await addAndShowAIMessage(
          `Creating invoice now! You can add client details later when sending.`,
          sessionId
        );
        await proceedWithInvoice(invoiceData, null, sessionId);
      }
    }
  };

  // ── Multi: Handle client details reply ──
  const handleMultiClientDetailsReply = async (
    reply: string,
    sessionId: string
  ) => {
    const current = pendingClientStateRef.current;
    if (!current || !user || !current.pendingClients) return;

    const { pendingClients } = current;
    const isSkip =
      reply.toLowerCase().trim() === "skip" ||
      reply.toLowerCase().includes("skip");

    updatePendingClientState(null);

    await addAndShowAIMessage(
      `Got it! Creating ${pendingClients.length} invoice${
        pendingClients.length > 1 ? "s" : ""
      } now...`,
      sessionId
    );

    for (const {
      clientName,
      invoice,
      matchedClient,
      needsConfirm,
    } of pendingClients) {
      try {
        if (isSkip) {
          await proceedWithInvoice(invoice, matchedClient || null, sessionId);
          continue;
        }

        if (needsConfirm && matchedClient) {
          const clientSection =
            extractClientSection(reply, clientName) || reply;
          const isSame =
            clientSection.toLowerCase().includes("same") ||
            reply.toLowerCase().includes("same") ||
            reply.toLowerCase().includes("yes");

          if (isSame) {
            await proceedWithInvoice(invoice, matchedClient, sessionId);
          } else {
            const result = await parseClientDetailsFromText(
              user.id,
              clientSection,
              clientName
            );
            await proceedWithInvoice(
              invoice,
              result?.client || null,
              sessionId
            );
          }
        } else {
          const clientSection =
            extractClientSection(reply, clientName) || reply;
          const result = await parseClientDetailsFromText(
            user.id,
            clientSection,
            clientName
          );
          await proceedWithInvoice(invoice, result?.client || null, sessionId);
        }
      } catch (err) {
        console.error(`Failed to process client ${clientName}:`, err);
        await proceedWithInvoice(invoice, null, sessionId);
      }
    }
  };

  // ── Single: Handle match result ──
  const handleMatchResult = async (
    invoice: ParsedInvoice,
    matchResult: MatchResult,
    sessionId: string
  ) => {
    if (matchResult.type === "exact" && matchResult.client) {
      await addAndShowAIMessage(
        `Got it! Using **${matchResult.client.name}**'s saved details ✓`,
        sessionId
      );
      await proceedWithInvoice(invoice, matchResult.client, sessionId);
    } else if (matchResult.type === "partial" && matchResult.client) {
      updatePendingClientState({
        status: "awaiting_confirm",
        clientName: invoice.clientName,
        matchedClient: matchResult.client,
        invoiceData: invoice,
        sessionId,
      });
      await addAndShowAIMessage(
        `I found a client named **${matchResult.client.name}** in your records. Is **${invoice.clientName}** the same person, or a different client?\n\nReply **same** or **different**.`,
        sessionId
      );
    } else {
      updatePendingClientState({
        status: "awaiting_details",
        clientName: invoice.clientName,
        invoiceData: invoice,
        sessionId,
      });
      await addAndShowAIMessage(
        `Got it! I've prepared the invoice for **${invoice.clientName}**. Could you share their email?\n\n*(Optional: phone, GSTIN, city)*\n\nOr just say **skip** to create without client details.`,
        sessionId
      );
    }
  };

  // ── Multi: Handle match results for all invoices ──
  const handleMultiMatchResults = async (
    invoicesWithMatch: { invoice: ParsedInvoice; matchResult: MatchResult }[],
    sessionId: string
  ) => {
    const exactMatches = invoicesWithMatch.filter(
      ({ matchResult }) => matchResult.type === "exact" && matchResult.client
    );
    const partialMatches = invoicesWithMatch.filter(
      ({ matchResult }) => matchResult.type === "partial" && matchResult.client
    );
    const noMatches = invoicesWithMatch.filter(
      ({ matchResult }) => matchResult.type === "none"
    );

    if (noMatches.length === 0 && partialMatches.length === 0) {
      const introMsg = `I've prepared **${invoicesWithMatch.length} invoices**! Review each one in the panel.`;
      await addAndShowAIMessage(introMsg, sessionId);
      for (const { invoice, matchResult } of exactMatches) {
        await proceedWithInvoice(invoice, matchResult.client, sessionId);
      }
      return;
    }

    const pendingClients: PendingInvoiceClient[] = [
      ...noMatches.map(({ invoice }) => ({
        clientName: invoice.clientName,
        invoice,
        matchedClient: null,
        needsConfirm: false,
      })),
      ...partialMatches.map(({ invoice, matchResult }) => ({
        clientName: invoice.clientName,
        invoice,
        matchedClient: matchResult.client,
        needsConfirm: true,
      })),
    ];

    const uniqueClientNames = [
      ...new Set(pendingClients.map((p) => p.clientName)),
    ];

    const parts: string[] = [
      `I've prepared **${invoicesWithMatch.length} invoice${
        invoicesWithMatch.length > 1 ? "s" : ""
      }**!`,
    ];

    const newClientNames = noMatches
      .map(({ invoice }) => invoice.clientName)
      .filter((name, i, arr) => arr.indexOf(name) === i);

    const partialClientNames = partialMatches
      .map(
        ({ invoice, matchResult }) =>
          `**${invoice.clientName}** (found similar: **${matchResult.client?.name}**)`
      )
      .filter((name, i, arr) => arr.indexOf(name) === i);

    if (newClientNames.length > 0) {
      const names = newClientNames.map((n) => `**${n}**`).join(", ");
      parts.push(
        `${names} ${
          newClientNames.length === 1 ? "is a new client" : "are new clients"
        }. Could you share their email${newClientNames.length > 1 ? "s" : ""}?`
      );
    }

    if (partialClientNames.length > 0) {
      parts.push(partialClientNames.join("\n"));
      parts.push("Are these the same people, or different clients?");
    }

    if (uniqueClientNames.length > 1) {
      parts.push(
        `\nFormat your reply as:\n**ClientName** - email, phone (optional)\n**ClientName2** - email`
      );
    } else {
      parts.push(`\n*(Optional: phone, GSTIN, city)*`);
    }

    parts.push(`\nOr say **skip** to create without client details.`);

    updatePendingClientState({
      status: "awaiting_multi_details",
      pendingClients,
      sessionId,
    });

    await addAndShowAIMessage(parts.join(" "), sessionId);

    // Create exact match invoices immediately
    for (const { invoice, matchResult } of exactMatches) {
      await proceedWithInvoice(invoice, matchResult.client, sessionId);
    }
  };

  // ── Main send handler ──
  const handleSend = async (prompt: string) => {
    if (!user) return;

    const tempId = Date.now().toString();
    addUserMessageToUI(prompt, tempId);
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

      // ── Route based on pending state ──
      if (pendingClientStateRef.current?.status === "awaiting_confirm") {
        await handleClientConfirmReply(prompt, sessionId);
        return;
      }

      if (pendingClientStateRef.current?.status === "awaiting_details") {
        await handleClientDetailsReply(prompt, sessionId);
        return;
      }

      if (pendingClientStateRef.current?.status === "awaiting_multi_details") {
        await handleMultiClientDetailsReply(prompt, sessionId);
        return;
      }

      // ── Normal invoice parse flow ──
      const result = await parseInvoiceWithAI(prompt, user.id);

      if (
        result.isMultiple &&
        result.invoicesWithMatch &&
        result.invoicesWithMatch.length > 1
      ) {
        await handleMultiMatchResults(result.invoicesWithMatch, sessionId);
      } else if (result.invoice && result.matchResult) {
        try {
          await handleMatchResult(
            result.invoice,
            result.matchResult,
            sessionId
          );
        } catch (err) {
          console.error("❌ handleMatchResult failed:", err);
          await proceedWithInvoice(result.invoice, null, sessionId);
        }
      } else if (result.invoice) {
        await proceedWithInvoice(result.invoice, null, sessionId);
      }

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

  const handleConfirmFromPanel = async (messageId: string) => {
    if (!user || !currentSessionId) return;

    const si = sessionInvoices.find((s) => s.messageId === messageId);
    if (!si) return;

    try {
      const invoiceId = si.invoiceId;

      if (!invoiceId) {
        console.error("No invoiceId found for message:", messageId);
        return;
      }

      const confirmed = await confirmInvoice(invoiceId);

      await confirmInvoiceInMessage(
        currentSessionId,
        messageId,
        confirmed.invoiceNumber,
        invoiceId
      );

      setSessionInvoices((prev) =>
        prev.map((s) =>
          s.messageId === messageId
            ? {
                ...s,
                isConfirmed: true,
                invoiceNumber: confirmed.invoiceNumber,
              }
            : s
        )
      );

      setSelectedPanelMessageId(messageId);

      setMessages((prev) =>
        prev.map((m) =>
          m.invoiceMessageId === messageId
            ? {
                ...m,
                isConfirmed: true,
                invoiceNumber: confirmed.invoiceNumber,
              }
            : m
        )
      );

      const confirmContent = `✅ Invoice **${confirmed.invoiceNumber}** for ${
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

  // ── Discard invoice from panel → delete from DB ──
  const handleDiscardFromPanel = async (messageId: string) => {
    const si = sessionInvoices.find((s) => s.messageId === messageId);

    // Delete from DB if we have the invoice id
    if (si?.invoiceId) {
      try {
        await deleteInvoice(si.invoiceId);
        console.log(`✅ Draft deleted from DB: ${si.invoiceId}`);
      } catch (err) {
        console.error("Failed to delete draft from DB:", err);
      }
    }

    // Remove from UI regardless
    setSessionInvoices((prev) => prev.filter((s) => s.messageId !== messageId));
    setMessages((prev) =>
      prev.map((m) =>
        m.invoiceMessageId === messageId
          ? { ...m, invoiceMessageId: undefined }
          : m
      )
    );
  };

  // ── New chat ──
  const handleNewChat = async () => {
    if (!user) return;
    try {
      const session = await createChatSession(user.id);
      setSessions((prev) => [session, ...prev]);
      setCurrentSessionId(session._id);
      setMessages([WELCOME]);
      setSessionInvoices([]);
      setSelectedPanelMessageId(null);
      updatePendingClientState(null);
    } catch (err) {
      console.error("Failed to create session:", err);
    }
  };

  // ── Delete session ──
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
        setSelectedPanelMessageId(null);
        updatePendingClientState(null);
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  // ── Load session ──
  const handleLoadSession = async (session: ChatSessionAPI) => {
    if (!user) return;
    setCurrentSessionId(session._id);
    setLoadingMessages(true);
    setMessages([]);
    setSessionInvoices([]);
    setSelectedPanelMessageId(null);
    updatePendingClientState(null);

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
        setSelectedPanelMessageId(null);
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
      setMessages([WELCOME]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const scrollToMessage = (messageId: string) => {
    const el = messageRefs.current[messageId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return {
    user,
    isLoading,
    loadingSessions,
    loadingMessages,
    sessions,
    currentSessionId,
    messages,
    sessionInvoices,
    selectedPanelMessageId,
    pendingClientState,
    bottomRef,
    messageRefs,
    handleSend,
    handleNewChat,
    handleDeleteSession,
    handleLoadSession,
    handleConfirmFromPanel,
    handleDiscardFromPanel,
    setSelectedPanelMessageId,
    setSessionInvoices,
    scrollToMessage,
  };
}
