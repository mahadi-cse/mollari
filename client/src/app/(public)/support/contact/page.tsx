import React from 'react';
import { Metadata } from 'next';
import { Mail, Phone, MapPin, MessageSquare, Send } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact Us | Mollari',
  description: 'Get in touch with Mollari for any inquiries, support, or feedback.',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header Section */}
      <div className="bg-zinc-900 py-20 sm:py-32 text-center text-white px-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
            Let&apos;s <span className="text-pink-500">Connect</span>
          </h1>
          <p className="mt-6 text-lg text-zinc-400">
            Have a question about our products or need help with an order? Our beauty experts are here for you.
          </p>
        </div>
      </div>

      <div className="mx-auto -mt-16 max-w-7xl px-6 pb-24 sm:px-10">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Contact Info Cards */}
          <div className="space-y-4">
            <div className="rounded-3xl bg-white p-8 shadow-sm border border-zinc-100 transition-all hover:shadow-md">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-50 text-pink-600">
                <Phone size={24} />
              </div>
              <h3 className="text-lg font-bold text-zinc-900">Call Us</h3>
              <p className="mt-2 text-zinc-600">Mon-Fri from 9am to 6pm.</p>
              <p className="mt-4 font-bold text-pink-600">+880 1XXX-XXXXXX</p>
            </div>

            <div className="rounded-3xl bg-white p-8 shadow-sm border border-zinc-100 transition-all hover:shadow-md">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Mail size={24} />
              </div>
              <h3 className="text-lg font-bold text-zinc-900">Email Us</h3>
              <p className="mt-2 text-zinc-600">We respond within 24 hours.</p>
              <p className="mt-4 font-bold text-blue-600">support@mollari.com</p>
            </div>

            <div className="rounded-3xl bg-white p-8 shadow-sm border border-zinc-100 transition-all hover:shadow-md">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
                <MapPin size={24} />
              </div>
              <h3 className="text-lg font-bold text-zinc-900">Visit Us</h3>
              <p className="mt-2 text-zinc-600">Our flagship store in Dhaka.</p>
              <p className="mt-4 font-bold text-zinc-900 leading-tight">
                House 123, Road 45, Gulshan,<br />
                Dhaka 1212, Bangladesh
              </p>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="rounded-[2.5rem] bg-white p-8 sm:p-12 shadow-xl border border-zinc-100">
              <h2 className="text-3xl font-bold text-zinc-900 flex items-center gap-3 mb-8">
                <MessageSquare className="text-pink-600" />
                Send a Message
              </h2>

              <form className="grid gap-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-zinc-700">Full Name</label>
                    <input
                      type="text"
                      className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 outline-none transition focus:border-pink-500 focus:ring-4 focus:ring-pink-50"
                      placeholder="Enter your name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-zinc-700">Email Address</label>
                    <input
                      type="email"
                      className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 outline-none transition focus:border-pink-500 focus:ring-4 focus:ring-pink-50"
                      placeholder="email@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700">Subject</label>
                  <select className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 outline-none transition focus:border-pink-500 focus:ring-4 focus:ring-pink-50 appearance-none">
                    <option>Product Inquiry</option>
                    <option>Order Support</option>
                    <option>Business Partnership</option>
                    <option>Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700">Message</label>
                  <textarea
                    rows={5}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 outline-none transition focus:border-pink-500 focus:ring-4 focus:ring-pink-50"
                    placeholder="How can we help you?"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  className="mt-4 flex items-center justify-center gap-3 rounded-2xl bg-zinc-900 py-5 text-lg font-bold text-white transition hover:bg-pink-600 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Send size={20} />
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
