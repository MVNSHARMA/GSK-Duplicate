import React from 'react';
import { PenTool, Settings, Disc, Cog, Wind, FileCheck, CheckCircle } from 'lucide-react';

import { Link } from 'react-router-dom';
import CtaBanner from './CtaBanner';

const About = () => {
  return (
    <section id="about" className="py-24 bg-white relative mt-16 md:mt-0">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        
        {/* Service Icons Bar (Floating) */}
        <div className="relative md:-mt-40 z-30 bg-white rounded-xl shadow-2xl mb-24 hidden md:flex border border-gray-100 overflow-hidden">
          {[
            { icon: PenTool, label: 'Logbook Servicing', active: true },
            { icon: Settings, label: 'Mechanical Repairs' },
            { icon: Disc, label: 'Brake & Clutch' },
            { icon: Cog, label: 'Transmission Services' },
            { icon: Wind, label: 'Air Conditioning' },
            { icon: FileCheck, label: 'Roadworthy Inspections' },
          ].map((item, idx) => (
            <div 
              key={idx}
              className={`flex-1 flex flex-col items-center justify-center p-8 hover:bg-gray-50 transition-all cursor-pointer relative ${idx !== 5 ? 'border-r border-gray-100' : ''}`}
            >
              <item.icon size={48} className={`${item.active ? 'text-primary' : 'text-dark'} mb-4 stroke-[1.5]`} />
              <span className="font-bold text-sm text-center text-dark tracking-tight">{item.label}</span>
              {item.active && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary"></div>}
            </div>
          ))}
        </div>

        {/* Mobile Service Icons (Fallback) */}
        <div className="md:hidden grid grid-cols-2 gap-4 mb-16">
          {[
            { icon: PenTool, label: 'Logbook Servicing', active: true },
            { icon: Settings, label: 'Mechanical Repairs' },
            { icon: Disc, label: 'Brake & Clutch' },
            { icon: Cog, label: 'Transmission Services' },
            { icon: Wind, label: 'Air Conditioning' },
            { icon: FileCheck, label: 'Roadworthy Inspections' },
          ].map((item, idx) => (
            <div key={idx} className={`flex flex-col items-center justify-center p-6 bg-white rounded-lg shadow-lg border ${item.active ? 'border-primary' : 'border-gray-100'}`}>
              <item.icon size={36} className={`${item.active ? 'text-primary' : 'text-dark'} mb-3 stroke-[1.5]`} />
              <span className="font-bold text-xs text-center text-dark">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Your Local Garage Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-16 overflow-hidden">
          <div className="animate-fade-in-up">
            <h2 className="font-heading text-4xl md:text-5xl leading-tight mb-6">
              Your Local Garage <br />
              You Can <span className="text-primary">Rely On</span>
            </h2>
            <p className="text-gray-600 mb-8 leading-relaxed max-w-lg">
              At GSK Auto, we treat your car like our own. We use quality parts, the latest equipment and skilled technicians to keep you safe on the road.
            </p>
            
            <ul className="space-y-4">
              {[
                'Experienced & Qualified Technicians',
                'All Makes & Models',
                'Honest Advice & Transparent Pricing',
                'High-Quality Parts & Equipment',
                'Customer Satisfaction Guaranteed'
              ].map((text, idx) => (
                <li key={idx} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <CheckCircle size={16} className="text-primary" />
                  </div>
                  <span className="text-dark font-medium tracking-wide text-[16px]">{text}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Angled Images Collage */}
          <div className="relative h-[500px] w-full overflow-hidden rounded-xl bg-gray-100 flex items-center justify-center"
          >
            <div className="w-[120%] h-[120%] grid grid-cols-2 grid-rows-2 gap-3 -rotate-12 transform origin-center">
              {/* Top Left */}
              <div className="relative overflow-hidden w-full h-full bg-dark">
                 <img src="/img1.jpg" alt="Mechanic" className="w-full h-full object-cover rotate-12 scale-150" />
              </div>
              {/* Top Right */}
              <div className="relative overflow-hidden w-full h-full bg-dark">
                 <img src="/img2.jpg" alt="Under car" className="w-full h-full object-cover rotate-12 scale-150" />
              </div>
              {/* Bottom Left */}
              <div className="relative overflow-hidden w-full h-full bg-dark">
                 <img src="/img9.jpg" alt="Engine" className="w-full h-full object-cover rotate-12 scale-150" />
              </div>
              {/* Bottom Right */}
              <div className="relative overflow-hidden w-full h-full bg-dark">
                 <img src="/img13.jpg" alt="Expertise" className="w-full h-full object-cover rotate-12 scale-150" />
              </div>
            </div>
          </div>
        </div>

        {/* Need a Service Banner */}
        <CtaBanner />
      </div>
    </section>
  );
};

export default About;