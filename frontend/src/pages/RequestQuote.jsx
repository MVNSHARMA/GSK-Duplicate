import React, { useState } from 'react';
import { Settings, User, PenTool, ShieldCheck, Clock, ThumbsUp, Upload, X } from 'lucide-react';
import PageWrapper from '../components/PageWrapper';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/ToastContext';
import { OFFICIAL_GOOGLE_MAPS_EMBED_URL } from '../config/businessInfo';

const RequestQuote = () => {
  const toast = useToast();
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    contactMethod: 'email',
    make: '',
    model: '',
    year: '',
    regNo: '',
    kilometers: '',
    transmission: 'automatic',
    selectedServices: [],
    description: '',
  });

  const [files, setFiles] = useState([]);
  const { token } = useAuth();

  const badges = [
    { icon: User, title: "Qualified Technicians", desc: "Highly trained & experienced experts" },
    { icon: ShieldCheck, title: "Honest & Transparent", desc: "Upfront pricing with no surprises" },
    { icon: Clock, title: "Same-Day Service", desc: "Get back on the road sooner" },
    { icon: Settings, title: "Quality Parts & Equipment", desc: "We use genuine & OEM parts" },
    { icon: ThumbsUp, title: "Trusted by Sydney Drivers", desc: "5-star rated by thousands of locals" },
  ];

  const servicesList = [
    { id: 'mechanical', label: 'All Mechanical Repairs', icon: Settings },
    { id: 'engine', label: 'Engine Transmission', icon: Settings },
    { id: 'inspection', label: 'Pre Purchase Inspection', icon: ShieldCheck },
    { id: 'batteries', label: 'Batteries and Starters', icon: PenTool },
    { id: 'belts', label: 'Belts & Hoses', icon: Settings },
    { id: 'oil', label: 'Basic oil service', icon: PenTool },
    { id: 'ac', label: 'Air Conditioning', icon: ShieldCheck },
    { id: 'brakes', label: 'Brakes & Clutches', icon: Settings },
  ];

  const toggleService = (id) => {
    setFormData(prev => {
      const isSelected = prev.selectedServices.includes(id);
      return {
        ...prev,
        selectedServices: isSelected 
          ? prev.selectedServices.filter(s => s !== id)
          : [...prev.selectedServices, id]
      };
    });
  };

  const [status, setStatus] = useState({ loading: false, success: false, message: '' });

  const handleFileChange = (e) => {
    if (e.target.files) {
      let selectedFiles = Array.from(e.target.files);
      
      selectedFiles = selectedFiles.filter(file => {
        if (file.size > 10 * 1024 * 1024) {
          alert(`File ${file.name} is too large. Maximum size is 10MB.`);
          return false;
        }
        return true;
      });

      setFiles(prev => {
        const newFiles = [...prev, ...selectedFiles];
        if (newFiles.length > 5) {
          alert('You can upload a maximum of 5 images.');
          return newFiles.slice(0, 5);
        }
        return newFiles;
      });
    }
  };

  const removeFile = (indexToRemove) => {
    setFiles(files.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setStatus({ loading: true, success: false, message: '' });

    const payload = {
      customerInfo: {
        fullName: formData.fullName,
        phone: formData.phone,
        email: formData.email,
        contactMethod: formData.contactMethod
      },
      vehicleInfo: {
        make: formData.make,
        model: formData.model,
        year: parseInt(formData.year) || null,
        regNo: formData.regNo,
        kilometers: parseInt(formData.kilometers) || null,
        transmission: formData.transmission
      },
      services: formData.selectedServices,
      description: formData.description
    };

    try {
      let fetchOptions = {};

      if (files.length > 0) {
        const form = new FormData();
        form.append('customerInfo', JSON.stringify(payload.customerInfo));
        form.append('vehicleInfo', JSON.stringify(payload.vehicleInfo));
        form.append('services', JSON.stringify(payload.services));
        form.append('description', payload.description);
        files.forEach(file => {
          form.append('images', file);
        });
        
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        fetchOptions = {
          method: 'POST',
          headers,
          body: form
        };
      } else {
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        fetchOptions = {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        };
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/intake/quote`, fetchOptions);
      const data = await response.json();

      if (response.ok) {
        setStatus({ loading: false, success: true, message: '' });
        toast.success('Quote request submitted successfully! We will get back to you shortly.');
        setTimeout(() => {
          setFormData({ fullName: '', phone: '', email: '', contactMethod: 'email', make: '', model: '', year: '', regNo: '', kilometers: '', transmission: 'automatic', selectedServices: [], description: '' });
          setFiles([]);
        }, 3000);
      } else {
        setStatus({ loading: false, success: false, message: data.error || 'Failed to submit.' });
      }
    } catch (error) {
      setStatus({ loading: false, success: false, message: '' });
      toast.error('Server error. Please try again later.');
    }
  };

  return (
    <PageWrapper className="bg-lightBg min-h-screen pt-24 pb-20">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 flex flex-col lg:flex-row gap-12 lg:gap-20">
        
        {/* Left Side Content */}
        <div className="lg:w-[35%] pt-8">
          <h1 className="font-heading text-5xl md:text-6xl text-dark leading-[1.1] mb-6">
            GET YOUR <br />
            <span className="text-primary">FREE ESTIMATE</span> <br />
            IN MINUTES
          </h1>
          <p className="text-gray-600 mb-10 text-[16px] leading-relaxed font-medium">
            Tell us about your vehicle and the service you need. Our experienced team will review your request and provide a transparent, no-obligation estimate as soon as possible.
          </p>

          <div className="space-y-8 mb-12">
            {badges.map((badge, idx) => (
              <div key={idx} className="flex gap-5 items-start">
                <badge.icon className="text-primary shrink-0 mt-1" size={26} strokeWidth={1.5} />
                <div className="flex flex-col gap-1.5">
                  <h4 className="font-bold text-dark text-[17px] tracking-wide">{badge.title}</h4>
                  <p className="text-gray-600 text-[15px] font-medium leading-relaxed">{badge.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white p-8 rounded-xl border border-gray-100 flex gap-6 items-start shadow-sm hover:shadow-lg transition-shadow mb-12">
            <ShieldCheck className="text-primary shrink-0 mt-1" size={32} />
            <div className="flex flex-col gap-1.5">
              <h4 className="font-bold text-dark text-[17px] tracking-wide">Our Promise</h4>
              <p className="text-gray-600 text-[15px] font-medium leading-relaxed">We believe in fixing what's needed — not selling what isn't.</p>
            </div>
          </div>

          <h4 className="font-bold text-xl mb-4 text-dark">Reach Out to us</h4>
          <div className="h-[200px] rounded-xl bg-dark overflow-hidden relative">
            {/* Interactive Google Map iframe */}
            <iframe 
              src={OFFICIAL_GOOGLE_MAPS_EMBED_URL}
              className="w-full h-full border-0 grayscale opacity-80 mix-blend-luminosity hover:grayscale-0 hover:opacity-100 hover:mix-blend-normal transition-all duration-500" 
              allowFullScreen="" 
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
              title="Location Map"
            ></iframe>
          </div>
        </div>

        {/* Right Side Form Card */}
        <div className="lg:w-[65%]">
          <div className="bg-white rounded-3xl p-8 md:p-12 shadow-[0_10px_40px_rgba(0,0,0,0.06)] border border-gray-50">
            <div className="text-center mb-12">
              <h2 className="font-heading text-3xl text-dark mb-3">Let's Provide You the Right Service</h2>
              <p className="text-gray-500 text-base">Please fill in the details below and we'll get back to you with an estimate</p>
            </div>

            <form onSubmit={handleSubmit}>
              {status.message && (
                <div className={`p-4 rounded-lg mb-6 ${status.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {status.message}
                </div>
              )}
              {/* Step 1 */}
              <div className="mb-12">
                <div className="flex items-center gap-4 mb-8">
                  <span className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-base">1</span>
                  <h3 className="font-heading text-xl text-dark">Your Details</h3>
                  <div className="flex-1 h-[2px] bg-gray-100 ml-4"></div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Full Name</label>
                    <input required name="fullName" value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} type="text" className="w-full bg-[#f8f9fa] border border-gray-200 rounded-lg px-4 py-3.5 text-base outline-none focus:border-primary focus:bg-white transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Phone No.</label>
                    <input required name="phone" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} type="tel" className="w-full bg-[#f8f9fa] border border-gray-200 rounded-lg px-4 py-3.5 text-base outline-none focus:border-primary focus:bg-white transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Email Address</label>
                    <input required name="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} type="email" className="w-full bg-[#f8f9fa] border border-gray-200 rounded-lg px-4 py-3.5 text-base outline-none focus:border-primary focus:bg-white transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Preferred Contact Method</label>
                    <div className="flex gap-8 mt-4">
                      <label className="flex items-center gap-3 cursor-pointer text-base font-medium text-gray-700">
                        <input type="radio" name="contactMethod" value="call" checked={formData.contactMethod === 'call'} onChange={(e) => setFormData({...formData, contactMethod: e.target.value})} className="accent-primary w-5 h-5" /> Call
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer text-base font-medium text-gray-700">
                        <input type="radio" name="contactMethod" value="email" checked={formData.contactMethod === 'email'} onChange={(e) => setFormData({...formData, contactMethod: e.target.value})} className="accent-primary w-5 h-5" /> Email
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="mb-12">
                <div className="flex items-center gap-4 mb-8">
                  <span className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-base">2</span>
                  <h3 className="font-heading text-xl text-dark">Your Vehicle</h3>
                  <div className="flex-1 h-[2px] bg-gray-100 ml-4"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Vehicle Make</label>
                    <input required type="text" name="make" value={formData.make} onChange={(e) => setFormData({...formData, make: e.target.value})} placeholder="e.g. Toyota" className="w-full bg-[#f8f9fa] border border-gray-200 rounded-lg px-4 py-3.5 text-base outline-none focus:border-primary focus:bg-white placeholder:text-gray-400 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Vehicle Model</label>
                    <input required type="text" name="model" value={formData.model} onChange={(e) => setFormData({...formData, model: e.target.value})} placeholder="e.g. Corolla" className="w-full bg-[#f8f9fa] border border-gray-200 rounded-lg px-4 py-3.5 text-base outline-none focus:border-primary focus:bg-white placeholder:text-gray-400 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Year</label>
                    <input type="number" name="year" value={formData.year} onChange={(e) => setFormData({...formData, year: e.target.value})} placeholder="e.g. 2020" className="w-full bg-[#f8f9fa] border border-gray-200 rounded-lg px-4 py-3.5 text-base outline-none focus:border-primary focus:bg-white placeholder:text-gray-400 transition-colors" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Rego No</label>
                    <input required type="text" name="regNo" value={formData.regNo} onChange={(e) => setFormData({...formData, regNo: e.target.value})} placeholder="e.g. ABC 123" className="w-full bg-[#f8f9fa] border border-gray-200 rounded-lg px-4 py-3.5 text-base outline-none focus:border-primary focus:bg-white placeholder:text-gray-400 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Current Kilometers</label>
                    <input type="number" name="kilometers" value={formData.kilometers} onChange={(e) => setFormData({...formData, kilometers: e.target.value})} placeholder="e.g. 70000" className="w-full bg-[#f8f9fa] border border-gray-200 rounded-lg px-4 py-3.5 text-base outline-none focus:border-primary focus:bg-white placeholder:text-gray-400 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Transmission</label>
                    <div className="flex gap-6 mt-4">
                      <label className="flex items-center gap-3 cursor-pointer text-base font-medium text-gray-700">
                        <input type="radio" name="transmission" value="automatic" checked={formData.transmission === 'automatic'} onChange={(e) => setFormData({...formData, transmission: e.target.value})} className="accent-primary w-5 h-5" /> Automatic
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer text-base font-medium text-gray-700">
                        <input type="radio" name="transmission" value="manual" checked={formData.transmission === 'manual'} onChange={(e) => setFormData({...formData, transmission: e.target.value})} className="accent-primary w-5 h-5" /> Manual
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="mb-12">
                <div className="flex items-center gap-4 mb-8">
                  <span className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-base">3</span>
                  <h3 className="font-heading text-xl text-dark">How Can we Help</h3>
                  <div className="flex-1 h-[2px] bg-gray-100 ml-4"></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  {servicesList.map((srv) => (
                    <div 
                      key={srv.id} 
                      onClick={() => toggleService(srv.id)}
                      className={`relative border rounded-xl p-5 cursor-pointer transition-all hover:shadow-md ${
                        formData.selectedServices.includes(srv.id) ? 'border-primary bg-red-50/50 shadow-sm' : 'border-gray-200 bg-white hover:border-primary/50'
                      }`}
                    >
                      <div className="absolute top-4 right-4">
                        <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
                          formData.selectedServices.includes(srv.id) ? 'bg-primary border-primary' : 'border-gray-300'
                        }`}>
                          {formData.selectedServices.includes(srv.id) && <span className="text-white text-xs font-bold">✓</span>}
                        </div>
                      </div>
                      <h4 className="font-bold text-dark text-sm mb-6 pr-8 leading-snug">{srv.label}</h4>
                      <div className="flex justify-end mt-auto">
                        <srv.icon className={`stroke-[1.5] transition-colors ${formData.selectedServices.includes(srv.id) ? 'text-primary' : 'text-gray-400'}`} size={28} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mb-8">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Please describe the services required</label>
                  <textarea name="description" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Describe the services" rows="4" className="w-full bg-[#f8f9fa] border border-gray-200 rounded-lg px-4 py-3.5 text-base outline-none focus:border-primary focus:bg-white placeholder:text-gray-400 resize-none transition-colors"></textarea>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Upload some pictures</label>
                  <div 
                    className="w-full bg-[#f8f9fa] border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-gray-50 hover:border-primary/50 transition-colors"
                    onClick={() => document.getElementById('quoteFileInput').click()}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        let droppedFiles = Array.from(e.dataTransfer.files);
                        droppedFiles = droppedFiles.filter(file => {
                          if (file.size > 10 * 1024 * 1024) {
                            alert(`File ${file.name} is too large. Maximum size is 10MB.`);
                            return false;
                          }
                          return true;
                        });
                        setFiles(prev => {
                          const newFiles = [...prev, ...droppedFiles];
                          if (newFiles.length > 5) {
                            alert('You can upload a maximum of 5 images.');
                            return newFiles.slice(0, 5);
                          }
                          return newFiles;
                        });
                      }
                    }}
                  >
                    <input id="quoteFileInput" type="file" multiple accept="image/*" onChange={handleFileChange} onClick={(e) => e.target.value = null} className="hidden" />
                    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                      <Upload className="text-primary" size={24} />
                    </div>
                    <span className="text-sm font-semibold text-dark">Choose a file or drag & drop it here</span>
                    <span className="text-xs text-gray-500">JPEG, PNG up to 10MB</span>
                  </div>
                  
                  {files.length > 0 && (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {files.map((file, idx) => (
                        <div key={idx} className="relative rounded-lg overflow-hidden border border-gray-200 h-24 group">
                          <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeFile(idx)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button disabled={status.loading} className="w-full bg-primary text-white font-bold text-lg py-4 rounded-lg hover:bg-primary-dark transition-colors disabled:bg-gray-400">
                {status.loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
};

export default RequestQuote;
