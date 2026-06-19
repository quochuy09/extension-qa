import { test, expect } from '@playwright/test';

test.describe('Generated checkout flow', () => {
  test('customer can login, add an item, and place an order', async ({ page }) => {
    await page.goto('/');

    await test.step('Login', async () => {
      await page.getByTestId("username-input").fill("standard_user");
      await page.getByTestId("password-input").fill("secret_sauce");
      await page.getByTestId("login-button").click();
      await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
    });

    await test.step('Products', async () => {
      await page.getByTestId("add-to-cart-bento-stand").click();
      await page.getByTestId("nav-cart").click();
      await expect(page.getByTestId('cart-count')).toHaveText('1');
      await expect(page.getByRole('heading', { name: 'Cart' })).toBeVisible();
    });

    await test.step('Cart', async () => {
      await page.getByTestId("checkout-button").click();
      await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
    });

    await test.step('Checkout', async () => {
      await page.getByTestId("full-name-input").fill("Taro Yamada");
      await page.getByTestId("postal-code-input").fill("100-0001");
      await page.getByTestId("place-order-button").click();
      await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
      await expect(page.getByTestId('confirmation-message')).toContainText('Thank you');
    });

  });
});
