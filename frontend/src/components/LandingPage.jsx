/**
 * Landing Page Component
 * 
 * Public hero presentation page showcasing application features, design aesthetics,
 * and quick-start links to authentication flows.
 */

import { Link } from "react-router-dom";
import { MessageCircle, Zap, Shield, ArrowRight } from "lucide-react";

/**
 * LandingPage component rendering brand header, hero proposition, CTA buttons, and feature cards.
 * 
 * @returns {JSX.Element} The rendered landing page view.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-transparent flex flex-col font-sans relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-0 left-0 w-[40rem] h-[40rem] bg-mint/20 blur-[100px] rounded-full -translate-x-1/2 -translate-y-1/2 z-0"></div>
      <div className="absolute bottom-0 right-0 w-[40rem] h-[40rem] bg-golden/20 blur-[100px] rounded-full translate-x-1/2 translate-y-1/2 z-0"></div>
      
      {/* Top Header Navigation */}
      <header className="px-8 py-6 flex justify-between items-center bg-white/40 backdrop-blur-xl sticky top-0 z-50 border-b border-white/40 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-br from-mint to-teal-500 p-2.5 rounded-xl text-white shadow-md ring-2 ring-white/50">
            <MessageCircle size={24} />
          </div>
          <h1 className="text-3xl font-extrabold text-deepslate-900 tracking-tighter ml-1">ChatSync</h1>
        </div>
        <div className="flex gap-4">
          <Link to="/auth" className="px-6 py-2.5 rounded-full font-bold text-deepslate-800 hover:bg-white/60 transition-all border border-transparent hover:border-white/50 shadow-sm hover:shadow-md">
            Login
          </Link>
          <Link to="/auth" state={{ isSignUp: true }} className="px-6 py-2.5 rounded-full font-bold bg-deepslate-900 text-white hover:bg-deepslate-800 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2">
            Get Started <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="flex-grow flex flex-col items-center justify-center text-center px-4 py-24 relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 border border-white/60 shadow-sm mb-8 text-sm font-bold text-mint animate-fade-in-up">
          <span className="w-2 h-2 rounded-full bg-mint animate-pulse"></span>
          Now in Open Beta
        </div>
        
        <h2 className="text-6xl md:text-8xl font-black text-deepslate-900 tracking-tighter leading-[1.1] max-w-5xl mb-8 drop-shadow-sm">
          Connect in <span className="text-transparent bg-clip-text bg-gradient-to-r from-mint to-teal-500 drop-shadow-sm">real-time</span> with zero friction.
        </h2>
        
        <p className="text-xl md:text-2xl text-deepslate-800/80 font-medium max-w-3xl mb-12 leading-relaxed">
          Experience seamless, high-speed messaging with our beautifully crafted platform designed for modern teams and communities.
        </p>

        {/* Primary Call to Action */}
        <div className="flex flex-col sm:flex-row gap-6 mb-24">
          <Link to="/auth" state={{ isSignUp: true }} className="px-10 py-5 rounded-full font-bold bg-gradient-to-r from-mint to-teal-500 text-white hover:shadow-glow hover:-translate-y-1 shadow-xl transition-all flex items-center justify-center gap-3 text-lg tracking-wide border border-white/20">
            Start Chatting Now <ArrowRight size={20} />
          </Link>
        </div>

        {/* Features Showcase Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto text-left w-full">
          <div className="bg-white/60 backdrop-blur-xl p-10 rounded-[2.5rem] shadow-soft hover:shadow-xl transition-all border border-white/70 hover:-translate-y-1 group">
            <div className="bg-golden/20 w-16 h-16 rounded-2xl flex items-center justify-center text-golden mb-8 group-hover:scale-110 group-hover:rotate-3 transition-transform">
              <Zap size={32} />
            </div>
            <h3 className="text-2xl font-bold text-deepslate-900 mb-4 tracking-tight">Lightning Fast</h3>
            <p className="text-deepslate-800/70 font-medium leading-relaxed text-lg">Built on WebSockets for instant message delivery and real-time typing indicators with zero lag.</p>
          </div>

          <div className="bg-white/60 backdrop-blur-xl p-10 rounded-[2.5rem] shadow-soft hover:shadow-xl transition-all border border-white/70 hover:-translate-y-1 group">
            <div className="bg-coral/20 w-16 h-16 rounded-2xl flex items-center justify-center text-coral mb-8 group-hover:scale-110 group-hover:-rotate-3 transition-transform">
              <Shield size={32} />
            </div>
            <h3 className="text-2xl font-bold text-deepslate-900 mb-4 tracking-tight">Secure & Private</h3>
            <p className="text-deepslate-800/70 font-medium leading-relaxed text-lg">Industry-standard JWT authentication and bcrypt password hashing keeps your data safe from prying eyes.</p>
          </div>

          <div className="bg-white/60 backdrop-blur-xl p-10 rounded-[2.5rem] shadow-soft hover:shadow-xl transition-all border border-white/70 hover:-translate-y-1 group">
            <div className="bg-mint/20 w-16 h-16 rounded-2xl flex items-center justify-center text-mint mb-8 group-hover:scale-110 group-hover:rotate-3 transition-transform">
              <MessageCircle size={32} />
            </div>
            <h3 className="text-2xl font-bold text-deepslate-900 mb-4 tracking-tight">Beautiful Design</h3>
            <p className="text-deepslate-800/70 font-medium leading-relaxed text-lg">A stunning, high-contrast glassmorphic interface carefully crafted for maximum readability and joy.</p>
          </div>
        </div>
      </main>
    </div>
  );
}

