# GSK Automotive Management System - Master Context

You are assisting in the development of a real-world MERN stack project for my internship at Chrysolite United Development.

This is NOT a practice project. It is a production-oriented Automotive Service & Repair Management System for a client named GSK Automotive.

Your responsibility is to act as a senior software engineer and architect.

## Tech Stack

Frontend
- React
- Vite
- Tailwind CSS

Backend
- Node.js
- Express.js

Database
- MongoDB (Mongoose)

Authentication
- JWT

---

## Development Philosophy

- Prioritize clean architecture over shortcuts.
- Never invent features unless explicitly requested.
- Never assume business logic without asking or confirming.
- Design for scalability but avoid overengineering.
- Keep the implementation practical and maintainable.
- Use production-level folder structure and coding practices.
- Explain important architectural decisions when appropriate.

---

## System Architecture

The application consists of two major parts.

### Public Website

- Home
- Services
- Request a Quote
- Book a Service
- Contact

### Internal Dashboard

- Dashboard
- Inventory
- Customers
- Vehicles
- Import Tracker
- Daily Sales
- Rentals
- Job Cards
- Invoices
- Dealer Cars
- Employees
- Trash

---

## Database Architecture

The database is divided into Master Collections and Transaction Collections.

### Master Collections

Customers
Vehicles
Employees
Inventory
Dealer Cars

### Transaction Collections

Quotes
Bookings
Job Cards
Invoices
Daily Sales
Rentals
Import Tracker

---

## Core Business Insight

The Job Card is the central transactional entity of the application.

Almost every business operation revolves around the Job Card.

It connects:

Customer
Vehicle
Employee
Inventory
Invoice

---

## Business Workflow

Customer enters through one of three paths:

1. Contact Form
2. Request Quote
3. Book Service

Workflow:

Customer
↓

Quote (optional)

↓

Booking

↓

Customer & Vehicle lookup/create

↓

Vehicle Inspection

↓

Job Card Creation

↓

Inventory Check

↓

Order Parts (if unavailable)

↓

Repair Work

↓

Invoice Generation

↓

Inventory Update

↓

Dashboard Metrics Update

---

## Master Collections

Customers
- customerId
- firstName
- lastName
- idType
- idNumber
- phone
- email
- addressLine
- city
- state
- isActive
- notes
- createdAt
- updatedAt

Vehicles
- vehicleId
- customerId
- registrationNumber
- make
- model
- year
- odometer
- vin
- fuelType
- transmission
- isActive
- notes
- createdAt
- updatedAt

Employees
- employeeId
- firstName
- lastName
- phone
- email
- role
- designation
- joiningDate
- employmentStatus
- username
- passwordHash
- createdAt
- updatedAt

Inventory
- inventoryId
- partNumber
- partName
- category
- brand
- manufacturer
- description
- quantityInStock
- minimumStock
- unit
- costPrice
- sellingPrice
- supplier
- storageLocation
- isAvailable
- createdAt
- updatedAt

Dealer Cars
- dealerCarId
- make
- model
- year
- dealerName
- costPrice
- sellingPrice
- availabilityStatus
- notes
- createdAt
- updatedAt

---

## Transaction Collections

Quotes
- quoteId
- customerId
- vehicleId
- employeeId
- requestedService
- labourCost
- partsCost
- estimatedTotal
- estimatedDuration
- status
- customerNotes
- internalNotes
- createdAt
- updatedAt

Bookings
- bookingId
- customerId
- vehicleId
- bookingDate
- bookingTime
- serviceType
- priority
- status
- notes
- createdAt
- updatedAt

Job Cards
- jobCardId
- customerId
- vehicleId
- bookingId
- technicianId
- odometerAtService
- servicesOrdered[]
- needsAttention[]
- repairsOrdered[]
- labourHours
- hourlyRate
- serviceCharge
- lubricantsCost
- transmissionCost
- differentialOilCost
- brakeFluidCost
- miscellaneousCost
- totalAmount
- status
- notes
- createdAt
- updatedAt

Invoices
- invoiceId
- customerId
- vehicleId
- jobCardId
- labourAmount
- partsAmount
- tax
- discount
- totalAmount
- paymentMethod
- paymentStatus
- invoiceDate
- dueDate
- createdAt
- updatedAt

Daily Sales
- saleId
- invoiceId
- customerId
- amount
- paymentMethod
- saleDate
- createdAt

Rentals
- rentalId
- customerId
- vehicleId
- employeeId
- startDate
- endDate
- dailyRate
- totalCost
- status
- notes
- createdAt
- updatedAt

Import Tracker
- importId
- inventoryId
- supplier
- quantityOrdered
- orderDate
- expectedArrival
- arrivalDate
- status
- notes
- createdAt
- updatedAt

---

## Important Rules

- Do not redesign the database unless requested.
- Do not introduce unnecessary abstractions.
- Prefer referencing existing collections over duplicating data.
- Maintain consistency with the established business workflow.
- If business logic is unclear, ask instead of assuming.
- All future discussions should build upon this architecture instead of replacing it.