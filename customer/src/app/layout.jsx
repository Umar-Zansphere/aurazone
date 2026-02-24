import './globals.css';
import { ToastProvider } from '../components/ToastContext';
import Toast from '../components/Toast';
import BottomNav from '../components/BottomNav';
import { AuthProvider } from '@/context/AuthContext';
import StoreInitializer from '@/components/StoreInitializer';

export const metadata = {
  title: 'SoleMate - Premium Footwear',
  description: 'Discover premium shoes with exclusive collections. Shop as a guest or create an account for exclusive benefits.',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes',
  themeColor: '#FF6B6B',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover" />
        <meta name="theme-color" content="#FF6B6B" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="bg-[#FAFAF8]">
        <AuthProvider>
          <StoreInitializer />
          <ToastProvider>
            <div className="mobile-container">
              {children}
            </div>
            <BottomNav />
            <Toast />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

