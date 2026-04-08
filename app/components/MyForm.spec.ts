import { mountSuspended } from "@nuxt/test-utils/runtime";
import { describe, it, expect } from "vitest";

import MyForm from "~/components/MyForm.vue";

describe("MyForm", () => {
  it("should render the form.", async () => {
    const wrapper = await mountSuspended(MyForm);

    expect(wrapper.find("[data-testid='my-form']").exists()).toBe(true);
  });

  it("should emit submitData when the form is submitted with valid data.", async () => {
    const wrapper = await mountSuspended(MyForm);
    const nameInput = wrapper.find("[data-testid='form-name-field'] input");
    const valueInput = wrapper.find("[data-testid='form-value-field'] input");

    await nameInput.setValue("test-name");
    await valueInput.setValue("test-value");

    await wrapper.vm.triggerFormSubmit();

    expect(wrapper.emitted("submitData")).toStrictEqual([[{ name: "test-name", value: "test-value" }]]);
  });

  it("should update formState when typing into name input.", async () => {
    const wrapper = await mountSuspended(MyForm);
    const input = wrapper.find("[data-testid='form-name-field'] input");

    await input.setValue("test-name");

    expect(input.element.value).toBe("test-name");
  });

  it("should update formState when typing into value input.", async () => {
    const wrapper = await mountSuspended(MyForm);
    const input = wrapper.find("[data-testid='form-value-field'] input");

    await input.setValue("test-value");

    expect(input.element.value).toBe("test-value");
  });
});