import { ExpiryAlert, ExpiryAlertFactory } from "../lib/patterns/ExpiryAlertFactory";

const TODAY = "2026-11-01";

describe("Factory pattern: ExpiryAlertFactory", () => {
  test.each([
    ["2026-10-20", "expired", "red", false],
    ["2026-11-01", "expired", "red", false],
    ["2026-11-21", "within30", "orange", true],
    ["2026-12-20", "within60", "yellow", true],
    ["2027-01-25", "within90", "teal", true],
    ["2027-06-01", "safe", "green", true],
  ])("%s → %s", (date, level, color, canSell) => {
    const alert = ExpiryAlertFactory.create(date, TODAY);
    expect(alert).toBeInstanceOf(ExpiryAlert);
    expect(alert.level).toBe(level);
    expect(alert.color).toBe(color);
    expect(alert.canSell).toBe(canSell);
  });

  test("band edges: 30, 60 and 90 days", () => {
    expect(ExpiryAlertFactory.fromDaysLeft(30, "x").level).toBe("within30");
    expect(ExpiryAlertFactory.fromDaysLeft(31, "x").level).toBe("within60");
    expect(ExpiryAlertFactory.fromDaysLeft(90, "x").level).toBe("within90");
    expect(ExpiryAlertFactory.fromDaysLeft(91, "x").level).toBe("safe");
  });

  test("only the 30-day band asks the cashier to warn the customer (FR-06)", () => {
    expect(ExpiryAlertFactory.fromDaysLeft(10, "x").warnCustomer).toBe(true);
    expect(ExpiryAlertFactory.fromDaysLeft(45, "x").warnCustomer).toBe(false);
  });

  test("priority puts the most urgent alerts first", () => {
    const sorted = [100, -3, 50, 20, 80].map((d) => ExpiryAlertFactory.fromDaysLeft(d, "x")).sort((a, b) => a.priority - b.priority);
    expect(sorted.map((a) => a.level)).toEqual(["expired", "within30", "within60", "within90", "safe"]);
  });

  test("every alert gives advice text", () => {
    expect(ExpiryAlertFactory.fromDaysLeft(-2, "x").advice()).toMatch(/quarantine/);
    expect(ExpiryAlertFactory.fromDaysLeft(12, "x").advice()).toMatch(/12 day/);
  });
});
