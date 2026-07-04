import {
  type Dispatch,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

export interface SelectDropdownOption {
  content?: ReactNode;
  label: string;
  leading?: ReactNode;
  value: string;
}

interface SelectDropdownProps {
  foldedOptions?: {
    label: string;
    options: SelectDropdownOption[];
  };
  id: string;
  label: string;
  onClose(restoreFocus: boolean): void;
  onSelect(value: string): void;
  options: SelectDropdownOption[];
  pinnedValue?: string;
  selectedValue: string;
  showSearch?: boolean;
}

export function SelectDropdown({
  foldedOptions,
  id,
  label,
  onClose,
  onSelect,
  options,
  pinnedValue,
  selectedValue,
  showSearch = true,
}: SelectDropdownProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLFieldSetElement>(null);
  const [query, setQuery] = useState("");
  const [foldedOpen, setFoldedOpen] = useState(
    foldedOptions?.options.some((option) => option.value === selectedValue) ??
      false,
  );
  const pinned = options.find((option) => option.value === pinnedValue);
  const visible = options.filter(
    (option) =>
      option.value !== pinnedValue &&
      option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const foldedVisible =
    foldedOptions?.options.filter((option) =>
      option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    ) ?? [];
  const showFoldedOptions = foldedOpen || query.length > 0;
  const keyboardOptions = [
    ...(pinned ? [pinned] : []),
    ...visible,
    ...(showFoldedOptions ? foldedVisible : []),
  ];
  const selectedIndex = keyboardOptions.findIndex(
    (option) => option.value === selectedValue,
  );
  const [activeIndex, setActiveIndex] = useState(Math.max(0, selectedIndex));

  useEffect(() => {
    if (showSearch) inputRef.current?.focus();
    else popupRef.current?.focus();
  }, [showSearch]);

  useEffect(() => {
    setActiveIndex((index) =>
      Math.min(Math.max(0, index), keyboardOptions.length - 1),
    );
  }, [keyboardOptions.length]);

  const choose = (option: SelectDropdownOption | undefined) =>
    option && onSelect(option.value);

  return (
    <fieldset
      aria-label={label}
      className="absolute top-[calc(100%+4px)] left-0 z-20 flex max-h-[min(520px,70vh)] w-[520px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-[7px] border border-[var(--vscode-dropdown-border,var(--vscode-contrastBorder,transparent))] bg-[var(--vscode-dropdown-listBackground,var(--vscode-dropdown-background))] p-1 text-[var(--vscode-dropdown-foreground)] shadow-[0_4px_12px_var(--vscode-widget-shadow,#0005)]"
      id={`${id}-listbox`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onClose(false);
      }}
      onKeyDown={(event) => {
        if (
          event.target instanceof HTMLElement &&
          event.target.tagName === "SUMMARY" &&
          (event.key === "Enter" || event.key === " ")
        ) {
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          setActiveIndex((index) =>
            Math.min(
              keyboardOptions.length - 1,
              Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1)),
            ),
          );
        } else if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          setActiveIndex(event.key === "Home" ? 0 : keyboardOptions.length - 1);
        } else if (event.key === "Enter") {
          event.preventDefault();
          choose(keyboardOptions[activeIndex]);
        } else if (event.key === "Escape") {
          event.preventDefault();
          onClose(true);
        }
      }}
      ref={popupRef}
      tabIndex={-1}
    >
      {showSearch && (
        <input
          aria-label={`Search ${label.toLocaleLowerCase()}`}
          className="mb-1 h-7 shrink-0 rounded-sm border border-[var(--vscode-input-border,var(--vscode-contrastBorder,transparent))] bg-[var(--vscode-input-background)] px-2 text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)] focus:outline-none"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
          ref={inputRef}
          type="search"
          value={query}
        />
      )}
      {pinned && (
        <div className="shrink-0 border-b border-[var(--vscode-dropdown-border,var(--vscode-contrastBorder,transparent))] pb-1">
          <Option
            active={activeIndex === 0}
            onSelect={() => choose(pinned)}
            option={pinned}
            selected={pinned.value === selectedValue}
          />
        </div>
      )}
      <div className="min-h-0 overflow-auto pt-1" role="listbox">
        {visible.map((option, index) => {
          const keyboardIndex = index + (pinned ? 1 : 0);
          return (
            <Option
              active={keyboardIndex === activeIndex}
              key={option.value}
              onSelect={() => choose(option)}
              option={option}
              selected={option.value === selectedValue}
            />
          );
        })}
        {visible.length === 0 && foldedVisible.length === 0 && (
          <p className="px-2 py-1.5 text-[var(--vscode-descriptionForeground)]">
            No matches
          </p>
        )}
        {foldedOptions && foldedVisible.length > 0 && (
          <details
            className="mt-1 border-t border-[var(--vscode-dropdown-border,var(--vscode-contrastBorder,transparent))] pt-1"
            onToggle={(event) => setFoldedOpen(event.currentTarget.open)}
            open={showFoldedOptions}
          >
            <summary className="cursor-pointer rounded-sm px-[7px] py-[5px] text-[var(--vscode-descriptionForeground)] focus-visible:bg-[var(--vscode-list-hoverBackground)] focus-visible:outline-none">
              {foldedOptions.label} ({foldedVisible.length})
            </summary>
            {foldedVisible.map((option, index) => {
              const keyboardIndex = (pinned ? 1 : 0) + visible.length + index;
              return (
                <Option
                  active={keyboardIndex === activeIndex}
                  key={option.value}
                  onSelect={() => choose(option)}
                  option={option}
                  selected={option.value === selectedValue}
                />
              );
            })}
          </details>
        )}
      </div>
    </fieldset>
  );
}

export function useDismissOnOutsidePointer(
  rootRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  setOpen: Dispatch<React.SetStateAction<boolean>>,
) {
  useEffect(() => {
    if (!open) return;

    const handlePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointer);
    return () => document.removeEventListener("pointerdown", handlePointer);
  }, [open, rootRef, setOpen]);
}

function Option({
  active,
  onSelect,
  option,
  selected,
}: {
  active: boolean;
  onSelect(): void;
  option: SelectDropdownOption;
  selected: boolean;
}) {
  return (
    <button
      aria-selected={selected}
      className={`flex min-h-[30px] w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-sm border-0 px-[7px] py-[5px] text-left focus-visible:outline-none ${
        selected
          ? "bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]"
          : active
            ? "bg-[var(--vscode-list-hoverBackground)]"
            : "bg-transparent text-inherit"
      }`}
      onClick={onSelect}
      role="option"
      tabIndex={-1}
      type="button"
    >
      <span className="flex min-w-0 flex-1 items-start gap-1.5">
        {option.leading}
        {option.content ?? (
          <span className="min-w-0 break-words whitespace-normal">
            {option.label}
          </span>
        )}
      </span>
      {selected && (
        <span className="shrink-0" aria-hidden="true">
          ✓
        </span>
      )}
    </button>
  );
}
