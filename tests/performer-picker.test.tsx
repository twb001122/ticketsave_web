// @vitest-environment jsdom

import React, { useState } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PerformerPicker, type PerformerPickerOption } from "../src/performer-picker";

const options: PerformerPickerOption[] = [
  { id: "a", label: "康天" },
  { id: "b", label: "杨梅" }
];

function Harness({ onCreate }: { onCreate?: (name: string) => Promise<PerformerPickerOption> }) {
  const [values, setValues] = useState<string[]>([]);
  return <PerformerPicker label="演员阵容" options={options} values={values} onChange={setValues} onCreate={onCreate} />;
}

afterEach(() => {
  cleanup();
});

describe("PerformerPicker", () => {
  it("lets the user select multiple performers in a dedicated panel", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: /点击选择演员/i }));
    const dialog = screen.getByRole("dialog", { name: /演员阵容选择器/i });
    await user.click(within(dialog).getByRole("button", { name: /康天/i }));
    await user.click(within(dialog).getByRole("button", { name: /杨梅/i }));

    expect(screen.getByRole("button", { name: /已选 2 位演员/i })).toBeTruthy();
    expect(screen.getAllByText("康天").length).toBeGreaterThan(0);
    expect(screen.getAllByText("杨梅").length).toBeGreaterThan(0);
  });

  it("can create a new performer from the search field and auto-select it", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async (name: string) => ({ id: "c", label: name }));
    render(<Harness onCreate={onCreate} />);

    await user.click(screen.getByRole("button", { name: /点击选择演员/i }));
    const dialog = screen.getByRole("dialog", { name: /演员阵容选择器/i });
    await user.type(within(dialog).getByPlaceholderText("搜索演员名字"), "白语");
    await user.click(within(dialog).getByRole("button", { name: /直接新建演员“白语”/i }));

    expect(onCreate).toHaveBeenCalledWith("白语");
    expect(screen.getAllByText("白语").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /已选 1 位演员/i })).toBeTruthy();
  });
});
