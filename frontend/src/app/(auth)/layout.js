export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen w-full flex bg-zinc-50 dark:bg-zinc-950 transition-colors duration-200">
      {/* Visual Splash Column (Desktop Only) */}
      <div className="hidden lg:flex flex-col w-1/2 bg-zinc-900 text-white p-12 justify-between relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-[-20%] left-[-20%] h-[70%] w-[70%] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-20%] h-[70%] w-[70%] rounded-full bg-secondary/20 blur-[120px]" />
        
        {/* Logo */}
        <div className="z-10">
          <span className="text-3xl font-black bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            PLATFORM
          </span>
        </div>

        {/* Mock content illustration / Social Proof */}
        <div className="z-10 flex flex-col space-y-6 max-w-md my-auto">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Connect, collaborate, and share with developers worldwide.
          </h1>
          <p className="text-zinc-450 text-lg leading-relaxed">
            Join a fast-growing community of builders sharing code, updates, and real-time insights.
          </p>

          {/* Social Proof overlapping avatars */}
          <div className="flex items-center space-x-4 pt-4">
            <div className="flex -space-x-3">
              {['A', 'B', 'C', 'D'].map((char, index) => (
                <div
                  key={index}
                  className={`h-9 w-9 rounded-full ring-2 ring-zinc-900 flex items-center justify-center font-bold text-xs bg-gradient-to-tr ${
                    index % 2 === 0 ? 'from-primary to-secondary' : 'from-emerald-500 to-teal-500'
                  }`}
                >
                  {char}
                </div>
              ))}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm">Trusted by 10,000+ creators</span>
              <span className="text-xs text-zinc-500">Real-time collaboration ready</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="z-10 text-xs text-zinc-500">
          © {new Date().getFullYear()} Social Media Platform. All rights reserved.
        </div>
      </div>

      {/* Main Form Auth Card Column */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-8 relative overflow-hidden transition-colors duration-200">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary to-secondary" />
          {children}
        </div>
      </div>
    </div>
  );
}
