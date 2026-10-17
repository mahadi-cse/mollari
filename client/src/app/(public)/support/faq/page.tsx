import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ | Mollari',
  description: 'Frequently asked questions about Mollari products, orders, and shipping.',
};

const faqs = [
  {
    category: 'Orders & Shipping',
    questions: [
      {
        q: 'How long does delivery take?',
        a: 'Standard delivery within Dhaka takes 24-48 hours. Outside Dhaka, it typically takes 3-5 business days.',
      },
      {
        q: 'How can I track my order?',
        a: 'You can track your order by visiting the "Track Order" section in your dashboard or by using the tracking link sent to your email.',
      },
      {
        q: 'What are the shipping charges?',
        a: 'We offer free delivery on orders over ৳999. For orders below that, a flat shipping fee of ৳60 (Dhaka) or ৳120 (Outside Dhaka) applies.',
      },
    ],
  },
  {
    category: 'Products & Quality',
    questions: [
      {
        q: 'Are your products cruelty-free?',
        a: 'Yes, all Mollari products are 100% cruelty-free and never tested on animals.',
      },
      {
        q: 'Where are your products manufactured?',
        a: 'Our products are formulated with premium ingredients sourced globally and manufactured in state-of-the-art facilities complying with international standards.',
      },
    ],
  },
  {
    category: 'Returns & Refunds',
    questions: [
      {
        q: 'What is your return policy?',
        a: 'We accept returns within 7 days of delivery for unused products in their original packaging. Please check our Returns policy page for more details.',
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-zinc-50 py-16 sm:py-24">
      <div className="mx-auto max-w-4xl px-6 sm:px-10">
        <div className="mb-16 text-center">
          <h1 className="text-4xl font-black tracking-tight text-zinc-900 sm:text-5xl">
            Frequently Asked <span className="text-pink-600">Questions</span>
          </h1>
          <p className="mt-4 text-lg text-zinc-600">
            Everything you need to know about Mollari.
          </p>
        </div>

        <div className="space-y-12">
          {faqs.map((group) => (
            <div key={group.category}>
              <h2 className="mb-6 text-xl font-bold uppercase tracking-widest text-zinc-400">
                {group.category}
              </h2>
              <div className="grid gap-4">
                {group.questions.map((faq, index) => (
                  <details
                    key={index}
                    className="group rounded-2xl border border-zinc-200 bg-white p-6 transition-all duration-300 hover:border-pink-200 open:border-pink-200 open:ring-4 open:ring-pink-50"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between font-bold text-zinc-900">
                      <span className="pr-4">{faq.q}</span>
                      <span className="transition-transform duration-300 group-open:rotate-180">
                        <svg
                          className="h-5 w-5 text-zinc-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="Step 19: 19"
                          />
                        </svg>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                      </span>
                    </summary>
                    <div className="mt-4 text-zinc-600 leading-relaxed">
                      {faq.a}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 rounded-3xl bg-zinc-900 p-8 text-center text-white sm:p-12">
          <h3 className="text-2xl font-bold">Still have questions?</h3>
          <p className="mt-2 text-zinc-400">
            Can&apos;t find the answer you&apos;re looking for? Please chat with our friendly team.
          </p>
          <button className="mt-8 rounded-full bg-pink-600 px-8 py-3 font-bold transition-all hover:bg-pink-700 hover:scale-105 active:scale-95">
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
}
