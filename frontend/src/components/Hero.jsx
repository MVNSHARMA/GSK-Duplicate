import React from 'react';
import { Calendar, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';


const Hero = () => {
  return (
    <section className="relative min-h-[85vh] lg:min-h-screen flex items-center pt-24 pb-32 overflow-hidden bg-gray-50">
      {/* Background Image - Bright and clean */}
      <div className="absolute inset-0 z-0 flex justify-end overflow-hidden">
        <img 
          src="/BMW_Hero.webp" 
          alt="GSK Automotive Service" 
          className="w-full lg:w-[65%] h-full object-cover object-center lg:object-contain lg:object-right-bottom mix-blend-multiply"
          loading="eager"
          fetchPriority="high"
          decoding="async" 
        />
        {/* Desktop: wider left gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/80 via-white/40 to-transparent z-10 hidden md:block w-3/4 lg:w-2/3"></div>
        {/* Mobile: narrower, softer gradient so car stays visible */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/80 to-transparent z-10 block md:hidden w-[85%]"></div>
      </div>

      <div className="max-w-[1400px] w-full mx-auto px-4 md:px-8 relative z-20">
        <div className="max-w-2xl">
          
          {/* Left Text Content */}
          <div className="flex flex-col items-start animate-fade-in-up">
            <span className="text-primary font-bold tracking-[3px] uppercase text-sm md:text-sm mb-4">
              SYDNEY'S TRUSTED
            </span>
            <h1 className="font-heading text-5xl md:text-7xl lg:text-[5.5rem] leading-[0.95] text-dark mb-6">
              Auto Service <br />
              & Repair <span className="text-primary">Experts</span>
            </h1>
            
            <div className="w-16 h-1 bg-primary mb-6"></div>

            <p className="text-gray-700 text-lg md:text-xl max-w-md mb-10 leading-relaxed font-medium">
              Quality workmanship, honest advice and affordable prices you can trust.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mt-2">
              <Link to="/book-service" className="w-full sm:w-auto">
                <button className="w-full justify-center flex items-center gap-2 bg-primary text-white px-8 py-4 rounded font-bold uppercase tracking-wide transition-transform transition-colors duration-200 hover:bg-primary-dark shadow-xl shadow-primary/20 hover:-translate-y-1">
                  <Calendar size={20} />
                  BOOK A SERVICE
                </button>
              </Link>
              <a href="tel:0410433851" className="w-full sm:w-auto">
                <button className="w-full justify-center flex items-center gap-2 bg-white text-primary border-2 border-primary px-8 py-4 rounded font-bold uppercase tracking-wide transition-transform transition-colors duration-200 hover:-translate-y-1 hover:shadow-lg">
                  <Phone size={20} />
                  0410 433 851
                </button>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;