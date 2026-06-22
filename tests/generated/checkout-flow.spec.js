import { test } from '@playwright/test';
import { CheckoutFlowPage } from "./pages/checkout-flow.page.js";

test.describe("checkout flow", () => {
  test("checkout flow", async ({ page }) => {
    const app = new CheckoutFlowPage(page);
    await app.gotoStart("/#/cart");

    await test.step("Cart", async () => {
      await app.clickCheckout1();
      await app.assertCartComplete();
    });

    await test.step("Checkout", async () => {
      await app.inputFullName2();
      await app.inputPostalCode3();
      await app.inputShippingMethod4();
      await app.inputBankTransfer5();
      await app.inputGiftWrapThisOrder6();
      await app.inputDeliveryNote7();
      await app.clickPlaceOrder8();
      await app.assertCheckoutComplete();
    });

  });
});
