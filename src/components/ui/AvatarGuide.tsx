'use client';

import React, { useState, useEffect } from 'react';
import { X, HelpCircle, MessageCircle } from 'lucide-react';

interface AvatarGuideProps {
  className?: string;
}

const AvatarGuide: React.FC<AvatarGuideProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasSeen, setHasSeen] = useState(false);
  const [showInitial, setShowInitial] = useState(false);

  useEffect(() => {
    // Check if user has seen the guide before
    const seen = localStorage.getItem('avatar-guide-seen');
    if (!seen) {
      // Show initial message after 3 seconds
      const timer = setTimeout(() => {
        setShowInitial(true);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setHasSeen(true);
    }
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    setShowInitial(false);
    localStorage.setItem('avatar-guide-seen', 'true');
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleDismiss = () => {
    setShowInitial(false);
    localStorage.setItem('avatar-guide-seen', 'true');
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      {/* Initial floating message */}
      {showInitial && !isOpen && (
        <div className="absolute bottom-16 right-0 mb-3 animate-bounce">
          <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg max-w-xs">
            <div className="flex items-center gap-2">
              <MessageCircle size={16} />
              <span className="text-sm">Need help navigating? Click me! 👋</span>
            </div>
            <div className="flex justify-end mt-2">
              <button
                onClick={handleDismiss}
                className="text-xs text-blue-200 hover:text-white"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Avatar button */}
      <button
        onClick={handleOpen}
        className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 flex items-center justify-center text-white font-bold text-lg border-2 border-blue-400 relative"
        title="Get help navigating the portfolio"
      >
        {/* Custom icon placeholder - replace with your image */}
        <div className="w-8 h-8 rounded-full overflow-hidden">
          {/* TODO: Replace this div with your custom icon image */}
          <img src="public/kartikey-avatar.png" alt="Kartikey" className="w-full h-full object-cover" /> 
        </div>
        
        {/* Fallback "K" text - remove this when you add your icon */}
        <span className="absolute inset-0 flex items-center justify-center">K</span>
      </button>

      {/* Help panel */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <HelpCircle size={20} className="text-blue-400" />
              <h3 className="text-white font-semibold">Portfolio Guide</h3>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 max-h-96 overflow-y-auto">
            <div className="space-y-4 text-sm text-gray-300">
              {/* Welcome */}
              <div>
                <p className="text-blue-400 font-medium mb-2">
                  👋 Hey! I'm Kartikey - Welcome to my interactive portfolio!
                </p>
              </div>

              {/* Navigation */}
              <div>
                <h4 className="text-white font-medium mb-2">📁 How to Navigate:</h4>
                <ul className="space-y-1 ml-4">
                  <li>• Click files in the sidebar to explore my projects</li>
                  <li>• Use the terminal below for commands (try 'help' or 'ls')</li>
                  <li>• Open multiple tabs just like real VS Code!</li>
                </ul>
              </div>

              {/* What to check out */}
              <div>
                <h4 className="text-white font-medium mb-2">🚀 What to Check Out:</h4>
                <ul className="space-y-1 ml-4">
                  <li>• README.md - Start here for overview</li>
                  <li>• projects/ - My funded AR projects & hackathon wins</li>
                  <li>• experience.md - Work at Snap Inc. & Intel</li>
                  <li>• awards.md - $50k+ funding & achievements</li>
                </ul>
              </div>

              {/* Terminal commands */}
              <div>
                <h4 className="text-white font-medium mb-2">💻 Terminal Commands:</h4>
                <ul className="space-y-1 ml-4">
                  <li>• help - Show all available commands</li>
                  <li>• whoami - Learn about me</li>
                  <li>• cd projects - Browse my work</li>
                  <li>• achievements - View accomplishments</li>
                </ul>
              </div>

              {/* Quick facts */}
              <div>
                <h4 className="text-white font-medium mb-2">🎯 Quick Facts:</h4>
                <ul className="space-y-1 ml-4">
                  <li>• AR Developer at Snap Inc.</li>
                  <li>• $50,000+ in secured funding</li>
                  <li>• 8x hackathon winner</li>
                  <li>• Led Penn State ranking: 185→74 nationally</li>
                </ul>
              </div>

              {/* Contact */}
              <div className="pt-2 border-t border-gray-700">
                <p className="text-blue-400">
                  Questions? Email: kartikeypandey.official@gmail.com
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvatarGuide; 