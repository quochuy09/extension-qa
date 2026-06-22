import { expect } from '@playwright/test';

export class LoginFlowPage {
  constructor(page) {
    this.page = page;
  }

  async gotoStart(path) {
    await this.page.goto(path || '/');
  }

  async inputUsername1() {
    await this.page.getByTestId("username-input").fill("standard_userstandard_user");
  }

  async inputPassword2() {
    await this.page.getByTestId("password-input").fill("secret_saucesss");
  }

  async clickLogin3() {
    await this.page.getByTestId("login-button").click();
  }

  async assertLoginComplete() {
    await expect(this.page.getByRole('heading', { name: 'Products' })).toBeVisible();
  }

}
