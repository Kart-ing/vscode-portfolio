# 🚀 Deployment Guide - VS Code Portfolio

This guide covers multiple hosting options for your VS Code-themed portfolio.

## 📋 Prerequisites

1. **GitHub Account** (for version control)
2. **Node.js** (already installed)
3. **Git** (for pushing to repository)

## 🎯 Option 1: Vercel (Recommended)

### Step 1: Prepare Your Project
```bash
# Build your project locally to test
npm run build

# If build succeeds, you're ready to deploy!
```

### Step 2: Deploy to Vercel
```bash
# Login to Vercel (first time only)
vercel login

# Deploy your project
vercel

# Follow the prompts:
# - Set up and deploy? → Yes
# - Which scope? → Select your account
# - Link to existing project? → No
# - What's your project's name? → vscode-portfolio
# - In which directory is your code located? → ./
# - Want to override the settings? → No
```

### Step 3: Custom Domain (Optional)
1. Go to [vercel.com](https://vercel.com)
2. Select your project
3. Go to Settings → Domains
4. Add your custom domain

### Step 4: Automatic Deployments
- Push to GitHub: `git push origin main`
- Vercel automatically deploys on every push

---

## 🌐 Option 2: Netlify

### Step 1: Build Configuration
Create `netlify.toml` in your project root:
```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

### Step 2: Deploy
1. Go to [netlify.com](https://netlify.com)
2. Click "New site from Git"
3. Connect your GitHub repository
4. Build command: `npm run build`
5. Publish directory: `.next`
6. Deploy!

---

## ☁️ Option 3: Railway

### Step 1: Prepare
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login
```

### Step 2: Deploy
```bash
# Initialize Railway project
railway init

# Deploy
railway up
```

---

## 🐳 Option 4: Docker (Advanced)

### Step 1: Create Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

### Step 2: Build and Deploy
```bash
# Build image
docker build -t vscode-portfolio .

# Run locally
docker run -p 3000:3000 vscode-portfolio

# Deploy to any Docker-compatible platform
```

---

## 🔧 Pre-Deployment Checklist

### ✅ Code Optimization
- [ ] All TypeScript errors fixed
- [ ] Build passes locally (`npm run build`)
- [ ] No console errors in browser
- [ ] All features working

### ✅ Performance
- [ ] Images optimized
- [ ] Bundle size reasonable
- [ ] Loading times acceptable

### ✅ SEO & Meta
- [ ] Title and description set
- [ ] Open Graph tags added
- [ ] Favicon included

### ✅ Content
- [ ] Resume information updated
- [ ] Project links working
- [ ] Contact information current
- [ ] GitHub links correct

---

## 🎨 Customization for Production

### 1. Update Personal Information
Edit `src/contexts/FileSystemContext.tsx`:
```typescript
// Update your personal details in the markdown files
const fileStructure: FileNode[] = [
  // ... your files with updated content
]
```

### 2. Add Analytics (Optional)
Add Google Analytics or other tracking:
```typescript
// In _app.tsx or layout.tsx
useEffect(() => {
  // Add your analytics code here
}, [])
```

### 3. Environment Variables
Create `.env.local` for sensitive data:
```env
NEXT_PUBLIC_GITHUB_URL=https://github.com/Kart-ing
NEXT_PUBLIC_LINKEDIN_URL=https://www.linkedin.com/in/kartikeypandey2004/
```

---

## 🚀 Quick Deploy Commands

### Vercel (Fastest)
```bash
npm run build && vercel --prod
```

### Netlify
```bash
npm run build && netlify deploy --prod --dir=.next
```

### Railway
```bash
railway up --prod
```

---

## 📊 Performance Monitoring

After deployment, monitor:
- **Page Load Speed**: Use Lighthouse
- **Core Web Vitals**: Check Google PageSpeed Insights
- **Uptime**: Monitor with UptimeRobot or similar
- **Analytics**: Track user engagement

---

## 🔄 Continuous Deployment

### GitHub Actions (Vercel/Netlify)
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      # Add deployment step based on platform
```

---

## 🆘 Troubleshooting

### Common Issues:
1. **Build Fails**: Check TypeScript errors
2. **Runtime Errors**: Check browser console
3. **Styling Issues**: Verify Tailwind CSS build
4. **Performance**: Optimize images and bundle size

### Support:
- **Vercel**: [vercel.com/support](https://vercel.com/support)
- **Netlify**: [netlify.com/support](https://netlify.com/support)
- **Railway**: [railway.app/support](https://railway.app/support)

---

## 🎉 Success!

The portfolio's public URL is `https://www.kartikey.fyi`.
