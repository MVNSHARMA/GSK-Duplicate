import React from 'react';
import { Users, Award, Settings, ShieldCheck, PenTool, ThumbsUp, CheckCircle, Clock } from 'lucide-react';
import PageWrapper from '../components/PageWrapper';

const About = () => {
  return (
    <PageWrapper className="min-h-screen pt-24">
      {/* Hero Section */}
      <section className="relative w-full flex items-end md:items-center bg-[#111] overflow-hidden" style={{ minHeight: '70vh' }}>
        <img 
          src="/about-us.webp" 
          alt="About GSK Automotive" 
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
              <span className="text-primary">ABOUT</span> US
            </h1>
            <p className="text-gray-200 text-base md:text-xl leading-relaxed mb-8 md:mb-10 drop-shadow-md">
              Your trusted automotive professionals, dedicated to providing premium service and expert care for your vehicle.
            </p>
            <a 
              href="/book-service" 
              className="inline-flex items-center justify-center gap-2 bg-primary text-white font-bold text-base md:text-lg px-8 md:px-10 py-3.5 md:py-4 rounded-lg hover:bg-[#a80d26] transition-all shadow-lg hover:shadow-primary/30 hover:-translate-y-1 tracking-wide"
            >
              Book a Service
            </a>
          </div>
        </div>
      </section>

      {/* More Than Just a Mechanic Section */}
      <section className="py-20 lg:py-28 bg-gray-50 overflow-hidden">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 lg:px-20 flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
          <div className="lg:w-1/2 w-full relative group">
            <div className="absolute -inset-4 bg-primary/10 rounded-3xl blur-xl group-hover:bg-primary/20 transition-all duration-700"></div>
            <img 
              src="/img1.jpg" 
              alt="Mechanic working on car" 
              className="relative w-full h-[400px] sm:h-[500px] lg:h-[650px] object-cover rounded-2xl shadow-2xl transition-transform duration-700 group-hover:scale-[1.01]" 
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="lg:w-1/2 w-full">
            <p className="text-primary font-bold text-sm uppercase tracking-[3px] mb-4">MORE THAN JUST A MECHANIC</p>
            <h2 className="font-heading text-4xl sm:text-5xl md:text-6xl mb-8 leading-[1.15] text-dark">
              Why Drivers Choose<br />GSK Automotive
            </h2>
            <div className="w-24 h-1.5 bg-primary mb-10 rounded-full"></div>
            
            <div className="text-gray-600 mb-12 space-y-6 text-lg leading-[1.8] font-medium">
              <p>
                We understand that trusting someone with your vehicle isn't easy. That's why transparency, communication, and quality workmanship are at the heart of everything we do.
              </p>
              <p>
                From routine servicing to complex mechanical repairs, every vehicle receives the same level of care and attention as if it were our own.
              </p>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="shrink-0 bg-red-50 p-5 rounded-2xl">
                <ShieldCheck size={40} className="text-primary stroke-[2]" />
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-primary font-bold uppercase tracking-widest text-[11px]">Our Goal</p>
                <h4 className="font-bold text-xl md:text-2xl text-dark leading-snug">Dealership-quality service without the dealership price tag.</h4>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-white py-20 lg:py-28">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 lg:px-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Award, title: "15+ YEARS", subtitle: "Over 15 years of industry experience you can trust." },
              { icon: Users, title: "5000+ VEHICLES", subtitle: "Thousands of happy customers across Sydney." },
              { icon: Settings, title: "LATEST TECH", subtitle: "Using the latest diagnostic tools and equipment." },
              { icon: ShieldCheck, title: "100% SATISFACTION", subtitle: "We stand by our workmanship and service." },
            ].map((stat, idx) => (
              <div key={idx} className="bg-gray-50 border border-gray-100 rounded-2xl p-8 flex flex-col items-center text-center shadow-sm hover:shadow-lg hover:-translate-y-2 transition-all duration-300 group">
                <div className="w-20 h-20 rounded-2xl bg-white border border-gray-100 flex items-center justify-center mb-6 shadow-sm group-hover:bg-primary transition-colors duration-300">
                  <stat.icon size={36} className="text-primary group-hover:text-white stroke-[1.5] transition-colors duration-300" />
                </div>
                <h4 className="font-heading text-2xl text-dark tracking-wide mb-3">{stat.title}</h4>
                <p className="text-[15px] text-gray-600 leading-relaxed font-medium">{stat.subtitle}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Consumer Guide / Dark Process Section */}
      <section className="py-20 lg:py-28 bg-[#111] relative overflow-hidden text-white">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
           <img src="/img12.jpg" alt="background pattern" className="w-full h-full object-cover grayscale" loading="lazy" decoding="async" />
        </div>
        
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 lg:px-20 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
            <div className="lg:w-1/3 w-full">
              <p className="text-primary font-bold text-sm uppercase tracking-[3px] mb-4">3 SIMPLE STEPS</p>
              <h2 className="font-heading text-4xl sm:text-5xl lg:text-6xl mb-8 leading-[1.1]">
                A CONSUMER'S <br /> GUIDE TO <br />
                <span className="text-primary">AUTOMOTIVE REPAIR</span>
              </h2>
              <div className="w-24 h-1.5 bg-primary mb-8 rounded-full"></div>
              <p className="text-gray-300 text-lg mb-10 font-medium leading-[1.7]">
                Quality Service. Transparent Process. Complete peace of mind.
              </p>
              <a 
                href="/book-service" 
                className="inline-flex items-center gap-2 bg-white text-dark font-bold text-lg px-8 py-4 rounded-lg hover:bg-gray-200 transition-colors shadow-lg hover:-translate-y-1 tracking-wide"
              >
                Start Your Process
              </a>
            </div>

            <div className="lg:w-2/3 w-full grid grid-cols-1 md:grid-cols-3 gap-12 relative mt-8 lg:mt-0">
              {/* Connecting lines for desktop */}
              <div className="hidden md:block absolute top-14 left-[15%] right-[15%] h-[2px] z-0 border-t-2 border-dashed border-gray-700"></div>

              {[
                { step: 1, title: "REQUEST QUOTE", desc: "Get a transparent, no-obligation estimate.", icon: PenTool },
                { step: 2, title: "APPROVE WORK", desc: "Visit the garage, approve the work, we handle the rest.", icon: Settings },
                { step: 3, title: "DRIVE AWAY", desc: "Happy with quality work and our lifetime warranty.", icon: CheckCircle },
              ].map(item => (
                <div key={item.step} className="relative z-10 flex flex-col items-center text-center group">
                  <div className="w-28 h-28 rounded-3xl bg-[#222] border border-gray-700 flex items-center justify-center mb-8 shadow-xl relative transition-transform duration-300 group-hover:-translate-y-2 group-hover:border-primary">
                    <span className="absolute -bottom-4 bg-primary text-white w-10 h-10 rounded-xl flex items-center justify-center font-bold font-heading text-xl shadow-lg">
                      {item.step}
                    </span>
                    <item.icon size={40} className="text-gray-300 group-hover:text-white stroke-[1.5] transition-colors" />
                  </div>
                  <div className="flex flex-col gap-3">
                    <h4 className="font-heading text-[22px] tracking-wide text-white group-hover:text-primary transition-colors">{item.title}</h4>
                    <p className="text-[15px] text-gray-400 font-medium leading-relaxed max-w-[200px] mx-auto">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Footer Section */}
      <section className="py-20 bg-gray-50 border-t border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 lg:px-20">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 justify-items-center">
            {[
              { icon: Settings, label: "EXPERT TECHNICIANS" },
              { icon: ShieldCheck, label: "QUALITY PARTS" },
              { icon: Award, label: "TRANSPARENT PRICING" },
              { icon: CheckCircle, label: "WARRANTY ASSURED" },
              { icon: Clock, label: "ON-TIME SERVICE" },
              { icon: ThumbsUp, label: "CUSTOMER SATISFACTION" },
            ].map((item, idx) => (
              <div key={idx} className="flex flex-col items-center gap-4 hover:-translate-y-2 transition-transform cursor-pointer group">
                <div className="w-16 h-16 rounded-2xl border border-gray-200 flex items-center justify-center bg-white shadow-sm group-hover:border-primary group-hover:shadow-md transition-all">
                  <item.icon size={28} className="text-gray-600 group-hover:text-primary stroke-[1.5] transition-colors" />
                </div>
                <span className="font-bold text-[12px] uppercase text-gray-600 text-center tracking-widest max-w-[140px] leading-relaxed group-hover:text-dark transition-colors">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

    </PageWrapper>
  );
};

export default About;
