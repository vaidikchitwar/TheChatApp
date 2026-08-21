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
    <div className="min-h-screen bg-cream flex flex-col font-sans">
      {/* Top Header Navigation */}
      <header className="px-8 py-6 flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-10 shadow-soft">
        <div className="flex items-center gap-2">
          <div className="bg-mint p-2 rounded-xl text-white">
            <MessageCircle size={24} />
          </div>
          <h1 className="text-2xl font-bold text-deepslate-900 tracking-tight">ChatSync</h1>
        </div>
        <div className="flex gap-4">
          <Link to="/auth" className="px-5 py-2.5 rounded-full font-medium text-deepslate-800 hover:bg-black/5 transition-colors">
            Login
          </Link>
          <Link to="/auth" state={{ isSignUp: true }} className="px-5 py-2.5 rounded-full font-medium bg-mint text-white hover:bg-mint/90 shadow-md hover:shadow-lg transition-all flex items-center gap-2">
            Get Started <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="flex-grow flex flex-col items-center justify-center text-center px-4 py-20">
        <h2 className="text-5xl md:text-7xl font-extrabold text-deepslate-900 tracking-tight leading-tight max-w-4xl mb-6">
          Connect in <span className="text-mint">real-time</span> with zero friction.
        </h2>
        <p className="text-xl text-muted-text max-w-2xl mb-12">
          Experience seamless, high-speed messaging with our beautifully crafted platform designed for modern teams and communities.
        </p>

        {/* Primary Call to Action */}
        <div className="flex flex-col sm:flex-row gap-4 mb-20">
          <Link to="/auth" state={{ isSignUp: true }} className="px-8 py-4 rounded-full font-bold bg-deepslate-900 text-white hover:bg-deepslate-800 hover:-translate-y-1 shadow-xl transition-all flex items-center justify-center gap-2 text-lg">
            Start Chatting Now
          </Link>
        </div>

        {/* Features Showcase Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto text-left w-full">
          <div className="bg-white p-8 rounded-3xl shadow-soft hover:shadow-md transition-shadow border border-white/40">
            <div className="bg-golden/20 w-12 h-12 rounded-2xl flex items-center justify-center text-golden mb-6">
              <Zap size={24} />
            </div>
            <h3 className="text-xl font-bold text-deepslate-900 mb-3">Lightning Fast</h3>
            <p className="text-muted-text leading-relaxed">Built on WebSockets for instant message delivery and real-time typing indicators.</p>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-soft hover:shadow-md transition-shadow border border-white/40">
            <div className="bg-coral/20 w-12 h-12 rounded-2xl flex items-center justify-center text-coral mb-6">
              <Shield size={24} />
            </div>
            <h3 className="text-xl font-bold text-deepslate-900 mb-3">Secure & Private</h3>
            <p className="text-muted-text leading-relaxed">Industry-standard JWT authentication and bcrypt password hashing keeps your data safe.</p>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-soft hover:shadow-md transition-shadow border border-white/40">
            <div className="bg-mint/20 w-12 h-12 rounded-2xl flex items-center justify-center text-mint mb-6">
              <MessageCircle size={24} />
            </div>
            <h3 className="text-xl font-bold text-deepslate-900 mb-3">Beautiful Design</h3>
            <p className="text-muted-text leading-relaxed">A stunning, high-contrast interface carefully crafted for maximum readability and joy.</p>
          </div>
        </div>
      </main>
    </div>
  );
}

