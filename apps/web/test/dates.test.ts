import { expect, it } from "vitest";
import { earliestDeliveryDate, limaToday } from "../src/dates";

it("uses Lima's calendar, including the UTC midnight boundary", () => {
  expect(limaToday(new Date("2026-11-20T04:59:59.000Z"))).toBe("2026-11-19");
  expect(limaToday(new Date("2026-11-20T05:00:00.000Z"))).toBe("2026-11-20");
  expect(earliestDeliveryDate("2026-11-19", [1, 2])).toBe("2026-11-22");
  expect(earliestDeliveryDate("2026-11-19", [5])).toBe("2026-11-24");
  expect(earliestDeliveryDate("2026-11-30", [])).toBe("2026-12-03");
  expect(earliestDeliveryDate(limaToday(new Date("2026-11-20T04:30:00.000Z")), [0])).toBe(
    "2026-11-22",
  );
  expect(earliestDeliveryDate(limaToday(new Date("2026-11-20T05:30:00.000Z")), [0])).toBe(
    "2026-11-23",
  );
});
