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
import { BULK_SAFE_FIELDS, WELCOME } from "@/lib/invoice-chat/constants";
import {
  extractClientSection,
  getTime,
  toUIMessage,
} from "@/lib/invoice-chat/messageHelpers";
import {
  diffLineItems,
  recalculateTotals,
} from "@/lib/invoice-chat/invoiceHelpers";
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

export interface MatchResult {
  type: "exact" | "partial" | "none";
  client: ClientAPI | null;
  score: number;
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
    if (!user || !currentSessionId) return;
    localStorage.setItem(`ledger_session_${user.id}`, currentSessionId);
  }, [currentSessionId, user]);

  const loadMessagesForSession = useCallback(
    async (userId: string, sessionId: string) => {
      setCurrentSessionId(sessionId);
      setLoadingMessages(true);
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
            const invoiceResults = await Promise.all(
              invoiceMsgs.map(async (m) => {
                const invoiceId = m.invoice!.invoiceId;
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
                      cgstPercent: db.cgstPercent,
                      sgstPercent: db.sgstPercent,
                      igstPercent: db.igstPercent,
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
                  } as SessionInvoice;
                } catch {
                  return null;
                }
              })
            );

            const invoices = invoiceResults.filter(
              (inv): inv is SessionInvoice => inv !== null
            );
            setSessionInvoices(invoices);

            if (invoices.length > 0) {
              const latestInvoice = invoices[invoices.length - 1];
              setSelectedPanelMessageId(latestInvoice.messageId);
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
    originalPrompt?: string,
    autoSelect = true
  ) => {
    if (!user) return;

    // ── Ensure totals are correct before saving ──
    const finalInvoice = recalculateTotals(invoice);

    let savedDraft = null;
    try {
      savedDraft = await saveDraftInvoice(
        finalInvoice,
        user.id,
        originalPrompt || "",
        client?._id
      );
    } catch (err) {
      console.error("Failed to save draft:", err);
    }

    const assistantContent = `Invoice draft ready for **${finalInvoice.clientName}**. Review it in the side panel.`;

    const savedAssistantMsg = await addChatMessage(
      user.id,
      sessionId,
      "assistant",
      assistantContent,
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
      invoice: finalInvoice,
      isConfirmed: false,
      dbMessageId: savedAssistantMsg._id,
      invoiceId: savedDraft?._id,
      invoiceNumber: savedDraft?.invoiceNumber,
    };
    if (autoSelect) {
      setSessionInvoices((prev) => {
        const updatedInvoices = [...prev, newSessionInvoice];

        // Single invoice → open that invoice
        if (updatedInvoices.length === 1) {
          setSelectedPanelMessageId(savedAssistantMsg._id);
        }

        // Multiple invoices → open latest invoice
        if (updatedInvoices.length > 1) {
          setSelectedPanelMessageId(
            updatedInvoices[updatedInvoices.length - 1].messageId
          );
        }

        return updatedInvoices;
      });
    } else {
      setSessionInvoices((prev) => [...prev, newSessionInvoice]);
    }
    setTabTemporarily("draft");

    if (savedDraft?.hasSimilar && savedDraft.similarInvoiceNumber) {
      await addAndShowAIMessage(
        `⚠️ A confirmed invoice already exists for **${finalInvoice.clientName}** in **${savedDraft.similarInvoiceMonth}** (${savedDraft.similarInvoiceNumber}). This new draft is ${savedDraft.invoiceNumber}. Review both before confirming.`,
        sessionId
      );
    }
  };

  const applyEditToInvoice = async (
    target: SessionInvoice,
    parsedInvoice: ParsedInvoice & {
      changedFields?: string[];
      warning?: string;
    },
    sessionId: string,
    silent = false
  ) => {
    const changedFields = parsedInvoice.changedFields || [];
    const updated: ParsedInvoice = { ...target.invoice };

    if (changedFields.includes("clientName") && parsedInvoice.clientName)
      updated.clientName = parsedInvoice.clientName;
    if (changedFields.includes("gstPercent"))
      updated.gstPercent = parsedInvoice.gstPercent;
    if (changedFields.includes("gstType"))
      updated.gstType = parsedInvoice.gstType;
    if (changedFields.includes("paymentTermsDays"))
      updated.paymentTermsDays = parsedInvoice.paymentTermsDays;
    if (changedFields.includes("invoiceDate"))
      updated.invoiceDate = parsedInvoice.invoiceDate;
    if (changedFields.includes("invoiceMonth"))
      updated.invoiceMonth = parsedInvoice.invoiceMonth;
    if (changedFields.includes("discountType"))
      updated.discountType = parsedInvoice.discountType;
    if (changedFields.includes("discountValue"))
      updated.discountValue = parsedInvoice.discountValue;
    if (changedFields.includes("notes")) updated.notes = parsedInvoice.notes;

    let lineItemDiff = { summary: "", hasRealChange: false };
    if (
      changedFields.includes("lineItems") &&
      Array.isArray(parsedInvoice.lineItems) &&
      parsedInvoice.lineItems.length > 0
    ) {
      const candidateItems = parsedInvoice.lineItems.map((item) => ({
        ...item,
        amount: item.quantity * item.rate,
      }));
      lineItemDiff = diffLineItems(target.invoice.lineItems, candidateItems);
      if (lineItemDiff.hasRealChange) {
        updated.lineItems = candidateItems;
      }
    }

    const effectiveChangedFields = changedFields.filter((f) =>
      f === "lineItems" ? lineItemDiff.hasRealChange : true
    );

    // ── Nothing changed ──
    if (effectiveChangedFields.length === 0) {
      if (!silent) {
        const existingList = target.invoice.lineItems
          .map((i) => `**${i.description}**`)
          .join(", ");
        const existingKeys = target.invoice.lineItems.map((i) =>
          i.description.toLowerCase().trim()
        );
        const notFound = (parsedInvoice.lineItems ?? [])
          .filter(
            (i) => !existingKeys.includes(i.description.toLowerCase().trim())
          )
          .map((i) => i.description);

        if (notFound.length > 0) {
          await addAndShowAIMessage(
            `⚠️ **"${notFound[0]}"** wasn't found in **${target.invoice.clientName}**'s invoice — nothing was changed.\n\nCurrent line items: ${existingList}`,
            sessionId
          );
        } else {
          await addAndShowAIMessage(
            `⚠️ Couldn't find the item to replace or remove in **${target.invoice.clientName}**'s invoice — nothing was changed.\n\nCurrent line items: ${existingList}`,
            sessionId
          );
        }
      }
      return;
    }

    const finalUpdated = recalculateTotals(updated);

    if (target.invoiceId) {
      try {
        await updateInvoice(target.invoiceId, finalUpdated);
      } catch (err) {
        console.error("Failed to update invoice in DB:", err);
      }
    }

    setSessionInvoices((prev) =>
      prev.map((s) =>
        s.messageId === target.messageId ? { ...s, invoice: finalUpdated } : s
      )
    );

    const sid = currentSessionIdRef.current;
    if (sid) {
      try {
        await updateMessageInvoiceData(sid, target.messageId, finalUpdated);
      } catch (err) {
        console.error("Failed to persist edit:", err);
      }
    }

    // ── silent=true: persist only, no UI message, no panel jump ──
    if (silent) return;

    setSelectedPanelMessageId(target.messageId);

    const fieldLabels: Record<string, string> = {
      clientName: "client name",
      gstPercent: "GST rate",
      gstType: "GST type",
      paymentTermsDays: "payment terms",
      invoiceDate: "invoice date",
      invoiceMonth: "invoice month",
      discountType: "discount type",
      discountValue: "discount",
      notes: "notes",
    };

    const changeParts: string[] = [];
    if (effectiveChangedFields.includes("lineItems") && lineItemDiff.summary) {
      changeParts.push(lineItemDiff.summary);
    }
    const otherChanges = effectiveChangedFields
      .filter((f) => f !== "lineItems")
      .map((f) => fieldLabels[f] || f);
    if (otherChanges.length > 0) {
      changeParts.push(`Updated ${otherChanges.join(", ")}`);
    }

    await addAndShowAIMessage(
      `Updated **${target.invoice.clientName}**'s invoice (${
        target.invoiceNumber || "Draft"
      }).
   
  ${changeParts.join(" · ")}
  New total: **₹${finalUpdated.total.toLocaleString("en-IN")}**
   
  Review the updated invoice in the side panel.`,
      sessionId
    );
  };

  // ── Shared: clone invoice ──
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
      `Creating a copy of **${source.invoice.clientName}**'s invoice for **${newClientName}**.`,
      sessionId
    );
    await proceedWithInvoice(cloned, null, sessionId);
  };

  const handleEditIntent = async (
    parsedInvoice: ParsedInvoice & {
      targetInvoiceRef?: string;
      changedFields?: string[];
    },
    sessionId: string
  ) => {
    const ref = parsedInvoice.targetInvoiceRef || "";
    const changedFields = parsedInvoice.changedFields || [];
    const matches = findMatchingInvoices(sessionInvoicesRef.current, ref);

    if (matches.length === 0) {
      await addAndShowAIMessage(
        `I couldn't find an invoice matching **"${ref}"**.\n\nPlease use the full client name or invoice number (e.g. **INV-2026-001**).`,
        sessionId
      );
      return;
    }

    // ── Single match: apply normally with full message ──
    if (matches.length === 1) {
      await applyEditToInvoice(matches[0], parsedInvoice, sessionId);
      return;
    }

    // ── Multiple matches ──
    const isBulkSafe =
      changedFields.length > 0 &&
      changedFields.every((f) => BULK_SAFE_FIELDS.has(f));

    if (isBulkSafe) {
      // Apply silently to all — no per-invoice messages
      for (const match of matches) {
        await applyEditToInvoice(match, parsedInvoice, sessionId, true);
      }

      // One consolidated message
      const fieldLabels: Record<string, string> = {
        paymentTermsDays: "payment terms",
        gstPercent: "GST rate",
        gstType: "GST type",
        discountType: "discount",
        discountValue: "discount",
        notes: "notes",
      };
      const changedList = [
        ...new Set(changedFields.map((f) => fieldLabels[f] || f)),
      ].join(", ");
      const invoiceNums = matches
        .map((m) => m.invoiceNumber || "Draft")
        .join(", ");

      await addAndShowAIMessage(
        `Updated **${changedList}** across **${matches.length} invoices** for **${matches[0].invoice.clientName}** (${invoiceNums}).`,
        sessionId
      );
      return;
    }

    // ── Multiple matches + destructive fields → ask which invoice ──
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

    const invoiceList = matches
      .map(
        (m) =>
          `**${m.invoiceNumber || "Draft"}** — ${
            m.invoice.invoiceMonth || "unknown month"
          }`
      )
      .join("\n");

    await addAndShowAIMessage(
      `Found **${matches.length} invoices** for **${ref}**:\n\n${invoiceList}\n\nWhich one should I update? Reply with an invoice number, or **latest** for the most recent.`,
      sessionId
    );
  };

  const handleCopyIntent = async (
    parsedInvoice: ParsedInvoice & { targetInvoiceRef?: string },
    sessionId: string
  ) => {
    const ref = parsedInvoice.targetInvoiceRef || "";
    const matches = findMatchingInvoices(sessionInvoicesRef.current, ref);

    if (matches.length === 0) {
      await addAndShowAIMessage(
        `I couldn't find an invoice matching **"${ref}"**.\n\nPlease use the full client name or invoice number.`,
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
        ambiguityCopyTargetClient: parsedInvoice.clientName,
        ambiguityDefaultTarget: latest,
        sessionId,
      });
      await addAndShowAIMessage(
        `Found multiple invoices matching **"${ref}"**. Copying from the most recent:\n\n` +
          `**${latest.invoiceNumber || "Draft"}** — ${
            latest.invoice.clientName
          } — ₹${latest.invoice.total.toLocaleString("en-IN")}\n\n` +
          `Reply **yes** to confirm, or give an invoice number.`,
        sessionId
      );
      return;
    }

    await applyCopyFromInvoice(matches[0], parsedInvoice.clientName, sessionId);
  };

  const handleAmbiguityResolutionReply = async (
    reply: string,
    sessionId: string
  ) => {
    const current = pendingClientStateRef.current;
    if (!current) return;

    const isYes = ["yes", "haan", "confirm"].includes(
      reply.toLowerCase().trim()
    );

    if (isYes && current.ambiguityDefaultTarget) {
      updatePendingClientState(null);
      if (current.ambiguityAction === "edit" && current.ambiguityEditedInvoice)
        await applyEditToInvoice(
          current.ambiguityDefaultTarget,
          current.ambiguityEditedInvoice,
          sessionId
        );
      else if (current.ambiguityAction === "copy")
        await applyCopyFromInvoice(
          current.ambiguityDefaultTarget,
          current.ambiguityCopyTargetClient || "New Client",
          sessionId
        );
      return;
    }

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
        `Still found multiple matches. Using most recent:\n\n**${
          latest.invoiceNumber || "Draft"
        }** — ${
          latest.invoice.clientName
        }\n\nReply **yes** or use exact invoice number.`,
        sessionId
      );
      return;
    }

    const target = matches[0];
    if (current.ambiguityAction === "edit" && current.ambiguityEditedInvoice)
      await applyEditToInvoice(
        target,
        current.ambiguityEditedInvoice,
        sessionId
      );
    else if (current.ambiguityAction === "copy")
      await applyCopyFromInvoice(
        target,
        current.ambiguityCopyTargetClient || "New Client",
        sessionId
      );
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
        `**${clientName}** looks like a new client.
        Please send:
        - Email (required)
        - Address, City, State, Phone, GSTIN (optional)
        Example:
        john@gmail.com, E-24 Sector 85, Karol Bagh, Delhi 
        Or reply **skip**.`,
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
        `No problem! Creating invoice without client details.`,
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
        await addAndShowAIMessage(
          result?.client
            ? `Saved **${clientName}**'s details ✓ Creating invoice now!`
            : `Creating invoice! You can add client details later.`,
          sessionId
        );
        await proceedWithInvoice(
          invoiceData,
          result?.client || null,
          sessionId
        );
      } catch {
        await addAndShowAIMessage(
          `Creating invoice now! You can add client details later.`,
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
          const section = extractClientSection(reply, clientName) || reply;
          const isSame =
            section.toLowerCase().includes("same") ||
            reply.toLowerCase().includes("yes");
          if (isSame)
            await proceedWithInvoice(invoice, matchedClient, sessionId);
          else {
            const result = await parseClientDetailsFromText(
              user.id,
              section,
              clientName
            );
            await proceedWithInvoice(
              invoice,
              result?.client || null,
              sessionId
            );
          }
        } else {
          const section = extractClientSection(reply, clientName) || reply;
          const result = await parseClientDetailsFromText(
            user.id,
            section,
            clientName
          );
          await proceedWithInvoice(invoice, result?.client || null, sessionId);
        }
      } catch {
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
        `I found a saved client named **${matchResult.client.name}**.
  Is **${invoice.clientName}** the same client?
  Reply **same** or **different**.`,
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
        `Got it! Invoice for **${invoice.clientName}** is ready. 🎉
  
  To complete the invoice, share **${invoice.clientName}**'s contact details:
  
  **Email** *(required)*
  *(Optional: Address, City, State, Phone, GSTIN)*
  
  💡 Format: \`john@gmail.com, 42 MG Road, Pune, Maharashtra\`
  
  Or say **skip** to create without client details.`,
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
      const latestInvoice =
        sessionInvoicesRef.current[sessionInvoicesRef.current.length - 1];

      if (latestInvoice) {
        setSelectedPanelMessageId(latestInvoice.messageId);
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
      .filter((n, i, arr) => arr.indexOf(n) === i);
    const partialClientNames = partialMatches
      .map(
        ({ invoice, matchResult }) =>
          `**${invoice.clientName}** (found similar: **${matchResult.client?.name}**)`
      )
      .filter((n, i, arr) => arr.indexOf(n) === i);

    if (newClientNames.length > 0) {
      parts.push(
        `${newClientNames.map((n) => `**${n}**`).join(", ")} ${
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
      parts.push(`\nFormat: **ClientName** - email\n**ClientName2** - email`);
    }
    parts.push(`\nOr say **skip** to create without client details.`);

    updatePendingClientState({
      status: "awaiting_multi_details",
      pendingClients,
      sessionId,
    });
    await addAndShowAIMessage(parts.join(" "), sessionId);

    for (const { invoice, matchResult } of exactMatches)
      await proceedWithInvoice(
        invoice,
        matchResult.client,
        sessionId,
        undefined,
        false
      );

    const newlyCreatedInvoices = sessionInvoicesRef.current.slice(
      -invoicesWithMatch.length
    );

    if (newlyCreatedInvoices.length > 0) {
      setSelectedPanelMessageId(
        newlyCreatedInvoices[newlyCreatedInvoices.length - 1].messageId
      );
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

      // ── Build session context ──
      const sessionContext = buildSessionContext(sessionInvoicesRef.current);

      // ── Fetch memory context (RAG) ──
      let memoryContext = "No past invoice history for this client.";
      const possibleClient = extractClientNameFromPrompt(prompt);
      if (possibleClient) {
        try {
          const history = await fetchClientHistory(possibleClient, user.id);
          if (history && history.length > 0) {
            const lines = history.map(
              (
                inv: {
                  invoiceMonth?: string;
                  lineItems?: Array<{ description: string; rate: number }>;
                  gstPercent?: number;
                  gstType?: string;
                  paymentTermsDays?: number;
                  total?: number;
                },
                i: number
              ) => {
                const items =
                  inv.lineItems
                    ?.map((li) => `${li.description} ₹${li.rate}`)
                    .join(", ") || "";
                return `Invoice ${i + 1} [${
                  inv.invoiceMonth || "unknown"
                }]: ${items} | GST ${inv.gstPercent}% ${
                  inv.gstType || ""
                } | Terms ${inv.paymentTermsDays}d | Total ₹${inv.total}`;
              }
            );
            memoryContext = `Past invoices for ${possibleClient}:\n${lines.join(
              "\n"
            )}\nUse these rates and terms as defaults.`;
            console.log(
              `🧠 Memory loaded for ${possibleClient}: ${history.length} invoices`
            );
          }
        } catch {
          // Memory is optional — silently ignore errors
        }
      }

      // ── Parse with AI agent ──
      const result = await parseInvoiceWithAI(
        prompt,
        user.id,
        sessionContext,
        memoryContext
      );

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
          warning?: string;
        };
        const intent = invoice.intent || "new";

        if (intent === "edit") await handleEditIntent(invoice, sessionId);
        else if (intent === "copy") await handleCopyIntent(invoice, sessionId);
        else {
          if (result.matchResult) {
            try {
              await handleMatchResult(invoice, result.matchResult, sessionId);
            } catch {
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
