import { describe, expect, it } from "vitest"
import { databaseNameForUser } from "@/lib/db/database"

describe("databaseNameForUser", () => {
  it("namespaces by clerk user id", () => {
    expect(databaseNameForUser("user_2abcXYZ")).toBe("AttendlyDB_u_user_2abcXYZ")
  })

  it("strips unsafe characters", () => {
    expect(databaseNameForUser("user/evil?x")).toBe("AttendlyDB_u_user_evil_x")
  })
})
