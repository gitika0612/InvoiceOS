import { useState, useRef, useEffect, useCallback } from "react";
import { useUser } from "@clerk/clerk-react";
import {
  parseInvoiceWithAI,
  saveDraftInvoice,
  confirmInvoice,
  deleteInvoice,
  updateInvoice,
  MatchResult,
  fetchInvoiceById,
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
  updateMessageInvoiceData,
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
  | "awaiting_multi_details"
  | "awaiting_ambiguity_resolution";

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
  ambiguityAction?: "edit" | "copy";
  ambiguityRef?: string;
  ambiguityEditedInvoice?: ParsedInvoice;
  ambiguityCopyTargetClient?: string;
  ambiguityDefaultTarget?: SessionInvoice;
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

function buildSessionContext(sessionInvoices: SessionInvoice[]): string {
  if (sessionInvoices.length === 0)
    return "No existing invoices in this session.";
  const lines = sessionInvoices.map((si) => {
    const inv = si.invoice;
    const num = si.invoiceNumber || "Draft";
    const items = inv.lineItems?.map((l) => l.description).join(", ") || "";
    return `- ${num}: ${inv.clientName} | ₹${inv.total.toLocaleString(
      "en-IN"
    )} | GST ${inv.gstPercent}% | ${
      inv.paymentTermsDays
    } days | Items: ${items}`;
  });
  return `Existing invoices in this session:\n${lines.join("\n")}`;
}

function findMatchingInvoices(
  sessionInvoices: SessionInvoice[],
  ref: string
): SessionInvoice[] {
  if (!ref) return [];
  const refLower = ref.toLowerCase().trim();

  const byNumber = sessionInvoices.filter(
    (si) => si.invoiceNumber?.toLowerCase() === refLower
  );
  if (byNumber.length > 0) return byNumber;

  const byExactName = sessionInvoices.filter(
    (si) => si.invoice.clientName.toLowerCase() === refLower
  );
  if (byExactName.length > 0) return byExactName;

  const byPartialName = sessionInvoices.filter(
    (si) =>
      si.invoice.clientName.toLowerCase().includes(refLower) ||
      refLower.includes(si.invoice.clientName.toLowerCase())
  );
  return byPartialName;
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
  const [panelTab, setPanelTab] = useState<"draft" | "confirmed" | undefined>(
    undefined
  );

  const pendingClientStateRef = useRef<PendingClientState | null>(null);
  const sessionInvoicesRef = useRef<SessionInvoice[]>([]);
  const currentSessionIdRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isInitialLoadRef = useRef(true);

  // Keep refs in sync
  useEffect(() => {
    sessionInvoicesRef.current = sessionInvoices;
  }, [sessionInvoices]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  const setTabTemporarily = (tab: "draft" | "confirmed") => {
    setPanelTab(tab);
    setTimeout(() => setPanelTab(undefined), 200);
  };

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

  useEffect(() => {
    if (!user) return;
    if (currentSessionId) {
      localStorage.setItem(`ledger_session_${user.id}`, currentSessionId);
    }
  }, [currentSessionId, user]);

  const loadMessagesForSession = useCallback(
    async (userId: string, sessionId: string) => {
      setCurrentSessionId(sessionId);
      setLoadingMessages(true);
      // ── Clear immediately — no stale data ──
      setMessages([]);
      setSessionInvoices([]);
      setSelectedPanelMessageId(null);
      setPanelTab(undefined);
      updatePendingClientState(null);

      try {
        const msgs = await getSessionMessages(userId, sessionId);
        if (msgs.length === 0) {
          setMessages([WELCOME]);
        } else {
          setMessages(msgs.map(toUIMessage));

          const invoiceMsgs = msgs.filter(
            (m) => m.invoice?.data && m.invoice?.invoiceId
          );

          if (invoiceMsgs.length > 0) {
            // ── Fetch fresh data from DB, skip deleted invoices ──
            const invoiceResults = await Promise.all(
              invoiceMsgs.map(async (m) => {
                const invoiceId = m.invoice!.invoiceId;
                if (!invoiceId) return null;

                try {
                  const dbInvoice = await fetchInvoiceById(invoiceId);
                  if (!dbInvoice) return null; // deleted

                  return {
                    messageId: m._id,
                    invoice: {
                      clientName: dbInvoice.clientName,
                      lineItems: dbInvoice.lineItems,
                      gstPercent: dbInvoice.gstPercent,
                      paymentTermsDays: dbInvoice.paymentTermsDays,
                      subtotal: dbInvoice.subtotal,
                      gstAmount: dbInvoice.gstAmount,
                      total: dbInvoice.total,
                      invoiceDate: dbInvoice.invoiceDate,
                      invoiceMonth: dbInvoice.invoiceMonth,
                    } as ParsedInvoice,
                    isConfirmed: dbInvoice.isConfirmed,
                    invoiceNumber: dbInvoice.invoiceNumber,
                    invoiceId: invoiceId,
                    dbMessageId: m._id,
                  } as SessionInvoice;
                } catch (err) {
                  // ── 404 or any error = invoice deleted from DB, skip it ──
                  console.log(
                    `⚠️ Invoice ${invoiceId} not found in DB, skipping
                    ${err}
                    `
                  );
                  return null;
                }
              })
            );

            // ── Filter out nulls (deleted invoices) ──
            const invoices = invoiceResults.filter(
              (inv): inv is SessionInvoice => inv !== null
            );

            setSessionInvoices(invoices);

            if (invoices.length > 0) {
              const now = new Date();
              const currentMonth = now.toLocaleDateString("en-IN", {
                month: "long",
                year: "numeric",
              });
              const currentMonthInvoice = invoices.find(
                (inv) =>
                  inv.invoice.invoiceMonth?.toLowerCase() ===
                  currentMonth.toLowerCase()
              );
              setSelectedPanelMessageId(
                currentMonthInvoice
                  ? currentMonthInvoice.messageId
                  : invoices[invoices.length - 1].messageId
              );
            }
          }
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
        setMessages([WELCOME]);
      } finally {
        setLoadingMessages(false);
      }
    },
    []
  );

  const loadSessions = async () => {
    if (!user) return;
    try {
      const data = await getUserChatSessions(user.id);
      setSessions(data);

      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        const savedSessionId = localStorage.getItem(
          `ledger_session_${user.id}`
        );
        if (savedSessionId) {
          const session = data.find((s) => s._id === savedSessionId);
          if (session) {
            await loadMessagesForSession(user.id, session._id);
          }
        }
      }
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

  const proceedWithInvoice = async (
    invoice: ParsedInvoice,
    client: ClientAPI | null,
    sessionId: string,
    originalPrompt?: string
  ) => {
    if (!user) return;

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

    const savedAssistantMsg = await addChatMessage(
      user.id,
      sessionId,
      "assistant",
      assistantContent,
      {
        data: invoice,
        isConfirmed: false,
        invoiceId: savedDraft?._id || "",
        invoiceNumber: savedDraft?.invoiceNumber || "",
      }
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
        invoiceNumber: savedDraft?.invoiceNumber,
        dbMessageId: savedAssistantMsg._id,
      },
    ]);

    const newSessionInvoice: SessionInvoice = {
      messageId: savedAssistantMsg._id,
      invoice,
      isConfirmed: false,
      dbMessageId: savedAssistantMsg._id,
      invoiceId: savedDraft?._id,
      invoiceNumber: savedDraft?.invoiceNumber,
    };

    setSessionInvoices((prev) => [...prev, newSessionInvoice]);
    setSelectedPanelMessageId(savedAssistantMsg._id);
    setTabTemporarily("draft");

    // ── Show similar invoice warning if exists ──
    if (savedDraft?.hasSimilar && savedDraft.similarInvoiceNumber) {
      await addAndShowAIMessage(
        `⚠️ Note — a confirmed invoice for **${invoice.clientName}** already exists in **${savedDraft.similarInvoiceMonth}** (**${savedDraft.similarInvoiceNumber}**). ` +
          `This new draft has been saved as **${savedDraft.invoiceNumber}**.\n\nReview both in the panel and discard if not needed.`,
        sessionId
      );
    }
  };

  // ── Shared: apply edit to a specific invoice ──
  const applyEditToInvoice = async (
    target: SessionInvoice,
    parsedInvoice: ParsedInvoice & { changedFields?: string[] },
    sessionId: string
  ) => {
    const changedFields = parsedInvoice.changedFields || [];

    // ── Only apply what actually changed, preserve everything else ──
    const updatedInvoice: ParsedInvoice = { ...target.invoice };

    if (changedFields.includes("clientName") && parsedInvoice.clientName) {
      updatedInvoice.clientName = parsedInvoice.clientName;
    }
    if (changedFields.includes("gstPercent")) {
      updatedInvoice.gstPercent = parsedInvoice.gstPercent;
    }
    if (changedFields.includes("paymentTermsDays")) {
      updatedInvoice.paymentTermsDays = parsedInvoice.paymentTermsDays;
    }
    if (changedFields.includes("lineItems")) {
      updatedInvoice.lineItems = parsedInvoice.lineItems;
    }
    if (changedFields.includes("invoiceDate")) {
      updatedInvoice.invoiceDate = parsedInvoice.invoiceDate;
    }
    if (changedFields.includes("invoiceMonth")) {
      updatedInvoice.invoiceMonth = parsedInvoice.invoiceMonth;
    }

    // ── Always recalculate totals from current line items + current GST ──
    const subtotal = updatedInvoice.lineItems.reduce(
      (sum, item) => sum + item.amount,
      0
    );
    const gstAmount = Math.round((subtotal * updatedInvoice.gstPercent) / 100);
    updatedInvoice.subtotal = subtotal;
    updatedInvoice.gstAmount = gstAmount;
    updatedInvoice.total = subtotal + gstAmount;

    // rest of DB update + state update stays the same...
    if (target.invoiceId) {
      try {
        await updateInvoice(target.invoiceId, {
          clientName: updatedInvoice.clientName,
          lineItems: updatedInvoice.lineItems,
          paymentTermsDays: updatedInvoice.paymentTermsDays,
          gstPercent: updatedInvoice.gstPercent,
          subtotal: updatedInvoice.subtotal,
          gstAmount: updatedInvoice.gstAmount,
          total: updatedInvoice.total,
        });
      } catch (err) {
        console.error("Failed to update invoice in DB:", err);
      }
    }

    setSessionInvoices((prev) =>
      prev.map((s) =>
        s.messageId === target.messageId ? { ...s, invoice: updatedInvoice } : s
      )
    );

    const sessionId_ = currentSessionIdRef.current;
    if (sessionId_) {
      try {
        await updateMessageInvoiceData(
          sessionId_,
          target.messageId,
          updatedInvoice
        );
      } catch (err) {
        console.error("Failed to persist edit:", err);
      }
    }

    setSelectedPanelMessageId(target.messageId);

    const changedList = changedFields.join(", ") || "invoice";
    await addAndShowAIMessage(
      `✅ Updated **${target.invoice.clientName}**'s invoice (${
        target.invoiceNumber || "Draft"
      }) — changed: ${changedList}.\n\nNew total: **₹${updatedInvoice.total.toLocaleString(
        "en-IN"
      )}**. Review in the panel →`,
      sessionId
    );
  };

  // ── Shared: clone invoice for new client ──
  const applyCopyFromInvoice = async (
    source: SessionInvoice,
    newClientName: string,
    sessionId: string
  ) => {
    const cloned: ParsedInvoice = {
      ...source.invoice,
      clientName: newClientName,
    };
    await addAndShowAIMessage(
      `Copying **${source.invoice.clientName}**'s invoice for **${newClientName}**...`,
      sessionId
    );
    await proceedWithInvoice(cloned, null, sessionId);
  };

  // ── Handle edit intent from AI ──
  const handleEditIntent = async (
    parsedInvoice: ParsedInvoice & {
      targetInvoiceRef?: string;
      changedFields?: string[];
    },
    sessionId: string
  ) => {
    const ref = parsedInvoice.targetInvoiceRef || "";
    const matches = findMatchingInvoices(sessionInvoicesRef.current, ref);

    if (matches.length === 0) {
      await addAndShowAIMessage(
        `I couldn't find an invoice matching **"${ref}"** in this session.\n\nPlease use the full client name or invoice number (e.g. **INV-2026-001**).`,
        sessionId
      );
      return;
    }

    if (matches.length > 1) {
      const latest = [...matches].sort((a, b) =>
        b.dbMessageId.localeCompare(a.dbMessageId)
      )[0];

      updatePendingClientState({
        status: "awaiting_ambiguity_resolution",
        ambiguityAction: "edit",
        ambiguityRef: ref,
        ambiguityEditedInvoice: parsedInvoice,
        ambiguityDefaultTarget: latest,
        sessionId,
      });

      await addAndShowAIMessage(
        `Found multiple invoices matching **"${ref}"**. Applying to the most recent one:\n\n` +
          `**${latest.invoiceNumber || "Draft"}** — ${
            latest.invoice.clientName
          } — ₹${latest.invoice.total.toLocaleString("en-IN")}\n\n` +
          `Reply **yes** to confirm, or share a specific invoice number like **INV-XXXX-XXX**.`,
        sessionId
      );
      return;
    }

    await applyEditToInvoice(matches[0], parsedInvoice, sessionId);
  };

  // ── Handle copy intent from AI ──
  const handleCopyIntent = async (
    parsedInvoice: ParsedInvoice & { targetInvoiceRef?: string },
    sessionId: string
  ) => {
    const ref = parsedInvoice.targetInvoiceRef || "";
    const newClientName = parsedInvoice.clientName;
    const matches = findMatchingInvoices(sessionInvoicesRef.current, ref);

    if (matches.length === 0) {
      await addAndShowAIMessage(
        `I couldn't find an invoice matching **"${ref}"** in this session.\n\nPlease use the full client name or invoice number.`,
        sessionId
      );
      return;
    }

    if (matches.length > 1) {
      const latest = [...matches].sort((a, b) =>
        b.dbMessageId.localeCompare(a.dbMessageId)
      )[0];

      updatePendingClientState({
        status: "awaiting_ambiguity_resolution",
        ambiguityAction: "copy",
        ambiguityRef: ref,
        ambiguityCopyTargetClient: newClientName,
        ambiguityDefaultTarget: latest,
        sessionId,
      });

      await addAndShowAIMessage(
        `Found multiple invoices matching **"${ref}"**. Copying from the most recent one:\n\n` +
          `**${latest.invoiceNumber || "Draft"}** — ${
            latest.invoice.clientName
          } — ₹${latest.invoice.total.toLocaleString("en-IN")}\n\n` +
          `Reply **yes** to confirm, or share a specific invoice number like **INV-XXXX-XXX**.`,
        sessionId
      );
      return;
    }

    await applyCopyFromInvoice(matches[0], newClientName, sessionId);
  };

  // ── Handle ambiguity resolution reply ──
  const handleAmbiguityResolutionReply = async (
    reply: string,
    sessionId: string
  ) => {
    const current = pendingClientStateRef.current;
    if (!current) return;

    const isYes =
      reply.toLowerCase().trim() === "yes" ||
      reply.toLowerCase().trim() === "haan" ||
      reply.toLowerCase().trim() === "confirm";

    // User confirmed the default target
    if (isYes && current.ambiguityDefaultTarget) {
      updatePendingClientState(null);

      if (
        current.ambiguityAction === "edit" &&
        current.ambiguityEditedInvoice
      ) {
        await applyEditToInvoice(
          current.ambiguityDefaultTarget,
          current.ambiguityEditedInvoice,
          sessionId
        );
      } else if (current.ambiguityAction === "copy") {
        await applyCopyFromInvoice(
          current.ambiguityDefaultTarget,
          current.ambiguityCopyTargetClient || "New Client",
          sessionId
        );
      }
      return;
    }

    // User gave a specific invoice number or name
    updatePendingClientState(null);
    const matches = findMatchingInvoices(
      sessionInvoicesRef.current,
      reply.trim()
    );

    if (matches.length === 0) {
      await addAndShowAIMessage(
        `Couldn't find **"${reply}"**. Please use the exact invoice number like **INV-2026-001**.`,
        sessionId
      );
      return;
    }

    if (matches.length > 1) {
      const latest = [...matches].sort((a, b) =>
        b.dbMessageId.localeCompare(a.dbMessageId)
      )[0];
      updatePendingClientState({
        ...current,
        ambiguityDefaultTarget: latest,
        ambiguityRef: reply,
      });
      await addAndShowAIMessage(
        `Still found multiple matches. Using most recent:\n\n` +
          `**${latest.invoiceNumber || "Draft"}** — ${
            latest.invoice.clientName
          } — ₹${latest.invoice.total.toLocaleString("en-IN")}\n\n` +
          `Reply **yes** to confirm or use exact invoice number like **INV-2026-001**.`,
        sessionId
      );
      return;
    }

    const target = matches[0];

    if (current.ambiguityAction === "edit" && current.ambiguityEditedInvoice) {
      await applyEditToInvoice(
        target,
        current.ambiguityEditedInvoice,
        sessionId
      );
    } else if (current.ambiguityAction === "copy") {
      await applyCopyFromInvoice(
        target,
        current.ambiguityCopyTargetClient || "New Client",
        sessionId
      );
    }
  };

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
        `Got it! **${clientName}** is a new client. Please share their details.\n\n` +
          `**Email** *(required)*\n` +
          `*(Optional: Address, City, State, Phone, GSTIN)*\n\n` +
          `💡 Best format: \`email, address, city, state\`\n` +
          `e.g. \`rahul@gmail.com, E-24 Sector 85, Faridabad, Haryana\`\n\n` +
          `Or say **skip**.`,
        sessionId
      );
    }
  };

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
        `Got it! I've prepared the invoice for **${invoice.clientName}**. To send it, I'll need their contact details.\n\n` +
          `**Email** *(required)*\n` +
          `*(Optional: Address, City, State, Phone, GSTIN)*\n\n` +
          `💡 Best format: \`email, address, city, state\`\n` +
          `e.g. \`john@gmail.com, D Block Sector 103, Greater Noida, Uttar Pradesh\`\n\n` +
          `Or say **skip** to create without client details.`,
        sessionId
      );
    }
  };

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
      await addAndShowAIMessage(
        `I've prepared **${invoicesWithMatch.length} invoices**! Review each one in the panel.`,
        sessionId
      );
      for (const { invoice, matchResult } of exactMatches) {
        await proceedWithInvoice(invoice, matchResult.client, sessionId);
      }

      // ── Auto-select current month invoice after all are created ──
      const now = new Date();
      const currentMonth = now.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      });
      const currentMonthInvoice = sessionInvoicesRef.current.find(
        (si) =>
          si.invoice.invoiceMonth?.toLowerCase() === currentMonth.toLowerCase()
      );
      if (currentMonthInvoice) {
        setSelectedPanelMessageId(currentMonthInvoice.messageId);
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
        }. Please share their email${
          newClientNames.length > 1 ? "s" : ""
        }.\n\n*(Optional: City, State, Address, Phone, GSTIN)*`
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
    }

    parts.push(`\nOr say **skip** to create without client details.`);

    updatePendingClientState({
      status: "awaiting_multi_details",
      pendingClients,
      sessionId,
    });
    await addAndShowAIMessage(parts.join(" "), sessionId);

    for (const { invoice, matchResult } of exactMatches) {
      await proceedWithInvoice(invoice, matchResult.client, sessionId);
    }

    // ── Auto-select current month invoice after exact matches are created ──
    const now = new Date();
    const currentMonth = now.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
    const currentMonthInvoice = sessionInvoicesRef.current.find(
      (si) =>
        si.invoice.invoiceMonth?.toLowerCase() === currentMonth.toLowerCase()
    );
    if (currentMonthInvoice) {
      setSelectedPanelMessageId(currentMonthInvoice.messageId);
    }
  };

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

      // ── Route pending states ──
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
      if (
        pendingClientStateRef.current?.status ===
        "awaiting_ambiguity_resolution"
      ) {
        await handleAmbiguityResolutionReply(prompt, sessionId);
        return;
      }

      // ── Build session context for AI ──
      const sessionContext = buildSessionContext(sessionInvoicesRef.current);

      // ── Parse with AI ──
      const result = await parseInvoiceWithAI(prompt, user.id, sessionContext);

      if (
        result.isMultiple &&
        result.invoicesWithMatch &&
        result.invoicesWithMatch.length > 1
      ) {
        await handleMultiMatchResults(result.invoicesWithMatch, sessionId);
      } else if (result.invoice) {
        const invoice = result.invoice as ParsedInvoice & {
          intent?: "new" | "edit" | "copy";
          targetInvoiceRef?: string;
          changedFields?: string[];
        };

        const intent = invoice.intent || "new";

        if (intent === "edit") {
          await handleEditIntent(invoice, sessionId);
        } else if (intent === "copy") {
          await handleCopyIntent(invoice, sessionId);
        } else {
          if (result.matchResult) {
            try {
              await handleMatchResult(invoice, result.matchResult, sessionId);
            } catch (err) {
              console.error("❌ handleMatchResult failed:", err);
              await proceedWithInvoice(invoice, null, sessionId);
            }
          } else {
            await proceedWithInvoice(invoice, null, sessionId);
          }
        }
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
      setTabTemporarily("confirmed");

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

  const handleEditFromPanel = async (
    messageId: string,
    updated: ParsedInvoice
  ) => {
    setSessionInvoices((prev) =>
      prev.map((s) =>
        s.messageId === messageId ? { ...s, invoice: updated } : s
      )
    );

    if (currentSessionId) {
      try {
        await updateMessageInvoiceData(currentSessionId, messageId, updated);
      } catch (err) {
        console.error("Failed to persist edit to chat message:", err);
      }
    }
  };

  const handleDiscardFromPanel = async (messageId: string) => {
    const si = sessionInvoices.find((s) => s.messageId === messageId);
    if (si?.invoiceId) {
      try {
        await deleteInvoice(si.invoiceId);
      } catch (err) {
        console.error("Failed to delete draft from DB:", err);
      }
    }
    setSessionInvoices((prev) => prev.filter((s) => s.messageId !== messageId));
    setMessages((prev) =>
      prev.map((m) =>
        m.invoiceMessageId === messageId
          ? { ...m, invoiceMessageId: undefined }
          : m
      )
    );
  };

  const handleNewChat = async () => {
    if (!user) return;
    try {
      const session = await createChatSession(user.id);
      setSessions((prev) => [session, ...prev]);
      setCurrentSessionId(session._id);
      setMessages([WELCOME]);
      setSessionInvoices([]);
      setSelectedPanelMessageId(null);
      setPanelTab(undefined);
      updatePendingClientState(null);
      localStorage.removeItem(`ledger_session_${user.id}`);
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
        setSelectedPanelMessageId(null);
        setPanelTab(undefined);
        updatePendingClientState(null);
        localStorage.removeItem(`ledger_session_${user.id}`);
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const handleLoadSession = async (session: ChatSessionAPI) => {
    if (!user) return;
    await loadMessagesForSession(user.id, session._id);
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
    panelTab,
    bottomRef,
    messageRefs,
    handleSend,
    handleNewChat,
    handleDeleteSession,
    handleLoadSession,
    handleConfirmFromPanel,
    handleDiscardFromPanel,
    handleEditFromPanel,
    setSelectedPanelMessageId,
    setSessionInvoices,
    scrollToMessage,
  };
}
