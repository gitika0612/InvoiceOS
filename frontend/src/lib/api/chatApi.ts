import api from "@/lib/api/api";
import { ParsedInvoice } from "@/components/invoice/InvoicePreviewCard";

export interface ChatSessionAPI {
  _id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceAttachment {
  data: ParsedInvoice;
  invoiceId?: string;
  invoiceNumber?: string;
  status: "draft" | "confirmed" | "sent" | "paid" | "overdue";
}

export interface ChatMessageAPI {
  _id: string;
  sessionId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  invoice?: InvoiceAttachment;
  createdAt: string;
  updatedAt: string;
}

export async function createChatSession(
  userId: string
): Promise<ChatSessionAPI> {
  const response = await api.post(
    "/chats/",
    {},
    { headers: { "x-clerk-id": userId } }
  );
  return response.data.session;
}

export async function getUserChatSessions(
  userId: string
): Promise<ChatSessionAPI[]> {
  const response = await api.get("/chats/", {
    headers: { "x-clerk-id": userId },
  });
  return response.data.sessions;
}

export async function deleteChatSession(
  userId: string,
  sessionId: string
): Promise<void> {
  await api.delete(`/chats/${sessionId}`, {
    headers: { "x-clerk-id": userId },
  });
}

export async function getSessionMessages(
  userId: string,
  sessionId: string
): Promise<ChatMessageAPI[]> {
  const response = await api.get(`/chats/${sessionId}/messages`, {
    headers: { "x-clerk-id": userId },
  });
  return response.data.messages;
}

export async function addChatMessage(
  userId: string,
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  invoice?: InvoiceAttachment
): Promise<ChatMessageAPI> {
  const response = await api.post(
    `/chats/${sessionId}/messages`,
    { role, content, invoice },
    { headers: { "x-clerk-id": userId } }
  );
  return response.data.message;
}

export async function confirmInvoiceInMessage(
  sessionId: string,
  messageId: string,
  invoiceNumber: string,
  invoiceId: string
): Promise<void> {
  await api.patch(`/chats/${sessionId}/messages/${messageId}/confirm`, {
    invoiceId,
    invoiceNumber,
  });
}

export async function updateMessageInvoiceData(
  sessionId: string,
  messageId: string,
  invoiceData: ParsedInvoice
): Promise<void> {
  await api.patch(`/chats/${sessionId}/messages/${messageId}/invoice`, {
    invoiceData,
  });
}
