import { useCallback, useEffect, useRef, useState } from "react";

export function useToast() {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const timer = useRef(0);

  const show = useCallback((text) => {
    setMessage(String(text || ""));
    setVisible(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisible(false), 2400);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { message, visible, show };
}
