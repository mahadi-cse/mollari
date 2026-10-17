import React from 'react';
import { Metadata } from 'next';
import { Truck, Clock, ShieldCheck, Globe } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Shipping Policy | Mollari',
  description: 'Learn about Mollari shipping methods, delivery times, and rates across Bangladesh.',
};

export default function ShippingPolicyPage() {
  return (
    <div className="min-h-screen bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-4xl px-6 sm:px-10">
        <div className="mb-16">
          <h1 className="text-4xl font-black tracking-tight text-zinc-900 sm:text-5xl">
            Shipping <span className="text-pink-600">Policy</span>
          </h1>
          <p className="mt-4 text-lg text-zinc-600">
            Last updated: May 2026
          </p>
        </div>

        <div className="grid gap-12">
          <section className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-3xl bg-zinc-50 p-8 border border-zinc-100">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-100 text-pink-600">
                <Truck size={24} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900">Delivery Rates</h3>
              <p className="mt-2 text-zinc-600 leading-relaxed">
                Free delivery on all orders above <strong>৳999</strong>. For orders below this amount:
              </p>
              <ul className="mt-4 space-y-2 text-sm text-zinc-600">
                <li className="flex justify-between border-b pb-2">
                  <span>Inside Dhaka</span>
                  <span className="font-bold text-zinc-900">৳60</span>
                </li>
                <li className="flex justify-between border-b pb-2">
                  <span>Outside Dhaka</span>
                  <span className="font-bold text-zinc-900">৳120</span>
                </li>
              </ul>
            </div>

            <div className="rounded-3xl bg-zinc-50 p-8 border border-zinc-100">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                <Clock size={24} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900">Delivery Timeline</h3>
              <p className="mt-2 text-zinc-600 leading-relaxed">
                We strive to get your products to you as fast as possible.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-zinc-600">
                <li className="flex justify-between border-b pb-2">
                  <span>Dhaka Metro</span>
                  <span className="font-bold text-zinc-900">24 - 48 Hours</span>
                </li>
                <li className="flex justify-between border-b pb-2">
                  <span>Suburbs & Cities</span>
                  <span className="font-bold text-zinc-900">3 - 5 Days</span>
                </li>
              </ul>
            </div>
          </section>

          <section className="prose prose-zinc max-w-none space-y-8 text-zinc-600">
            <div>
              <h2 className="text-2xl font-bold text-zinc-900">Order Processing</h2>
              <p className="mt-4 leading-relaxed">
                Orders placed before 2:00 PM (GMT+6) will be processed the same day. Orders placed after 2:00 PM or on holidays will be processed on the next business day. You will receive a confirmation email/SMS once your order has been dispatched.
              </p>
            </div>

            <div className="rounded-3xl border-2 border-dashed border-zinc-200 p-8">
              <h2 className="text-2xl font-bold text-zinc-900 flex items-center gap-3">
                <ShieldCheck className="text-green-600" />
                Shipping Security
              </h2>
              <p className="mt-4 leading-relaxed">
                All packages are sealed with Mollari security tape. If you notice any tampering or if the seal is broken, please do not accept the delivery and contact our support team immediately at <strong>+880 1XXX-XXXXXX</strong>.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-zinc-900">International Shipping</h2>
              <p className="mt-4 leading-relaxed flex items-start gap-3">
                <Globe className="mt-1 shrink-0 text-zinc-400" size={20} />
                Currently, we only ship within Bangladesh. We are working on bringing Mollari to our international fans soon!
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
