import crypto from "node:crypto";
import { dayKey } from "./time";
import { DEFAULT_SETTINGS } from "./settings";
import { hashPassword } from "./password";
import type { Business, Category, DB, Queue, Review, Service, Ticket, User } from "../../../src/lib/types";

/** Every seeded business has an owner account so the merchant dashboard can be tested. */
export const DEMO_PASSWORD = "demo1234";

const U = (id: string) => `https://images.unsplash.com/photo-${id}`;
/** Real photography (Unsplash): cover first, then gallery. */
const PHOTOS: Record<string, string[]> = {
  "style-studio": ["1554519934-e32b1629d9ee", "1600948836101-f9ffda59d250", "1634449571010-02389ed0f9b0"],
  "looks-salon": ["1580618672591-eb180b1a973f", "1560869713-7d0a29430803", "1554519934-e32b1629d9ee"],
  "urban-cuts": ["1605497788044-5a32c7078486", "1634449571010-02389ed0f9b0", "1600948836101-f9ffda59d250"],
  "razor-and-co": ["1585747860715-2ba37e788b70", "1503951914875-452162b0f3f1", "1621605815971-fbc98d665033"],
  "city-dental": ["1629909613654-28e377c37b09", "1616391182219-e080b4d1043a", "1588776814546-daab30f310ce"],
  "carefirst-clinic": ["1612349317150-e413f6a5b16d", "1612349316228-5942a9b489c2", "1638202993928-7267aad84c31"],
  "quickfix-auto": ["1619505372149-07875c35b313", "1613214150132-9606e332d68e", "1619642751034-765dfdf7c58e"],
  "fresh-brew-cafe": ["1600093463592-8e36ae95ef56", "1542372147193-a7aca54189cd", "1495474472287-4d71bcdd2085"],
  "zen-spa": ["1600334089648-b0d9d3028eb2", "1544161515-4ab6ce6db874"],
  "sparkle-car-wash": ["1633014041037-f5446fb4ce99", "1608506375591-b90e1f955e4b", "1605164598708-25701594473e"],
  "fixit-electronics": ["1611396000732-f8c9a933424f", "1550041473-d296a3a8a18a", "1588515603140-81bd9f7d1db0"],
};
const CAT_PHOTO: Record<string, string> = {
  salon: "1580618672591-eb180b1a973f", barber: "1585747860715-2ba37e788b70", dental: "1629909613654-28e377c37b09",
  clinic: "1612349316228-5942a9b489c2", restaurant: "1613274554329-70f997f5789f", cafe: "1600093463592-8e36ae95ef56",
  auto: "1619505372149-07875c35b313", "car-wash": "1633014041037-f5446fb4ce99", spa: "1544161515-4ab6ce6db874", repair: "1611396000732-f8c9a933424f",
};

const CATS: [string, string, string, string[]][] = [
  ["salon", "Salons", "💇", ["hair", "haircut", "hair salon", "beauty", "styling"]],
  ["barber", "Barbers", "💈", ["beard", "shave", "haircut", "men"]],
  ["dental", "Dental", "🦷", ["dentist", "dental clinic", "teeth", "orthodontics"]],
  ["clinic", "Clinics", "🏥", ["doctor", "hospital", "health", "consultation", "medical"]],
  ["restaurant", "Restaurants", "🍽", ["food", "dining", "lunch", "dinner"]],
  ["cafe", "Cafes", "☕", ["coffee", "tea", "breakfast", "bakery"]],
  ["auto", "Car Service", "🚗", ["car", "auto service", "oil change", "garage", "bike service"]],
  ["car-wash", "Car Wash", "🫧", ["car wash", "detailing"]],
  ["spa", "Spas", "🧖", ["massage", "wellness", "relax"]],
  ["repair", "Repairs", "🔧", ["electronics", "phone repair", "fix", "tailor"]],
  ["bank", "Banks & Govt", "🏦", ["bank", "government", "passport", "service center"]],
];

type Q = { name: string; avg: number; prefix: string; svc?: string; ahead: number; paused?: boolean };
type B = {
  slug: string; name: string; cat: string; desc: string; area: string; lat: number; lng: number;
  phone: string; hue: number; live?: boolean; rating: number;
  services: [string, number, number?][]; queues: Q[];
};

const BIZ: B[] = [
  { slug: "style-studio", name: "Style Studio", cat: "salon", desc: "Modern unisex salon: cuts, colour and styling by senior stylists.", area: "Indiranagar", lat: 12.9784, lng: 77.6408, phone: "+91 80 4000 1001", hue: 265, rating: 4.4,
    services: [["Haircut", 30, 400], ["Hair coloring", 90, 2200], ["Beard trim", 15, 200]], queues: [{ name: "General Queue", avg: 5, prefix: "A", ahead: 5 }] },
  { slug: "looks-salon", name: "Looks Salon", cat: "salon", desc: "Neighbourhood favourite for haircuts, spa and bridal packages.", area: "Indiranagar", lat: 12.9719, lng: 77.6412, phone: "+91 80 4000 1002", hue: 330, rating: 4.6,
    services: [["Haircut", 30, 350], ["Facial", 45, 900], ["Hair spa", 60, 1200]], queues: [{ name: "Haircut", avg: 6, prefix: "H", ahead: 2, svc: "Haircut" }, { name: "Hair spa", avg: 20, prefix: "S", ahead: 1, svc: "Hair spa" }] },
  { slug: "urban-cuts", name: "Urban Cuts", cat: "salon", desc: "Fast, precise cuts. Walk-ins welcome, no appointment needed.", area: "Koramangala", lat: 12.9352, lng: 77.6245, phone: "+91 80 4000 1003", hue: 200, rating: 4.7,
    services: [["Haircut", 25, 300], ["Beard", 15, 150]], queues: [{ name: "General Queue", avg: 5, prefix: "A", ahead: 1 }] },
  { slug: "razor-and-co", name: "Razor & Co", cat: "barber", desc: "Classic barbershop. Hot towel shaves and sharp fades.", area: "Indiranagar", lat: 12.9791, lng: 77.6389, phone: "+91 80 4000 1004", hue: 25, rating: 4.5,
    services: [["Fade cut", 30, 350], ["Hot towel shave", 20, 250]], queues: [{ name: "Chair queue", avg: 12, prefix: "B", ahead: 4 }] },
  { slug: "city-dental", name: "City Dental", cat: "dental", desc: "Family dental care: cleaning, root canal and orthodontics.", area: "HSR Layout", lat: 12.9116, lng: 77.6474, phone: "+91 80 4000 1005", hue: 190, rating: 4.8,
    services: [["General consultation", 20, 500], ["Dental cleaning", 40, 1200], ["Orthodontics", 45, 3000]], queues: [{ name: "Dr. Sharma", avg: 15, prefix: "S", ahead: 3 }, { name: "Dr. Patel", avg: 20, prefix: "P", ahead: 1 }] },
  { slug: "carefirst-clinic", name: "CareFirst Clinic", cat: "clinic", desc: "General physician and paediatric consultations.", area: "Koramangala", lat: 12.9279, lng: 77.6271, phone: "+91 80 4000 1006", hue: 150, rating: 4.3,
    services: [["General consultation", 15, 400], ["Paediatrics", 20, 600]], queues: [{ name: "OPD", avg: 10, prefix: "C", ahead: 8 }] },
  { slug: "quickfix-auto", name: "QuickFix Auto", cat: "auto", desc: "Car and bike servicing with same-day delivery.", area: "HSR Layout", lat: 12.9081, lng: 77.6389, phone: "+91 80 4000 1007", hue: 15, rating: 4.2,
    services: [["Oil change", 30, 1500], ["General service", 120, 4500], ["Car wash", 40, 500]], queues: [{ name: "Oil change", avg: 20, prefix: "O", ahead: 2, svc: "Oil change" }, { name: "General service", avg: 60, prefix: "G", ahead: 3, svc: "General service" }] },
  { slug: "fresh-brew-cafe", name: "Fresh Brew Cafe", cat: "cafe", desc: "Specialty coffee, brunch and a busy weekend table queue.", area: "Indiranagar", lat: 12.9702, lng: 77.6395, phone: "+91 80 4000 1008", hue: 35, rating: 4.6,
    services: [["Table for 2", 40], ["Table for 4", 50], ["Takeaway", 5]], queues: [{ name: "Table waitlist", avg: 8, prefix: "T", ahead: 6 }] },
  { slug: "zen-spa", name: "Zen Spa", cat: "spa", desc: "Massage and wellness. Queue is paused during staff break.", area: "Koramangala", lat: 12.9386, lng: 77.6322, phone: "+91 80 4000 1009", hue: 170, rating: 4.7,
    services: [["Swedish massage", 60, 2000], ["Foot reflexology", 30, 900]], queues: [{ name: "Walk-ins", avg: 25, prefix: "Z", ahead: 2, paused: true }] },
  { slug: "sparkle-car-wash", name: "Sparkle Car Wash", cat: "car-wash", desc: "Foam wash and interior detailing. Live queue not enabled yet.", area: "HSR Layout", lat: 12.9141, lng: 77.636, phone: "+91 80 4000 1010", hue: 210, rating: 4.0, live: false,
    services: [["Foam wash", 25, 400], ["Interior detailing", 90, 1800]], queues: [{ name: "Wash bay", avg: 20, prefix: "W", ahead: 0 }] },
  { slug: "fixit-electronics", name: "FixIt Electronics", cat: "repair", desc: "Phone, laptop and TV repair with quick diagnosis.", area: "Indiranagar", lat: 12.9754, lng: 77.6366, phone: "+91 80 4000 1011", hue: 240, rating: 4.1,
    services: [["Diagnosis", 10, 0], ["Screen replacement", 45, 3500]], queues: [{ name: "Service counter", avg: 7, prefix: "F", ahead: 3 }] },
];

// deterministic PRNG so reseeding looks the same
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const NAMES = ["Rahul", "Priya", "Arjun", "Neha", "Kiran", "Sneha", "Vikram", "Anita", "Rohan", "Meera", "Karthik", "Divya", "Aman", "Pooja", "Suresh", "Isha"];
const REVIEWS = ["Short wait, exactly as shown.", "Loved being able to track from the cafe next door.", "Great service, queue was accurate.", "Quick and friendly.", "Waited a bit longer than estimated but worth it.", ""];

/** A clean platform: the category catalogue and default settings, no businesses, no accounts. */
export function buildBaseSeed(): DB {
  const db: DB = { secret: crypto.randomBytes(32).toString("hex"), settings: structuredClone(DEFAULT_SETTINGS), audit: [], users: [], categories: [], businesses: [], services: [], queues: [], tickets: [], events: [], reviews: [] };
  CATS.forEach(([slug, name, icon, keywords]) => db.categories.push({ id: slug, slug, name, icon, keywords, imageUrl: CAT_PHOTO[slug] ? U(CAT_PHOTO[slug]) : undefined } as Category));
  return db;
}

/** Demo accounts share a known password, so demo data must never appear on a public deployment by accident. */
export const demoAllowed = () =>
  process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "1" || process.env.SEED_DEMO === "1";

export function buildSeed(): DB {
  const now = Date.now();
  const rand = rng(42);
  const id = () => crypto.randomUUID();
  const db: DB = { secret: crypto.randomBytes(32).toString("hex"), settings: structuredClone(DEFAULT_SETTINGS), audit: [], users: [], categories: [], businesses: [], services: [], queues: [], tickets: [], events: [], reviews: [] };

  CATS.forEach(([slug, name, icon, keywords]) => db.categories.push({ id: slug, slug, name, icon, keywords, imageUrl: CAT_PHOTO[slug] ? U(CAT_PHOTO[slug]) : undefined } as Category));

  const demoHash = hashPassword(DEMO_PASSWORD);
  ["Aarav Mehta", "Diya Nair", "Kabir Singh", "Ananya Rao", "Ishaan Gupta", "Saanvi Iyer", "Vihaan Shah", "Myra Kapoor"].forEach((n, i) =>
    db.users.push({ id: id(), email: `${n.toLowerCase().replace(" ", ".")}@example.test`, role: "customer", createdAt: now - (20 - i) * 864e5, status: "active", favorites: ["style-studio", "fresh-brew-cafe"].slice(0, i % 3), name: n, lastLoginAt: now - i * 5 * 36e5 }),
  );
  BIZ.forEach((b, bi) => {
    const owner: User = { id: id(), email: `owner@${b.slug}.test`, passHash: demoHash, role: "merchant", createdAt: now - (30 - bi) * 864e5, status: "active", favorites: [], name: `${b.name} owner`, lastLoginAt: now - bi * 36e5 };
    db.users.push(owner);
    const biz: Business = {
      id: id(), slug: b.slug, ownerId: owner.id, name: b.name, categoryId: b.cat, description: b.desc, phone: b.phone,
      address: `${12 + bi} Main Road, ${b.area}`, area: b.area, city: "Bengaluru", lat: b.lat, lng: b.lng, hue: b.hue, imageUrl: U(PHOTOS[b.slug][0]), gallery: PHOTOS[b.slug].slice(1).map(U),
      hours: { open: "00:00", close: "23:59", tzOffsetMin: 330 },
      liveQueue: b.live !== false, approval: "approved", createdAt: now - 30 * 864e5,
    };
    db.businesses.push(biz);
    const svcs: Service[] = b.services.map(([name, durationMin, price]) => ({ id: id(), businessId: biz.id, name, durationMin, price }));
    db.services.push(...svcs);

    b.queues.forEach((q) => {
      const queue: Queue = {
        id: id(), businessId: biz.id, name: q.name, prefix: q.prefix, avgServiceMin: q.avg, status: q.paused ? "paused" : "open",
        nextSeq: 1, createdAt: now - 30 * 864e5, serviceId: svcs.find((s) => s.name === q.svc)?.id,
      };
      db.queues.push(queue);
      let todays = false;
      const mk = (status: Ticket["status"], joinedAt: number, extra: Partial<Ticket> = {}) => {
        const seq = queue.nextSeq++;
        if (todays) queue.counter = (queue.counter ?? 0) + 1;
        db.tickets.push({
          id: id(), queueId: queue.id, businessId: biz.id, token: crypto.randomBytes(18).toString("base64url"),
          number: todays ? `${queue.prefix}${queue.counter}` : `${queue.prefix}-${seq}`, seq, name: NAMES[Math.floor(rand() * NAMES.length)], status,
          source: rand() > 0.6 ? "walk-in" : "online", joinedAt, ...extra,
        });
      };
      // 14 days of history for analytics
      for (let d = 14; d >= 1; d--) {
        const perDay = 8 + Math.floor(rand() * 14);
        for (let i = 0; i < perDay; i++) {
          const hour = 9 + Math.floor(rand() * 11);
          const joined = now - d * 864e5 + (hour - 12) * 36e5 + Math.floor(rand() * 36e5);
          const waited = Math.floor(rand() * 25 + 3) * 6e4;
          const dur = Math.max(2, Math.round(q.avg * (0.7 + rand() * 0.6))) * 6e4;
          const skipped = rand() > 0.9;
          mk(skipped ? "SKIPPED" : "COMPLETED", joined, skipped ? {} : { calledAt: joined + waited, servedAt: joined + waited, completedAt: joined + waited + dur });
        }
      }
      // today's numbering starts here
      todays = true;
      queue.counter = 0;
      queue.counterDay = dayKey(now, biz.hours.tzOffsetMin);
      for (let i = 0; i < 6; i++) {
        const joined = now - (200 - i * 25) * 6e4;
        mk("COMPLETED", joined, { calledAt: joined + 8 * 6e4, servedAt: joined + 8 * 6e4, completedAt: joined + (8 + q.avg) * 6e4 });
      }
      // live queue: first is being served, the rest are waiting
      for (let i = 0; i < q.ahead; i++) {
        const joined = now - (q.ahead - i + 2) * 3 * 6e4;
        if (i === 0 && !q.paused) mk("SERVING", joined, { calledAt: now - 2 * 6e4, servedAt: now - 2 * 6e4 });
        else mk("WAITING", joined);
      }
    });

    const rv = 3 + Math.floor(rand() * 5);
    for (let i = 0; i < rv; i++) {
      const rating = Math.max(1, Math.min(5, Math.round(b.rating + (rand() - 0.5) * 1.6)));
      const r: Review = { id: id(), businessId: biz.id, ticketId: `seed-${i}`, rating, text: REVIEWS[Math.floor(rand() * REVIEWS.length)], name: NAMES[Math.floor(rand() * NAMES.length)], createdAt: now - Math.floor(rand() * 20) * 864e5 };
      db.reviews.push(r);
    }
  });
  return db;
}
