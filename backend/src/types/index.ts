export interface IUser {
  clerkId: string;
  email: string;
  name: string;
  imageUrl: string;
  plan: "free" | "pro" | "business";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses: { email_address: string }[];
    first_name: string;
    last_name: string;
    image_url: string;
  };
}
