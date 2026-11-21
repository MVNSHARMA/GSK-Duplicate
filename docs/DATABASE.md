# Database Design

## Architecture

This document defines the initial data architecture for the GSK Automotive Management System and serves as the single source of truth for database design throughout development.

The database is divided into two primary groups.

### Master Collections

- Customers
- Vehicles
- Employees
- Inventory
- Dealer Cars

### Transaction Collections

- Quotes
- Bookings
- Job Cards
- Invoices
- Daily Sales
- Rentals
- Import Tracker

---

# Master Collections

## Customers

Purpose

Maintain permanent customer records and act as the primary contact for workshop operations.

Fields

Identity
- customerId
- firstName
- lastName

Identification
- idType
- idNumber

Contact
- phone
- email

Address
- addressLine
- city
- state

Status
- isActive
- notes

Metadata
- createdAt
- updatedAt

---

## Vehicles

Purpose

Maintain permanent records of serviced vehicles.

Fields

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

---

## Employees

Purpose

Represent authenticated users of the management system.

Fields

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

---

## Inventory

Purpose

Maintain workshop inventory and spare parts.

Fields

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

---

## Dealer Cars

Purpose

Maintain dealership-owned vehicles available for sale or management.

Fields

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

## Version Status

**Version:** 1.0

**Last Updated:** August 2, 2026

The initial database architecture has been completed based on the current business workflow and Figma designs.

This document represents Version 1 of the data model and will evolve as new business requirements and implementation details emerge.