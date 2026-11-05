import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createRequire } from "node:module";
import { cleanDb, createUser, authCookie } from "./helpers.js";

const nodeRequire = createRequire(import.meta.url);
const { app } = nodeRequire("../src/server.js");
const prisma = nodeRequire("../src/config/db");

const ROLES = ["CANDIDAT", "RECRUTEUR", "ADMIN"];
const cookies = {};

beforeAll(async () => {
  await cleanDb();
  for (const role of ROLES)
    cookies[role] = authCookie((await createUser(role)).user);
});
afterAll(() => prisma.$disconnect());

// Allowed roles come from the comments in your controllers. Adjust to your routes.
const routes = [
  { method: "post", path: "/api/offres", allowed: ["RECRUTEUR", "ADMIN"] },
  { method: "post", path: "/api/candidatures", allowed: ["CANDIDAT"] },
  {
    method: "get",
    path: "/api/candidatures/mes-candidatures",
    allowed: ["CANDIDAT"],
  },
  {
    method: "get",
    path: "/api/candidatures/offre/999999",
    allowed: ["RECRUTEUR"],
  },
  {
    method: "patch",
    path: "/api/candidatures/999999/statut",
    allowed: ["RECRUTEUR"],
  },
];

for (const { method, path, allowed } of routes) {
  describe(`${method.toUpperCase()} ${path}`, () => {
    it("anonymous gets 401", async () => {
      expect((await request(app)[method](path)).status).toBe(401);
    });

    for (const role of ROLES) {
      const ok = allowed.includes(role);
      it(`${role} is ${ok ? "allowed (not 401/403)" : "forbidden (403)"}`, async () => {
        const res = await request(app)
          [method](path)
          .set("Cookie", cookies[role])
          .send({});
        if (ok) expect([401, 403]).not.toContain(res.status);
        else expect(res.status).toBe(403);
      });
    }
  });
}
