import { createContext, useContext } from 'react';

type AlertKind = "ORDER" | "INQUIRY" | "REVIEW" | "INQUIRY_COMMENT" | "REVIEW_COMMENT";

type AdminAlertContextType = {
  markAlertAsRead: (alertId: string) => void;
  onAlertClick: (alertId: string, kind: AlertKind) => void;
};

export const AdminAlertContext = createContext<AdminAlertContextType | null>(null);

export function useAdminAlert(): AdminAlertContextType {
  const context = useContext(AdminAlertContext);
  if (!context) {
    throw new Error('useAdminAlert must be used within AdminAlertProvider');
  }
  return context;
}
