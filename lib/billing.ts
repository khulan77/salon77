// Monthly billing rules. A salon gets a free trial from the day the platform
// approves it, then pays per active branch for 30-day periods.
export const TRIAL_DAYS = 14;
export const PERIOD_DAYS = 30;
// Owners are warned this many days before access ends.
export const WARN_DAYS = 3;
const DAY = 86400000;
export type BillingState = "PENDING" | "FREE" | "TRIAL" | "PAID" | "EXPIRED";
export const BILLING_LABELS: Record<BillingState, string> = {
  PENDING: "Хүлээгдэж буй",
  FREE: "Төлбөргүй",
  TRIAL: "Туршилт",
  PAID: "Төлсөн",
  EXPIRED: "Хугацаа дууссан",
};
type Salon = {
  reviewStatus: string;
  trialEndsAt: Date | null;
  paidUntil: Date | null;
};
// Access lasts until the later of the trial end and the paid period. A salon
// with neither (created outside onboarding) is not billed.
export function billingState(salon: Salon, now = new Date()) {
  if (salon.reviewStatus !== "APPROVED")
    return {
      state: "PENDING" as BillingState,
      until: null,
      daysLeft: 0,
      warn: false,
    };
  const ends = [salon.trialEndsAt, salon.paidUntil].filter(
    (d): d is Date => d !== null,
  );
  if (!ends.length)
    return {
      state: "FREE" as BillingState,
      until: null,
      daysLeft: 0,
      warn: false,
    };
  const until = new Date(Math.max(...ends.map(Number)));
  if (+until <= +now)
    return {
      state: "EXPIRED" as BillingState,
      until,
      daysLeft: 0,
      warn: false,
    };
  const daysLeft = Math.ceil((+until - +now) / DAY);
  const paid = salon.paidUntil !== null && +salon.paidUntil > +now;
  return {
    state: (paid ? "PAID" : "TRIAL") as BillingState,
    until,
    daysLeft,
    warn: daysLeft <= WARN_DAYS,
  };
}
export const trialEnd = (approvedAt: Date) =>
  new Date(+approvedAt + TRIAL_DAYS * DAY);
// A payment extends access from whichever is later: now or the current end,
// so paying early never loses days.
export function nextPeriod(salon: Salon, now = new Date()) {
  const { until } = billingState(salon, now);
  const start = until && +until > +now ? until : now;
  return { start, end: new Date(+start + PERIOD_DAYS * DAY) };
}
export const monthlyAmount = (pricePerBranch: number, branches: number) =>
  pricePerBranch * Math.max(1, branches);
// A salon's own fee, when the operator set one, wins over the branch price.
export function monthlyFee(
  custom: number | null,
  pricePerBranch: number | null,
  branches: number,
) {
  if (custom !== null) return custom;
  return pricePerBranch === null
    ? null
    : monthlyAmount(pricePerBranch, branches);
}
// Prisma filter for salons whose access has not run out.
export const paidUp = (now = new Date()) => ({
  OR: [
    { trialEndsAt: null, paidUntil: null },
    { trialEndsAt: { gt: now } },
    { paidUntil: { gt: now } },
  ],
});
