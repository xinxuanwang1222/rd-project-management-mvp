import { expect, test } from "@playwright/test";

test("owner can log in and see the project list", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("账号").fill("owner");
  await page.getByLabel("密码").fill("Owner123!");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByRole("heading", { name: "项目列表" })).toBeVisible();
  await expect(page.getByText("样品结构优化项目")).toBeVisible();
});
