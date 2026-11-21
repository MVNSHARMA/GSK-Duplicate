import React, { useState } from 'react';
import { Phone, Mail, MapPin, Users } from 'lucide-react';
import { FaFacebook, FaInstagram, FaTwitter } from 'react-icons/fa';
import PageWrapper from '../components/PageWrapper';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/ToastContext';
import { OFFICIAL_BUSINESS_ADDRESS, OFFICIAL_GOOGLE_MAPS_EMBED_URL } from '../config/businessInfo';

const Contact = () => {
  const toast = useToast();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [status, setStatus] = useState({ loading: false, success: false, message: '' });

  const { token } = useAuth();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setStatus({ loading: true, success: false, message: '' });
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(`${import.meta.env.VITE_API_URL}/intake/contact`, {
        method: 'POST',
        headers,
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (response.ok) {
        setStatus({ loading: false, success: true, message: 'Message sent successfully! We will contact you soon.' });
        setTimeout(() => {
          setFormData({ firstName: '', lastName: '', email: '', phone: '', subject: '', message: '' });
        }, 4000);
      } else {
        setStatus({ loading: false, success: false, message: '' });
        toast.error(data.error || 'Failed to send message.');
      }
    } catch (error) {
      setStatus({ loading: false, success: false, message: '' });
      toast.error('Server error. Please try again later.');
    }
  };

  return (
    <PageWrapper className="min-h-screen pt-24">
      {/* Hero Section */}
      <section className="relative w-full flex items-end md:items-center bg-[#111] overflow-hidden" style={{ minHeight: '70vh' }}>
        <img 
          src="/Contact-us.webp" 
          alt="Contact GSK Automotive" 
          className="absolute inset-0 w-full h-full object-cover z-0 object-[80%_center] md:object-[85%_center] lg:object-[85%_center]" 
          loading="eager"
          fetchPriority="high"
        />
        {/* Desktop: left-side gradient for text readability */}
        <div 
          className="absolute inset-0 z-[1] pointer-events-none hidden md:block" 
          style={{ backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.3) 35%, transparent 70%)' }}
        ></div>
        {/* Mobile: subtle bottom gradient only behind text area */}
        <div 
          className="absolute inset-0 z-[1] pointer-events-none block md:hidden" 
          style={{ backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.05) 75%, transparent 100%)' }}
        ></div>
        
        <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 md:px-12 lg:px-20 py-12 md:py-20">
          <div style={{ maxWidth: '650px' }}>
            <h1 
              className="font-heading text-white tracking-wide mb-4 md:mb-6 leading-tight drop-shadow-lg"
              style={{ fontSize: 'clamp(2.5rem, 6vw + 1rem, 5.5rem)' }}
            >
              <span className="text-primary">CONTACT</span> US
            </h1>
            <p className="text-gray-200 text-base md:text-xl leading-relaxed mb-8 md:mb-10 drop-shadow-md">
              Get in touch with our team of expert mechanics for trusted advice and premium care for your vehicle.
            </p>
            <a 
              href="tel:0410433851" 
              className="inline-flex items-center justify-center gap-3 bg-primary text-white font-bold text-base md:text-lg px-8 md:px-10 py-3.5 md:py-4 rounded-lg hover:bg-[#a80d26] transition-all shadow-lg hover:shadow-primary/30 hover:-translate-y-1 tracking-wide"
            >
              <Phone size={24} />
              Call Now: 0410 433 851
            </a>
          </div>
        </div>
      </section>

      {/* Main Content Section */}
      <section className="py-20 lg:py-28 bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 lg:px-20 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
          
          {/* Left: Get in Touch Cards (5 columns) */}
          <div className="lg:col-span-5">
            <p className="text-primary font-bold text-sm uppercase tracking-[3px] mb-4">REACH OUT</p>
            <h2 className="font-heading text-4xl sm:text-5xl md:text-6xl mb-8 leading-[1.15] text-dark">GET IN <span className="text-primary">TOUCH</span></h2>
            <div className="w-24 h-1.5 bg-primary mb-12 rounded-full"></div>

            <div className="space-y-6">
              {[
                { icon: Phone, title: "Phone No.", text: "0410 433 851" },
                { icon: Mail, title: "Mail", text: "gsksevenhill@gmail.com" },
                { icon: MapPin, title: "Location", text: OFFICIAL_BUSINESS_ADDRESS }
              ].map((card, idx) => (
                <div key={idx} className="bg-white p-6 md:p-8 rounded-2xl border border-gray-100 flex items-center gap-6 shadow-sm hover:shadow-xl transition-all duration-300 group cursor-pointer hover:-translate-y-1">
                  <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center shrink-0 group-hover:bg-primary transition-colors duration-300 shadow-inner">
                    <card.icon className="text-primary group-hover:text-white stroke-[1.5] transition-colors duration-300" size={28} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <h4 className="font-bold text-dark text-lg tracking-wide">{card.title}</h4>
                    <p className="text-gray-600 font-medium text-[15px]">{card.text}</p>
                  </div>
                </div>
              ))}

              {/* Social Media Card */}
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-100 flex items-center gap-6 shadow-sm hover:shadow-xl transition-all duration-300 group hover:-translate-y-1">
                <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center shrink-0 group-hover:bg-[#1877F2] transition-colors duration-300 shadow-inner">
                  <Users className="text-gray-600 group-hover:text-white stroke-[1.5] transition-colors duration-300" size={28} />
                </div>
                <div className="flex flex-col gap-3">
                  <h4 className="font-bold text-dark text-lg tracking-wide">Social Media</h4>
                  <div className="flex gap-4">
                    <a href="https://www.facebook.com/profile.php?id=61562431613338" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white transition-colors shadow-sm"><FaFacebook size={20} /></a>
                    <a href="https://www.instagram.com/gsk_automotive/?hl=en" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-pink-600 hover:bg-pink-600 hover:text-white transition-colors shadow-sm"><FaInstagram size={20} /></a>
                    <a href="#" className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-blue-400 hover:bg-blue-400 hover:text-white transition-colors shadow-sm"><FaTwitter size={20} /></a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Send us a message form (7 columns) */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 md:p-12 h-full">
              <p className="text-primary font-bold text-sm uppercase tracking-[3px] mb-4">INQUIRY</p>
              <h2 className="font-heading text-4xl sm:text-5xl md:text-6xl mb-8 leading-[1.15] text-dark">SEND A <span className="text-primary">MESSAGE</span></h2>
              <div className="w-24 h-1.5 bg-primary mb-10 rounded-full"></div>
              <p className="text-gray-600 mb-10 font-medium text-lg leading-relaxed">Fill the form below and one of our team members will reach out to you shortly.</p>

              {status.message && (
                <div className={`p-5 rounded-xl mb-10 font-bold border ${status.success ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {status.message}
                </div>
              )}

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <input required name="firstName" value={formData.firstName} onChange={handleChange} type="text" placeholder="First Name" className="w-full bg-gray-50 border border-gray-200 p-5 rounded-xl outline-none focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium text-[15px] placeholder-gray-400" />
                  <input required name="lastName" value={formData.lastName} onChange={handleChange} type="text" placeholder="Last Name" className="w-full bg-gray-50 border border-gray-200 p-5 rounded-xl outline-none focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium text-[15px] placeholder-gray-400" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <input required name="email" value={formData.email} onChange={handleChange} type="email" placeholder="Email Address" className="w-full bg-gray-50 border border-gray-200 p-5 rounded-xl outline-none focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium text-[15px] placeholder-gray-400" />
                  <input required name="phone" value={formData.phone} onChange={handleChange} type="tel" placeholder="Phone Number" className="w-full bg-gray-50 border border-gray-200 p-5 rounded-xl outline-none focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium text-[15px] placeholder-gray-400" />
                </div>
                <input required name="subject" value={formData.subject} onChange={handleChange} type="text" placeholder="Subject" className="w-full bg-gray-50 border border-gray-200 p-5 rounded-xl outline-none focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium text-[15px] placeholder-gray-400" />
                <textarea required name="message" value={formData.message} onChange={handleChange} placeholder="Your Message" rows="5" className="w-full bg-gray-50 border border-gray-200 p-5 rounded-xl outline-none focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium text-[15px] placeholder-gray-400 resize-none"></textarea>
                
                <button disabled={status.loading} className="w-full bg-primary text-white font-bold text-lg py-5 rounded-xl transition-all disabled:bg-gray-400 hover:bg-[#a80d26] shadow-lg hover:shadow-primary/30 hover:-translate-y-1 tracking-wide mt-4">
                  {status.loading ? 'SENDING...' : 'SUBMIT MESSAGE'}
                </button>
              </form>
            </div>
          </div>

        </div>
      </section>

      {/* Map Section */}
      <section className="bg-white py-20 lg:py-28">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 lg:px-20">
          <div className="flex flex-col items-center text-center mb-16">
            <p className="text-primary font-bold text-sm uppercase tracking-[3px] mb-4">LOCATION</p>
            <h2 className="font-heading text-4xl sm:text-5xl md:text-6xl mb-6 leading-[1.15] text-dark">FIND <span className="text-primary">US</span></h2>
            <div className="w-24 h-1.5 bg-primary rounded-full"></div>
          </div>
          
          <div className="w-full h-[500px] bg-gray-100 rounded-3xl overflow-hidden relative shadow-2xl border border-gray-200 group">
            {/* Interactive Google Map iframe */}
            <iframe 
              src={OFFICIAL_GOOGLE_MAPS_EMBED_URL}
              className="w-full h-full border-0 grayscale-[80%] hover:grayscale-0 transition-all duration-700" 
              allowFullScreen="" 
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
              title="Location Map"
            ></iframe>
          </div>
        </div>
      </section>
    </PageWrapper>
  );
};

export default Contact;