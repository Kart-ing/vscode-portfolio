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
        <h1>Kartikey Pandey - Founding Engineer & Software Engineer</h1>

        <h2>Professional Summary</h2>
        <p>
          Founding Engineer at Raya Health (HF0 W26). Full-stack and machine-learning engineer
          building scalable systems, cloud-native applications, and AI-driven products. 10x hackathon
          winner across ML, computer vision, and full-stack development. Previously a Machine Learning
          Engineer on NASA&apos;s Lunar Autonomy Challenge (via JHU APL) and an engineer at Intel.
          Founder &amp; President of Penn State&apos;s Collegiate Hackathon Team, which he led from
          national rank #185 to #74.
        </p>

        <h2>Work Experience</h2>
        <h3>Founding Engineer - Raya Health (2026 - Present)</h3>
        <p>
          Founding engineer building the company&apos;s product end-to-end as part of the HF0 W26
          residency. Full-stack engineering, ML, and cloud infrastructure.
        </p>

        <h3>Founder &amp; President - Penn State Collegiate Hackathon Team (2024 - 2025)</h3>
        <p>
          Founded and led the team, growing it to 27+ members and elevating Penn State&apos;s national
          hackathon rank from #185 to #74 within a year. Built a dual-track mentorship program and
          secured national sponsorships.
        </p>

        <h3>Machine Learning Engineer - NASA Lunar Autonomy Challenge / JHU APL (2024 - 2025)</h3>
        <p>
          Selected for the NASA-affiliated Lunar Autonomy Challenge run by Johns Hopkins University
          Applied Physics Laboratory. Built autonomous lunar robotics for navigation, excavation, and
          resource utilization using CARLA simulation and SLAM, supporting NASA&apos;s Lunar Surface
          Innovation Initiative (LSII).
        </p>

        <h3>Software Engineer Intern - ColdStart (2025)</h3>
        <p>Software engineering internship.</p>

        <h3>President &amp; Technical Lead - Google Developer Student Club, Penn State (2023 - 2025)</h3>
        <p>Built a 200+ student community focused on software engineering, AI/ML, and cloud technologies.</p>

        <h3>Engineer - Intel Corporation (2020 - 2021)</h3>
        <p>
          Built an ML training pipeline (TensorFlow, Python, Docker, AWS) reducing model deployment time
          by 33%. Developed computer-vision systems for chip defect detection (OpenCV, PyTorch) at 97%
          accuracy on 100,000+ test images, and a BERT-based NLP document classifier processing 1,000+
          technical specs per day at 90% accuracy.
        </p>

        <h2>Education</h2>
        <h3>B.S. Computer Science, Minor in Entrepreneurship - Penn State University (2022 - 2026)</h3>
        <p>Relevant coursework: Data Structures &amp; Algorithms, Software Engineering, Computer Architecture, Database Systems, Machine Learning</p>

        <h2>Key Projects</h2>
        <h3>ReCompress - Query-Aware Prompt Compression</h3>
        <p>
          Published research (Zenodo DOI 10.5281/zenodo.20786357) on query-aware prompt compression
          distilled into a 1.5B-parameter model, achieving an 8.1x reduction in multi-turn conversation
          tokens. Built at the UC Berkeley AI Hackathon 2026.
        </p>

        <h3>Multiverse - Speculative Execution for AI Agents</h3>
        <p>
          A speculative-execution engine that forks agent tool calls into parallel sandboxed futures,
          verifies them, and commits the winner atomically, enabling rewind and deterministic replay.
        </p>

        <h3>Snap Spectacles Accelerator - AR/AI Projects</h3>
        <p>
          Secured $25,000+ in funding for AR/AI development with TypeScript, Node.js, and real-time cloud
          synchronization. Snap AR Challenge Winner. Projects include Reality Rush (HackPSU 1st place AR
          fitness trainer) and Project Elementals (multiplayer AR).
        </p>

        <h2>Skills</h2>
        <h3>Core</h3>
        <p>Software Engineering, Full-Stack Development, Machine Learning</p>

        <h3>Programming Languages</h3>
        <p>Python, TypeScript, JavaScript, Java, C++, SQL</p>

        <h3>Machine Learning &amp; AI</h3>
        <p>TensorFlow, PyTorch, OpenCV, BERT/NLP, Computer Vision, SLAM</p>

        <h3>Web &amp; Backend</h3>
        <p>React, Next.js, Node.js, Flask, FastAPI, PostgreSQL, MongoDB</p>

        <h3>Cloud &amp; DevOps</h3>
        <p>AWS, Docker, Modal, Vercel, Railway</p>

        <h2>Honors &amp; Awards</h2>
        <ul>
          <li>10x Hackathon Winner</li>
          <li>Harvard Hack - CareYaya Track, 2nd Place</li>
          <li>HackPSU - 2nd Place Overall</li>
          <li>HackPSU Spring 2024 Entrepreneurship Award</li>
          <li>Best Cybersecurity Track - Bitcamp</li>
          <li>Snap AR Challenge Winner ($25,000+ in secured AR/AI funding)</li>
          <li>Led Penn State Collegiate Hackathon Team from national rank #185 to #74</li>
          <li>Patent: System and Method Providing Data Conversion</li>
        </ul>

        <h2>Contact Information</h2>
        <p>Email: kartikeypandey.official@gmail.com</p>
        <p>LinkedIn: https://linkedin.com/in/kartikeypandey2004</p>
        <p>GitHub: https://github.com/Kart-ing</p>

        <h2>Portfolio Content</h2>
        <p>
          This portfolio showcases my work through an interactive VS Code interface.
          Key sections include: README.md for overview, projects/ for projects and research,
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