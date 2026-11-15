// FR-08: the daily email summary is built from the thread-pool result.
import { buildDailyEmail, sendEmail } from "../lib/email";
import { runAnalysisInThreads } from "../lib/threads/pool";
import { sampleInput, TODAY } from "./fixtures/sample-input";

jest.setTimeout(30000);

describe("daily email (FR-08)", () => {
  test("subject and body list expired stock, return deadlines and low stock", async () => {
    const analysis = await runAnalysisInThreads(sampleInput());
    const mail = buildDailyEmail(analysis, TODAY, 2, "https://expiryguard.example.com");

    expect(mail.subject).toContain("1 expired");
    expect(mail.subject).toContain("1 return deadline");
    expect(mail.html).toContain("PN-2401"); // quarantine
    expect(mail.html).toContain("CP-2408"); // return deadline
    expect(mail.html).toContain("Softin 10 mg"); // low stock
    expect(mail.html).toContain("also covers 2 missed day(s)"); // NFR-04
    expect(mail.text).toContain("Low stock:");
  });

  test("without SMTP settings the email is skipped, not failed", async () => {
    delete process.env.SMTP_HOST;
    expect(await sendEmail(["owner@example.com"], "s", "<p>h</p>", "t")).toMatch(/^skipped/);
  });
});
