function PseudoPage() {
  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: `2rem`,
          height: `2rem`,
        }}
      >
        <svg stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <g>
            <circle cx="12" cy="12" r="9.5" fill="none" strokeWidth="3" strokeLinecap="round">
              <animate
                attributeName="stroke-dasharray"
                dur="1.5s"
                calcMode="spline"
                values="0 150;42 150;42 150;42 150"
                keyTimes="0;0.475;0.95;1"
                keySplines="0.42,0,0.58,1;0.42,0,0.58,1;0.42,0,0.58,1"
                repeatCount="indefinite"
              />
              <animate
                attributeName="stroke-dashoffset"
                dur="1.5s"
                calcMode="spline"
                values="0;-16;-59;-59"
                keyTimes="0;0.475;0.95;1"
                keySplines="0.42,0,0.58,1;0.42,0,0.58,1;0.42,0,0.58,1"
                repeatCount="indefinite"
              />
            </circle>
            <animateTransform
              attributeName="transform"
              type="rotate"
              dur="2s"
              values="0 12 12;360 12 12"
              repeatCount="indefinite"
            />
          </g>
        </svg>
      </div>
    </div>
  );
}

export default PseudoPage;
