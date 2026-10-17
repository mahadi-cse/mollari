# Mollari Platform

Mollari is a comprehensive e-commerce and inventory management platform designed to handle online sales, POS operations, and multi-branch inventory logistics.

## 🌟 Key Features

- **E-Commerce Storefront**: Beautiful, responsive UI built with Next.js and Tailwind CSS.
- **Order Management**: End-to-end order tracking from placement to delivery, including returns and refunds.
- **Inventory & Multi-Branch Management**: Track stock levels across different warehouses and retail branches. Includes stock transfers and supplier transaction tracking.
- **Point of Sale (POS)**: Manual sales and return processing for staff.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions for different user types (Customers, Admin, Staff).

## 🏗️ Architecture

Below is the high-level architecture diagram of the Mollari platform:

```mermaid
flowchart TD
    %% Styles
    classDef normalStyle stroke:#4f46e5,stroke-width:2px,fill:#e0e7ff,color:#1e1b4b
    classDef successStyle stroke:#10b981,stroke-width:2px,fill:#d1fae5,color:#064e3b
    classDef errStyle stroke:#f59e0b,stroke-width:2px,fill:#fef3c7,color:#78350f
    classDef bugStyle stroke:#ff4444,stroke-width:2px,fill:#ffebeb,color:#7f1d1d

    Users(("👥 Users"))

    subgraph Client ["🖥️ Frontend"]
        Next["Next.js App \n (React Query, NextAuth)"]
    end

    subgraph Backend ["⚙️ Backend & Security"]
        API["Express API Gateway \n (Helmet, Rate Limit)"]
        Services["Domain Services \n (Orders, POS, Inventory)"]
        Jobs["Background Jobs \n (Node-Cron)"]
    end

    subgraph Data ["🗄️ Data & External"]
        DB[("PostgreSQL \n + Prisma")]
        Redis[("Redis Cache")]
        Cloud["Cloudinary CDN"]
    end

    %% Flow
    Users -->|HTTPS| Next
    Next <-->|REST API| API
    API --> Services
    Services <--> DB
    Services <--> Redis
    Services <--> Cloud
    Jobs <--> DB

    %% Apply Classes
    class Users normalStyle
    class Next normalStyle
    class API,Services,Jobs successStyle
    class DB,Redis errStyle
    class Cloud bugStyle
```

## 📁 Folder Structure

The project uses a monorepo setup with a highly modularized, domain-driven architecture for both the frontend and backend.

```text
Mollari/
├── client/                     # Next.js Frontend
│   ├── src/
│   │   ├── app/                # Next.js App Router (Pages & Layouts)
│   │   ├── modules/            # Domain-driven feature modules
│   │   │   ├── auth/           # Authentication UI & Logic
│   │   │   ├── cart/           # Shopping Cart & Checkout
│   │   │   ├── dashboard/      # Admin & Staff Dashboard
│   │   │   ├── products/       # Product Catalog
│   │   │   └── ...             # (categories, orders, inventory, etc.)
│   │   ├── shared/             # Shared components, hooks, and contexts
│   │   └── auth.ts             # NextAuth.js Configuration
│   └── package.json
│
├── server/                     # Node.js + Express Backend
│   ├── prisma/                 # Database schema and migrations
│   ├── src/
│   │   ├── config/             # App Configurations
│   │   ├── middleware/         # Express Middlewares (Auth, Error Handling)
│   │   ├── modules/            # Domain-driven feature modules
│   │   │   ├── auth/           # Authentication Controllers & Services
│   │   │   ├── orders/         # Order Management Logic
│   │   │   ├── inventory/      # Stock & Warehouse Logic
│   │   │   └── ...             # (products, analytics, customers, etc.)
│   │   ├── shared/             # Shared utilities (errors, validations)
│   │   └── app.ts              # Express App Entry
│   └── package.json
└── README.md
```

## 🛠️ Technology Stack

### Client (Frontend)
- **Framework**: Next.js 16
- **Styling**: Tailwind CSS v4
- **State Management / Data Fetching**: React Query
- **Animations**: Framer Motion
- **UI Components**: Lucide React, Recharts, SweetAlert2

### Server (Backend)
- **Runtime**: Node.js 20.x
- **Framework**: Express.js
- **Database ORM**: Prisma ORM
- **Database Engine**: PostgreSQL
- **Caching**: Redis
- **Authentication**: NextAuth.js (v5)
- **Media**: Cloudinary
- **Security**: Helmet, Express Rate Limit, CORS

## 🚀 Getting Started

### Prerequisites

- Node.js (v20+)
- PostgreSQL
- Redis Server
- Cloudinary Account (for media uploads)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd "Mollari"
   ```

2. **Setup Backend:**
   ```bash
   cd server
   npm install
   # Create a .env file based on .env.example
   
   # Run migrations and seed database
   npm run db:migrate
   npm run db:seed
   
   # Start the development server
   npm run dev
   ```

3. **Setup Frontend:**
   ```bash
   cd ../client
   npm install
   # Create a .env.local file with necessary frontend variables
   
   # Start the frontend app
   npm run dev
   ```

## 📝 License

This project is licensed under the MIT License.
