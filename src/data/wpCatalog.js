// Mock WordPress directory catalog — Krishna's WP.org theme data, extended
// schema (author URL + minimum WP/PHP, rating + review count, parent for
// child themes) mirrors what the real /themes/info/1.2 endpoint returns.
// Embedded locally because the demo can't hit api.wordpress.org directly
// (CORS + no network in the dev sandbox).
//
// Fields per theme:
//   slug              — WordPress directory slug (kebab-case)
//   name              — display name
//   shortDescription  — one-line, plain text, ~140 chars max
//   description       — full WP.org description
//   version           — semver-ish latest stable
//   author            — display name (string)
//   authorUrl         — vendor homepage
//   rating            — 0-5, decimal
//   numRatings        — integer
//   requires          — minimum WP version (e.g. "6.5")
//   requiresPhp       — minimum PHP version (e.g. "7.2")
//   homepage          — WP.org theme page URL
//   screenshot        — full https URL for the actual WP.org screenshot
//   parent            — for child themes: { slug, name, homepage }; null otherwise
//   color             — Tailwind gradient for the mockup fallback if screenshot fails

// ---------------------------------------------------------------------------
// Themes — Krishna's WP.org data, extended schema
// ---------------------------------------------------------------------------

export const WP_THEMES = [
  {
    slug: 'bee-elegant-interior',
    name: 'Bee Elegant Interior',
    shortDescription: 'For interior designers, decorators, architects, and luxury real estate agents — pre-built sections for portfolios, services, team, and testimonials.',
    description: 'Bee Elegant Interior Theme is designed for professionals such as interior designers, home decorators, architects, and luxury real estate agents who need a clean and structured online presence. The theme includes pre-built layout sections for showcasing portfolios, services, team members, and client testimonials. It supports high-resolution image galleries, enabling furniture showrooms and home-staging professionals to present projects with visual clarity. The design emphasizes balanced spacing, readable typography, and a neutral color system that can be customized to match branding needs. It offers responsive layouts that adjust across devices, ensuring consistent presentation on mobile and desktop screens. Basic customization options typically include color controls, font settings, and widget-ready areas for adding content blocks. The theme also supports integration with common plugins for contact forms and social sharing, enabling straightforward communication and content distribution without requiring advanced technical knowledge.',
    version: '1.0.2',
    author: 'Bee Themes',
    authorUrl: 'https://themebee.net/',
    rating: 0,
    numRatings: 0,
    requires: '6.1',
    requiresPhp: '7.2',
    homepage: 'https://wordpress.org/themes/bee-elegant-interior/',
    screenshot: 'https://ts.w.org/wp-content/themes/bee-elegant-interior/screenshot.png?ver=1.0.2',
    parent: null,
    color: 'from-amber-500 to-orange-700',
  },
  {
    slug: 'elisen-photography',
    name: 'Elisen Photography',
    shortDescription: 'A simple, clean, responsive blog theme for YouTube, travel, food, fashion bloggers, and writers who need a personal blog with creative effects.',
    description: 'Elisen Photography is a simple, clean and responsive WordPress blog theme perfect for youtube bloggers, travel bloggers, food bloggers, fashion bloggers and writers who need to create personal blog site with creative features and effects to make readers feel the pleasure of reading blog posts and articles.',
    version: '1.0.2',
    author: 'Kantipur Themes',
    authorUrl: 'https://www.kantipurthemes.com/',
    rating: 0,
    numRatings: 0,
    requires: '6.5',
    requiresPhp: '8.0',
    homepage: 'https://wordpress.org/themes/elisen-photography/',
    screenshot: 'https://ts.w.org/wp-content/themes/elisen-photography/screenshot.png?ver=1.0.2',
    parent: null,
    color: 'from-rose-500 to-pink-700',
  },
  {
    slug: 'blr-frontstage',
    name: 'BLR Frontstage',
    shortDescription: 'Modern, responsive WordPress newspaper theme for news sites, online magazines, blogs, and editorial publishers — SEO-friendly and fast.',
    description: 'A modern and responsive WordPress newspaper theme designed for news websites, online magazines, blogs, and editorial publishers. Its clean layout, fast performance, and SEO-friendly code help improve search engine visibility while delivering an excellent user experience on all devices. Easily customize your website with the built-in WordPress Customizer, where you can change colors, backgrounds, layouts, typography, site width, and more — without writing code. Built with responsive HTML5 and optimized for speed, this theme makes publishing engaging articles, breaking news, and blog content simple, professional, and efficient.',
    version: '1.0.7',
    author: 'CodeVibrant',
    authorUrl: 'https://codevibrant.com',
    rating: 0,
    numRatings: 0,
    requires: '6.0',
    requiresPhp: '7.2',
    homepage: 'https://wordpress.org/themes/blr-frontstage/',
    screenshot: 'https://ts.w.org/wp-content/themes/blr-frontstage/screenshot.png?ver=1.0.7',
    parent: { slug: 'news-vibrant', name: 'News Vibrant', homepage: 'https://wordpress.org/themes/news-vibrant/' },
    color: 'from-blue-600 to-indigo-900',
  },
  {
    slug: 'service-business',
    name: 'Service Business',
    shortDescription: 'A structured, responsive layout for services, company info, and contact details — customizable homepage, service showcase, navigation, blog, testimonial sections.',
    description: 'The Service Business theme provides a structured and responsive layout designed for presenting services, company information, contact details, and business-related content in a clear and organized format. It includes customizable homepage sections, service showcase areas, banner spaces, and navigation menus that help arrange content efficiently. Responsive design ensures consistent viewing across desktops, tablets, and mobile devices. The theme offers customization options for colors, typography, headers, backgrounds, and page layouts without requiring extensive code modifications. Additional features include blog integration, testimonial sections, contact forms, call-to-action areas, social media connectivity, and widget-ready spaces. These tools support content management while maintaining a consistent visual structure throughout the website. Built with a clean code framework, the theme supports compatibility with commonly used plugins and follows modern development standards. Flexible content blocks allow information to be arranged according to different requirements while preserving readability and accessibility. The theme also includes customizable footer layouts, featured content sections, and organized navigation settings. Its combination of responsive design, customization controls, and content management features provides a practical framework for maintaining a well-structured and accessible website experience.',
    version: '1.0',
    author: 'VWThemes',
    authorUrl: 'https://www.vwthemes.com/',
    rating: 0,
    numRatings: 0,
    requires: '5.9',
    requiresPhp: '5.6',
    homepage: 'https://wordpress.org/themes/service-business/',
    screenshot: 'https://ts.w.org/wp-content/themes/service-business/screenshot.png?ver=1.0',
    parent: null,
    color: 'from-emerald-500 to-teal-700',
  },
  {
    slug: 'newscontrast',
    name: 'NewsContrast',
    shortDescription: 'Fast, responsive, SEO-friendly theme for news sites and magazines — 50+ starter sites, Block Editor + Elementor, light/dark, WooCommerce, RTL.',
    description: 'NewsContrast is a fast, responsive, and SEO-friendly WordPress theme for news sites, online magazines, blogs, publishers, and content-rich websites. It includes 50+ ready-to-import starter sites compatible with the Block Editor, Elementor, and other popular page builders, making it easy to launch a professional website. The theme offers flexible layouts, customizable widgets, block patterns, multiple banner styles, light and dark mode, WooCommerce support, RTL compatibility, multilingual readiness, and accessibility-focused design. NewsContrast also works seamlessly with popular plugins such as Jetpack, Yoast SEO, and Contact Form 7, helping you create a modern, high-performance website with an excellent user experience.',
    version: '1.0.3',
    author: 'AF themes',
    authorUrl: 'https://afthemes.com',
    rating: 0,
    numRatings: 0,
    requires: '4.0',
    requiresPhp: '5.6',
    homepage: 'https://wordpress.org/themes/newscontrast/',
    screenshot: 'https://ts.w.org/wp-content/themes/newscontrast/screenshot.png?ver=1.0.3',
    parent: { slug: 'covernews', name: 'CoverNews', homepage: 'https://wordpress.org/themes/covernews/' },
    color: 'from-red-500 to-rose-700',
  },
  {
    slug: 'marriage-event-planner',
    name: 'Marriage - Event Planner',
    shortDescription: 'A clean layout for event-related content — customizable homepage, responsive layouts, navigation, banners, galleries, testimonials, schedules, contact forms.',
    description: 'The Event Planner theme is designed with a clean layout and organized sections that help present event-related content in a structured format. It includes customizable homepage sections, responsive layouts, navigation menus, banner areas, galleries, testimonial blocks, schedule sections, contact forms, and footer widgets. The theme supports image and video content, making it suitable for displaying event highlights, announcements, and important information. Built with a mobile-friendly design, it adapts smoothly across desktops, tablets, and smartphones. The theme provides customization options for colors, typography, logos, headers, footers, and page layouts through an easy-to-use interface. It is compatible with popular plugins, supports social media integration, and includes widget-ready areas for additional functionality. Clean code and an organized structure contribute to consistent performance and easier maintenance. Features such as call-to-action sections, countdown timers, speaker or team profiles, pricing tables, and blog integration help organize different types of event content. Translation readiness, browser compatibility, and accessibility-focused design further improve usability. The overall structure focuses on presenting information clearly while allowing flexible customization without relying on complex coding.',
    version: '1.0',
    author: 'Apex Themes',
    authorUrl: 'https://www.apexthemes.net/',
    rating: 0,
    numRatings: 0,
    requires: '5.5',
    requiresPhp: '5.6',
    homepage: 'https://wordpress.org/themes/marriage-event-planner/',
    screenshot: 'https://ts.w.org/wp-content/themes/marriage-event-planner/screenshot.png?ver=1.0',
    parent: null,
    color: 'from-pink-500 to-rose-700',
  },
  {
    slug: 'umrah',
    name: 'Umrah',
    shortDescription: 'Modern, lightweight theme for Islamic tour operators, Umrah/Hajj agencies — WP Travel Engine ready, Block Editor + Kadence Blocks based.',
    description: 'Umrah is a modern, lightweight, and responsive WordPress theme designed specifically for Islamic tour operators, Umrah and Hajj travel agencies, Ziyarat tour providers, and halal tourism businesses. Built to work seamlessly with the WP Travel Engine plugin, it enables you to create a professional travel booking website where you can showcase Umrah packages, Hajj tours, Islamic pilgrimage journeys, travel itineraries, accommodations, visa assistance, and other travel services with ease. The theme is built entirely with the native WordPress Block Editor (Gutenberg) and Kadence Blocks, giving you a fast, flexible, and intuitive editing experience without relying on a page builder. Easily customize layouts, create beautiful landing pages, and design engaging content using reusable blocks and full-site editing capabilities. Umrah features a clean and mobile-friendly design, fast loading performance, SEO-optimized structure, accessibility-ready markup, and standards-compliant code to deliver an excellent user experience across all devices. Whether you are promoting Ramadan Umrah packages, family pilgrimage tours, Islamic heritage trips, or customized travel experiences, the theme provides professionally designed layouts and conversion-focused sections to help build trust and generate more inquiries. It is WP Travel Engine compatible, translation ready, cross-browser compatible, and regularly updated to ensure compatibility with the latest version of WordPress.',
    version: '1.0.3',
    author: 'WP Travel Kit',
    authorUrl: 'https://wptravelkit.com/',
    rating: 0,
    numRatings: 0,
    requires: '6.0',
    requiresPhp: '7.4',
    homepage: 'https://wordpress.org/themes/umrah/',
    screenshot: 'https://ts.w.org/wp-content/themes/umrah/screenshot.png?ver=1.0.3',
    parent: { slug: 'travelscape', name: 'Travelscape', homepage: 'https://wordpress.org/themes/travelscape/' },
    color: 'from-amber-500 to-yellow-700',
  },
  {
    slug: 'thryvewp-fse-pulse',
    name: 'Thryvewp FSE Pulse',
    shortDescription: 'Modern FSE theme for businesses, consulting firms, and agencies — Gutenberg-based, WooCommerce-compatible, no code required.',
    description: 'Thryvewp FSE Pulse is a modern and versatile Full Site Editing (FSE) WordPress theme designed for businesses, consulting firms, agencies, and professional service providers. Built entirely with Gutenberg blocks for easy, code-free customization, it offers a clean design, fast performance, and fully responsive layouts. Fully compatible with WooCommerce, Thryvewp FSE Pulse allows you to seamlessly create corporate websites, service-based platforms, and powerful online stores, making it an ideal choice for startups, growing companies, and established enterprises seeking a professional and flexible web presence.',
    version: '1.1',
    author: 'thryvewp',
    authorUrl: 'https://thryvewp.com/',
    rating: 0,
    numRatings: 0,
    requires: '6.5',
    requiresPhp: '7.0',
    homepage: 'https://wordpress.org/themes/thryvewp-fse-pulse/',
    screenshot: 'https://ts.w.org/wp-content/themes/thryvewp-fse-pulse/screenshot.png?ver=1.1',
    parent: { slug: 'thryvewp-fse', name: 'Thryvewp FSE', homepage: 'https://wordpress.org/themes/thryvewp-fse/' },
    color: 'from-indigo-500 to-violet-700',
  },
  {
    slug: 'redesignee-creative-agency',
    name: 'Redesignee Creative Agency',
    shortDescription: 'Minimal Creative Agency Theme — clean, modern, focused on showcasing creative work.',
    description: 'Minimal Creative Agency Theme',
    version: '0.1.2',
    author: 'Redesignee',
    authorUrl: 'https://redesignee.com',
    rating: 0,
    numRatings: 0,
    requires: '6.6',
    requiresPhp: '7.4',
    homepage: 'https://wordpress.org/themes/redesignee-creative-agency/',
    screenshot: 'https://ts.w.org/wp-content/themes/redesignee-creative-agency/screenshot.png?ver=0.1.2',
    parent: null,
    color: 'from-fuchsia-500 to-purple-700',
  },
  {
    slug: 'seo-agency-services',
    name: 'SEO Agency Services',
    shortDescription: 'Responsive layout for SEO services, project info, performance reports, team profiles, testimonials — customizable homepage, banners, contact forms.',
    description: 'The SEO Agency Services theme is designed with a responsive layout and structured content sections for presenting services, project information, performance reports, team profiles, and client testimonials. It includes customizable homepage areas, banner sections, service showcases, contact forms, and flexible content blocks that help organize information clearly. The responsive design ensures content remains accessible across desktops, tablets, and mobile devices while maintaining a consistent visual structure. The theme provides customization options for colors, typography, headers, menus, and page layouts through an intuitive interface. Additional features include blog integration, social media connectivity, widget-ready sections, customizable call-to-action areas, and multiple content display options. Built with a clean code structure, the theme supports compatibility with commonly used plugins and follows modern web development standards. Flexible page templates allow content to be arranged according to specific requirements while maintaining readability and navigation. Dedicated sections for services, testimonials, case studies, and featured content help improve organization across the website. The theme offers practical tools for managing content efficiently while supporting responsive performance, accessibility, and customization across various devices and screen sizes.',
    version: '1.0.1',
    author: 'flextheme',
    authorUrl: 'https://www.flextheme.net/',
    rating: 0,
    numRatings: 0,
    requires: '6.0',
    requiresPhp: '5.6',
    homepage: 'https://wordpress.org/themes/seo-agency-services/',
    screenshot: 'https://ts.w.org/wp-content/themes/seo-agency-services/screenshot.png?ver=1.0.1',
    parent: { slug: 'flex-multi-business', name: 'Flex Multi Business', homepage: 'https://wordpress.org/themes/flex-multi-business/' },
    color: 'from-blue-500 to-cyan-700',
  },
  {
    slug: 'fse-ecommerce',
    name: 'FSE eCommerce',
    shortDescription: 'Modern, fast, customizable block-based theme for WooCommerce — FSE, conversion-optimized patterns: hero banners, product spotlights, flash sales.',
    description: 'FSE eCommerce is a modern, fast, and highly customizable block-based theme built specifically for WooCommerce. Leveraging Full Site Editing (FSE), it empowers you to design every aspect of your shop without writing any code. It includes a curated collection of conversion-optimized block patterns — such as hero banners, product spotlights, flash sales, store stats, and testimonials — providing a premium storefront experience right out of the box. Lightweight, seamlessly integrated with Gutenberg, and fully translation-ready, FSE eCommerce is the perfect theme for boutiques, modern brands, and growing online stores.',
    version: '1.1',
    author: 'DiThemes',
    authorUrl: 'https://dithemes.com',
    rating: 0,
    numRatings: 0,
    requires: '6.7',
    requiresPhp: '7.4',
    homepage: 'https://wordpress.org/themes/fse-ecommerce/',
    // This one uses .jpg, not .png — kept the actual URL from Krishna's data
    screenshot: 'https://ts.w.org/wp-content/themes/fse-ecommerce/screenshot.jpg?ver=1.1',
    parent: { slug: 'di-ecommerce', name: 'Di eCommerce', homepage: 'https://wordpress.org/themes/di-ecommerce/' },
    color: 'from-orange-500 to-red-700',
  },
  {
    slug: 'fitness-yoga-coach',
    name: 'Fitness Yoga Coach',
    shortDescription: 'For yoga instructors, fitness coaches, wellness studios — class scheduling, trainer profiles, online booking, membership tools, gallery layouts.',
    description: 'Elevate your wellness brand with our Fitness Yoga Coach — the perfect digital solution for yoga instructors, fitness coaches, personal trainers, and wellness studios looking to build a powerful online presence. Designed with mindfulness and functionality in mind, this theme creates a calming yet professional website experience that truly reflects your brand. This feature-rich Yoga Coach includes a seamless class scheduling system, trainer profile pages, online booking integration, and membership management tools. Showcase your fitness programs, meditation sessions, and wellness packages with stunning gallery layouts and engaging video backgrounds. Whether you\'re a solo yoga instructor or managing a full-scale fitness studio, this theme adapts effortlessly to your needs. With fully responsive design, SEO-optimized architecture, WooCommerce compatibility, and blazing-fast performance, your fitness and yoga website will attract more clients, boost online enrollments, and grow your wellness community with confidence.',
    version: '1.0.0',
    author: 'Abu Turab',
    authorUrl: 'https://www.thealphablocks.com/',
    rating: 0,
    numRatings: 0,
    requires: '5.9',
    requiresPhp: '7.2',
    homepage: 'https://wordpress.org/themes/fitness-yoga-coach/',
    screenshot: 'https://ts.w.org/wp-content/themes/fitness-yoga-coach/screenshot.png?ver=1.0.0',
    parent: null,
    color: 'from-lime-500 to-green-700',
  },
  {
    slug: 'member-read',
    name: 'Member Read',
    shortDescription: 'A modern, fully customizable WordPress block theme for membership communities, publishers, premium content platforms, and creator websites.',
    description: 'Member Read is a modern, fully customizable WordPress block theme designed for membership communities, digital publishers, premium content platforms, and creator websites. Built with Full Site Editing capabilities and fully compatible with membership and user management plugins, this theme offers flexibility and ease of use for creating professional content-driven websites without coding knowledge. Perfect for blogs, newsletters, resource libraries, and subscription-based communities, Member Read provides seamless integration for premium articles, downloadable resources, content restriction, member directories, and membership management.',
    version: '1.0.3',
    author: 'WPEverest',
    authorUrl: 'https://wpeverest.com/',
    rating: 0,
    numRatings: 0,
    requires: '6.9',
    requiresPhp: '7.4',
    homepage: 'https://wordpress.org/themes/member-read/',
    screenshot: 'https://ts.w.org/wp-content/themes/member-read/screenshot.png?ver=1.0.3',
    parent: null,
    color: 'from-violet-500 to-purple-700',
  },
  // -- Real WordPress.org themes (kept alongside Krishna's 13 so blueprints
  // -- that reference them via slug still resolve to full metadata) ----------
  {
    slug: 'twentytwentyfour',
    name: 'Twenty Twenty-Four',
    shortDescription: 'The 2024 default block theme for WP 6.4+ with full-site editing.',
    description: 'Twenty Twenty-Four is a multipurpose block theme designed to take advantage of the new features introduced in WordPress 6.4. It ships with a clean, opinionated design system and full-site editing support out of the box.',
    version: '1.0',
    author: 'WordPress Team',
    authorUrl: 'https://wordpress.org/',
    rating: 4.6,
    numRatings: 1820,
    requires: '6.4',
    requiresPhp: '7.0',
    homepage: 'https://wordpress.org/themes/twentytwentyfour/',
    screenshot: 'https://ts.w.org/wp-content/themes/twentytwentyfour/screenshot.png?ver=1.0.2',
    parent: null,
    color: 'from-slate-700 to-slate-900',
  },
  {
    slug: 'twentytwentythree',
    name: 'Twenty Twenty-Three',
    shortDescription: 'Minimalist block theme shipped with WP 6.1.',
    description: 'Twenty Twenty-Three is the 2023 default block theme, focused on clean typography and a minimal aesthetic.',
    version: '1.3',
    author: 'WordPress Team',
    authorUrl: 'https://wordpress.org/',
    rating: 4.4,
    numRatings: 2640,
    requires: '6.1',
    requiresPhp: '5.6',
    homepage: 'https://wordpress.org/themes/twentytwentythree/',
    screenshot: 'https://ts.w.org/wp-content/themes/twentytwentythree/screenshot.png?ver=1.0.2',
    parent: null,
    color: 'from-stone-600 to-stone-900',
  },
  {
    slug: 'twentytwentytwo',
    name: 'Twenty Twenty-Two',
    shortDescription: 'The 2022 default block theme. Simple, clean, opinionated.',
    description: 'Twenty Twenty-Two is the first default block theme for WP 5.9. Designed around the new full-site editing experience.',
    version: '1.6',
    author: 'WordPress Team',
    authorUrl: 'https://wordpress.org/',
    rating: 4.2,
    numRatings: 3120,
    requires: '5.9',
    requiresPhp: '5.6',
    homepage: 'https://wordpress.org/themes/twentytwentytwo/',
    screenshot: 'https://ts.w.org/wp-content/themes/twentytwentytwo/screenshot.png?ver=1.0.2',
    parent: null,
    color: 'from-zinc-600 to-zinc-900',
  },
  {
    slug: 'astra',
    name: 'Astra',
    shortDescription: 'Lightweight, fast, highly customizable — powers 1M+ sites.',
    description: 'Astra is a lightweight, fast, and highly customizable theme powering 1M+ WordPress sites.',
    version: '4.6',
    author: 'Brainstorm Force',
    authorUrl: 'https://wpastra.com/',
    rating: 4.9,
    numRatings: 32100,
    requires: '5.7',
    requiresPhp: '7.0',
    homepage: 'https://wordpress.org/themes/astra/',
    screenshot: 'https://ts.w.org/wp-content/themes/astra/screenshot.png?ver=4.6',
    parent: null,
    color: 'from-violet-600 to-indigo-900',
  },
  {
    slug: 'generatepress',
    name: 'GeneratePress',
    shortDescription: 'A focus on speed, stability and accessibility. Developer-friendly.',
    description: 'GeneratePress is a lightweight WordPress theme focused on speed, stability and accessibility.',
    version: '3.4',
    author: 'Tom Usborne',
    authorUrl: 'https://generatepress.com/',
    rating: 4.9,
    numRatings: 18400,
    requires: '5.4',
    requiresPhp: '5.6',
    homepage: 'https://wordpress.org/themes/generatepress/',
    screenshot: 'https://ts.w.org/wp-content/themes/generatepress/screenshot.png?ver=3.4',
    parent: null,
    color: 'from-blue-600 to-cyan-900',
  },
  {
    slug: 'oceanwp',
    name: 'OceanWP',
    shortDescription: 'Highly extensible with free extensions for every feature.',
    description: 'OceanWP is a WordPress theme with dozens of free extensions for every feature.',
    version: '3.5',
    author: 'OceanWP',
    authorUrl: 'https://oceanwp.org/',
    rating: 4.5,
    numRatings: 12700,
    requires: '5.6',
    requiresPhp: '7.0',
    homepage: 'https://wordpress.org/themes/oceanwp/',
    screenshot: 'https://ts.w.org/wp-content/themes/oceanwp/screenshot.png?ver=3.5',
    parent: null,
    color: 'from-sky-600 to-blue-900',
  },
  {
    slug: 'kadence',
    name: 'Kadence',
    shortDescription: 'Performance-focused with deep WooCommerce and starter templates.',
    description: 'Kadence is a performance-focused WordPress theme with deep WooCommerce integration and starter templates.',
    version: '1.2',
    author: 'Kadence WP',
    authorUrl: 'https://www.kadencewp.com/',
    rating: 4.8,
    numRatings: 9400,
    requires: '5.8',
    requiresPhp: '7.0',
    homepage: 'https://wordpress.org/themes/kadence/',
    screenshot: 'https://ts.w.org/wp-content/themes/kadence/screenshot.png?ver=1.2',
    parent: null,
    color: 'from-fuchsia-600 to-purple-900',
  },
  {
    slug: 'neve',
    name: 'Neve',
    shortDescription: 'AMP-ready, super-fast, integrates with all major page builders.',
    description: 'Neve is an AMP-ready, super-fast WordPress theme that integrates with all major page builders.',
    version: '3.8',
    author: 'ThemeIsle',
    authorUrl: 'https://themeisle.com/',
    rating: 4.7,
    numRatings: 8600,
    requires: '5.5',
    requiresPhp: '7.0',
    homepage: 'https://wordpress.org/themes/neve/',
    screenshot: 'https://ts.w.org/wp-content/themes/neve/screenshot.png?ver=3.8',
    parent: null,
    color: 'from-rose-600 to-pink-900',
  },
  {
    slug: 'hello-elementor',
    name: 'Hello Elementor',
    shortDescription: 'Bare-bones theme built for Elementor. Tiny, fast, nothing extra.',
    description: 'Hello Elementor is a bare-bones WordPress theme built for Elementor.',
    version: '3.1',
    author: 'Elementor',
    authorUrl: 'https://elementor.com/',
    rating: 4.4,
    numRatings: 4200,
    requires: '5.5',
    requiresPhp: '7.0',
    homepage: 'https://wordpress.org/themes/hello-elementor/',
    screenshot: 'https://ts.w.org/wp-content/themes/hello-elementor/screenshot.png?ver=3.1',
    parent: null,
    color: 'from-pink-600 to-rose-900',
  },
  {
    slug: 'phlox',
    name: 'Phlox',
    shortDescription: 'Elementor-focused with 160+ demos and a built-in page builder.',
    description: 'Phlox is an Elementor-focused WordPress theme with 160+ demos and a built-in page builder.',
    version: '5.6',
    author: 'Averta',
    authorUrl: 'https://averta.net/',
    rating: 4.3,
    numRatings: 3100,
    requires: '5.0',
    requiresPhp: '5.6',
    homepage: 'https://wordpress.org/themes/phlox/',
    screenshot: 'https://ts.w.org/wp-content/themes/phlox/screenshot.png?ver=5.6',
    parent: null,
    color: 'from-yellow-600 to-amber-900',
  },

]

// ---------------------------------------------------------------------------
// Plugins — unchanged (Krishna only asked for the theme catalog to change)
// ---------------------------------------------------------------------------

export const WP_PLUGINS = [
  { slug: 'yoast-seo',          name: 'Yoast SEO',                shortDescription: 'SEO toolkit — titles, meta, schema, sitemaps, readability.', version: '22.0',  author: 'Yoast',           rating: 4.5, numRatings: 28400, activeInstalls: 5000000, category: 'seo',         icon: 'Search' },
  { slug: 'all-in-one-seo',     name: 'All in One SEO',           shortDescription: 'Feature-rich SEO suite with smart schema and local SEO.',      version: '4.6',   author: 'AIOSEO',         rating: 4.6, numRatings: 11200, activeInstalls: 3000000, category: 'seo',         icon: 'Search' },
  { slug: 'rank-math',          name: 'Rank Math SEO',            shortDescription: 'Lightweight SEO with built-in schema and keyword rank tracker.', version: '1.0',   author: 'Rank Math',      rating: 4.8, numRatings: 9800,  activeInstalls: 2000000, category: 'seo',         icon: 'TrendingUp' },
  { slug: 'wordfence',          name: 'Wordfence Security',       shortDescription: 'Endpoint firewall + malware scanner built for WP.',             version: '7.10',  author: 'Wordfence',      rating: 4.6, numRatings: 19400, activeInstalls: 4000000, category: 'security',    icon: 'Shield' },
  { slug: 'sucuri-scanner',     name: 'Sucuri Security',          shortDescription: 'Auditing, malware scanner, and post-hack security actions.',     version: '1.8',   author: 'Sucuri',         rating: 4.4, numRatings: 5200,  activeInstalls: 800000,  category: 'security',    icon: 'ShieldCheck' },
  { slug: 'ithemes-security',   name: 'iThemes Security',         shortDescription: 'Brute-force protection, 2FA, file change detection.',           version: '9.0',   author: 'iThemes',        rating: 4.5, numRatings: 6800,  activeInstalls: 1000000, category: 'security',    icon: 'Lock' },
  { slug: 'really-simple-ssl', name: 'Really Simple SSL',        shortDescription: 'One-click SSL redirect and mixed-content fixer.',               version: '7.3',   author: 'Really Simple Plugins', rating: 4.7, numRatings: 7600, activeInstalls: 5000000, category: 'security', icon: 'Lock' },
  { slug: 'wp-rocket',          name: 'WP Rocket',                shortDescription: 'Premium cache, lazy load, critical CSS — fires on install.',      version: '3.15',  author: 'WP Rocket',      rating: 4.8, numRatings: 8200,  activeInstalls: 700000,  category: 'performance', icon: 'Rocket' },
  { slug: 'w3-total-cache',    name: 'W3 Total Cache',           shortDescription: 'Battle-tested cache + CDN integration, very configurable.',       version: '2.8',   author: 'W3 EDGE',        rating: 4.3, numRatings: 9100,  activeInstalls: 1000000, category: 'performance', icon: 'Zap' },
  { slug: 'wp-super-cache',    name: 'WP Super Cache',           shortDescription: 'Static file caching from Automattic. Simple, free, fast.',        version: '1.12',  author: 'Automattic',     rating: 4.2, numRatings: 6400,  activeInstalls: 2000000, category: 'performance', icon: 'Zap' },
  { slug: 'autoptimize',        name: 'Autoptimize',              shortDescription: 'Minify HTML/CSS/JS, optimize Google Fonts, lazy-load images.',    version: '3.1',   author: 'Frank Goossens', rating: 4.6, numRatings: 5400,  activeInstalls: 1000000, category: 'performance', icon: 'Gauge' },
  { slug: 'shortpixel',         name: 'ShortPixel Image Optimizer', shortDescription: 'Compress + serve images in WebP/AVIF. Bulk optimizer included.', version: '5.4', author: 'ShortPixel',     rating: 4.7, numRatings: 4900,  activeInstalls: 300000,  category: 'performance', icon: 'Image' },
  { slug: 'contact-form-7',    name: 'Contact Form 7',           shortDescription: 'The classic form plugin. Simple markup, lots of extensions.',    version: '5.9',   author: 'Takayuki Miyoshi', rating: 4.3, numRatings: 8800, activeInstalls: 5000000, category: 'forms',      icon: 'Mail' },
  { slug: 'wpforms-lite',      name: 'WPForms Lite',             shortDescription: 'Beginner-friendly drag-and-drop form builder.',                 version: '1.8',   author: 'WPForms',        rating: 4.7, numRatings: 11200, activeInstalls: 5000000, category: 'forms',       icon: 'Mail' },
  { slug: 'flavor-forms',      name: 'Flavor Forms',             shortDescription: 'First-class form blocks with conditional logic and webhooks.',   version: '1.0',   author: 'Central Panel',  rating: 4.5, numRatings: 180,  activeInstalls: 8000,    category: 'forms',       icon: 'Mail' },
  { slug: 'woocommerce',       name: 'WooCommerce',              shortDescription: 'The most popular e-commerce platform on the web.',                version: '8.8',   author: 'Automattic',     rating: 4.4, numRatings: 7200,  activeInstalls: 5000000, category: 'commerce',    icon: 'ShoppingCart' },
  { slug: 'flavor-payments',   name: 'Flavor Payments',          shortDescription: 'Stripe + PayPal checkout with one-click refunds and exports.',   version: '1.2',   author: 'Central Panel',  rating: 4.6, numRatings: 96,   activeInstalls: 4000,    category: 'commerce',    icon: 'CreditCard' },
  { slug: 'elementor',         name: 'Elementor',                shortDescription: 'Live drag-and-drop page builder with theme builder.',            version: '3.20',  author: 'Elementor.com',  rating: 4.6, numRatings: 12400, activeInstalls: 5000000, category: 'builder',     icon: 'Layout' },
  { slug: 'flavor-blocks',     name: 'Flavor Blocks',            shortDescription: 'Native Gutenberg blocks tuned for the Flavor starter themes.',   version: '1.0',   author: 'Central Panel',  rating: 4.7, numRatings: 64,   activeInstalls: 3000,    category: 'builder',     icon: 'Layout' },
  { slug: 'updraftplus',       name: 'UpdraftPlus',              shortDescription: 'Scheduled backups to S3, Google Drive, Dropbox, and more.',       version: '1.23',  author: 'UpdraftPlus.com', rating: 4.7, numRatings: 9200, activeInstalls: 3000000, category: 'backup',      icon: 'Database' },
  { slug: 'backwpup',          name: 'BackWPup',                 shortDescription: 'Backup to folder, S3, Dropbox, SugarSync. Restore inside WP.',     version: '4.0',   author: 'Inpsyde',        rating: 4.2, numRatings: 2400,  activeInstalls: 700000,  category: 'backup',      icon: 'Database' },
  { slug: 'akismet',           name: 'Akismet',                  shortDescription: 'Best-in-class comment and form spam filter.',                      version: '5.3',   author: 'Automattic',     rating: 4.4, numRatings: 4800,  activeInstalls: 5000000, category: 'antispam',    icon: 'ShieldX' },
  { slug: 'jetpack',           name: 'Jetpack',                  shortDescription: 'Stats, social sharing, security, performance — the kitchen sink.', version: '13.0',  author: 'Automattic',     rating: 4.1, numRatings: 7400,  activeInstalls: 4000000, category: 'utility',     icon: 'Package' },
  { slug: 'classic-editor',    name: 'Classic Editor',           shortDescription: 'Restores the classic WP editor and toolbar.',                      version: '1.6',   author: 'WordPress Contributors', rating: 4.6, numRatings: 5200, activeInstalls: 5000000, category: 'utility', icon: 'Edit' },
  { slug: 'duplicate-page',    name: 'Duplicate Page',           shortDescription: 'One-click duplicate of any post, page, or CPT.',                  version: '4.5',   author: 'Mndpsingh',      rating: 4.8, numRatings: 2100,  activeInstalls: 2000000, category: 'utility',     icon: 'Copy' },
  { slug: 'broken-link-checker', name: 'Broken Link Checker',    shortDescription: 'Detects broken links and missing images across your content.',    version: '2.2',   author: 'WPMU DEV',       rating: 4.0, numRatings: 1400,  activeInstalls: 700000,  category: 'utility',     icon: 'Unlink' },
  { slug: 'redirection',       name: 'Redirection',              shortDescription: 'Manage 301 redirects and track 404 errors.',                      version: '5.4',   author: 'John Godley',    rating: 4.6, numRatings: 3100,  activeInstalls: 2000000, category: 'utility',     icon: 'ArrowRight' },
  { slug: 'tablepress',        name: 'TablePress',               shortDescription: 'Create and embed beautiful tables without code.',                 version: '2.3',   author: 'Tobias Bäthge',  rating: 4.8, numRatings: 3700,  activeInstalls: 800000,  category: 'utility',     icon: 'Table' },
  { slug: 'wp-mail-smtp',      name: 'WP Mail SMTP',             shortDescription: 'Fixes WordPress email deliverability via SMTP/transactional.',     version: '4.0',   author: 'WPForms',        rating: 4.7, numRatings: 6900,  activeInstalls: 3000000, category: 'utility',     icon: 'Send' },
  { slug: 'flavor-cron',       name: 'Flavor Cron',              shortDescription: 'Visual cron scheduler with retries, logging, and alerting.',        version: '1.0',   author: 'Central Panel',  rating: 4.6, numRatings: 32,   activeInstalls: 1200,    category: 'utility',     icon: 'Clock' },
]

// Derived from WP_PLUGINS so they stay in sync with the data — PluginPicker
// uses this list to render the category filter tabs.
// Friendly labels for the PluginPicker's category filter pills. The id is
// the raw category slug (matches `plugin.category` from WP_PLUGINS); the
// label is the human-readable name shown in the picker.
const PLUGIN_CATEGORY_LABELS = {
  antispam: 'Antispam',
  backup: 'Backup',
  builder: 'Page builders',
  commerce: 'Commerce',
  forms: 'Forms & CRM',
  performance: 'Performance',
  seo: 'SEO',
  security: 'Security',
  utility: 'Utilities',
}

export const PLUGIN_CATEGORIES = [...new Set(WP_PLUGINS.map((p) => p.category))]
  .sort()
  .map((id) => ({ id, label: PLUGIN_CATEGORY_LABELS[id] || id.charAt(0).toUpperCase() + id.slice(1) }))

// ---------------------------------------------------------------------------
// Quick lookups
// ---------------------------------------------------------------------------

export function getThemeBySlug(slug) {
  return WP_THEMES.find((t) => t.slug === slug)
}

export function getPluginBySlug(slug) {
  return WP_PLUGINS.find((p) => p.slug === slug)
}

// ---------------------------------------------------------------------------
// Screenshot URL — uses each theme's actual WP.org URL. Accepts either a
// slug string (looked up here) or a theme object directly. This handles
// the unusual case of fse-ecommerce, which uses screenshot.jpg instead
// of .png — the synthetic URL pattern wouldn't work for it.
// ---------------------------------------------------------------------------

export function getThemeScreenshotUrl(slugOrTheme) {
  if (!slugOrTheme) return null
  const theme = typeof slugOrTheme === 'string' ? getThemeBySlug(slugOrTheme) : slugOrTheme
  return theme?.screenshot || null
}

// ---------------------------------------------------------------------------
// Locale / format / permalink constants (unchanged)
// ---------------------------------------------------------------------------

export const WP_LANGUAGES = [
  { code: 'en_US', label: 'English (United States)' },
  { code: 'en_GB', label: 'English (United Kingdom)' },
  { code: 'es_ES', label: 'Español' },
  { code: 'fr_FR', label: 'Français' },
  { code: 'de_DE', label: 'Deutsch' },
  { code: 'it_IT', label: 'Italiano' },
  { code: 'pt_BR', label: 'Português (Brasil)' },
  { code: 'pt_PT', label: 'Português (Portugal)' },
  { code: 'nl_NL', label: 'Nederlands' },
  { code: 'ru_RU', label: 'Русский' },
  { code: 'ja',    label: '日本語' },
  { code: 'zh_CN', label: '中文(简体)' },
]

export const WP_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Amsterdam',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Pacific/Auckland',
]

export const WP_DATE_FORMATS = [
  { value: 'F j, Y', label: 'December 18, 2026' },
  { value: 'Y-m-d', label: '2026-12-18' },
  { value: 'm/d/Y', label: '12/18/2026' },
  { value: 'd/m/Y', label: '18/12/2026' },
  { value: 'M j, Y', label: 'Dec 18, 2026' },
  { value: 'j F Y', label: '18 December 2026' },
  { value: 'D, M j, Y', label: 'Fri, Dec 18, 2026' },
  { value: 'd M Y', label: '18 Dec 2026' },
  { value: 'Y/m/d', label: '2026/12/18' },
]

export const WP_TIME_FORMATS = [
  { value: 'g:i a', label: '2:34 pm' },
  { value: 'g:i A', label: '2:34 PM' },
  { value: 'H:i', label: '14:34' },
  { value: 'G:i', label: '14:34' },
]

export const WP_PERMALINK_STRUCTURES = [
  { value: '',                label: 'Plain (default)',  preview: '/?p=123' },
  { value: '/%post_id%/',     label: 'Numeric',          preview: '/123/' },
  { value: '/%postname%/',    label: 'Post name',        preview: '/hello-world/' },
  { value: '/%category%/%postname%/', label: 'Category + name', preview: '/category/hello-world/' },
  { value: '/%year%/%monthnum%/%postname%/', label: 'Month + name', preview: '/2026/12/hello-world/' },
]

export const DEFAULT_BLUEPRINT_SETTINGS = {
  language: 'en_US',
  timezone: 'UTC',
  dateFormat: 'F j, Y',
  timeFormat: 'g:i a',
  permalinkStructure: '/%postname%/',
  disableSearchIndexing: false,
  organizeUploads: true,
  debugMode: false,
  debugLog: false,
  displayErrors: false,
}
