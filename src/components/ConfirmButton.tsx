"use client";

// Kritik işlemler için onaylı gönderim butonu
export default function ConfirmButton({
  message,
  children,
  className = "btn sm danger",
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
