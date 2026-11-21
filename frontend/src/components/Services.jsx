import React from 'react';
import { PenTool, CheckCircle, Award, Settings, ShieldCheck, ThumbsUp } from 'lucide-react';
import { Link } from 'react-router-dom';


const Services = () => {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        
        {/* Brand Logos */}
        <div className="text-center mb-32">
          <p className="text-primary font-bold text-sm uppercase tracking-[3px] mb-4">ALL MAKES & MODELS</p>
          <h2 className="font-heading text-4xl md:text-5xl mb-16">VEHICLE BRANDS WE SERVE</h2>
          
          <div className="flex overflow-hidden w-full relative group pause-marquee">
            {/* First Set */}
            <div className="animate-marquee flex items-center gap-12 md:gap-20 pr-12 md:pr-20 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
              {['Mercedez', 'Toyota', 'Mazda', 'Audi', 'Nissan', 'Hyundai', 'Jeep', 'Holden'].map((brand, idx) => (
                <img key={`${brand}-1-${idx}`} src={`/${brand}.svg`} alt={brand} className="h-10 md:h-14 grayscale hover:grayscale-0 transition-all cursor-pointer" />
              ))}
            </div>
            {/* Second Set (Duplicate) */}
            <div className="animate-marquee flex items-center gap-12 md:gap-20 pr-12 md:pr-20 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity duration-300" aria-hidden="true">
              {['Mercedez', 'Toyota', 'Mazda', 'Audi', 'Nissan', 'Hyundai', 'Jeep', 'Holden'].map((brand, idx) => (
                <img key={`${brand}-2-${idx}`} src={`/${brand}.svg`} alt={brand} className="h-10 md:h-14 grayscale hover:grayscale-0 transition-all cursor-pointer" />
              ))}
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8 justify-items-center mb-32 border-y border-gray-100 py-24">
          {[
            { icon: Award, title: "15+ YEARS EXPERIENCE", subtitle: "Over 15 years of industry experience you can trust" },
            { icon: Award, title: "5000+ VEHICLES SERVICED", subtitle: "Thousands of happy customers across Seven Hills & Sydney" },
            { icon: Settings, title: "LATEST TECHNOLOGY", subtitle: "Using the latest diagnostic tools and equipment" },
            { icon: ShieldCheck, title: "100% SATISFACTION", subtitle: "We stand by our workmanship and customer service" },
          ].map((stat, idx) => (
            <div key={idx} className="flex flex-col items-center text-center max-w-[280px]">
              <div className="w-20 h-20 rounded-full border border-gray-200 bg-white flex items-center justify-center mb-8 shadow-sm transition-transform hover:-translate-y-1">
                <stat.icon size={36} className="text-primary stroke-[1.5]" />
              </div>
              <div className="flex flex-col gap-4">
                <h4 className="font-bold text-[15px] text-dark tracking-wide">{stat.title}</h4>
                <p className="text-[15px] text-gray-600 leading-relaxed">{stat.subtitle}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Our Services Grid */}
        <div className="text-center mb-16">
          <h2 className="font-heading text-5xl">
            OUR <span className="text-primary">SERVICES</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-24">
          {[
            { title: "ALL MECHANICAL REPAIRS", img: "img14.jpg" },
            { title: "PRE PURCHASE INSPECTION", img: "img6.jpg" },
            { title: "ENGINE TRANSMISSION", img: "img9.jpg" },
            { title: "SUSPENSION & STEERING", img: "img7.jpg" },
            { title: "BATTERIES AND STARTERS", img: "img5.jpg" },
            { title: "BASIC OIL SERVICE", img: "img10.jpg" },
            { title: "BRAKES AND CLUTCH", img: "img2.jpg" },
            { title: "BELTS AND HOSES", img: "img8.jpg" },
          ].map((service, idx) => (
            <div key={idx} className="group relative h-[240px] overflow-hidden bg-dark">
              <img 
                src={`/${service.img}`} 
                alt={service.title} 
                className="w-full h-full object-cover opacity-100 transition-transform duration-500 group-hover:scale-110" 
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark/90 via-dark/30 to-transparent"></div>
              <div className="absolute inset-0 flex flex-col justify-end p-6">
                <h3 className="text-white font-heading text-2xl mb-1">{service.title}</h3>
                <p className="text-gray-300 text-xs line-clamp-2">Professional {service.title.toLowerCase()} tailored to your vehicle's specifications.</p>
              </div>
            </div>
          ))}
        </div>

        {/* Consumer Guide Section */}
        <div className="bg-gray-50 rounded-2xl p-12 lg:p-20 flex flex-col lg:flex-row items-center gap-16 lg:gap-24 mt-24">
          <div className="lg:w-1/3 w-full">
            <p className="text-primary font-bold text-sm uppercase tracking-[3px] mb-6">DO IT IN JUST 3 SIMPLE STEPS</p>
            <h2 className="font-heading text-5xl lg:text-6xl mb-10 leading-[1.1]">
              A CONSUMER'S <br /> GUIDE TO <br />
              <span className="text-primary">AUTOMOTIVE REPAIR</span>
            </h2>
            <div className="w-20 h-1 bg-primary mb-8"></div>
            <p className="text-gray-600 text-[17px] mb-8 font-medium leading-[1.7]">
              Quality Service. Transparent Process. Complete peace of mind.
            </p>
          </div>

          <div className="lg:w-2/3 w-full grid grid-cols-1 md:grid-cols-3 gap-12 relative mt-8 lg:mt-0">
            {/* Connecting lines for desktop */}
            <div className="hidden md:block absolute top-14 left-24 right-24 h-[2px] bg-red-100 z-0 border-t-2 border-dashed border-red-200"></div>

            {[
              { step: 1, title: "REQUEST A QUOTE", desc: "Get a transparent, no-obligation estimate from trusted local garage.", icon: PenTool },
              { step: 2, title: "GET YOUR CAR FIXED", desc: "Visit the garage, approve the work, and our experts take care of the rest.", icon: Settings },
              { step: 3, title: "VEHICLE READY", desc: "Drive away happy with quality work and our worry-free lifetime warranty.", icon: CheckCircle },
            ].map(item => (
              <div key={item.step} className="relative z-10 flex flex-col items-center text-center">
                <div className="w-28 h-28 rounded-full bg-white border-2 border-primary flex items-center justify-center mb-10 shadow-xl relative transition-transform hover:-translate-y-2 cursor-pointer">
                  <span className="absolute -bottom-4 bg-primary text-white w-10 h-10 rounded-full flex items-center justify-center font-bold font-heading text-xl shadow-md">
                    {item.step}
                  </span>
                  <item.icon size={40} className="text-dark stroke-[1.5]" />
                </div>
                <div className="flex flex-col gap-4">
                  <h4 className="font-heading text-[22px] text-dark">{item.title}</h4>
                  <p className="text-[15px] text-gray-500 font-medium leading-relaxed max-w-[220px] mx-auto">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom features bar */}
        <div className="flex flex-wrap justify-center gap-10 md:gap-16 mt-32 pb-8">
          {[
            { icon: ThumbsUp, label: "EXPERT TECHNICIANS" },
            { icon: ShieldCheck, label: "QUALITY PARTS" },
            { icon: CheckCircle, label: "TRANSPARENT PRICING" },
            { icon: Award, label: "WARRANTY ASSURED" },
            { icon: Settings, label: "ON-TIME SERVICE" },
            { icon: ThumbsUp, label: "CUSTOMER SATISFACTION" },
          ].map((item, idx) => (
            <div key={idx} className="flex flex-col items-center gap-6 hover:-translate-y-2 transition-transform cursor-pointer">
              <div className="w-20 h-20 rounded-full border border-gray-100 flex items-center justify-center bg-white shadow-md">
                <item.icon size={32} className="text-primary stroke-[1.5]" />
              </div>
              <span className="font-bold text-[11px] uppercase text-gray-600 text-center tracking-widest">{item.label}</span>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default Services;