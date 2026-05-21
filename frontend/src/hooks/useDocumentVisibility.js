import { useEffect, useState } from "react";

const getIsVisible = () => {
  if (typeof document === "undefined") {
    return true;
  }

  return document.visibilityState !== "hidden";
};

const useDocumentVisibility = () => {
  const [isVisible, setIsVisible] = useState(getIsVisible);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(getIsVisible());
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return isVisible;
};

export default useDocumentVisibility;
