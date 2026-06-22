import { expect } from '@playwright/test';

export class CheckoutFlowPage {
  constructor(page) {
    this.page = page;
  }

  async gotoStart(path) {
    await this.page.goto(path || '/');
  }

  async clickCheckout1() {
    await this.page.getByTestId("checkout-button").click();
  }

  async inputFullName2() {
    await this.page.getByTestId("full-name-input").fill("Luong Huy");
  }

  async inputPostalCode3() {
    await this.page.getByTestId("postal-code-input").fill("5005112");
  }

  async inputShippingMethod4() {
    await this.page.getByTestId("shipping-method-select").selectOption("pickup");
  }

  async inputBankTransfer5() {
    await this.page.getByTestId("payment-bank-radio").check();
  }

  async inputGiftWrapThisOrder6() {
    await this.page.getByTestId("gift-wrap-checkbox").check();
  }

  async inputDeliveryNote7() {
    await this.page.getByTestId("delivery-note-textarea").fill("20/06/2026");
  }

  async clickPlaceOrder8() {
    await this.page.getByTestId("place-order-button").click();
  }

  async assertCartComplete() {
    await expect(this.page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  }

  async assertCheckoutComplete() {
    await expect(this.page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
    await expect(this.page.getByTestId('confirmation-message')).toContainText('Thank you');
  }

}
