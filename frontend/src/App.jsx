import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Outlet, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';

const AdminLayout = React.lazy(() => import('./components/admin/AdminLayout'));

const Contact = React.lazy(() => import('./pages/Contact'));
const About = React.lazy(() => import('./pages/About'));
const Services = React.lazy(() => import('./pages/Services'));
const RequestQuote = React.lazy(() => import('./pages/RequestQuote'));
const BookService = React.lazy(() => import('./pages/BookService'));
const PinkSlip = React.lazy(() => import('./pages/PinkSlip'));
const Suburbs = React.lazy(() => import('./pages/Suburbs'));

// Auth & Admin imports
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/ui/ToastContext';
import RoleRoute from './components/RoleRoute';
import { hasPageAccess } from './utils/pageAccess';

const AdminIndexRedirect = () => {
  const { user } = useAuth();
  if (user?.role === 'mechanic' && hasPageAccess(user, 'jobCards')) {
    return <Navigate to="job-cards" replace />;
  }
  return <Navigate to="dashboard" replace />;
};

// Public Layout Wrapper
const Login = React.lazy(() => import('./pages/Login'));
const Register = React.lazy(() => import('./pages/Register'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'));
const AcceptInvite = React.lazy(() => import('./pages/AcceptInvite'));
const Dashboard = React.lazy(() => import('./pages/admin/Dashboard'));
const Inventory = React.lazy(() => import('./pages/admin/Inventory'));
const InventoryHierarchyDetail = React.lazy(() => import('./pages/admin/InventoryHierarchyDetail'));
const Customers = React.lazy(() => import('./pages/admin/Customers'));
const CustomerDetail = React.lazy(() => import('./pages/admin/CustomerDetail'));
const Vehicles = React.lazy(() => import('./pages/admin/Vehicles'));
const VehicleDetail = React.lazy(() => import('./pages/admin/VehicleDetail'));
const ImportTrackers = React.lazy(() => import('./pages/admin/ImportTrackers'));
const TrackerDetail = React.lazy(() => import('./pages/admin/TrackerDetail'));
const DailySales = React.lazy(() => import('./pages/admin/DailySales'));
const DealerCars = React.lazy(() => import('./pages/admin/DealerCars'));
const Rentals = React.lazy(() => import('./pages/admin/Rentals'));
const JobCards = React.lazy(() => import('./pages/admin/JobCards'));
const NewJobCard = React.lazy(() => import('./pages/admin/NewJobCard'));
const EditJobCard = React.lazy(() => import('./pages/admin/EditJobCard'));
const Invoices = React.lazy(() => import('./pages/admin/Invoices'));
const InvoicePrint = React.lazy(() => import('./pages/admin/InvoicePrint'));
const Employees = React.lazy(() => import('./pages/admin/Employees'));
const Trash = React.lazy(() => import('./pages/admin/Trash'));
const Settings = React.lazy(() => import('./pages/admin/Settings'));
const Communications = React.lazy(() => import('./pages/admin/Communications'));
const BookingSlots = React.lazy(() => import('./pages/admin/BookingSlots'));
const Suppliers = React.lazy(() => import('./pages/admin/Suppliers'));
const PurchaseOrders = React.lazy(() => import('./pages/admin/PurchaseOrders'));
const PurchaseOrderDetail = React.lazy(() => import('./pages/admin/PurchaseOrderDetail'));
const AuditLogs = React.lazy(() => import('./pages/admin/AuditLogs'));
const RegularCustomers = React.lazy(() => import('./pages/admin/RegularCustomers'));
const CustomerLayout = React.lazy(() => import('./components/customer/CustomerLayout'));
const CustomerDashboard = React.lazy(() => import('./pages/customer/CustomerDashboard'));
const CustomerVehicles = React.lazy(() => import('./pages/customer/CustomerVehicles'));
const CustomerJobCards = React.lazy(() => import('./pages/customer/CustomerJobCards'));
const CustomerInvoices = React.lazy(() => import('./pages/customer/CustomerInvoices'));
const CustomerBookings = React.lazy(() => import('./pages/customer/CustomerBookings'));
const CustomerServiceHistory = React.lazy(() => import('./pages/customer/CustomerServiceHistory'));
const CustomerJobCardDetail = React.lazy(() => import('./pages/customer/CustomerJobCardDetail'));

// Public Layout Wrapper
const PublicLayout = () => {
  return (
    <div className="App flex flex-col min-h-screen bg-white">
      <Navbar />
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
};

const AnimatedRoutes = () => {
  const location = useLocation();
  
  return (
      <React.Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-gray-50"><div className="w-10 h-10 border-4 border-red-200 border-t-red-600 rounded-full animate-spin"></div></div>}>
      <Routes location={location} key="main-routes">
        
        {/* Public Routes with Navbar/Footer */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/services" element={<Services />} />
          <Route path="/request-quote" element={<RequestQuote />} />
          <Route path="/book-service" element={<BookService />} />
          <Route path="/pink-slip" element={<PinkSlip />} />
          <Route path="/suburbs" element={<Suburbs />} />
        </Route>

        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:resettoken" element={<ResetPassword />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />

        {/* Admin Routes (Protected, No Navbar/Footer) */}
        <Route path="/admin/invoices/:id/print" element={
          <RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="invoices">
            <InvoicePrint />
          </RoleRoute>
        } />

        <Route path="/admin" element={
          <RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']}>
            <AdminLayout />
          </RoleRoute>
        }>
          <Route index element={<AdminIndexRedirect />} />
          <Route path="dashboard" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="dashboard"><Dashboard /></RoleRoute>} />
          <Route path="communications" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="communications"><Communications /></RoleRoute>} />
          <Route path="booking-slots" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="bookingSlots"><BookingSlots /></RoleRoute>} />
          <Route path="inventory" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="inventory"><Inventory /></RoleRoute>} />
          <Route path="inventory/:id" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="inventory"><InventoryHierarchyDetail /></RoleRoute>} />
          <Route path="inventory/:id/variants/:variantId" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="inventory"><InventoryHierarchyDetail /></RoleRoute>} />
          <Route path="inventory/:id/variants/:variantId/sub-variants/:subVariantId" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="inventory"><InventoryHierarchyDetail /></RoleRoute>} />
          <Route path="inventory/:id/variants/:variantId/sub-variants/:subVariantId/sub-sub-variants/:subSubVariantId" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="inventory"><InventoryHierarchyDetail /></RoleRoute>} />
          <Route path="customers" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="customers"><Customers /></RoleRoute>} />
          <Route path="customers/:id" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="customers"><CustomerDetail /></RoleRoute>} />
          <Route path="vehicles" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="vehicles"><Vehicles /></RoleRoute>} />
          <Route path="vehicles/:id" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="vehicles"><VehicleDetail /></RoleRoute>} />
          <Route path="suppliers" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="suppliers"><Suppliers /></RoleRoute>} />
          <Route path="purchase-orders" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="purchaseOrders"><PurchaseOrders /></RoleRoute>} />
          <Route path="purchase-orders/:id" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="purchaseOrders"><PurchaseOrderDetail /></RoleRoute>} />
          
          {/* Restricted Routes */}
          <Route path="import-trackers" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="importTrackers"><ImportTrackers /></RoleRoute>} />
          <Route path="import-trackers/:id" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="importTrackers"><TrackerDetail /></RoleRoute>} />
          <Route path="daily-sales" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="dailySales"><DailySales /></RoleRoute>} />
          <Route path="dealer-cars" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="dealerCars"><DealerCars /></RoleRoute>} />
          <Route path="rentals" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="rentals"><Rentals /></RoleRoute>} />
          <Route path="regular-customers" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="regularCustomers"><RegularCustomers /></RoleRoute>} />
          
          {/* Mechanic Accessible */}
          <Route path="job-cards" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="jobCards"><JobCards /></RoleRoute>} />
          <Route path="job-cards/new" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="jobCards" actionKey="jobCards.create"><NewJobCard /></RoleRoute>} />
          <Route path="job-cards/:id/edit" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="jobCards" actionKey="jobCards.edit"><EditJobCard /></RoleRoute>} />
          
          {/* Restricted Routes */}
          <Route path="invoices" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="invoices"><Invoices /></RoleRoute>} />
          <Route path="settings" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="settings"><Settings /></RoleRoute>} />
          <Route path="audit-logs" element={<RoleRoute allowedRoles={['admin', 'super_admin']} pageKey="auditLogs"><AuditLogs /></RoleRoute>} />
          
          <Route path="trash" element={
            <RoleRoute allowedRoles={['admin', 'super_admin', 'mechanic']} pageKey="trash">
              <Trash />
            </RoleRoute>
          } />

          {/* Super Admin Only Routes */}
          <Route path="employees" element={
            <RoleRoute allowedRoles={['admin', 'super_admin']} pageKey="employees">
              <Employees />
            </RoleRoute>
          } />
          
          {/* Add more admin routes here later */}
        </Route>

        {/* Customer Portal Routes */}
        <Route path="/customer" element={
          <RoleRoute allowedRoles={['user']}>
            <CustomerLayout />
          </RoleRoute>
        }>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<CustomerDashboard />} />
          <Route path="vehicles" element={<CustomerVehicles />} />
          <Route path="job-cards" element={<RoleRoute allowedRoles={['user']}><CustomerJobCards /></RoleRoute>} />
          <Route path="job-cards/:id" element={<RoleRoute allowedRoles={['user']}><CustomerJobCardDetail /></RoleRoute>} />
          <Route path="invoices" element={<RoleRoute allowedRoles={['user']}><CustomerInvoices /></RoleRoute>} />
          <Route path="bookings" element={<RoleRoute allowedRoles={['user']}><CustomerBookings /></RoleRoute>} />
          <Route path="service-history" element={<RoleRoute allowedRoles={['user']}><CustomerServiceHistory /></RoleRoute>} />
        </Route>

      </Routes>
      </React.Suspense>
  );
};

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Router>
          <ScrollToTop />
          <ErrorBoundary>
            <AnimatedRoutes />
          </ErrorBoundary>
        </Router>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;