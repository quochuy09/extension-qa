import { test } from '@playwright/test';
import { ManualQcSuitePage } from "./pages/manual-qc-suite.page.js";

test.describe("Manual QC Suite", () => {
  test("Manual QC Suite", async ({ page }) => {
    const app = new ManualQcSuitePage(page);
    await app.gotoStart("/");

    await test.step("login flow", async () => {
      await app.inputUsername1();
      await app.inputPassword2();
      await app.clickLogin3();
      await app.assertLoginFlowComplete();
    });

    await test.step("add cart flow", async () => {
      await app.clickAddToCart4();
      await app.clickAddToCart5();
      await app.clickCart26();
      await app.assertAddCartFlowComplete();
    });

    await test.step("checkout flow", async () => {
      await app.clickCheckout7();
      await app.inputFullName8();
      await app.inputPostalCode9();
      await app.inputShippingMethod10();
      await app.inputBankTransfer11();
      await app.inputGiftWrapThisOrder12();
      await app.inputDeliveryNote13();
      await app.clickPlaceOrder14();
      await app.assertCheckoutFlowComplete();
    });

  });
});
