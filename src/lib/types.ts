export type TicketStatus = "WAITING" | "CALLED" | "SERVING" | "COMPLETED" | "SKIPPED" | "CANCELLED";
export const ACTIVE: TicketStatus[] = ["WAITING", "CALLED", "SERVING"];
export type BusinessStatus = "OPEN" | "CLOSED" | "PAUSED" | "QUEUE_FULL" | "NO_LIVE_DATA";

export interface Category { id: string; slug: string; name: string; icon: string; keywords: string[]; imageUrl?: string }
export type Role = "customer" | "merchant" | "admin";
export interface User {
  id: string; email: string; passHash?: string; role: Role; createdAt: number;
  name?: string; picture?: string; googleId?: string; status: "active" | "suspended"; favorites: string[]; lastLoginAt?: number;
}
export interface RankingWeights { name: number; category: number; categoryKeyword: number; service: number; area: number; description: number }
export interface Settings {
  platformName: string; supportEmail: string; announcement: string; requireApproval: boolean; allowSignups: boolean;
  busyThresholdMin: number; rankingWeights: RankingWeights;
}
export interface AuditEntry { id: string; at: number; actor: string; action: string; target: string; detail?: string }
export interface Business {
  id: string; slug: string; ownerId: string; name: string; categoryId: string;
  description: string; phone: string; address: string; area: string; city: string;
  lat: number; lng: number; imageUrl?: string; gallery: string[]; hue: number;
  hours: { open: string; close: string; tzOffsetMin: number };
  liveQueue: boolean; approval: "pending" | "approved" | "suspended"; createdAt: number;
}
export interface Service { id: string; businessId: string; name: string; durationMin: number; price?: number }
export interface Queue {
  id: string; businessId: string; name: string; serviceId?: string; status: "open" | "paused";
  prefix: string; nextSeq: number; counter?: number; counterDay?: string; avgServiceMin: number; maxSize?: number; createdAt: number;
}
export interface Ticket {
  id: string; queueId: string; businessId: string; token: string; number: string; seq: number;
  name: string; phone?: string; userId?: string; status: TicketStatus; source: "online" | "walk-in";
  joinedAt: number; calledAt?: number; servedAt?: number; completedAt?: number;
}
export interface QueueEvent { id: string; queueId: string; ticketId?: string; type: string; at: number }
export interface Review { id: string; businessId: string; ticketId: string; rating: number; text: string; name: string; createdAt: number; hidden?: boolean }

export interface DB {
  secret: string; settings: Settings; audit: AuditEntry[];
  users: User[]; categories: Category[]; businesses: Business[]; services: Service[];
  queues: Queue[]; tickets: Ticket[]; events: QueueEvent[]; reviews: Review[];
}

// ---- public views (what leaves the server) ----
export interface QueueView {
  id: string; name: string; status: "open" | "paused" | "full"; serving: string | null;
  waiting: number; active: number; avgServiceMin: number; estWaitMin: number;
}
export interface BusinessCard {
  slug: string; name: string; category: { slug: string; name: string; icon: string };
  rating: number | null; reviewCount: number; area: string; city: string; lat: number; lng: number;
  distanceKm: number | null; hue: number; imageUrl?: string; status: BusinessStatus; busy: boolean; tone: "green" | "amber" | "red" | "gray";
  waitMin: number | null; peopleWaiting: number | null; hoursLabel: string; services: string[]; queueCount: number;
}
export interface TicketView {
  token: string; number: string; name: string; status: TicketStatus; joinedAt: number;
  queue: { id: string; name: string; status: string; serving: string | null; avgServiceMin: number };
  business: { slug: string; name: string; phone: string; address: string };
  ahead: number; estWaitMin: number; isNext: boolean; canReview: boolean; reviewed: boolean;
}
