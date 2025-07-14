'use client';

import React from 'react';

const SEOContent: React.FC = () => {
  return (
    <div 
      className="sr-only" 
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '-9999px',
        width: '1px',
        height: '1px',
        overflow: 'hidden'
      }}
    >
      {/* SEO Content for ATS Systems and Search Engines */}
      <section>
        <h1>Kartikey Pandey - AR Developer & Software Engineer</h1>
        
        <h2>Professional Summary</h2>
        <p>
          AR Developer at Snap Inc. with $50,000+ in secured funding, 8x hackathon winner, 
          and experience leading Penn State's competitive programming team from 185th to 74th nationally.
        </p>

        <h2>Work Experience</h2>
        <h3>AR Developer - Snap Inc. (2024 - Present)</h3>
        <p>
          Developing augmented reality experiences and applications using cutting-edge AR technologies. 
          Focus on AR development and implementation, cross-platform AR solutions, and performance 
          optimization for AR applications.
        </p>

        <h3>Software Engineer Intern - Intel Corporation (2023 - 2024)</h3>
        <p>
          Software engineering internship focusing on system-level programming and optimization. 
          Experience with system-level programming, performance optimization, and software development lifecycle.
        </p>

        <h2>Education</h2>
        <h3>Bachelor's in Computer Science - Penn State University (2021 - 2025)</h3>
        <p>GPA: 3.8</p>
        <p>Relevant coursework: Data Structures & Algorithms, Software Engineering, Computer Architecture, Database Systems</p>

        <h2>Key Projects</h2>
        <h3>AR E-commerce Platform</h3>
        <p>
          Funded AR project enabling virtual try-ons and interactive shopping experiences. 
          Secured $25,000 in funding. Implemented AR try-on technology and integrated with e-commerce platforms.
        </p>

        <h3>Task Management AR App</h3>
        <p>
          Augmented reality task management system with spatial organization. 
          Features spatial AR interface design, real-time collaboration features, and cross-platform compatibility.
        </p>

        <h2>Skills</h2>
        <h3>Programming Languages</h3>
        <p>JavaScript, TypeScript, Python, Java, C++, React, Next.js</p>

        <h3>AR/VR Development</h3>
        <p>Unity, Unreal Engine, ARCore, ARKit, Snap Lens Studio</p>

        <h3>Web Development</h3>
        <p>React, Next.js, Node.js, MongoDB, PostgreSQL, AWS</p>

        <h3>Mobile Development</h3>
        <p>React Native, Flutter, iOS, Android</p>

        <h2>Achievements</h2>
        <ul>
          <li>8x Hackathon Winner (2021-2024)</li>
          <li>$50,000+ Secured Funding for AR and software projects</li>
          <li>Led Penn State Competitive Programming team from 185th to 74th nationally</li>
        </ul>

        <h2>Contact Information</h2>
        <p>Email: kartikeypandey.official@gmail.com</p>
        <p>LinkedIn: https://linkedin.com/in/kartikeypandey</p>
        <p>GitHub: https://github.com/Kart-ing</p>

        <h2>Portfolio Content</h2>
        <p>
          This portfolio showcases my work through an interactive VS Code interface. 
          Key sections include: README.md for overview, projects/ for AR projects and hackathon wins, 
          experience.md for work history, and awards.md for achievements.
        </p>

        <h2>Available Resources</h2>
        <ul>
          <li><a href="/resume.json">Structured Resume Data (JSON)</a></li>
          <li><a href="/seo-content">SEO Content Index</a></li>
          <li><a href="/sitemap.xml">Sitemap</a></li>
        </ul>
      </section>
    </div>
  );
};

export default SEOContent; 