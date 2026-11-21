import React from 'react';
import { Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

const CtaBanner = () => {
  return (
    <div className="relative rounded-2xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between overflow-hidden shadow-2xl group min-h-[220px]">
      {/* Full Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/img12.jpg" 
          alt="Automotive Service" 
          className="w-full h-full object-cover object-[70%_center] sm:object-[60%_center] md:object-center" 
        />
        {/* Subtle localized gradient behind text to ensure readability without darkening the whole image */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent md:w-2/3"></div>
        {/* Subtle gradient from bottom for mobile to ensure button and text readability when stacked */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent md:hidden"></div>
      </div>

      <div className="relative z-10 text-white max-w-lg w-full">
        <div className="flex items-center gap-4 mb-4">
          <Calendar size={32} className="text-primary shrink-0" />
          <h3 className="font-heading text-3xl sm:text-4xl text-white">Need a Service?</h3>
        </div>
        <p className="text-gray-200 text-[15px] leading-relaxed max-w-md font-medium">
          Book your appointment today and get back on the road with confidence.
        </p>
      </div>
      
      <div className="relative z-10 mt-8 md:mt-0 shrink-0">
        <Link to="/book-service">
          <button className="bg-primary hover:bg-primary-dark text-white px-8 py-4 rounded font-bold uppercase tracking-wide transition-transform transition-colors duration-200 shadow-[0_4px_20px_rgba(220,38,38,0.4)] hover:-translate-y-1 hover:shadow-[0_8px_25px_rgba(220,38,38,0.6)] flex items-center gap-2">
            BOOK NOW <span className="ml-1">&rarr;</span>
          </button>
        </Link>
      </div>
    </div>
  );
};

export default CtaBanner;
