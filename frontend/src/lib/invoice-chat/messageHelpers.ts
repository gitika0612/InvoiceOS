import { ChatMessageAPI } from "@/lib/api/chatApi";
import { UIMessage } from "@/hooks/useInvoiceChat";

export function getTime() {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toUIMessage(msg: ChatMessageAPI): UIMessage {
  return {
    _id: msg._id,
    role: msg.role,
    content: msg.content,
    timestamp: new Date(msg.createdAt).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    invoiceMessageId: msg.invoice ? msg._id : undefined,
    status: msg.invoice?.status,
    invoiceNumber: msg.invoice?.invoiceNumber,
    dbMessageId: msg._id,
  };
}

export function extractClientSection(
  text: string,
  clientName: string
): string | null {
  const regex = new RegExp(
    `${clientName}\\s*[-:]\\s*(.+?)(?=\\b[A-Z][a-z]+\\s*[-:]|$)`,
    "is"
  );

  const match = text.match(regex);
  return match ? match[1].trim() : null;
}
