"use client";

import { motion } from "motion/react";
import { DeleteIcon } from "@/components/pocket/icons";
import type { Op } from "@/features/payments/amount";

const OPERATORS: Op[] = ["+", "-", "×", "÷"];
const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"];

/**
 * Amount keypad.
 *
 * Operators sit on their own row above the digits, which keeps arithmetic a
 * detour and typing an amount the main road — the row order says which is
 * which. The reference's keypad has no operator row at all; this one keeps it
 * because the send screen it was swapped in from had one, and adding two
 * numbers before sending them is a thing people do.
 *
 * Every key is a real button with a name, so the keypad is usable by keyboard
 * and by screen reader — the digits and operators read as themselves, and the
 * two that do not ("." and delete) are labelled explicitly.
 */
export function NumberPad({
  onDigit,
  onDecimal,
  onOperator,
  onBackspace,
}: {
  onDigit: (digit: string) => void;
  onDecimal: () => void;
  onOperator: (op: Op) => void;
  onBackspace: () => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-around px-6">
        {OPERATORS.map((op) => (
          <motion.button
            key={op}
            type="button"
            whileTap={{ scale: 0.85 }}
            onClick={() => onOperator(op)}
            aria-label={`${operatorWord(op)} operator`}
            className="grid size-11 place-items-center rounded-full text-[19px] font-semibold text-[var(--m)] outline-none transition-colors active:bg-[var(--s)] focus-visible:bg-[var(--s)]"
          >
            {op}
          </motion.button>
        ))}
      </div>

      {/*
        `.pk-key` is the grid recipe from the stylesheet: three columns, a 56px
        row, and a press state that fills rather than shifts. The delete key is
        the twelfth cell, which is where the reference puts it too.
      */}
      <div className="pk-key">
        {DIGITS.map((digit) => (
          <motion.button
            key={digit}
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => (digit === "." ? onDecimal() : onDigit(digit))}
            aria-label={digit === "." ? "Decimal point" : digit}
            className="select-none"
          >
            {digit}
          </motion.button>
        ))}

        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={onBackspace}
          aria-label="Delete last digit"
          className="grid place-items-center"
        >
          <DeleteIcon size={22} />
        </motion.button>
      </div>
    </div>
  );
}

function operatorWord(op: Op): string {
  if (op === "+") return "add";
  if (op === "-") return "subtract";
  if (op === "×") return "multiply";
  return "divide";
}
