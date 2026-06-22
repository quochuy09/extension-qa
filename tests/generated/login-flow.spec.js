import { test } from '@playwright/test';
import { LoginFlowPage } from "./pages/login-flow.page.js";

test.describe("login flow", () => {
  test("login flow", async ({ page }) => {
    const app = new LoginFlowPage(page);
    await app.gotoStart("/");

    await test.step("Login", async () => {
      await app.inputUsername1();
      await app.inputPassword2();
      await app.clickLogin3();
      await app.assertLoginComplete();
    });

  });
});
