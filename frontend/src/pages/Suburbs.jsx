import React from 'react';
import { ShieldCheck, MapPin, Users, Car, MapPin as MapPinIcon } from 'lucide-react';
import PageWrapper from '../components/PageWrapper';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
};

const Suburbs = () => {
  const locations = [
    { name: "North Shore", desc: "North Sydney, Mosman, Neutral Bay, Cremorne, Lane Cove, St Leonards", img: "img1.jpg" },
    { name: "Parramatta", desc: "Parramatta, Westmead, Granville, Harris Park, Merrylands", img: "img14.jpg" },
    { name: "Sydney CBD", desc: "Sydney, Surry Hills, Darlinghurst, Pyrmont, Ultimo", img: "img13.jpg" },
    { name: "Northern Beaches", desc: "Dee Why, Brookvale, Manly Vale, Narrabeen, Mona Vale", img: "img5.jpg" },
  ];

  return (
    <PageWrapper className="bg-[#f8f9fa] min-h-screen pt-24 pb-20">
      
      {/* Hero Section with Skyline watermark */}
      <section className="relative pt-16 pb-32 overflow-hidden flex flex-col items-center text-center px-4">
        
        {/* Background elements */}
        <div className="absolute inset-0 z-0 bg-[#f8f9fa]">
          <div className="absolute bottom-0 left-0 right-0 h-64 bg-repeat-x opacity-10" style={{ backgroundImage: "url('/img12.jpg')", backgroundSize: "cover", backgroundPosition: "bottom" }}></div>
        </div>
        
        <div className="relative z-10 max-w-3xl mx-auto">
          <p className="text-primary font-bold text-sm uppercase tracking-[2px] mb-4">AREAS WE SERVE</p>
          <h1 className="font-heading text-5xl md:text-6xl text-dark leading-[1] mb-2">PROUDLY SERVICING</h1>
          <h2 className="font-heading text-5xl md:text-7xl text-primary leading-[1] mb-6">SYDNEY & SURROUNDS</h2>
          
          <p className="text-gray-700 font-medium mb-12 max-w-xl mx-auto">
            From our home base in Clontarf NSW, we provide expert automotive servicing and repairs to local communities.
          </p>

          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-[1px] w-24 bg-gray-300"></div>
            <Car className="text-primary" size={20} />
            <div className="h-[1px] w-24 bg-gray-300"></div>
          </div>
          
          <p className="font-bold text-lg text-dark">
            Quality service. Honest advice. Reliable care. Close to home.
          </p>
        </div>
      </section>

      {/* Floating Trust Badges Bar */}
      <section className="max-w-[1200px] mx-auto px-4 relative z-20 -mt-16 mb-24">
        <div className="bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.06)] py-8 px-6 grid grid-cols-2 md:grid-cols-4 gap-6 divide-x divide-gray-100">
          {[
            { icon: ShieldCheck, title: "LOCAL & TRUSTED", desc: "Proudly supporting our local community." },
            { icon: MapPin, title: "EASY TO REACH", desc: "Convenient location with easy access and parking." },
            { icon: Users, title: "EXPERT CARE", desc: "Experienced technicians you can rely on." },
            { icon: Car, title: "ALL MAKES & MODELS", desc: "We service a wide range of vehicles." },
          ].map((item, idx) => (
            <div key={idx} className="flex gap-4 px-4 items-center">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shrink-0">
                <item.icon className="text-white" size={24} />
              </div>
              <div>
                <h4 className="font-bold text-xs text-dark mb-1">{item.title}</h4>
                <p className="text-xs text-gray-500 leading-tight">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Suburbs Grid */}
      <section className="max-w-[1400px] mx-auto px-4 md:px-8">
        
        <div className="flex items-center justify-center gap-6 mb-16">
          <div className="h-[2px] w-32 bg-primary"></div>
          <h2 className="font-heading text-4xl text-dark">
            SUBURBS WE <span className="text-primary">SERVE</span>
          </h2>
          <div className="h-[2px] w-32 bg-primary"></div>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {locations.map((loc, idx) => (
            <motion.div variants={itemVariants} key={idx} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-100 flex flex-col group">
              <div className="h-48 w-full relative overflow-hidden">
                <img src={`/${loc.img}`} alt={loc.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </div>
              <div className="p-6 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <MapPinIcon className="text-primary" size={20} />
                  <h3 className="font-bold text-dark text-lg">{loc.name}</h3>
                </div>
                <p className="text-xs text-gray-500 mb-6 flex-1 line-clamp-3 leading-relaxed">
                  {loc.desc}
                </p>
                <button className="bg-primary text-white text-xs font-bold py-3 px-6 rounded hover:bg-primary-dark transition-colors self-start hover:shadow-md">
                  Learn More
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>
    </PageWrapper>
  );
};

export default Suburbs;
