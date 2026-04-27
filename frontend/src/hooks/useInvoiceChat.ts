import { useState, useRef, useEffect, useCallback } from "react";
import { useUser } from "@clerk/clerk-react";
import {
  parseInvoiceWithAI,
  saveDraftInvoice,
  confirmInvoice,
  deleteInvoice,
  updateInvoice,
  fetchInvoiceById,
  fetchClientHistory,
  AgentResult,
} from "@/lib/api/invoiceApi";
import { parseClientDetailsFromText, ClientAPI } from "@/lib/api/clientApi";
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
} from "@/lib/api/chatApi";
import { SessionInvoice } from "@/components/invoice/InvoicePanel";
import { WELCOME } from "@/lib/invoice-chat/constants";
import { getTime, toUIMessage } from "@/lib/invoice-chat/messageHelpers";
import { recalculateTotals } from "@/lib/invoice-chat/invoiceHelpers";
import {
  buildSessionContext,
  extractClientNameFromPrompt,
  findMatchingInvoices,
} from "@/lib/invoice-chat/sessionHelpers";

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

interface InvoiceHistoryEntry {
  invoiceMonth?: string;
  lineItems?: Array<{ description: string; rate: number }>;
  gstPercent?: number;
  gstType?: string;
  paymentTermsDays?: number;
  total?: number;
}

// Bug 9a: detect generic placeholder client names
const GENERIC_CLIENT_NAMES = new Set([
  "international client",
  "client",
  "the client",
  "new client",
  "unknown client",
  "customer",
  "overseas client",
  "foreign client",
]);

function isGenericClientName(name: string): boolean {
  return GENERIC_CLIENT_NAMES.has(name.toLowerCase().trim());
}

type PendingStatus =
  | "awaiting_client_details"
  | "awaiting_confirm_same"
  | "awaiting_ambiguity" // copy ambiguity
  | "awaiting_edit_ambiguity" // edit ambiguity
  | "awaiting_client_name"; // Bug 9a: need real client name

interface PendingState {
  status: PendingStatus;
  sessionId: string;
  originalPrompt: string;
  invoice?: ParsedInvoice;
  clientName?: string;
  matchedClient?: ClientAPI | null;
  ambiguityInvoice?: ParsedInvoice;
  ambiguityTargetRef?: string;
  // For client name flow: we have email but need name
  pendingEmail?: string;
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
  const [pendingState, setPendingState] = useState<PendingState | null>(null);
  const [panelTab, setPanelTab] = useState<"draft" | "confirmed" | undefined>(
    undefined
  );

  const pendingStateRef = useRef<PendingState | null>(null);
  const sessionInvoicesRef = useRef<SessionInvoice[]>([]);
  const currentSessionIdRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    sessionInvoicesRef.current = sessionInvoices;
  }, [sessionInvoices]);
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);
  useEffect(() => {
    if (!isLoaded || !user) return;
    loadSessions();
  }, [isLoaded, user]);
  useEffect(() => {
    if (!user || !currentSessionId) return;
    localStorage.setItem(`ledger_session_${user.id}`, currentSessionId);
  }, [currentSessionId, user]);

  const setPending = (val: PendingState | null) => {
    pendingStateRef.current = val;
    setPendingState(val);
  };

  const setTabTemporarily = (tab: "draft" | "confirmed") => {
    setPanelTab(tab);
    setTimeout(() => setPanelTab(undefined), 200);
  };

  // ─────────────────────────────────────────────
  // Session / message loading
  // ─────────────────────────────────────────────

  const loadMessagesForSession = useCallback(
    async (userId: string, sessionId: string) => {
      setCurrentSessionId(sessionId);
      setLoadingMessages(true);
      setMessages([]);
      setSessionInvoices([]);
      setSelectedPanelMessageId(null);
      setPanelTab(undefined);
      setPending(null);

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
            const results = await Promise.all(
              invoiceMsgs.map(async (m): Promise<SessionInvoice | null> => {
                const invoiceId = m.invoice?.invoiceId;
                if (!invoiceId) return null;
                try {
                  const db = await fetchInvoiceById(invoiceId);
                  if (!db) return null;
                  return {
                    messageId: m._id,
                    invoice: {
                      clientName: db.clientName,
                      lineItems: db.lineItems,
                      gstPercent: db.gstPercent,
                      gstType: db.gstType,
                      cgstAmount: db.cgstAmount,
                      sgstAmount: db.sgstAmount,
                      igstAmount: db.igstAmount,
                      gstAmount: db.gstAmount,
                      discountType: db.discountType,
                      discountValue: db.discountValue,
                      discountAmount: db.discountAmount,
                      notes: db.notes,
                      paymentTermsDays: db.paymentTermsDays,
                      subtotal: db.subtotal,
                      taxableAmount: db.taxableAmount,
                      total: db.total,
                      invoiceDate: db.invoiceDate,
                      invoiceMonth: db.invoiceMonth,
                    } as ParsedInvoice,
                    isConfirmed: db.isConfirmed,
                    invoiceNumber: db.invoiceNumber,
                    invoiceId,
                    dbMessageId: m._id,
                  };
                } catch {
                  return null;
                }
              })
            );
            const invoices = results.filter(
              (inv): inv is SessionInvoice => inv !== null
            );
            setSessionInvoices(invoices);

            // Bug 2 fix: select the LAST invoice in array = most recently created
            if (invoices.length > 0) {
              setSelectedPanelMessageId(
                invoices[invoices.length - 1].messageId
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
        const savedId = localStorage.getItem(`ledger_session_${user.id}`);
        if (savedId) {
          const session = data.find((s) => s._id === savedId);
          if (session) await loadMessagesForSession(user.id, session._id);
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

  // ─────────────────────────────────────────────
  // Core helpers
  // ─────────────────────────────────────────────

  const addAIMessage = async (
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
        .concat({ _id: tempId, role: "user", content, timestamp: getTime() })
    );
  };

  const saveDraftAndShow = async (
    invoice: ParsedInvoice,
    client: ClientAPI | null,
    sessionId: string,
    originalPrompt: string,
    autoSelect = true
  ) => {
    if (!user) return;
    const finalInvoice = recalculateTotals(invoice);

    let savedDraft = null;
    try {
      savedDraft = await saveDraftInvoice(
        finalInvoice,
        user.id,
        originalPrompt,
        client?._id
      );
    } catch (err) {
      console.error("Failed to save draft:", err);
    }

    const content = `Invoice draft ready for **${finalInvoice.clientName}**. Review it in the side panel.`;
    const savedMsg = await addChatMessage(
      user.id,
      sessionId,
      "assistant",
      content,
      {
        data: finalInvoice,
        isConfirmed: false,
        invoiceId: savedDraft?._id || "",
        invoiceNumber: savedDraft?.invoiceNumber || "",
      }
    );

    setMessages((prev) => [
      ...prev,
      {
        _id: savedMsg._id,
        role: "assistant",
        content,
        timestamp: getTime(),
        invoiceMessageId: savedMsg._id,
        isConfirmed: false,
        invoiceNumber: savedDraft?.invoiceNumber,
        dbMessageId: savedMsg._id,
      },
    ]);

    const newInvoice: SessionInvoice = {
      messageId: savedMsg._id,
      invoice: finalInvoice,
      isConfirmed: false,
      dbMessageId: savedMsg._id,
      invoiceId: savedDraft?._id,
      invoiceNumber: savedDraft?.invoiceNumber,
    };

    setSessionInvoices((prev) => {
      const updated = [...prev, newInvoice];
      // Bug 1 fix: only auto-select for single invoice creation.
      // For multi-invoice batch, caller passes autoSelect=false and selects after all are done.
      if (autoSelect)
        setSelectedPanelMessageId(updated[updated.length - 1].messageId);
      return updated;
    });

    setTabTemporarily("draft");

    if (savedDraft?.hasSimilar && savedDraft.similarInvoiceNumber) {
      await addAIMessage(
        `⚠️ A confirmed invoice already exists for **${finalInvoice.clientName}** in **${savedDraft.similarInvoiceMonth}** (${savedDraft.similarInvoiceNumber}). This new draft is ${savedDraft.invoiceNumber}. Review both before confirming.`,
        sessionId
      );
    }
  };

  const applyEditAndShow = async (
    target: SessionInvoice,
    updatedInvoice: ParsedInvoice,
    message: string,
    sessionId: string
  ) => {
    const finalInvoice = recalculateTotals(updatedInvoice);

    if (target.invoiceId) {
      try {
        await updateInvoice(target.invoiceId, finalInvoice);
      } catch (err) {
        console.error("Failed to update invoice in DB:", err);
      }
    }

    setSessionInvoices((prev) =>
      prev.map((s) =>
        s.messageId === target.messageId ? { ...s, invoice: finalInvoice } : s
      )
    );

    const sid = currentSessionIdRef.current;
    if (sid) {
      try {
        await updateMessageInvoiceData(sid, target.messageId, finalInvoice);
      } catch (err) {
        console.error("Failed to persist edit:", err);
      }
    }

    setSelectedPanelMessageId(target.messageId);
    await addAIMessage(message, sessionId);
  };

  // ─────────────────────────────────────────────
  // Handle agent result
  // ─────────────────────────────────────────────

  const handleAgentResult = async (
    result: AgentResult,
    sessionId: string,
    originalPrompt: string
  ) => {
    const { action, message, invoice, invoices, invoicesWithMatch, targetRef } =
      result;

    switch (action) {
      case "created":
      case "copied": {
        if (!invoice) break;
        await addAIMessage(message, sessionId);
        await saveDraftAndShow(
          invoice,
          result.matchResult?.client ?? null,
          sessionId,
          originalPrompt
        );
        break;
      }

      case "needs_client": {
        if (!invoice) break;
        const matchType = result.matchResult?.type;

        // Bug 9a: if client name is generic (e.g. "International client"),
        // ask for the real name before asking for email
        if (isGenericClientName(invoice.clientName)) {
          setPending({
            status: "awaiting_client_name",
            sessionId,
            originalPrompt,
            invoice,
            clientName: invoice.clientName,
          });
          await addAIMessage(
            `Invoice of **₹${invoice.total.toLocaleString(
              "en-IN"
            )}** is ready!\n\nWhat's the client's name? (The name will appear on the invoice.)`,
            sessionId
          );
          break;
        }

        if (matchType === "partial") {
          setPending({
            status: "awaiting_confirm_same",
            sessionId,
            originalPrompt,
            invoice,
            clientName: invoice.clientName,
            matchedClient: result.matchResult?.client ?? null,
          });
        } else {
          setPending({
            status: "awaiting_client_details",
            sessionId,
            originalPrompt,
            invoice,
            clientName: invoice.clientName,
          });
        }
        await addAIMessage(message, sessionId);
        break;
      }

      case "edited": {
        if (!invoice) {
          await addAIMessage(message, sessionId);
          break;
        }
        const matches = findMatchingInvoices(
          sessionInvoicesRef.current,
          targetRef ?? ""
        );
        if (matches.length === 0) {
          await addAIMessage(message, sessionId);
          break;
        }
        if (matches.length === 1) {
          await applyEditAndShow(matches[0], invoice, message, sessionId);
          break;
        }
        // Multiple matches
        setPending({
          status: "awaiting_edit_ambiguity",
          sessionId,
          originalPrompt,
          ambiguityInvoice: invoice,
          ambiguityTargetRef: targetRef,
        });
        const latest = [...matches].sort((a, b) =>
          b.dbMessageId.localeCompare(a.dbMessageId)
        )[0];
        const invoiceList = matches
          .map(
            (m) =>
              `**${m.invoiceNumber ?? "Draft"}** — ${
                m.invoice.invoiceMonth ?? "unknown"
              }`
          )
          .join("\n");
        await addAIMessage(
          `Found **${
            matches.length
          } invoices** for **${targetRef}**:\n\n${invoiceList}\n\nWhich one should I update? Reply with an invoice number or **latest** for the most recent (${
            latest.invoiceNumber ?? "Draft"
          }).`,
          sessionId
        );
        break;
      }

      case "ambiguous": {
        // Bug 4 fix: copier found multiple invoices for the source client
        // Store pending state so next reply (with invoice number) triggers the copy
        setPending({
          status: "awaiting_ambiguity",
          sessionId,
          originalPrompt,
          ambiguityTargetRef: targetRef,
          invoice: undefined,
        });
        await addAIMessage(message, sessionId);
        break;
      }

      case "multi_created": {
        // Bug 1 fix: show summary message first, then create each invoice WITHOUT auto-selecting
        await addAIMessage(message, sessionId);
        const items =
          invoicesWithMatch ??
          (invoices ?? []).map((inv) => ({
            invoice: inv,
            matchResult: { type: "none" as const, client: null, score: 0 },
          }));

        for (const { invoice: inv, matchResult } of items) {
          await saveDraftAndShow(
            inv,
            matchResult.type === "exact" ? matchResult.client : null,
            sessionId,
            originalPrompt,
            false // never auto-select during batch
          );
        }

        // Bug 1 fix: after all are created, select the FIRST one (current/most relevant month)
        // The first invoice in the batch = the earliest month = most likely current month
        const allNow = sessionInvoicesRef.current;
        const batchStart = allNow.length - items.length;
        const firstOfBatch = allNow[batchStart];
        if (firstOfBatch) {
          setSelectedPanelMessageId(firstOfBatch.messageId);
        }
        break;
      }

      case "not_found":
      case "unclear":
      case "info":
      default:
        await addAIMessage(message, sessionId);
        break;
    }
  };

  // ─────────────────────────────────────────────
  // Pending state replies
  // ─────────────────────────────────────────────

  const handlePendingReply = async (reply: string, sessionId: string) => {
    const current = pendingStateRef.current;
    if (!current || !user) return;
    const replyLower = reply.toLowerCase().trim();

    // Bug 9a: collect real client name, then ask for email
    if (current.status === "awaiting_client_name") {
      const realName = reply.trim();
      const updatedInvoice = current.invoice
        ? { ...current.invoice, clientName: realName }
        : current.invoice;
      setPending({
        ...current,
        status: "awaiting_client_details",
        clientName: realName,
        invoice: updatedInvoice,
      });
      await addAIMessage(
        `Got it! Invoice for **${realName}**.\n\nPlease share their contact details:\n\n**Email** *(required)*\n*(Optional: Address, City, State, Phone, GSTIN)*\n\nOr say **skip** to create without client details.`,
        sessionId
      );
      return;
    }

    // Same/different for partial match
    if (current.status === "awaiting_confirm_same") {
      const isSame = ["same", "yes", "haan", "confirm", "y"].includes(
        replyLower
      );
      if (isSame && current.matchedClient) {
        setPending(null);
        await addAIMessage(
          `Got it! Using **${current.matchedClient.name}**'s saved details ✓`,
          sessionId
        );
        await saveDraftAndShow(
          current.invoice!,
          current.matchedClient,
          sessionId,
          current.originalPrompt
        );
      } else {
        setPending({ ...current, status: "awaiting_client_details" });
        await addAIMessage(
          `Got it! Please share **${current.clientName}**'s contact details:\n\n**Email** *(required)*\n*(Optional: Address, City, State, Phone, GSTIN)*\n\nOr say **skip**.`,
          sessionId
        );
      }
      return;
    }

    // Email / details for new client
    if (current.status === "awaiting_client_details") {
      setPending(null);
      const isSkip = replyLower === "skip" || replyLower.startsWith("skip");
      if (isSkip) {
        await addAIMessage(
          `No problem! Creating invoice without client details.`,
          sessionId
        );
        await saveDraftAndShow(
          current.invoice!,
          null,
          sessionId,
          current.originalPrompt
        );
      } else {
        try {
          const result = await parseClientDetailsFromText(
            user.id,
            reply,
            current.clientName!
          );
          await addAIMessage(
            result?.client
              ? `Saved **${current.clientName}**'s details ✓ Creating invoice now!`
              : `Creating invoice! You can add client details later.`,
            sessionId
          );
          await saveDraftAndShow(
            current.invoice!,
            result?.client ?? null,
            sessionId,
            current.originalPrompt
          );
        } catch {
          await addAIMessage(
            `Creating invoice now! You can add client details later.`,
            sessionId
          );
          await saveDraftAndShow(
            current.invoice!,
            null,
            sessionId,
            current.originalPrompt
          );
        }
      }
      return;
    }

    // Bug 4: copy ambiguity — user replied with which invoice to copy
    if (current.status === "awaiting_ambiguity") {
      setPending(null);
      // Re-run the AI parse with the specific invoice number appended
      const refinedPrompt = `${
        current.originalPrompt
      } — use invoice ${reply.trim()}`;
      const result = await parseInvoiceWithAI(
        refinedPrompt,
        user.id,
        buildSessionContext(sessionInvoicesRef.current),
        undefined,
        null
      );
      await handleAgentResult(result, sessionId, current.originalPrompt);
      return;
    }

    // Edit ambiguity resolution
    if (current.status === "awaiting_edit_ambiguity") {
      const isLatest = ["latest", "last", "recent"].includes(replyLower);
      const allMatches = findMatchingInvoices(
        sessionInvoicesRef.current,
        current.ambiguityTargetRef ?? ""
      );
      const byReply = findMatchingInvoices(
        sessionInvoicesRef.current,
        replyLower
      );
      const latestMatch = [...allMatches].sort((a, b) =>
        b.dbMessageId.localeCompare(a.dbMessageId)
      )[0];
      const target = isLatest ? latestMatch : byReply[0];

      if (!target) {
        await addAIMessage(
          `Couldn't find **"${reply}"**. Please use the exact invoice number like **INV-2026-001**, or say **latest**.`,
          sessionId
        );
        return;
      }
      setPending(null);
      if (current.ambiguityInvoice) {
        await applyEditAndShow(
          target,
          current.ambiguityInvoice,
          `Updated **${target.invoice.clientName}**'s invoice (${
            target.invoiceNumber ?? "Draft"
          }).`,
          sessionId
        );
      }
      return;
    }
  };

  // ─────────────────────────────────────────────
  // Main send handler
  // ─────────────────────────────────────────────

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

      if (pendingStateRef.current) {
        await handlePendingReply(prompt, sessionId);
        loadSessions();
        return;
      }

      const sessionContext = buildSessionContext(sessionInvoicesRef.current);

      // Memory context — fetch for the specific client mentioned
      let memoryContext = "No past invoice history for this client.";
      const possibleClient = extractClientNameFromPrompt(prompt);
      if (possibleClient) {
        try {
          const history = (await fetchClientHistory(
            possibleClient,
            user.id
          )) as InvoiceHistoryEntry[];
          if (history?.length > 0) {
            const lines = history.map((inv, i) => {
              const items =
                inv.lineItems
                  ?.map((li) => `${li.description} ₹${li.rate}`)
                  .join(", ") ?? "";
              return `Invoice ${i + 1} [${
                inv.invoiceMonth ?? "unknown"
              }]: ${items} | GST ${inv.gstPercent ?? 18}% ${
                inv.gstType ?? ""
              } | Terms ${inv.paymentTermsDays ?? 15}d | Total ₹${
                inv.total ?? 0
              }`;
            });
            memoryContext = `Past invoices for ${possibleClient}:\n${lines.join(
              "\n"
            )}\nUse these rates and terms as defaults.`;
          }
        } catch {
          // Memory is optional
        }
      }

      // Pass currently selected invoice as edit context
      const currentInvoice: ParsedInvoice | null = selectedPanelMessageId
        ? sessionInvoicesRef.current.find(
            (s) => s.messageId === selectedPanelMessageId
          )?.invoice ?? null
        : sessionInvoicesRef.current.length > 0
        ? sessionInvoicesRef.current[sessionInvoicesRef.current.length - 1]
            .invoice ?? null
        : null;

      const result = await parseInvoiceWithAI(
        prompt,
        user.id,
        sessionContext,
        memoryContext,
        currentInvoice
      );
      await handleAgentResult(result, sessionId, prompt);
      loadSessions();
    } catch (err) {
      console.error("Failed:", err);
      setMessages((prev) => [
        ...prev,
        {
          _id: Date.now().toString(),
          role: "assistant",
          content: "❌ Sorry, something went wrong. Please try again.",
          timestamp: getTime(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────
  // Panel actions
  // ─────────────────────────────────────────────

  const handleConfirmFromPanel = async (messageId: string) => {
    if (!user || !currentSessionId) return;
    const si = sessionInvoices.find((s) => s.messageId === messageId);
    if (!si?.invoiceId) return;
    try {
      const confirmed = await confirmInvoice(si.invoiceId);
      await confirmInvoiceInMessage(
        currentSessionId,
        messageId,
        confirmed.invoiceNumber,
        si.invoiceId
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
      const confirmContent = `✅ Invoice **${
        confirmed.invoiceNumber
      }** confirmed for **${
        si.invoice.clientName
      }**. Total: ₹${si.invoice.total.toLocaleString("en-IN")}.`;
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
        console.error("Failed to persist edit:", err);
      }
    }
  };

  const handleDiscardFromPanel = async (messageId: string) => {
    const si = sessionInvoices.find((s) => s.messageId === messageId);
    if (si?.invoiceId) {
      try {
        await deleteInvoice(si.invoiceId);
      } catch (err) {
        console.error("Failed to delete draft:", err);
      }
    }
    setSessionInvoices((prev) => {
      const updated = prev.filter((s) => s.messageId !== messageId);
      if (selectedPanelMessageId === messageId) {
        setSelectedPanelMessageId(
          updated.length > 0 ? updated[updated.length - 1].messageId : null
        );
      }
      return updated;
    });
    setMessages((prev) =>
      prev.map((m) =>
        m.invoiceMessageId === messageId
          ? {
              ...m,
              invoiceMessageId: undefined,
              isConfirmed: undefined,
              invoiceNumber: undefined,
            }
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
      setPending(null);
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
        setPending(null);
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
    pendingState,
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
