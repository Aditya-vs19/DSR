import { useEffect, useRef } from "react";

const usePolling = (callback, delay, enabled = true) => {
  const callbackRef = useRef(callback);
  const runningRef = useRef(false);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || !delay) {
      return undefined;
    }

    const tick = async () => {
      if (runningRef.current) {
        return;
      }

      runningRef.current = true;

      try {
        await callbackRef.current?.();
      } finally {
        runningRef.current = false;
      }
    };

    const timer = window.setInterval(tick, delay);
    return () => window.clearInterval(timer);
  }, [delay, enabled]);
};

export default usePolling;
