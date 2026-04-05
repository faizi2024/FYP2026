'use client';

const LoadingIndicator = () => {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
      <svg
        width="100"
        height="100"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        className="text-primary"
        aria-label="Loading mannequin"
      >
        <style>{`
          .mannequin-path {
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
            animation: draw 3s ease-in-out infinite;
          }
          @keyframes draw {
            0% { stroke-dashoffset: 100; }
            50% { stroke-dashoffset: 0; }
            100% { stroke-dashoffset: -100; }
          }
          .mannequin-path:nth-child(1) { animation-delay: 0s; }
          .mannequin-path:nth-child(2) { animation-delay: 0.2s; }
          .mannequin-path:nth-child(3) { animation-delay: 0.4s; }
          .mannequin-path:nth-child(4) { animation-delay: 0.6s; }
          .mannequin-path:nth-child(5) { animation-delay: 0.8s; }
        `}</style>
        <g fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          {/* Head */}
          <path className="mannequin-path" d="M12 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
          {/* Body */}
          <path className="mannequin-path" d="M12 5v5.5" />
          {/* Arms */}
          <path className="mannequin-path" d="M12 6.5L8 9.5" />
          <path className="mannequin-path" d="M12 6.5l4 3" />
          {/* Pelvis/Legs */}
          <path className="mannequin-path" d="M9 10.5h6L12 10.5" />
          <path className="mannequin-path" d="M12 10.5v4l-2 7" />
          <path className="mannequin-path" d="M12 10.5v4l2 7" />
        </g>
      </svg>
      <p className="mt-4 text-sm text-muted-foreground font-headline animate-pulse">
        Initializing VirtuFit...
      </p>
    </div>
  );
};

export default LoadingIndicator;
