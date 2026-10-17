"use client";

import { Mail, MapPin, Phone } from "lucide-react";
import { motion } from "framer-motion";
import { footerContent } from "./data";
import { useHomepageLocale } from "../locales/HomepageLocaleContext";
import { useHomepageStats, useSiteSettings } from "@/modules/homepage";
import Link from "next/link";

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

export function Footer() {
  const { t } = useHomepageLocale();
  const { data: stats } = useHomepageStats();
  const { data: settings } = useSiteSettings();
  
  const paymentMethods = (stats?.paymentMethods || [])
    .filter(m => m.isActive)
    .map(m => m.name);
  
  // Use custom payment methods if set in DB stats, otherwise fallback to defaults
  const displayMethods = paymentMethods.length > 0 
    ? paymentMethods 
    : ["bKash", "Nagad", "Visa", "MC"];
 
  return (
    <footer className="bg-zinc-950 text-zinc-400">
      <motion.div
        className="mx-auto max-w-[1600px] grid gap-10 px-6 sm:px-10 py-14 sm:grid-cols-2 lg:grid-cols-4"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        <motion.div variants={itemVariants}>
          <p className="text-xl font-extrabold text-white">{footerContent.brandName}</p>
          <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-primary">
            {t.footer.brandRegion}
          </p>
          <p className="mb-5 text-sm leading-7">{t.footer.brandDescription}</p>
          <div className="flex gap-2">
            {footerContent.socialIcons.map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-800/80 text-zinc-300 transition-all duration-200 hover:bg-primary hover:text-white hover:-translate-y-0.5"
              >
                <Icon size={16} />
              </a>
            ))}
          </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <h4 className="mb-5 text-sm font-bold tracking-widest text-white uppercase">
            {t.footer.sections.products}
          </h4>
          <ul className="space-y-3 text-sm">
            {t.footer.productCategories.map((item) => (
              <li key={item}>
                <a href="#" className="transition-colors duration-200 hover:text-white">
                  {item}
                </a>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div variants={itemVariants}>
          <h4 className="mb-5 text-sm font-bold tracking-widest text-white uppercase">
            {t.footer.sections.support}
          </h4>
          <ul className="space-y-3 text-sm">
            {t.footer.supportLinks.map((item, index) => {
              const footerLinks = [
                "/dashboard",
                "/dashboard?tab=order-tracking",
                "/dashboard?tab=returns",
                "/support/faq",
                "/support/shipping-policy",
                "/support/contact",
              ];
              const href = footerLinks[index] || "#";

              return (
                <li key={item}>
                  <Link
                    href={href}
                    className="transition-colors duration-200 hover:text-white"
                  >
                    {item}
                  </Link>
                </li>
              );
            })}
          </ul>
        </motion.div>

        <motion.div variants={itemVariants}>
          <p className="mb-6 text-sm font-bold uppercase tracking-wider text-white">
            {t.footer.sections.contact}
          </p>
          <div className="space-y-4 text-[13px]">
            <p className="inline-flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-zinc-800/80">
                <MapPin size={14} className="text-primary" />
              </span>
              {settings?.contactAddress || "Dhaka, Bangladesh"}
            </p>
            <p className="inline-flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-zinc-800/80">
                <Phone size={14} className="text-primary" />
              </span>
              {settings?.contactPhone || "+880 1XXX-XXXXXX"}
            </p>
            <p className="inline-flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-zinc-800/80">
                <Mail size={14} className="text-primary" />
              </span>
              {settings?.contactEmail || "hello@mollari.com"}
            </p>
          </div>
        </motion.div>
      </motion.div>

      <div className="border-t border-zinc-800/60">
        <div className="mx-auto max-w-[1600px] flex flex-col items-center justify-between gap-3 px-6 sm:px-10 py-5 text-xs sm:flex-row">
          <p className="text-zinc-500">{t.footer.copyright}</p>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">{t.footer.paymentLabel}</span>
            {displayMethods.map((pay) => (
              <span
                key={pay}
                className="rounded-md bg-zinc-800/80 px-2.5 py-1 text-zinc-300 text-[11px] font-medium"
              >
                {pay}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
