import { QueryProvider } from "@/app/providers/QueryProvider";
import { ErpNotification } from "@/shared/components/common/ErpNotification";

export function AppProviders({ children }) {
  return (
    <QueryProvider>
      {children}
      <ErpNotification />
    </QueryProvider>
  );
}
