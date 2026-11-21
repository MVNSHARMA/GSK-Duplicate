# Phase 16 Implementation Plan

## Root Cause Analysis
The "sidebar overlapping the form" issue is caused by the Create Purchase Order form being implemented as a full-screen Modal (`fixed inset-0 z-50`) while the global `AdminSidebar` has a higher `z-index` (`z-[70]`). Because it's a fixed modal, it escapes the standard `<main>` layout container and centers itself on the entire viewport, ignoring the 240px sidebar offset. On large screens, this causes the wide modal (`max-w-4xl`) to be physically covered on its left side by the permanent desktop sidebar.

## Proposed Changes

### 1. Refactor Purchase Order Creation into a Page-like View
Instead of a giant modal, the PO Creation form will be refactored into a standard inline view within `PurchaseOrders.jsx` (or a dedicated route). Since the user wants "<- Back to Purchase Orders", I will implement it as a conditional render view within `PurchaseOrders.jsx` to keep all existing state logic intact without creating new routes, matching the requested layout:

- `if (view === 'create') return <CreatePurchaseOrderView />`
- `if (view === 'list') return <PurchaseOrderList />`

This will natively place the form inside the `<main>` container, automatically fixing the sidebar overlap since the main container has `lg:pl-[240px]` applied.

### 2. Form UI/UX Improvements
I will restructure the PO creation form into the requested professional sections:
- **Header**: "<- Back to Purchase Orders" button and titles.
- **Supplier Information**: Using the existing `EntityAutocomplete`.
- **Order Items**: Using an improved horizontal layout or grid for adding variants, keeping `inventoryId + variantId` logic untouched.
- **Order Summary**: Subtotal calculation and clearly labeled Purchase Price.
- **Submission**: Clear "Cancel" and "Create Purchase Order" footer buttons.

### 3. Responsive Adjustments
- The grid for adding items will be tweaked for tablet/mobile.
- PO Items list will use a responsive table with controlled `overflow-x-auto`.
- No absolute or fixed positioning will be used for the form container, guaranteeing it never conflicts with the sidebar again.

### 4. Admin Sidebar Global Fix (Optional but Recommended)
To prevent future modals from experiencing this overlap, I will also adjust `AdminSidebar.jsx` so its desktop `z-index` is `40` (`z-[70] lg:z-40`), allowing `z-50` modals across the app to center properly.

## User Review Required
Does this architectural shift from Modal to an inline Page View (within `PurchaseOrders.jsx`) align with your vision for the Create PO screen?
