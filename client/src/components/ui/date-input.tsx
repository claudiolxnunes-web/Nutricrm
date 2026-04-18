import { useState, useEffect } from "react";
import { Input } from "./input";
import { isoToBR, brToISO } from "@/lib/dateUtils";

interface DateInputProps {
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  className?: string;
}

export function DateInput({ value, onChange, placeholder = "DD/MM/AAAA", className }: DateInputProps) {
  const [displayValue, setDisplayValue] = useState("");

  useEffect(() => {
    setDisplayValue(isoToBR(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, ""); // Remove não-números

    // Adiciona as barras automaticamente
    if (val.length >= 2) val = val.slice(0, 2) + "/" + val.slice(2);
    if (val.length >= 5) val = val.slice(0, 5) + "/" + val.slice(5, 9);

    setDisplayValue(val);

    // Converte para ISO e envia para o onChange
    const iso = brToISO(val);
    if (iso) {
      onChange(iso);
    }
  };

  return (
    <Input
      type="text"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      maxLength={10}
    />
  );
}
