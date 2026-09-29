import { useContext } from "react";
import { StationContext, type StationContextType } from "../context/StationContextTypes";

export function useStation(): StationContextType {
  const context = useContext(StationContext);
  if (!context) {
    throw new Error("useStation must be used within a StationProvider");
  }
  return context;
}
