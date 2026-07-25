"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  isPending?: boolean;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  debounceMs = 300,
  isPending = false,
  className,
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  // Tracks the last value *this* input emitted via onChange. The debounced
  // onChange round-trips through the parent (often a URL query param), which
  // lands back here as a new `value` prop - without this guard, that echo
  // re-syncs `localValue` unconditionally, and if it arrives while the user
  // kept typing (e.g. two keystrokes spaced close to a debounce interval), it
  // clobbers whatever they typed since, dropping/reordering characters.
  const lastEmittedRef = useRef(value);

  // Sync external value changes (e.g. from URL params or clearing filters) -
  // but not the echo of our own emitted value, which would stomp in-progress typing.
  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalValue(value);
    lastEmittedRef.current = value;
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      lastEmittedRef.current = newValue;
      onChange(newValue);
    }, debounceMs);
  };

  const handleClear = () => {
    setLocalValue("");
    lastEmittedRef.current = "";
    onChange("");
    inputRef.current?.focus();
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const isDebouncing = localValue !== value;
  const showSpinner = isPending || isDebouncing;

  return (
    <div className={cn("relative flex-1 min-w-0 max-w-sm", className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="pl-8 pr-8 text-sm text-ellipsis"
      />
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
        {showSpinner && (
          <Loader2 className="size-4 text-muted-foreground animate-spin" />
        )}
        {!showSpinner && localValue && (
          <button
            type="button"
            onClick={handleClear}
            className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
            <span className="sr-only">Clear search</span>
          </button>
        )}
      </div>
    </div>
  );
}