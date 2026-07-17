import AppLayout from "@/components/layout/AppLayout";
import ToastProvider from "@/components/layout/ToastProvider";
import { I18nProvider } from "@/i18n/I18nProvider";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <I18nProvider storageKey="app_locale">
        <AppLayout>{children}</AppLayout>
      </I18nProvider>
    </ToastProvider>
  );
}