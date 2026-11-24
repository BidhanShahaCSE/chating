export function BrandMark({ className = 'w-6 h-6' }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="9" fill="currentColor" fillOpacity="0.14" />
      <path
        d="M8.5 11.75A2.75 2.75 0 0 1 11.25 9h9.5a2.75 2.75 0 0 1 2.75 2.75v6.5A2.75 2.75 0 0 1 20.75 21H14.5l-4.25 3.25V21H11.25A2.75 2.75 0 0 1 8.5 18.25v-6.5Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M16 12.1l.65 1.85 1.85.65-1.85.65L16 17.1l-.65-1.85-1.85-.65 1.85-.65.65-1.85Z"
        fill="currentColor"
      />
    </svg>
  );
}
