import { expect } from '@playwright/test';

export class ManualQcSuitePage {
  constructor(page) {
    this.page = page;
  }

  async gotoStart(path) {
    await this.page.goto(path || '/');
  }

  async inputUsername1() {
    await this.page.getByTestId("username-input").fill("standard_user");
  }

  async inputPassword2() {
    await this.page.getByTestId("password-input").fill("secret_sauce");
  }

  async clickLogin3() {
    await this.page.getByTestId("login-button").click();
  }

  async clickAddToCart4() {
    await this.page.getByTestId("add-to-cart-bento-stand").click();
  }

  async clickAddToCart5() {
    await this.page.getByTestId("add-to-cart-qa-notebook").click();
  }

  async clickCart26() {
    await this.page.getByTestId("nav-cart").click();
  }

  async clickCheckout7() {
    await this.page.getByTestId("checkout-button").click();
  }

  async inputFullName8() {
    await this.page.getByTestId("full-name-input").fill("Luong Huy");
  }

  async inputPostalCode9() {
    await this.page.getByTestId("postal-code-input").fill("5005112");
  }

  async inputShippingMethod10() {
    await this.page.getByTestId("shipping-method-select").selectOption("pickup");
  }

  async inputBankTransfer11() {
    await this.page.getByTestId("payment-bank-radio").check();
  }

  async inputGiftWrapThisOrder12() {
    await this.page.getByTestId("gift-wrap-checkbox").check();
  }

  async inputDeliveryNote13() {
    await this.page.getByTestId("delivery-note-textarea").fill("20/06/2026");
  }

  async clickPlaceOrder14() {
    await this.page.getByTestId("place-order-button").click();
  }

  async assertLoginFlowComplete() {
    await expect(this.page.getByRole('heading', { name: 'Products' })).toBeVisible();
  }

  async assertAddCartFlowComplete() {
    await expect(this.page.getByTestId('cart-count')).not.toHaveText('0');
    await expect(this.page.getByRole('heading', { name: 'Cart' })).toBeVisible();
  }

  async assertCheckoutFlowComplete() {
    await expect(this.page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
    await expect(this.page.getByTestId('confirmation-message')).toContainText('Thank you');
  }

}
