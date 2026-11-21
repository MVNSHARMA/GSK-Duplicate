import React, { useState } from 'react';
import { PenTool, CheckCircle, Award, Settings, ShieldCheck, ChevronDown, ChevronUp, Calendar, Search, ThumbsUp, Truck, Phone, Zap, Wind, MapPin, Users, CheckSquare, Battery, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import PageWrapper from '../components/PageWrapper';
import CtaBanner from '../components/CtaBanner';

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

const Services = () => {
  const [openFaq, setOpenFaq] = useState(0);
  const [inspectionMode, setInspectionMode] = useState('Pink Slip');

  const services = [
    { title: "ALL MECHANICAL REPAIRS", desc: "From engine repairs to transmission, we fix it all using the highest quality parts.", icon: Settings, img: "img14.jpg" },
    { title: "PRE PURCHASE INSPECTION", desc: "Buy your next vehicle with confidence. Comprehensive mechanical and safety checks before you buy.", icon: Search, img: "img6.jpg" },
    { title: "ENGINE TRANSMISSION", desc: "Expert diagnostics and repairs to keep your engine running smoothly.", icon: PenTool, img: "img9.jpg" },
    { title: "SUSPENSION & STEERING", desc: "Ensure a smooth ride and precise handling with our suspension and steering services.", icon: Settings, img: "img7.jpg" },
    { title: "BATTERIES & STARTERS", desc: "Reliable starts every time. We offer battery testing and replacement.", icon: PenTool, img: "img5.jpg" },
    { title: "BASIC OIL SERVICE", desc: "Preventative maintenance with high-quality oil and filter changes.", icon: Settings, img: "img10.jpg" },
    { title: "BRAKES & CLUTCH", desc: "Safety first. We provide expert brake pad, disc replacement, and clutch repairs.", icon: Settings, img: "img2.jpg" },
    { title: "BELTS & HOSES", desc: "Keep your engine running cool and safe with our belt and hose replacement service.", icon: Settings, img: "img8.jpg" },
  ];

  const processSteps = [
    { step: "01", name: "BOOK", desc: "Book online or call us at a time that suits you", icon: Calendar },
    { step: "02", name: "ASSESS", desc: "We inspect, test and diagnose your vehicle", icon: Search },
    { step: "03", name: "APPROVE", desc: "Receive an upfront quote. You approve before we proceed", icon: ShieldCheck },
    { step: "04", name: "DELIVER", desc: "Quality service completed on time. Back on the road", icon: Truck },
  ];

  const faqs = [
    { q: "What types of vehicles do you service?", a: "We service most makes and models, including passenger cars, SUVs, 4WDs, and light commercial vehicles. Whether you drive a European, Japanese, Korean, or Australian vehicle, our experienced technicians are here to help." },
    { q: "Do I need to book an appointment?", a: "While we do accept walk-ins if we have availability, we strongly recommend booking an appointment to ensure we can dedicate the necessary time to your vehicle without long wait times." },
    { q: "How long does a standard vehicle service take?", a: "A standard minor service usually takes about 1-2 hours. Major services or specific repairs may take longer. We'll give you a clear time estimate when you drop your car off." },
    { q: "Do you provide Pink Slip (eSafety) inspections?", a: "Yes! We are an Authorised Inspection Station and can provide eSafety Checks (Pink Slips) while you wait." },
    { q: "What happens if my vehicle doesn't pass a Pink Slip inspection?", a: "If your vehicle fails the inspection, we'll provide you with a detailed report of what needs fixing. We can usually complete the necessary repairs on-site, after which we will issue the Pink Slip at no extra charge." },
  ];

  return (
    <PageWrapper className="bg-lightBg min-h-screen pt-24">
      
      {/* Hero Section */}
      <section className="relative min-h-[250px] h-[30vh] sm:h-[300px] bg-dark flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          <img 
            src="/Our-services.webp" 
            alt="Services background" 
            className="w-full h-full object-cover object-[50%_20%] sm:object-[50%_25%] md:object-center opacity-100" 
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
          <div className="absolute inset-0 bg-black/50"></div>
        </div>
        <div className="relative z-10 text-center">
          <h1 className="font-heading text-5xl md:text-6xl text-white tracking-wide">
            <span className="text-primary">OUR</span> SERVICES
          </h1>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-20 max-w-[1400px] mx-auto px-4 md:px-8">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-1 md:grid-cols-2 gap-8"
        >
          {services.map((srv, idx) => (
            <motion.div variants={itemVariants} key={idx} className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden flex h-[220px] group border border-gray-100 hover:shadow-lg transition-shadow duration-300">
              <div className="w-[55%] p-8 flex flex-col justify-center relative z-10 bg-white">
                <srv.icon className="text-primary mb-4" size={32} strokeWidth={1.5} />
                <h3 className="font-heading text-2xl mb-2 leading-none group-hover:text-primary transition-colors duration-300">{srv.title}</h3>
                <p className="text-gray-500 text-[15px] leading-relaxed">{srv.desc}</p>
              </div>
              <div className="w-[45%] relative clip-slant-reverse h-full bg-gray-100">
                <img 
                  src={`/${srv.img}`} 
                  alt={srv.title} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Our Process - Dark Section */}
      <section className="bg-dark py-20 text-white">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="lg:w-1/4">
              <p className="text-primary font-bold text-xs uppercase tracking-[2px] mb-2">OUR PROCESS</p>
              <h2 className="font-heading text-4xl mb-4 leading-tight">Simple. Transparent.<br />Hassle-Free.</h2>
              <p className="text-gray-400 text-sm">We make car servicing easy from start to finish.</p>
            </div>
            
            <div className="lg:w-3/4 flex flex-wrap lg:flex-nowrap justify-between gap-6 relative">
              {/* Connecting Dashed Line */}
              <div className="hidden lg:block absolute top-[28px] left-[10%] right-[10%] h-[1px] border-t border-dashed border-gray-700 z-0"></div>
              
              {processSteps.map((step, idx) => (
                <div key={idx} className="flex flex-col relative z-10 w-full sm:w-[45%] lg:w-1/4">
                  <div className="w-14 h-14 rounded-full border border-gray-700 bg-dark flex items-center justify-center mb-6">
                    <step.icon size={24} className="text-primary" />
                  </div>
                  <h4 className="font-bold text-lg mb-2">
                    <span className="text-gray-500 mr-2">{step.step}.</span>
                    <span className="text-primary uppercase tracking-wide">{step.name}</span>
                  </h4>
                  <p className="text-gray-400 text-[15px] leading-relaxed pr-4">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pink/Blue Slip Inspection Section */}
      <section className="py-20 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          
          {/* Toggle */}
          <div className="flex justify-center mb-16">
            <div className="inline-flex bg-gray-100 rounded-full p-1 border border-gray-200 shadow-inner">
              <button
                onClick={() => setInspectionMode('Pink Slip')}
                className={`px-8 py-3 rounded-full text-sm font-bold transition-all duration-300 ${inspectionMode === 'Pink Slip' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                PINK SLIP
              </button>
              <button
                onClick={() => setInspectionMode('Blue Slip')}
                className={`px-8 py-3 rounded-full text-sm font-bold transition-all duration-300 ${inspectionMode === 'Blue Slip' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                BLUE SLIP
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={inspectionMode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {/* Top Hero Layout */}
              <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 mb-20 items-center">
                {/* Left Content */}
                <div className="lg:w-1/2">
                  <h2 className="font-heading text-5xl md:text-6xl mb-6 leading-tight text-dark">
                    <span className="text-primary">{inspectionMode.toUpperCase()}</span><br />
                    INSPECTIONS MADE<br />SIMPLE
                  </h2>
                  
                  {inspectionMode === 'Pink Slip' ? (
                    <>
                      <p className="text-xl font-medium text-dark mb-6">Fast, Professional NSW eSafety Checks</p>
                      <p className="text-gray-600 mb-8 leading-relaxed">
                        Need to renew your NSW registration? Our authorised technicians complete comprehensive eSafety inspections quickly and efficiently, helping you get back on the road with confidence. A Pink Slip verifies that an eligible vehicle meets required safety standards for road use. Most light vehicles over 5 years old require this inspection for registration renewal.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xl font-medium text-dark mb-6">Authorised Unregistered Vehicle Inspections</p>
                      <p className="text-gray-600 mb-8 leading-relaxed">
                        Need to register an unregistered vehicle in NSW? A Blue Slip (AUVIS) inspection checks an unregistered vehicle's safety, design, and identity requirements. Required for vehicles with expired rego over 3 months, brought from interstate/overseas, or without number plates. Valid for 42 days subject to NSW rules.
                      </p>
                    </>
                  )}

                  <Link to={`/book-service?service=${encodeURIComponent(inspectionMode)}`}>
                    <button className="bg-primary hover:bg-red-700 text-white px-8 py-4 rounded-lg font-bold transition-colors">
                      Book your inspection
                    </button>
                  </Link>
                </div>
                
                {/* Right Image & Features */}
                <div className="lg:w-1/2 relative">
                  <img src="/PinkSlip_BlueSlip.webp" alt={`${inspectionMode} Mechanic`} className="w-full h-auto object-cover rounded-xl shadow-lg mb-8" />
                </div>
              </div>

              {/* Bottom Layout: Details & Grid */}
              <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">
                <div className="lg:w-1/3">
                  <h3 className="font-heading text-3xl mb-6">
                    WHAT IS A <span className="text-primary">{inspectionMode.toUpperCase()}?</span>
                  </h3>
                  {inspectionMode === 'Pink Slip' ? (
                    <p className="text-gray-600 leading-relaxed mb-4">
                      A Pink Slip, also known as an eSafety Check, is a safety inspection required for many NSW vehicles before registration renewal. It confirms that your vehicle meets the minimum road safety standards for use on public roads. Eligibility depends on your vehicle and registration requirements in NSW.
                    </p>
                  ) : (
                    <p className="text-gray-600 leading-relaxed mb-4">
                      A Blue Slip is an Authorised Unregistered Vehicle Inspection Scheme (AUVIS) report. It is more comprehensive than a Pink Slip and verifies the safety, identity, and design of unregistered vehicles to ensure they meet NSW standards before they can be registered for road use.
                    </p>
                  )}
                </div>
                
                <div className="lg:w-2/3">
                  <h3 className="font-heading text-xl text-primary mb-6 uppercase tracking-wider">What We Inspect</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { icon: CheckCircle, title: "Braking System", desc: "Brake pads, discs and overall performance." },
                      { icon: Settings, title: "Tyres & Wheels", desc: "Tyre condition, tread depth and safety." },
                      { icon: Zap, title: "Steering & Suspension", desc: "Checking for wear and proper control." },
                      { icon: Eye, title: "Lights & Indicators", desc: "Headlights, brake lights, and visibility." },
                      { icon: ShieldCheck, title: "Seatbelts", desc: "Safety restraints and correct operation." },
                      { icon: Wind, title: "Windscreen & Wipers", desc: "Visibility, washer system and condition." },
                      { icon: Battery, title: "Battery & Electrical", desc: "Basic electrical components & charging." },
                      { icon: CheckSquare, title: "General Safety Check", desc: "Complete inspection for NSW standards." }
                    ].map((item, idx) => (
                      <div key={idx} className="bg-white border border-gray-100 rounded-xl p-5 hover:shadow-md transition-shadow text-center flex flex-col items-center">
                        <item.icon className="text-primary mb-3" size={32} strokeWidth={1.5} />
                        <h4 className="font-bold text-[14px] uppercase mb-2">{item.title}</h4>
                        <p className="text-[13px] text-gray-600 font-medium leading-relaxed">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

        </div>
      </section>

      {/* Import Compliance Section */}
      <section id="import-compliance" className="py-20 bg-white border-t border-gray-100">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 mb-20 items-center">
            {/* Left Content */}
            <div className="lg:w-1/2">
              <h2 className="font-heading text-5xl md:text-6xl mb-6 leading-tight text-dark">
                <span className="text-primary">IMPORT COMPLIANCE</span><br />
                MADE CLEARER
              </h2>
              <p className="text-xl font-medium text-dark mb-6">Guidance for Imported Vehicles</p>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Import Compliance assists customers with navigating the requirements associated with importing vehicles into Australia. Our team helps assess vehicle documentation, identify applicable compliance requirements and guide customers through the necessary steps involved in preparing an imported vehicle for registration.
              </p>
              <p className="text-gray-600 mb-8 leading-relaxed">
                Whether you are importing a vehicle or preparing an imported vehicle for registration, GSK Automotive can assist you in understanding the compliance process and the next steps involved.
              </p>

              <Link to={`/book-service?service=${encodeURIComponent('Import Compliance')}`}>
                <button className="bg-primary hover:bg-red-700 text-white px-8 py-4 rounded-lg font-bold transition-colors">
                  Book Import Compliance
                </button>
              </Link>
            </div>

            {/* Right Image */}
            <div className="lg:w-1/2 relative">
              <img
                src="/img15.jpg"
                alt="Reviewing vehicle import paperwork"
                className="w-full h-auto object-cover rounded-xl shadow-lg"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>

          {/* How we can help */}
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">
            <div className="lg:w-1/3">
              <h3 className="font-heading text-3xl mb-6">
                HOW WE <span className="text-primary">CAN HELP</span>
              </h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                Importing a vehicle involves paperwork and requirements that are easy to get wrong. We help you understand where your vehicle stands and what comes next.
              </p>
              <p className="text-gray-500 text-sm leading-relaxed">
                Approvals and certifications for imported vehicles are issued by the relevant authorities. Our service provides guidance and assistance through the process.
              </p>
            </div>

            <div className="lg:w-2/3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { icon: Search, title: "Documentation Review", desc: "We help assess your vehicle's import documentation." },
                  { icon: CheckSquare, title: "Compliance Requirements", desc: "We help identify the compliance requirements that may apply." },
                  { icon: CheckCircle, title: "Next Steps", desc: "We guide you through preparing your imported vehicle for registration." }
                ].map((item, idx) => (
                  <div key={idx} className="bg-white border border-gray-100 rounded-xl p-5 hover:shadow-md transition-shadow text-center flex flex-col items-center">
                    <item.icon className="text-primary mb-3" size={32} strokeWidth={1.5} />
                    <h4 className="font-bold text-[14px] uppercase mb-2">{item.title}</h4>
                    <p className="text-[13px] text-gray-600 font-medium leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Row */}
      <section className="bg-gray-50 py-24 border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8 justify-items-center">
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
        </div>
      </section>

      {/* Booking CTA Banner */}
      <section className="py-20 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <CtaBanner />
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="font-heading text-4xl text-center mb-12">
            FREQUENTLY ASKED <span className="text-primary">QUESTIONS</span>
          </h2>
          
          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div key={idx} className="border-b border-gray-200 bg-white rounded-lg px-6 py-2 shadow-sm">
                <button 
                  onClick={() => setOpenFaq(openFaq === idx ? -1 : idx)}
                  className="w-full flex items-center justify-between py-4 text-left focus:outline-none group"
                >
                  <span className={`font-bold text-[17px] transition-colors ${openFaq === idx ? 'text-primary' : 'text-dark group-hover:text-primary'}`}>
                    {faq.q}
                  </span>
                  {openFaq === idx ? 
                    <ChevronUp className="text-primary shrink-0" /> : 
                    <ChevronDown className="text-gray-400 shrink-0 group-hover:text-primary" />
                  }
                </button>
                <AnimatePresence>
                  {openFaq === idx && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <p className="text-gray-600 pb-6 pr-8 leading-relaxed text-[15px]">
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

    </PageWrapper>
  );
};

export default Services;