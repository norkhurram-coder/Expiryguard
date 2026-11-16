// DESIGN PATTERN 1: FACTORY (Factory Method)
//
// Problem: the dashboard, the sales screen, the badges and the background scan all need
// to know, for one batch, "how serious is its expiry, what colour is it, can it be sold,
// and what should the pharmacist do?". Without a factory every screen would repeat the
// same if/else chain on the number of days left.
//
// Solution: ExpiryAlertFactory.create() looks at the expiry date ONCE and returns the right
// ExpiryAlert object (ExpiredAlert, CriticalAlert, WarningAlert, NoticeAlert or SafeStock).
// Screens only talk to the common ExpiryAlert type – they never use `new` themselves.
// Adding a new band later (e.g. "within 120 days") means adding one class and one line here.
import { daysUntil, todayISO, type ExpiryStatus } from "@/lib/expiry";

export type AlertColor = "red" | "orange" | "yellow" | "teal" | "green";

/** The common type every alert has (the "Product" in the Factory pattern). */
export abstract class ExpiryAlert {
  abstract readonly level: ExpiryStatus;
  abstract readonly label: string;
  abstract readonly color: AlertColor;
  /** 0 = most urgent. Used to sort lists so the worst problems come first. */
  abstract readonly priority: number;
  /** FR-05: expired stock may never be sold. */
  abstract readonly canSell: boolean;

  constructor(
    readonly expiryDate: string,
    readonly daysLeft: number
  ) {}

  /** What the pharmacist should do with this batch. */
  abstract advice(): string;

  /** FR-06: the cashier must warn the customer when the medicine expires soon. */
  get warnCustomer(): boolean {
    return false;
  }
}

class ExpiredAlert extends ExpiryAlert {
  readonly level = "expired" as const;
  readonly label = "Expired";
  readonly color = "red" as const;
  readonly priority = 0;
  readonly canSell = false;
  advice() {
    return `Expired ${Math.abs(this.daysLeft)} day(s) ago – move to quarantine, do not sell.`;
  }
}

class CriticalAlert extends ExpiryAlert {
  readonly level = "within30" as const;
  readonly label = "≤ 30 days";
  readonly color = "orange" as const;
  readonly priority = 1;
  readonly canSell = true;
  advice() {
    return `Expires in ${this.daysLeft} day(s) – sell first, discount or return to supplier.`;
  }
  override get warnCustomer() {
    return true;
  }
}

class WarningAlert extends ExpiryAlert {
  readonly level = "within60" as const;
  readonly label = "≤ 60 days";
  readonly color = "yellow" as const;
  readonly priority = 2;
  readonly canSell = true;
  advice() {
    return `Expires in ${this.daysLeft} days – keep at the front of the rack.`;
  }
}

class NoticeAlert extends ExpiryAlert {
  readonly level = "within90" as const;
  readonly label = "≤ 90 days";
  readonly color = "teal" as const;
  readonly priority = 3;
  readonly canSell = true;
  advice() {
    return `Expires in ${this.daysLeft} days – avoid re-ordering more of this batch.`;
  }
}

class SafeStock extends ExpiryAlert {
  readonly level = "safe" as const;
  readonly label = "Safe";
  readonly color = "green" as const;
  readonly priority = 4;
  readonly canSell = true;
  advice() {
    return "No action needed.";
  }
}

/** The Factory: the ONLY place that decides which alert class to create. */
export class ExpiryAlertFactory {
  /** Build the alert for an expiry date (FR-06 / FR-07 bands: expired, 30, 60, 90 days). */
  static create(expiryDate: string, today: string = todayISO()): ExpiryAlert {
    return ExpiryAlertFactory.fromDaysLeft(daysUntil(expiryDate, today), expiryDate);
  }

  /** Same, when the days left are already known (e.g. calculated by a worker thread). */
  static fromDaysLeft(daysLeft: number, expiryDate: string): ExpiryAlert {
    if (daysLeft <= 0) return new ExpiredAlert(expiryDate, daysLeft);
    if (daysLeft <= 30) return new CriticalAlert(expiryDate, daysLeft);
    if (daysLeft <= 60) return new WarningAlert(expiryDate, daysLeft);
    if (daysLeft <= 90) return new NoticeAlert(expiryDate, daysLeft);
    return new SafeStock(expiryDate, daysLeft);
  }
}
