import React, { useMemo, useState } from "react";

export interface PerformerPickerOption {
  id: string;
  label: string;
  subtitle?: string | null;
}

interface PerformerPickerProps {
  label: string;
  options: PerformerPickerOption[];
  values: string[];
  onChange: (values: string[]) => void;
  onCreate?: (name: string) => Promise<PerformerPickerOption>;
}

export function PerformerPicker({
  label,
  options,
  values,
  onChange,
  onCreate
}: PerformerPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [createdOptions, setCreatedOptions] = useState<PerformerPickerOption[]>([]);
  const [creating, setCreating] = useState(false);

  const mergedOptions = useMemo(() => {
    const byID = new Map<string, PerformerPickerOption>();
    [...options, ...createdOptions].forEach((option) => byID.set(option.id, option));
    return Array.from(byID.values()).sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
  }, [createdOptions, options]);

  const selectedOptions = mergedOptions.filter((option) => values.includes(option.id));
  const filteredOptions = mergedOptions.filter((option) => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;
    return `${option.label} ${option.subtitle ?? ""}`.toLowerCase().includes(keyword);
  });

  const canCreate =
    Boolean(onCreate) &&
    search.trim().length > 0 &&
    !mergedOptions.some((option) => option.label.trim().toLowerCase() === search.trim().toLowerCase());

  function toggleValue(id: string) {
    if (values.includes(id)) {
      onChange(values.filter((value) => value !== id));
      return;
    }
    onChange([...values, id]);
  }

  async function createPerformer() {
    if (!onCreate || !canCreate || creating) return;
    setCreating(true);
    try {
      const created = await onCreate(search.trim());
      setCreatedOptions((current) => [...current, created]);
      onChange(values.includes(created.id) ? values : [...values, created.id]);
      setSearch("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="performer-picker">
      <button type="button" className="picker-trigger" onClick={() => setOpen(true)}>
        <span className="picker-label">{label}</span>
        <strong>{selectedOptions.length > 0 ? `已选 ${selectedOptions.length} 位演员` : "点击选择演员"}</strong>
      </button>

      {selectedOptions.length > 0 ? (
        <div className="selected-chip-list">
          {selectedOptions.map((option) => (
            <button type="button" key={option.id} className="selected-chip" onClick={() => toggleValue(option.id)}>
              {option.label}
              <span>移除</span>
            </button>
          ))}
        </div>
      ) : null}

      {open ? (
        <div className="picker-modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div className="picker-modal" role="dialog" aria-modal="true" aria-label={`${label}选择器`} onClick={(event) => event.stopPropagation()}>
            <div className="picker-modal-header">
              <div>
                <p className="eyebrow">Lineup</p>
                <h2>{label}</h2>
              </div>
              <button type="button" className="ghost-button" onClick={() => setOpen(false)}>完成</button>
            </div>

            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索演员名字"
            />

            {selectedOptions.length > 0 ? (
              <div className="picker-summary">
                {selectedOptions.map((option) => (
                  <span key={option.id} className="picker-summary-chip">{option.label}</span>
                ))}
              </div>
            ) : null}

            <div className="picker-list" role="list">
              {filteredOptions.map((option) => {
                const selected = values.includes(option.id);
                return (
                  <button
                    type="button"
                    key={option.id}
                    className={`picker-row${selected ? " active" : ""}`}
                    onClick={() => toggleValue(option.id)}
                    aria-pressed={selected}
                  >
                    <div>
                      <strong>{option.label}</strong>
                      {option.subtitle ? <span>{option.subtitle}</span> : null}
                    </div>
                    <em>{selected ? "已选" : "选择"}</em>
                  </button>
                );
              })}

              {filteredOptions.length === 0 ? <p className="muted">没有匹配的演员。</p> : null}
            </div>

            {canCreate ? (
              <div className="picker-create-panel">
                <p>没有找到“{search.trim()}”</p>
                <button type="button" className="primary-button" disabled={creating} onClick={createPerformer}>
                  {creating ? "新建中..." : `直接新建演员“${search.trim()}”`}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
