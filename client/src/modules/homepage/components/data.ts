import type { LucideIcon } from "lucide-react";
import { Camera, Gift, Globe, Heart, Shield, Sparkles, Truck, Video } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export type Product = {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;
  image: string;
  badge?: string;
  badgeColor?: string;
};

export type FeatureItem = {
  title: string;
  description: string;
  icon: LucideIcon;
  iconClass: string;
  chipClass: string;
};

export type RangeCategory = {
  label: string;
  tag: string;
  bg: string;
  color: string;
};

export type ShopCategory = {
  id: string;
  label: string;
  description: string;
  count: string;
  image: string;
};

// ============================================================================
// Navigation & Categories
// ============================================================================

export const productCategories = ["Skincare", "Makeup", "Haircare", "Perfume"];

export const heroStats = [
  { value: "10K+", label: "Happy Customers" },
  { value: "৳999+", label: "Free Delivery" },
  { value: "48hr", label: "Delivery BD" },
];

export const featureItems: FeatureItem[] = [
  {
    title: "Free Delivery",
    description: "On orders over ৳999",
    icon: Truck,
    iconClass: "text-blue-700",
    chipClass: "bg-blue-100",
  },
  {
    title: "Premium Quality",
    description: "Luxury formulations",
    icon: Sparkles,
    iconClass: "text-violet-700",
    chipClass: "bg-violet-100",
  },
  {
    title: "Cruelty-Free",
    description: "Never tested on animals",
    icon: Heart,
    iconClass: "text-red-700",
    chipClass: "bg-red-100",
  },
  {
    title: "Secure Payment",
    description: "100% protected checkout",
    icon: Shield,
    iconClass: "text-green-700",
    chipClass: "bg-green-100",
  },
];

export const products: Product[] = [
  {
    id: 1,
    name: "Radiance Boosting Vitamin C Serum 30ml",
    price: 2800,
    originalPrice: 4500,
    rating: 5,
    reviews: 1243,
    image: "https://images.unsplash.com/photo-1618330834871-dd22c2c226ca?q=80&w=387&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    badge: "BESTSELLER",
    badgeColor: "bg-blue-700",
  },
  {
    id: 2,
    name: "Velvet Matte Long-lasting Lipstick",
    price: 1200,
    originalPrice: 1800,
    rating: 5,
    reviews: 876,
    image: "https://images.unsplash.com/photo-1598460880248-71ec6d2d582b?q=80&w=407&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    badge: "NEW",
    badgeColor: "bg-pink-600",
  },
  {
    id: 3,
    name: "Signature Floral Eau de Parfum 50ml",
    price: 4500,
    originalPrice: 6000,
    rating: 5,
    reviews: 432,
    image: "https://plus.unsplash.com/premium_photo-1679064286563-d686f06aed37?q=80&w=387&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    badge: "LIMITED",
    badgeColor: "bg-violet-700",
  },
  {
    id: 4,
    name: "Deep Hydration Premium Haircare Gift Set",
    price: 5800,
    originalPrice: 8500,
    rating: 4,
    reviews: 289,
    image: "https://images.unsplash.com/photo-1600852306771-c963331af110?q=80&w=435&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  },
];

export const rangeCategories: RangeCategory[] = [
  { label: "Skincare", tag: "Glow", bg: "bg-orange-50", color: "text-orange-700" },
  { label: "Makeup", tag: "Color", bg: "bg-pink-50", color: "text-pink-700" },
  { label: "Haircare", tag: "Care", bg: "bg-blue-50", color: "text-blue-700" },
  { label: "Perfume", tag: "Scent", bg: "bg-violet-50", color: "text-violet-700" },
];

export const shopCategories: ShopCategory[] = [
  {
    id: "skincare",
    label: "Skincare",
    description: "Glow & Nourish",
    count: "24 Products",
    image: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=500&q=80",
  },
  {
    id: "makeup",
    label: "Makeup",
    description: "Color & Define",
    count: "38 Products",
    image: "https://images.unsplash.com/photo-1512207736890-6ffed8a84e8d?w=500&q=80",
  },
  {
    id: "haircare",
    label: "Haircare",
    description: "Repair & Shine",
    count: "19 Products",
    image: "https://images.unsplash.com/photo-1527799820374-87f7caad78ef?w=500&q=80",
  },
  {
    id: "fragrance",
    label: "Fragrance",
    description: "Scent & Mood",
    count: "15 Products",
    image: "https://images.unsplash.com/photo-1587017539504-67cfbddac569?w=500&q=80",
  },
];

// ============================================================================
// Hero Section
// ============================================================================

export const heroContent = {
  mainTitle: "Spring Beauty",
  mainTitleHighlight: "Collection",
  subTitle: "2026",
  description:
    "Discover luxurious skincare and makeup that celebrates your natural glow. Clean, cruelty-free formulas delivered across Bangladesh in 48 hours.",
  badgeNew: "NEW LAUNCH",
  badgeOffer: "Up to 40% OFF",
  offerText: "Spring Sale - Save up to 40%",
  deliveryNote: "Free delivery on orders over ৳999 across Bangladesh",
  primaryCTA: "Shop Now",
  secondaryCTA: "View All Products",
  heroImage: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04",
  heroImageAlt: "Beauty model with glowing skin",
};

// ============================================================================
// Featured Products Section
// ============================================================================

export const featuredProductsContent = {
  title: "Featured Products",
  badge: "HOT DEALS",
  viewAllLink: "View All",
};

// ============================================================================
// Newsletter Section
// ============================================================================

export const newsletterContent = {
  icon: Gift,
  label: "Exclusive Member Offers",
  title: "Join Mollari Club",
  description: "Get 10% off your first order and early access to launches",
  inputPlaceholder: "Enter your email address",
  submitButton: "Subscribe",
  privacyNote: "We respect your privacy. Unsubscribe anytime.",
};

// ============================================================================
// Footer Section
// ============================================================================

export const footerContent = {
  brandName: "Mollari",
  brandRegion: "Bangladesh",
  brandDescription:
    "Celebrating natural beauty with luxurious cruelty-free cosmetics, proudly serving customers across Bangladesh.",
  socialIcons: [Globe, Camera, Video],
  sections: {
    products: "Product Range",
    support: "Help & Support",
    contact: "Contact Us",
  },
  contact: {
    address: "Dhaka, Bangladesh",
    phone: "+880 1XXX-XXXXXX",
    email: "hello@mollari.com",
  },
  copyright: "© 2026 Mollari. All rights reserved.",
  paymentLabel: "We Accept:",
};

export const supportLinks = [
  "My Account",
  "Track Order",
  "Returns",
  "FAQ",
  "Shipping Policy",
  "Contact",
];

export const paymentMethods = ["bKash", "Nagad", "Visa", "MC"];

// ============================================================================
// Brand & Site Constants
// ============================================================================

export const siteConfig = {
  siteName: "Mollari",
  tagline: "Beauty",
  searchPlaceholder: "Search for products, brands and more...",
};
