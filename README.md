# GSK Automotive - Full Stack Application


This repository contains the full-stack web application for **GSK Automotive**, a premium auto service and repair center located in Sydney. 
The project includes a visually stunning, responsive React frontend and a robust Node.js/Express backend API connected to a MongoDB database.






## Project Structure










The repository is structured as a monorepo with two main directories:

- `/frontend` - The React application built with Vite and Tailwind CSS.
- `/backend` - The Node.js and Express API server.
- `/docs` - Contains provided assets, branding images, and initial design requirements.

## 1. Frontend (React + Vite)


The frontend is a modern single-page application built to match premium design specifications. It focuses on a smooth user experience, dynamic micro-animations (Framer Motion), and responsive layouts.

### Key Pages Developed:
- **Home / Landing Page** (`/`): Features a dynamic Hero section, About Us, Services overview, and quick links.
- **Contact Us** (`/contact`): Integrated contact form with success/error handling.
- **Services** (`/services`): Detailed breakdown of all automotive services offered, including a consumer guide.
- **Request a Quote** (`/request-quote`): A structured intake form allowing customers to describe their vehicle and issues for an estimate.
- **Book a Service** (`/book-service`): A complex, multi-step booking form capturing customer details, vehicle specs, desired services, and preferred appointment times.
- **Pink Slip** (`/pink-slip`): Information on NSW eSafety checks.
- **Suburbs** (`/suburbs`): Service area details.

### Frontend Setup & Execution
```bash
cd frontend
npm install
npm run dev
```
*The frontend typically runs on `http://localhost:5173`.*

## 2. Backend (Node.js + Express)

The backend is an Express API that handles all incoming form submissions from the frontend, processing the data and securely storing it in a MongoDB database using Mongoose models.

### Key Features:
- **RESTful API Architecture:** Clear routing under `/api/intake/...`.
- **Database Resilience:** Configured to fall back to an in-memory MongoDB instance (`mongodb-memory-server`) during local development if a cloud MongoDB URI is not provided in the environment variables.
- **Relational Data Parsing:** Intelligent controllers that capture nested JSON payloads for `Booking` or `Quote` documents. The system performs soft matching to existing Customers and Vehicles without auto-creating persistent records prematurely.

### API Endpoints:
- `POST /api/intake/contact` - Submits a general contact inquiry.
- `POST /api/intake/quote` - Submits a detailed quote request.
- `POST /api/intake/book` - Submits a comprehensive service booking.

### Backend Setup & Execution
```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory with the following variables:
```env
PORT=5001
NODE_ENV=development

# MongoDB Atlas Connection String
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/?appName=GSKAutomotive

# Cloudinary Configuration (For future image uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Start the development server:
```bash
npm run dev
```
*Note: The backend is configured to run on port `5001` (to avoid macOS Control Center conflicts on port 5000).*

## 3. Admin Dashboard (Internal Portal)

The application includes a fully featured internal portal secured by Role-Based Access Control (RBAC). Only authenticated users with `admin` or `super_admin` roles can access these routes.

### Modules Implemented:
- **Dashboard (`/admin/dashboard`)**: High-level overview of daily sales, low stock alerts, and quick actions.
- **Inventory (`/admin/inventory`)**: Manage stock levels, pricing, and automated low-stock warnings.
- **Customers (`/admin/customers`)**: Centralized CRM for tracking customer details and history.
- **Vehicles (`/admin/vehicles`)**: Track customer vehicles linked via reference IDs. Features an intelligent 3-step wizard that allows Admins to seamlessly convert incoming Service Requests (Bookings/Quotes) into persistent Vehicle records while preventing duplicates.
- **Import Trackers (`/admin/import-trackers`)**: Track incoming vehicle shipments and their current statuses.
- **Daily Sales (`/admin/daily-sales`)**: Point-of-Sale module for daily transactions, auto-deducting from inventory.
- **Dealer Cars (`/admin/dealer-cars`)**: Manage cars bought and sold by the dealership, calculating profit margins.
- **Rentals (`/admin/rentals`)**: Manage rental fleet availability, tracking active rentals vs available vehicles.
- **Job Cards (`/admin/job-cards`)**: Comprehensive mechanic job cards tracking labour hours, parts used, and live totals.
- **Invoices (`/admin/invoices`)**: Advanced modal-in-modal invoice generator handling custom parts, checklists, and recommendations.

## Status & Next Steps

**Current Status:** The public-facing website, the integration with the backend API, and the comprehensive **Admin Dashboard** are **100% complete**.  

**Upcoming Enhancements:**
1. **Automated Notifications:** Integrating `Nodemailer` for email triggers upon successful form submissions and invoice generation.
2. **General Settings:** Finalizing the admin settings page for dynamic business configuration.
3. **Production Deployment:** Prepping environment variables and deploying to Vercel/Render.           
