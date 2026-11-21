import React from 'react';
import { Calendar, Shield, Users, MapPin, Disc, Circle, Activity, ShieldAlert, CheckSquare } from 'lucide-react';
import PageWrapper from '../components/PageWrapper';

const PinkSlip = () => {
  return (
    <PageWrapper className="bg-lightBg min-h-screen pt-24 pb-20">
      
      {/* Hero Section */}
      <section className="max-w-[1400px] mx-auto px-4 md:px-8 flex flex-col-reverse lg:flex-row items-center gap-12 lg:gap-0 mt-8 mb-20">
        <div className="lg:w-[45%] lg:pr-12">
          <h1 className="font-heading text-5xl md:text-7xl text-primary leading-[1] mb-2">PINK SLIP</h1>
          <h2 className="font-heading text-4xl md:text-6xl text-dark leading-[1] mb-6">INSPECTIONS MADE <br /> SIMPLE</h2>
          
          <h3 className="font-bold text-xl text-dark mb-4">Fast, Professional NSW eSafety Checks</h3>
          
          <p className="text-gray-600 mb-8 text-sm leading-relaxed max-w-lg">
            Need to renew your NSW registration? Our authorised technicians complete comprehensive eSafety inspections quickly and efficiently, helping you get back on the road with confidence.
          </p>
          
          <button className="bg-primary text-white font-bold text-sm uppercase px-8 py-4 rounded shadow-lg shadow-red-500/30 hover:bg-primary-dark transition-colors tracking-wide">
            Book your inspection
          </button>
        </div>
        
        <div className="lg:w-[55%] relative">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl h-[400px] lg:h-[550px]">
            <img 
              src="/img6.jpg" 
              alt="Mechanic inspecting vehicle" 
              className="w-full h-full object-cover object-[60%_center] sm:object-center" 
              loading="eager"
              fetchPriority="high"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent mix-blend-overlay"></div>
          </div>
          
          {/* Overlapping Stats Card */}
          <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 w-[95%] bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Calendar, title: "FAST SERVICE", desc: "Most inspections completed in 20-30 minutes" },
              { icon: Shield, title: "AUTHORISED", desc: "NSW eSafety inspection station" },
              { icon: Users, title: "EXPERIENCED", desc: "Qualified technicians you can trust" },
              { icon: MapPin, title: "CONVENIENT", desc: "Easy location & flexible booking times" },
            ].map((stat, idx) => (
              <div key={idx} className="flex flex-col items-center text-center">
                <stat.icon className="text-primary mb-3 stroke-[1.5]" size={32} />
                <h4 className="font-bold text-[14px] text-dark uppercase mb-1.5">{stat.title}</h4>
                <p className="text-[13px] text-gray-600 font-medium leading-tight px-1">{stat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content Section */}
      <section className="max-w-[1400px] mx-auto px-4 md:px-8 pt-16 grid grid-cols-1 lg:grid-cols-12 gap-16">
        
        {/* Left: What is a pink slip */}
        <div className="lg:col-span-4">
          <h2 className="font-heading text-4xl text-dark leading-tight mb-8">
            WHAT IS A <span className="text-primary">PINK SLIP?</span>
          </h2>
          <div className="text-gray-700 text-[15px] space-y-6 leading-relaxed">
            <p>
              A Pink Slip, also known as an eSafety Check, is a safety inspection required for many NSW vehicles before registration renewal. It confirms that your vehicle meets the minimum road safety standards for use on public roads.
            </p>
            <p>
              Eligibility depends on your vehicle and registration requirements in NSW.
            </p>
          </div>
        </div>

        {/* Right: What we inspect grid */}
        <div className="lg:col-span-8">
          <h3 className="font-heading text-xl text-primary tracking-wide mb-8">WHAT WE INSPECT</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: "Braking System", desc: "Brake pads, discs and overall braking performance.", icon: Disc },
              { title: "Tyres & Wheels", desc: "Tyre condition, tread depth and wheel safety.", icon: Circle },
              { title: "Steering & Suspension", desc: "Checking for wear and proper vehicle control.", icon: Activity },
              { title: "Lights & Indicators", desc: "Headlights, brake lights, indicators and visibility.", icon: ShieldAlert },
              { title: "Seatbelts", desc: "Safety restraints and correct operation.", icon: ShieldAlert },
              { title: "Windscreen & Wipers", desc: "Visibility, washer system and windscreen condition.", icon: ShieldAlert },
              { title: "Battery & Electrical", desc: "Basic electrical components and charging system.", icon: ShieldAlert },
              { title: "General Safety Check", desc: "A complete inspection to ensure your vehicle meets NSW safety standards.", icon: CheckSquare },
            ].map((item, idx) => (
              <div key={idx} className="bg-white p-6 md:p-8 rounded-xl border border-gray-100 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow">
                <item.icon className="text-primary mb-5 stroke-[1.5]" size={36} />
                <h4 className="font-bold text-[16px] text-dark mb-3 tracking-wide">{item.title}</h4>
                <p className="text-[15px] text-gray-500 leading-relaxed font-medium">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

      </section>
    </PageWrapper>
  );
};

export default PinkSlip;
