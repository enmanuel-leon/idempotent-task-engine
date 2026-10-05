import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client';
import { DashboardPage } from './pages/dashboard';
import { Toaster } from 'sonner';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" richColors closeButton duration={4000} />
      <DashboardPage />
    </QueryClientProvider>
  );
}
