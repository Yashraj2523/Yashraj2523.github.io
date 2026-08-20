// data.js
// This is the SEED content. On first load, app.js pushes this into Supabase
// (table: site_content, row id 'main') if no row exists yet, then always
// reads from Supabase after that. Edit mode writes back to Supabase.
// If Supabase isn't configured (see config.js), the site just runs on this
// file directly and "Edit mode" falls back to browser storage only.

const SITE_DATA = {

  hero_name: "Yashwanth R",
  hero_sub: "Full-stack engineer with a deep AI/ML core — I design, train, ship and deploy software that solves problems people actually have. Graduating 2026, looking for my first full-time role.",
  roles: ["intelligent systems", "full-stack web apps", "computer vision pipelines", "scalable backends", "NLP tools"],

  // ---- PROFILE PHOTO SLIDESHOW ----
  // Add as many image URLs/paths as you like. Local files work too —
  // just drop them in this folder and reference them like "me1.jpg".
  profile_photos: [
    "https://api.dicebear.com/7.x/shapes/svg?seed=yashwanth1",
    "https://api.dicebear.com/7.x/shapes/svg?seed=yashwanth2",
    "https://api.dicebear.com/7.x/shapes/svg?seed=yashwanth3"
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

  // ---- PROJECTS ----
  // "screenshots" and "demo" are optional — leave screenshots: [] or demo: ""
  // if you don't have one yet; the popup will just hide that part.
  projects: [
    {
      title: "AI-Based Meat Spoilage Detection System",
      desc: "CNN-based model with a FastAPI backend for real-time freshness prediction, with Grad-CAM integrated for explainable AI — simulating real-world food quality monitoring.",
      tags: ["CNN", "FastAPI", "Grad-CAM", "Computer Vision"],
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

  // ---- CERTIFICATIONS ----
  // "file" can be an image (.jpg/.png) or a PDF — the viewer auto-detects it.
  // Leave file: "" if you haven't uploaded the certificate yet.
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

  github_username: "Yashraj2523",
  linkedin_url: "https://www.linkedin.com/in/yashraj2523/",
  youtube_url: "https://youtube.com/@yashwanthrajesh4726",
  youtube_banner: "images/channel-art/banner1.jpg",
  youtube_logo: "images/channel-art/banner2.jpg",
  youtube_subs: "100+",
  email: "yashwanthriya25@gmail.com",
  phone: "+91-8438772502",

  background_image: "",
  resume_url: "Yashwanth_Resume.pdf",
  connectLinks: [],
  customSections: [],
  sectionVisibility: {},
  sectionMeta: {},

  settings: {
    iconButtonSize: 36,
    avatarSize: 320,
    cardRadius: 18,
    glassBlur: 18,
    sectionSpacing: 130,
    themePalette: "default",
    bgStyle: "dots",
    wallpaperOpacity: 35,
    eggsEnabled: true,
    cursorStyleId: "default",
    cursorTrailOn: false,
    emailjsService: "",
    emailjsTemplate: "",
    emailjsPublic: "",
    quizRewardVideoUrl: "",
  },
};
