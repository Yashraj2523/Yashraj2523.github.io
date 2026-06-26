// data.js
// IMPORTANT: This file is ONLY the one-time seed used the very first time the
// site ever loads with a fresh Supabase database. After that first load, the
// live site reads and writes EVERYTHING through Supabase (table: site_content,
// row id 'main') — this file is never read again automatically.
//
// To actually edit your live content day-to-day, use admin.html — it has a
// form for every section plus image/PDF uploads, and writes straight to
// Supabase. If you ever want to wipe the database and start over from
// whatever is written here, admin.html has a "Reset to data.js defaults"
// button under Settings that does exactly that.

const SITE_DATA = {

  hero_name: "Yashwanth R",
  hero_sub: "Full-stack engineer with a deep AI/ML core — I design, train, ship and deploy software that solves problems people actually have. Graduating 2026, looking for my first full-time role.",
  roles: ["intelligent systems", "full-stack web apps", "computer vision pipelines", "scalable backends", "NLP tools"],

  // Profile photo slideshow — local files in images/profile/ work great here.
  profile_photos: [
    "images/profile/me1.jpg",
    "images/profile/me2.jpg",
    "images/profile/me3.jpg",
    "images/profile/me4.jpg",
    "images/profile/me5.jpg",
    "images/profile/me6.jpg",
    "images/profile/me7.jpeg"
  ],

  about_text_html: `
    <p>I'm a software engineering postgraduate from VIT Vellore, most at home where full-stack engineering meets applied AI. My work ranges from training CNNs for real-time inference to shipping full-stack apps with role-based access control on production infrastructure.</p>
    <p>I care about clarity — in code, in explanations, and in the systems I design. I've spent the last few years learning DevOps pipelines, cloud deployment, secure database design, and the discipline of agile delivery, alongside the AI/ML stack: TensorFlow, Keras, OpenCV, NLP and transfer learning.</p>
    <p>Right now I'm looking for a role where I can take a system from prototype to production — and keep learning the entire way there.</p>
  `,

  linkedin_blurb: "Experience, recommendations and the full professional timeline — connect with me there.",

  skills: [
    { category: "Languages", items: ["Java", "Python", "JavaScript"] },
    { category: "Web & APIs", items: ["HTML", "CSS", "REST APIs", "FastAPI", "Uvicorn"] },
    { category: "AI / ML", items: ["CNN", "NLP", "OpenCV", "TensorFlow", "Keras", "Deep Learning", "Transfer Learning"] },
    { category: "Databases & Cloud", items: ["MySQL", "Azure", "Heroku"] },
    { category: "Tools", items: ["GitHub", "Postman"] },
    { category: "Operating Systems", items: ["Windows", "Linux (Kali)", "Ubuntu"] },
  ],

  // metrics: small highlight badges shown on the card AND in the popup,
  // e.g. { label: "Accuracy", value: "95%" }. Leave metrics: [] for none.
  projects: [
    {
      title: "AI-Based Meat Spoilage Detection System",
      desc: "CNN-based model with a FastAPI backend for real-time freshness prediction, with Grad-CAM integrated for explainable AI — simulating real-world food quality monitoring.",
      tags: ["CNN", "FastAPI", "Grad-CAM", "Computer Vision"],
      metrics: [{ label: "Accuracy", value: "95%" }, { label: "Inference", value: "50ms" }, { label: "Samples", value: "1000+" }],
      features: [
        "Real-time freshness classification from camera input",
        "Grad-CAM heatmaps for explainable predictions",
        "FastAPI backend serving the trained model"
      ],
      github: "https://github.com/Yashraj2523",
      demo: "",
      screenshots: []
    },
    {
      title: "AI Virtual Mouse",
      desc: "An AI-powered virtual mouse that enables full PC control through hand gestures, built as an accessibility tool for persons with disability.",
      tags: ["OpenCV", "Computer Vision", "Accessibility"],
      metrics: [],
      features: [
        "Hand-landmark tracking via webcam, no extra hardware",
        "Gesture mapping for click, scroll and drag",
        "Built specifically with accessibility use-cases in mind"
      ],
      github: "https://github.com/Yashraj2523",
      demo: "",
      screenshots: []
    },
    {
      title: "Hate Speech Detection using AI",
      desc: "An NLP + SVM based hate speech detector with auto-transcription and regional language support.",
      tags: ["NLP", "SVM", "Speech-to-Text"],
      metrics: [],
      features: [
        "SVM classifier trained on labelled hate-speech datasets",
        "Auto-transcription pipeline for audio input",
        "Regional language support beyond English"
      ],
      github: "https://github.com/Yashraj2523",
      demo: "",
      screenshots: []
    },
    {
      title: "Online Job Portal",
      desc: "Full-stack job portal with role-based access control and encrypted storage, deployed on Heroku using a PaaS model.",
      tags: ["Full-Stack", "RBAC", "Heroku", "Security"],
      metrics: [],
      features: [
        "Role-based access control for recruiters vs candidates",
        "Encrypted storage for sensitive applicant data",
        "Deployed and load-tested on Heroku's PaaS model"
      ],
      github: "https://github.com/Yashraj2523",
      demo: "",
      screenshots: []
    },
    {
      title: "Image Quality Enhancer using SRGAN",
      desc: "An AI system that upscales low-resolution images into high-quality outputs using SRGAN-based super-resolution.",
      tags: ["GANs", "Super-Resolution", "Deep Learning"],
      metrics: [],
      features: [
        "SRGAN architecture trained for 4x upscaling",
        "Perceptual loss for sharper, more natural textures",
        "Batch processing support for multiple images"
      ],
      github: "https://github.com/Yashraj2523",
      demo: "",
      screenshots: []
    },
  ],

  // file: URL to certificate image or PDF. Leave "" if not uploaded yet.
  certifications: [
    { name: "Microsoft Certified: Azure AI Fundamentals", issuer: "Microsoft", year: "Jul 2024", file: "" },
    { name: "Exploratory Data Analysis", issuer: "Infosys Springboard", year: "Sep 2024", file: "" },
    { name: "Artificial Intelligence and Machine Learning from Scratch", issuer: "Udemy", year: "Jan 2025", file: "" },
    { name: "DevOps Fundamentals", issuer: "IBM", year: "Jun 2025", file: "" },
    { name: "Oracle Java Foundations", issuer: "Oracle", year: "Aug 2025", file: "" },
  ],

  hobbies: [
    { emoji: "🎬", label: "Filming & editing for YouTube" },
    { emoji: "🤖", label: "Tinkering with AI side-projects" },
    { emoji: "🧩", label: "Competitive problem solving" },
    { emoji: "🎮", label: "Gaming" },
    { emoji: "📚", label: "Reading tech & sci-fi" },
    { emoji: "🗣️", label: "Public speaking" },
  ],

  // ---- RECRUITER-FOCUSED SECTIONS ----
  experience: [
    // { role: "Software Engineering Intern", org: "Company Name", period: "Jun 2025 – Aug 2025", desc: "What you did, in 1-2 sentences." }
  ],

  education: [
    { degree: "M.Tech, Software Engineering", school: "Vellore Institute of Technology", period: "2021 – 2026", detail: "CGPA 7.97" },
    { degree: "12th Grade", school: "Lakshmi Garden School", period: "2019 – 2020", detail: "62.17%" },
    { degree: "10th Grade", school: "Lakshmi Garden School", period: "2017 – 2018", detail: "88.4%" },
  ],

  achievements: [
    // { title: "Hackathon Winner", desc: "Won 1st place at XYZ Hackathon 2025", year: "2025" }
  ],

  publications: [
    // { title: "Paper title", venue: "Conference/Journal name", year: "2025", link: "" }
  ],

  languages: [
    { name: "English", level: 95 },
    { name: "Hindi", level: 85 },
    { name: "Tamil", level: 100 },
  ],

  github_username: "Yashraj2523",
  linkedin_url: "https://www.linkedin.com/in/yashraj2523/",
  youtube_url: "https://youtube.com/@yashwanthrajesh4726",
  youtube_banner: "images/channel-art/banner1.jpg",
  youtube_logo: "images/profile/youtube-logo.jpg",
  youtube_subs: "",
  email: "yashwanthriya25@gmail.com",
  phone: "+91-8438772502",
  background_image: "",
  resume_url: "Yashwanth_Resume.pdf",

  // ---- SITE SETTINGS (admin-editable: Settings tab) ----
  // Anything here is applied live as CSS custom properties — change a number,
  // the whole site re-renders with it, no code edits required.
  settings: {
    iconButtonSize: 36,     // px, the round nav icon buttons (theme/login)
    avatarSize: 320,        // px, profile photo slideshow diameter
    cardRadius: 18,         // px, corner roundness of cards/panels
    glassBlur: 18,          // px, backdrop blur strength on glass panels
    sectionSpacing: 130,    // px, top padding between major sections
  },
};
