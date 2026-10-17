# Mollari - Client Application

> A modern, scalable e-commerce frontend built with **Next.js 16**, **React 19**, and **TypeScript**. 

## 📖 Documentation

**For comprehensive architecture, project details, and development guides, see [PROJECT_README.md](./PROJECT_README.md)**

---

## 🚀 Quick Start

### Installation

```bash
npm install --legacy-peer-deps
```

### Development Server

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) to view the application.

### Commands

```bash
npm run dev       # Start dev server (Turbopack)
npm run build     # Production build
npm start         # Run production server
npm test          # Run tests
npm run lint      # Code linting
npm run typecheck # Type checking
```

---

## 📁 Project Structure

```
src/
├── app/              # Next.js App Router with route groups
├── features/         # Feature modules (products, orders, etc.)
├── entities/         # Domain types
├── shared/           # Types, constants, utilities, components
└── components/       # Reusable components
```

---

## 🏗️ Architecture

**Module-Based Architecture** with feature isolation:

- Each feature has its own API client, queries, and mutations
- Centralized type system in `src/shared/types/`
- Global constants and utilities in `src/shared/`
- React Query for server state management
- Axios interceptors for API error handling

📘 **See [PROJECT_README.md](./PROJECT_README.md) for detailed architecture documentation**

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16.2.2
- **Runtime**: React 19.2.4
- **Language**: TypeScript 5
- **State**: React Query 5.96.2
- **HTTP**: Axios 1.14.0
- **Styling**: Tailwind CSS 4
- **Testing**: Jest + Vitest + React Testing Library
- **Build**: Turbopack

---

## ✨ Features

✅ Module-based architecture
✅ Type-safe development
✅ React Query with automatic caching
✅ Comprehensive error handling
✅ Skeleton loaders & loading states
✅ Responsive design (Tailwind CSS)
✅ Testing infrastructure configured
✅ Production-ready

---

## 📚 Additional Resources

- [Complete Documentation](./PROJECT_README.md) - Full architecture guide
- [Next.js Docs](https://nextjs.org/docs)
- [React Docs](https://react.dev)
- [React Query](https://tanstack.com/query/latest)
- [TypeScript](https://www.typescriptlang.org/)

---

**Last Updated**: April 10, 2026
**Node Version**: 18+ or 20+
**Package Manager**: npm 9+

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
