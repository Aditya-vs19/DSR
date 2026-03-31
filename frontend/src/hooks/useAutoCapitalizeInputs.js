import { useEffect } from "react";

const SKIPPED_INPUT_TYPES = new Set(["password", "email", "date", "number", "checkbox", "radio"]);

const capitalizeFirstLetterPerLine = (value) =>
  String(value || "").replace(/(^|\n)([a-z])/g, (match, prefix, char) => `${prefix}${char.toUpperCase()}`);

const useAutoCapitalizeInputs = () => {
  useEffect(() => {
    const handleInput = (event) => {
      if (event.isComposing) {
        return;
      }

      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
        return;
      }

      if (target instanceof HTMLInputElement && SKIPPED_INPUT_TYPES.has(target.type)) {
        return;
      }

      const nextValue = capitalizeFirstLetterPerLine(target.value);
      if (nextValue === target.value) {
        return;
      }

      target.value = nextValue;
    };

    document.addEventListener("input", handleInput, true);
    return () => document.removeEventListener("input", handleInput, true);
  }, []);
};

export default useAutoCapitalizeInputs;
