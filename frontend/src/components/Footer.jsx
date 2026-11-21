import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Mail, Phone, PhoneCall, MailIcon } from 'lucide-react';
import { FaFacebook, FaInstagram } from 'react-icons/fa';
import { OFFICIAL_BUSINESS_ADDRESS, OFFICIAL_BUSINESS_PHONE, OFFICIAL_BUSINESS_PHONE_TEL } from '../config/businessInfo';

const Footer = () => {
  return (
    <footer className="bg-white border-t border-gray-200 pt-16 pb-8">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          
          {/* Column 1: Logo & Socials */}
          <div className="flex flex-col items-start gap-6">
            <img src="/Logo.png" alt="GSK Automotive" className="h-20 object-contain" />
            <div className="flex gap-4">
              <a href="https://www.facebook.com/profile.php?id=61562431613338" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-gray-700 hover:text-primary hover:border-primary transition-colors">
                <FaFacebook size={18} />
              </a>
              <a href="https://www.instagram.com/gsk_automotive/?hl=en" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-gray-700 hover:text-primary hover:border-primary transition-colors">
                <FaInstagram size={18} />
              </a>
              <a href="#" className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-gray-700 hover:text-primary hover:border-primary transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" /></svg>
              </a>
              <a href="#" className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-gray-700 hover:text-primary hover:border-primary transition-colors">
                <Mail size={18} />
              </a>
            </div>
          </div>

          {/* Column 2: Get In Touch */}
          <div>
            <h4 className="font-heading text-xl tracking-wide mb-6">
              GET IN <span className="text-primary">TOUCH</span>
            </h4>
            <ul className="space-y-4">
              <li className="flex gap-3 text-sm text-gray-600">
                <MapPin className="text-primary shrink-0" size={18} />
                <span>{OFFICIAL_BUSINESS_ADDRESS}</span>
              </li>
              <li className="flex gap-3 text-sm text-gray-600 items-center">
                <MailIcon className="text-primary shrink-0" size={18} />
                <a href="mailto:gsksevenhill@gmail.com" className="hover:text-primary transition-colors">gsksevenhill@gmail.com</a>
              </li>
              <li className="flex gap-3 text-sm text-gray-600 items-center">
                <PhoneCall className="text-primary shrink-0" size={18} />
                <a href={OFFICIAL_BUSINESS_PHONE_TEL} className="hover:text-primary transition-colors">{OFFICIAL_BUSINESS_PHONE}</a>
              </li>
              <li className="flex gap-3 text-sm text-gray-600 items-center">
                <Phone className="text-primary shrink-0" size={18} />
                <a href="tel:0410433851" className="hover:text-primary transition-colors">0410 433 851</a>
              </li>
            </ul>
          </div>

          {/* Column 3: Our Services (Left) */}
          <div>
            <h4 className="font-heading text-xl tracking-wide mb-6">
              OUR <span className="text-primary">SERVICES</span>
            </h4>
            <ul className="space-y-3">
              {[
                'All Mechanical Repairs',
                'Log Book Service',
                'Pre Purchase Inspection',
                'Batteries and Starters'
              ].map(service => (
                <li key={service} className="flex gap-2 text-sm text-gray-600 items-center">
                  <span className="text-primary font-bold text-xs">&raquo;</span>
                  <Link to="/services" className="hover:text-primary transition-colors">{service}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Our Services (Right) */}
          <div className="lg:mt-[52px]">
            <ul className="space-y-3">
              {[
                'Basic Oil Service',
                'Brakes & Clutch Repairs',
                'Wheels & Tyres',
                'Fuel System'
              ].map(service => (
                <li key={service} className="flex gap-2 text-sm text-gray-600 items-center">
                  <span className="text-primary font-bold text-xs">&raquo;</span>
                  <Link to="/services" className="hover:text-primary transition-colors">{service}</Link>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </footer>
  );
};

export default Footer;