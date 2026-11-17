import React from 'react';

interface OfficialEmblemProps {
  className?: string;
}

export const OfficialEmblem: React.FC<OfficialEmblemProps> = ({ className = 'w-14 h-16' }) => {
  return (
    <svg
      viewBox="0 0 80 92"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Lambang Instansi Pemerintah Daerah"
    >
      {/* Shield outline */}
      <path
        d="M40 4L72 14V44C72 64.5 57.5 80.2 40 88C22.5 80.2 8 64.5 8 44V14L40 4Z"
        fill="#FFFFFF"
        stroke="#0F172A"
        strokeWidth="2.5"
      />
      <path
        d="M40 10L66 18.2V43.8C66 60.8 54 74 40 80.8C26 74 14 60.8 14 43.8V18.2L40 10Z"
        fill="#F8FAFC"
        stroke="#0F172A"
        strokeWidth="1.2"
      />
      {/* Top five-point star */}
      <path
        d="M40 17L42.2 22.8L48.4 23L43.5 26.8L45.2 32.7L40 29.3L34.8 32.7L36.5 26.8L31.6 23L37.8 22.8L40 17Z"
        fill="#0F172A"
      />
      {/* Rice and cotton symbolic arcs */}
      <path
        d="M23 35C21 48 26 60 37 67"
        stroke="#0F172A"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M57 35C59 48 54 60 43 67"
        stroke="#0F172A"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Central pillar / monument */}
      <path d="M36 60H44V41L40 35L36 41V60Z" fill="#0F172A" />
      <path d="M31 63H49V60H31V63Z" fill="#0F172A" />
      {/* Bottom ribbon */}
      <path
        d="M24 68H56V74H24V68Z"
        fill="#FFFFFF"
        stroke="#0F172A"
        strokeWidth="1.3"
      />
    </svg>
  );
};
