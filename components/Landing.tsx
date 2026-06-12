import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { ArrowRight, Cpu, Database, Command, Zap, Terminal, Globe, Shield, Activity, GitBranch, ArrowDownLeft, Check, Star, Quote, ArrowUpRight, Play } from 'lucide-react';
import { User, View } from '../types';

interface LandingProps {
   onStart: () => void;
   onNavigate: (view: View) => void;
   user?: User | null;
}

// --- CUSTOM COMPONENTS ---

// Scrubbing Video for Contact Section
const ScrubbingVideo: React.FC<{ src: string; className?: string }> = ({ src, className }) => {
   const videoRef = useRef<HTMLVideoElement>(null);
   const prevX = useRef<number | null>(null);
   const isSeeking = useRef(false);
   const pendingTime = useRef<number | null>(null);

   useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handleMouseMove = (e: MouseEvent) => {
         if (window.innerWidth < 1024) return;

         if (prevX.current === null) {
            prevX.current = e.clientX;
            return;
         }

         const delta = e.clientX - prevX.current;
         prevX.current = e.clientX;

         const newTime = Math.max(0, Math.min(video.duration || 1, video.currentTime + (delta / window.innerWidth) * 0.8 * (video.duration || 1)));

         if (!isFinite(newTime)) return;

         if (isSeeking.current) {
            pendingTime.current = newTime;
         } else {
            isSeeking.current = true;
            video.currentTime = newTime;
         }
      };

      const handleSeeked = () => {
         if (pendingTime.current !== null) {
            video.currentTime = pendingTime.current;
            pendingTime.current = null;
         } else {
            isSeeking.current = false;
         }
      };

      if (window.innerWidth < 1024) {
         video.autoplay = true;
         video.play().catch(() => { });
      }

      video.addEventListener('seeked', handleSeeked);
      window.addEventListener('mousemove', handleMouseMove);
      return () => {
         video.removeEventListener('seeked', handleSeeked);
         window.removeEventListener('mousemove', handleMouseMove);
      };
   }, []);

   return (
      <video
         ref={videoRef}
         src={src}
         className={className}
         muted
         playsInline
         preload="auto"
      />
   );
};

// Typewriter Hook
const useTypewriter = (text: string, speed = 38, startDelay = 600) => {
   const [displayed, setDisplayed] = useState("");
   const [done, setDone] = useState(false);
   const [start, setStart] = useState(false);

   useEffect(() => {
      if (!start) return;
      let timeout: NodeJS.Timeout;
      let interval: NodeJS.Timeout;

      timeout = setTimeout(() => {
         let i = 0;
         interval = setInterval(() => {
            setDisplayed(text.slice(0, i + 1));
            i++;
            if (i === text.length) {
               clearInterval(interval);
               setDone(true);
            }
         }, speed);
      }, startDelay);

      return () => {
         clearTimeout(timeout);
         clearInterval(interval);
      };
   }, [text, speed, startDelay, start]);

   return { displayed, done, setStart };
};

// 1. FadingVideo: Custom JS crossfade manually handling looping
const FadingVideo: React.FC<{ src: string; className?: string; style?: React.CSSProperties }> = ({ src, className, style }) => {
   const videoRef = useRef<HTMLVideoElement>(null);
   const fadingOutRef = useRef(false);
   const rafRef = useRef<number>();

   const FADE_MS = 500;
   const FADE_OUT_LEAD = 0.55;

   const fadeTo = (target: number, duration: number) => {
      const video = videoRef.current;
      if (!video) return;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      const startOp = parseFloat(video.style.opacity || '0');
      const startTime = performance.now();

      const animate = (time: number) => {
         const elapsed = time - startTime;
         const progress = Math.min(elapsed / duration, 1);
         const currentOp = startOp + (target - startOp) * progress;

         if (videoRef.current) {
            videoRef.current.style.opacity = currentOp.toString();
         }

         if (progress < 1) {
            rafRef.current = requestAnimationFrame(animate);
         }
      };

      rafRef.current = requestAnimationFrame(animate);
   };

   useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const onLoadedData = () => {
         video.style.opacity = '0';
         video.play().catch(console.error);
         fadeTo(1, FADE_MS);
      };

      const onTimeUpdate = () => {
         if (fadingOutRef.current) return;
         const timeLeft = video.duration - video.currentTime;
         if (timeLeft <= FADE_OUT_LEAD && timeLeft > 0) {
            fadingOutRef.current = true;
            fadeTo(0, FADE_MS);
         }
      };

      const onEnded = () => {
         video.style.opacity = '0';
         setTimeout(() => {
            if (!videoRef.current) return;
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(console.error);
            fadingOutRef.current = false;
            fadeTo(1, FADE_MS);
         }, 100);
      };

      video.addEventListener('loadeddata', onLoadedData);
      video.addEventListener('timeupdate', onTimeUpdate);
      video.addEventListener('ended', onEnded);

      return () => {
         if (rafRef.current) cancelAnimationFrame(rafRef.current);
         video.removeEventListener('loadeddata', onLoadedData);
         video.removeEventListener('timeupdate', onTimeUpdate);
         video.removeEventListener('ended', onEnded);
      };
   }, []);

   return (
      <video
         ref={videoRef}
         src={src}
         className={className}
         style={{ ...style, opacity: 0 }}
         muted
         playsInline
         preload="auto"
      />
   );
};

// 2. BlurText Component: Word-by-word blur-in
const BlurText: React.FC<{ text: string; className?: string; delayOffset?: number }> = ({ text, className = "", delayOffset = 0 }) => {
   const ref = useRef(null);
   const isInView = useInView(ref, { once: true, amount: 0.1 });
   const words = text.split(" ");

   return (
      <p ref={ref} className={className} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', rowGap: '0.1em' }}>
         {words.map((word, i) => (
            <motion.span
               key={i}
               initial={{ filter: 'blur(10px)', opacity: 0, y: 50 }}
               animate={isInView ? {
                  filter: ['blur(10px)', 'blur(5px)', 'blur(0px)'],
                  opacity: [0, 0.5, 1],
                  y: [50, -5, 0]
               } : {}}
               transition={{
                  duration: 0.7,
                  times: [0, 0.5, 1],
                  ease: "easeOut",
                  delay: delayOffset + (i * 0.1)
               }}
               style={{ display: 'inline-block', marginRight: '0.28em' }}
            >
               {word}
            </motion.span>
         ))}
      </p>
   );
};

// --- MAIN COMPONENT ---

export const Landing: React.FC<LandingProps> = ({ onStart, onNavigate, user }) => {
   const { displayed: typewriterText, done: typewriterDone, setStart: startTypewriter } = useTypewriter("we'd love to\nhear from you!", 45, 200);
   const [services, setServices] = useState<string[]>([]);
   const contactRef = useRef(null);
   const contactInView = useInView(contactRef, { once: true, amount: 0.2 });

   useEffect(() => {
      if (contactInView) {
         startTypewriter(true);
      }
   }, [contactInView, startTypewriter]);

   const toggleService = (s: string) => {
      setServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
   };

   const serviceOptions = ["Enterprise Deployment", "Custom Fine-Tuning", "Dedicated Support", "Partnership", "Other"];

   return (
      <div className="w-full bg-black min-h-screen text-white overflow-x-hidden font-sans">

         {/* SECTION 1: HERO */}
         <section className="relative w-full min-h-screen flex flex-col overflow-hidden bg-black">
            <FadingVideo
               src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_080021_d598092b-c4c2-4e53-8e46-94cf9064cd50.mp4"
               className="absolute left-1/2 top-0 -translate-x-1/2 object-cover object-top z-0"
               style={{ width: "120%", height: "120%" }}
            />



            {/* Hero Content Layer */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center pt-24 px-4">

               <motion.div
                  initial={{ filter: 'blur(10px)', opacity: 0, y: 20 }}
                  animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, ease: "easeOut" }}
                  className="liquid-glass rounded-full px-1.5 py-1.5 pr-4 flex items-center gap-3 mb-8 border border-white/10"
               >
                  <span className="bg-white text-black px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">LIVE</span>
                  <span className="text-sm text-white/90 font-medium">System Architecture v3.4.0 <span className="text-cherry ml-1">●</span></span>
               </motion.div>

               <BlurText
                  text="The Engine of Intelligence."
                  className="text-6xl md:text-7xl lg:text-[6.5rem] font-serif italic text-white leading-[0.9] max-w-4xl text-center justify-center tracking-[-2px] mb-6"
                  delayOffset={0.5}
               />

               <motion.p
                  initial={{ filter: 'blur(10px)', opacity: 0, y: 20 }}
                  animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, ease: "easeOut" }}
                  className="text-base md:text-lg text-white/80 max-w-2xl text-center font-light leading-relaxed mb-10"
               >
                  Construct exquisite, deterministic workflows using our visual graph engine.
                  Designed for <span className="text-white font-medium border-b border-white/20 pb-0.5">researchers</span>, <span className="text-white font-medium border-b border-white/20 pb-0.5">engineers</span>, and <span className="text-white font-medium border-b border-white/20 pb-0.5">sentient systems</span>.
               </motion.p>

               <motion.div
                  initial={{ filter: 'blur(10px)', opacity: 0, y: 20 }}
                  animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
                  transition={{ delay: 1.1, ease: "easeOut" }}
                  className="flex items-center gap-6 mb-16"
               >
                  <button
                     onClick={onStart}
                     className="liquid-glass-cherry rounded-full px-8 py-4 text-sm font-bold text-white flex items-center gap-2 hover:bg-cherry/20 transition-colors border border-cherry/30"
                  >
                     {user ? "OPEN CONSOLE" : "DEPLOY CONSOLE"} <ArrowUpRight className="w-5 h-5" />
                  </button>
                  <button
                     onClick={() => onNavigate('RESOURCES_DOCS')}
                     className="text-sm font-medium text-white/90 hover:text-white transition-colors flex items-center gap-2 group"
                  >
                     Read Docs <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                  </button>
               </motion.div>

               {/* Stats Row */}
               <motion.div
                  initial={{ filter: 'blur(10px)', opacity: 0, y: 20 }}
                  animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
                  transition={{ delay: 1.3, ease: "easeOut" }}
                  className="flex flex-col sm:flex-row items-stretch gap-4"
               >
                  {[
                     { icon: Activity, val: "35M+", label: "Daily Executions", color: "text-blue-400" },
                     { icon: Globe, val: "300+", label: "Edge Locations", color: "text-green-400" }
                  ].map((stat, i) => (
                     <div key={i} className="liquid-glass p-5 w-[220px] rounded-3xl border border-white/10 flex flex-col items-center text-center hover:-translate-y-1 transition-transform">
                        <stat.icon className={`w-7 h-7 mb-4 ${stat.color}`} strokeWidth={1.5} />
                        <div className="font-serif italic text-4xl text-white tracking-tight leading-none mb-2">{stat.val}</div>
                        <div className="text-xs text-white/60 font-medium uppercase tracking-wider">{stat.label}</div>
                     </div>
                  ))}
               </motion.div>
            </div>


         </section>

         {/* SECTION 2: CAPABILITIES */}
         <section className="relative w-full min-h-screen bg-black">
            <FadingVideo
               src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_094631_d30ab262-45ee-4b7d-99f3-5d5848c8ef13.mp4"
               className="absolute inset-0 w-full h-full object-cover z-0"
            />

            <div className="relative z-10 px-6 md:px-16 lg:px-20 pt-32 pb-24 flex flex-col min-h-screen">

               <div className="mb-20">
                  <p className="text-sm font-medium text-cherry mb-6 tracking-widest uppercase">// Core Capabilities</p>
                  <h2 className="font-serif italic text-white text-5xl md:text-7xl lg:text-[6rem] leading-[0.9] tracking-[-2px] mb-8">
                     Modular.<br />
                     Precise.<br />
                     <span className="text-white/50">Scalable.</span>
                  </h2>
                  <p className="text-lg text-white/80 max-w-xl font-light leading-relaxed">
                     Connect logic, data, and LLMs in a unified visual interface.
                     The platform treats <span className="text-white font-medium">prompts as functions</span> and <span className="text-white font-medium">context as state</span>, ensuring deterministic execution.
                  </p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-auto">
                  {[
                     {
                        icon: Database, color: "text-blue-400",
                        tags: ["Vector DB", "Pinecone", "Weaviate", "Sub-ms"],
                        title: "Vector Memory",
                        desc: "Long-term state management with semantic retrieval. Store billions of vectors with sub-millisecond query times."
                     },
                     {
                        icon: Zap, color: "text-yellow-400",
                        tags: ["Cloudflare", "Edge", "Zero Cold Start", "Global"],
                        title: "Instant Edge",
                        desc: "Deploy to 35+ regions globally in sub-100ms. Powered by Cloudflare Workers natively."
                     },
                     {
                        icon: Command, color: "text-fuchsia-400",
                        tags: ["Stripe", "Salesforce", "Linear", "API"],
                        title: "Tool Calling",
                        desc: "First-class API integrations. Connect your enterprise stack securely and directly."
                     },
                     {
                        icon: Terminal, color: "text-green-400",
                        tags: ["Replay", "State Inspect", "Step-by-step", "Trace"],
                        title: "Live Debugging",
                        desc: "Step-by-step execution replay with full state inspection. No black boxes."
                     },
                     {
                        icon: Shield, color: "text-emerald-400",
                        tags: ["PII Masking", "SOC2", "RBAC", "VPC"],
                        title: "Security Core",
                        desc: "Enterprise grade guardrails. Built-in PII redaction and policy enforcement."
                     },
                     {
                        icon: GitBranch, color: "text-orange-400",
                        tags: ["Type-Safe", "Immutable", "DAG", "JSON"],
                        title: "State Ledger",
                        desc: "Strict type checking between nodes. Context is serialized into immutable ledgers."
                     }
                  ].map((card, i) => (
                     <div key={i} className="liquid-glass rounded-3xl p-8 min-h-[340px] flex flex-col border border-white/5 hover:border-white/20 transition-all hover:-translate-y-2 hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,0.5)] group">
                        <div className="flex items-start justify-between gap-4 mb-auto">
                           <div className="w-12 h-12 rounded-2xl liquid-glass flex items-center justify-center border border-white/10 shrink-0 group-hover:scale-110 transition-transform">
                              <card.icon className={`w-6 h-6 ${card.color}`} strokeWidth={1.5} />
                           </div>
                           <div className="flex flex-wrap justify-end gap-1.5 max-w-[70%]">
                              {card.tags.map(tag => (
                                 <span key={tag} className="liquid-glass rounded-full px-3 py-1 text-[10px] uppercase tracking-wider text-white/70 font-medium border border-white/5">
                                    {tag}
                                 </span>
                              ))}
                           </div>
                        </div>

                        <div className="mt-8">
                           <h3 className="font-serif italic text-white text-3xl tracking-tight leading-none mb-4 group-hover:text-cherry transition-colors">
                              {card.title}
                           </h3>
                           <p className="text-sm text-white/70 font-light leading-relaxed max-w-[32ch]">
                              {card.desc}
                           </p>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         </section>

         {/* SECTION 3: CONTACT & FOOTER */}
         <section ref={contactRef} className="relative w-full min-h-screen bg-black flex flex-col lg:block overflow-hidden">

            {/* Background Video */}
            <div className="order-last lg:order-none relative lg:absolute lg:inset-0 lg:z-0 overflow-hidden pointer-events-none w-full aspect-square md:aspect-video lg:aspect-auto lg:h-full bg-black/50 lg:bg-transparent">
               <ScrubbingVideo
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260601_110537_3a579fa0-7bbc-4d94-9d25-0e816c7840f5.mp4"
                  className="w-full h-full object-cover object-right lg:object-right-bottom opacity-50"
               />
            </div>

            {/* Content Layout Container */}
            <div className="relative z-10 flex flex-col order-first lg:order-none w-full bg-transparent pb-8 lg:pb-0 lg:min-h-screen">
               <main className="w-full max-w-7xl mx-auto px-6 py-32 flex-1 flex flex-col justify-center">

                  <div className="flex flex-col gap-12 w-full max-w-4xl mx-auto">
                     <div>
                        <motion.div
                           initial={{ opacity: 0, y: 20 }}
                           animate={contactInView ? { opacity: 1, y: 0 } : {}}
                           transition={{ duration: 0.6 }}
                        >
                           <h1 className="text-5xl md:text-6xl lg:text-[76px] font-serif italic tracking-tight text-white leading-[1.08] mb-8 select-none w-full whitespace-pre-wrap">
                              {typewriterText}
                              {!typewriterDone && (
                                 <span className="inline-block w-[2px] h-[1.1em] bg-cherry align-middle ml-[2px] animate-blink" />
                              )}
                           </h1>
                        </motion.div>

                        <motion.div
                           initial={{ opacity: 0, y: 20 }}
                           animate={contactInView ? { opacity: 1, y: 0 } : {}}
                           transition={{ duration: 0.6, delay: 0.1 }}
                        >
                           <p className="text-lg md:text-xl text-white/60 leading-relaxed font-light mb-14 max-w-2xl">
                              Whether you have questions, feedback, <br /> drop us a message and we'll get back to you as soon as possible.
                           </p>
                        </motion.div>
                     </div>

                     {/* Interactive Services */}
                     <motion.div
                        initial={{ opacity: 0, filter: 'blur(10px)' }}
                        animate={contactInView ? { opacity: 1, filter: 'blur(0px)' } : {}}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className="pt-4"
                     >
                        <h3 className="text-2xl font-serif italic text-white tracking-tight mb-2">What sort of service?</h3>
                        <p className="opacity-85 text-white/50 text-sm mb-8">Select all that apply</p>

                        <div className="flex flex-wrap gap-3 mb-8">
                           {serviceOptions.map(option => {
                              const isActive = services.includes(option);
                              return (
                                 <motion.button
                                    key={option}
                                    onClick={() => toggleService(option)}
                                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border flex items-center gap-2 ${isActive
                                          ? 'bg-cherry text-white border-cherry shadow-[0_0_15px_-3px_rgba(217,4,41,0.4)]'
                                          : 'bg-black/50 text-white/70 border-white/10 hover:bg-white/5'
                                       }`}
                                    whileTap={{ scale: 0.95 }}
                                 >
                                    {option}
                                    <AnimatePresence>
                                       {isActive && (
                                          <motion.div
                                             initial={{ scale: 0, opacity: 0 }}
                                             animate={{ scale: 1, opacity: 1 }}
                                             exit={{ scale: 0, opacity: 0 }}
                                             transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                          >
                                             <Check className="w-4 h-4" />
                                          </motion.div>
                                       )}
                                    </AnimatePresence>
                                 </motion.button>
                              );
                           })}
                        </div>

                        <AnimatePresence mode="wait">
                           {services.length === 0 ? (
                              <motion.div
                                 key="empty"
                                 initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
                                 className="italic text-xs text-white/50 py-4"
                              >
                                 Please click to select services above.
                              </motion.div>
                           ) : (
                              <motion.div
                                 key="active"
                                 initial={{ height: 0, opacity: 0 }}
                                 animate={{ height: "auto", opacity: 1 }}
                                 exit={{ height: 0, opacity: 0 }}
                                 className="overflow-hidden"
                              >
                                 <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-2">
                                    <p className="text-sm text-white/80 font-light">
                                       Ready to inquire about: <span className="font-medium text-white">{services.join(", ")}</span>
                                    </p>
                                    <button
                                       onClick={() => onNavigate('COMPANY_ENTERPRISE')}
                                       className="flex items-center gap-2 text-cherry font-bold uppercase tracking-widest text-xs hover:text-red-500 transition-colors whitespace-nowrap"
                                    >
                                       Let's Go <ArrowRight className="w-4 h-4" />
                                    </button>
                                 </div>
                              </motion.div>
                           )}
                        </AnimatePresence>
                     </motion.div>
                  </div>
               </main>

               {/* Footer */}
               <footer className="w-full max-w-7xl mx-auto border-t border-white/10 pt-16 pb-12 px-6 flex flex-col md:flex-row justify-between items-start gap-12 mt-auto">
                  <div className="max-w-sm">
                     <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-full liquid-glass-cherry flex items-center justify-center border border-cherry/20">
                           <span className="font-serif italic lowercase text-lg text-white">a</span>
                        </div>
                        <h4 className="font-serif italic text-2xl text-white">Aether Systems.</h4>
                     </div>
                     <p className="text-sm text-white/50 leading-relaxed">
                        Pioneering the interface for artificial general intelligence. We build tools for the architects of the next era.
                     </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-12 font-sans text-sm">
                     <div className="flex flex-col gap-3">
                        <h5 className="font-bold text-white mb-2 uppercase tracking-wider text-xs">Platform</h5>
                        {['Observability', 'Evaluations', 'Prompt Chain', 'Changelog'].map(l => (
                           <button key={l} className="text-left text-white/50 hover:text-cherry transition-colors">{l}</button>
                        ))}
                     </div>
                     <div className="flex flex-col gap-3">
                        <h5 className="font-bold text-white mb-2 uppercase tracking-wider text-xs">Resources</h5>
                        {['Documentation', 'API Reference', 'Community', 'Help Center'].map(l => (
                           <button key={l} className="text-left text-white/50 hover:text-cherry transition-colors">{l}</button>
                        ))}
                     </div>
                     <div className="flex flex-col gap-3">
                        <h5 className="font-bold text-white mb-2 uppercase tracking-wider text-xs">Company</h5>
                        {['About', 'Enterprise', 'Careers', 'Legal'].map(l => (
                           <button key={l} className="text-left text-white/50 hover:text-cherry transition-colors">{l}</button>
                        ))}
                     </div>
                  </div>
               </footer>

               <div className="w-full max-w-7xl mx-auto px-6 pt-8 pb-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/40 font-mono uppercase tracking-widest">
                  <p>© 2026 Aether Systems Inc. All rights reserved.</p>
                  <div className="flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-cherry animate-pulse" />
                     System Operational
                  </div>
               </div>
            </div>
         </section>



      </div>
   );
};

