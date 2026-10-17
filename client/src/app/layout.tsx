import type { Metadata } from "next";
import AuthProvider from "@/shared/providers/AuthProvider";
import QueryProvider from "@/shared/providers/QueryProvider";
import { CartProvider } from "@/shared/contexts/CartContext";
import { WishlistProvider } from "@/shared/contexts/WishlistContext";
import { CartDrawer } from "@/modules/cart/components/CartDrawer";
import { WishlistDrawer } from "@/modules/customer-dashboard/components/WishlistDrawer";
import ColorThemeProvider from "@/shared/providers/ColorThemeProvider";
import { homepageAPI } from "@/modules/homepage/api";
import { getThemeColors } from "@/shared/utils/theme";
import "./globals.css";

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await homepageAPI.getSettings();
    return {
      title: settings?.storeName || "Mollari",
      description: settings?.tagline || "Premium cosmetics for everyone",
    };
  } catch (error) {
    return {
      title: "Mollari",
      description: "Premium cosmetics for everyone",
    };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let primaryColor = "#f01172";
  
  try {
    const settings = await homepageAPI.getSettings();
    if (settings?.primaryColor) {
      primaryColor = settings.primaryColor;
    }
  } catch (error) {
    console.error("Failed to fetch site settings during SSR:", error);
  }

  const colors = getThemeColors(primaryColor);

  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --primary: ${colors.primary};
            --primary-dark: ${colors.primaryDark};
            --primary-light: ${colors.primaryLight};
            --primary-pale: ${colors.primaryPale};
            --ring: ${colors.primary};
          }
        `}} />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <AuthProvider>
          <QueryProvider>
            <CartProvider>
              <WishlistProvider>
                <ColorThemeProvider />
                {children}
                <CartDrawer />
                <WishlistDrawer />
              </WishlistProvider>
            </CartProvider>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
