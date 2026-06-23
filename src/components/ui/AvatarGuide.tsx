'use client';

import React, { useState, useEffect } from 'react';
import { X, HelpCircle, MessageCircle } from 'lucide-react';

interface AvatarGuideProps {
  className?: string;
}

// Browser-only safe localStorage access (avoids SSR "localStorage is not a
// function" crashes and private-mode exceptions).
const safeStorage = {
  get(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage?.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
};

const AvatarGuide: React.FC<AvatarGuideProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasSeen, setHasSeen] = useState(false);
  const [showInitial, setShowInitial] = useState(false);

  useEffect(() => {
    // Check if user has seen the guide before
    const seen = safeStorage.get('avatar-guide-seen');
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

  const handleToggle = () => {
    setIsOpen(!isOpen);
    setShowInitial(false);
    safeStorage.set('avatar-guide-seen', 'true');
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleDismiss = () => {
    setShowInitial(false);
    safeStorage.set('avatar-guide-seen', 'true');
  };

  return (
    <div className={`fixed bottom-9 right-4 z-50 ${className}`}>
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
        onClick={handleToggle}
        className="w-22 h-22 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 flex items-center justify-center relative overflow-hidden"
        title="Get help navigating the portfolio"
      >
        {/* Custom icon placeholder - replace with your image */}
        <img src="/kartikey-avatar.png" alt="Kartikey" className="w-full h-full object-cover" />
        
        
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
                  <li>• projects/ - My ML, AR & full-stack work</li>
                  <li>• experience.md - Raya Health, NASA, Intel & more</li>
                  <li>• awards.md - Hackathon wins, patent & achievements</li>
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
                  <li>• Founding Engineer @ Raya Health (HF0 W26)</li>
                  <li>• ex-NASA & ex-Intel</li>
                  <li>• $25,000+ funding at Snap's accelerator</li>
                  <li>• 10x hackathon winner</li>
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