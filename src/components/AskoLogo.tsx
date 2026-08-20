// ASKO kurumsal logosu (SVG yeniden çizim): kırmızı kare içinde beyaz Λ + kalın ASKO yazısı.
// wordColor ile yazı rengi zemine göre ayarlanır (koyu zeminde beyaz).
export const ASKO_RED = "#C0242C";
export const ASKO_NAVY = "#1C4E80";

export default function AskoLogo({
  height = 34,
  wordColor = ASKO_NAVY,
}: {
  height?: number;
  wordColor?: string;
}) {
  return (
    <svg
      viewBox="0 0 236 64"
      height={height}
      role="img"
      aria-label="ASKO"
      style={{ display: "block" }}
    >
      <rect x="0" y="2" width="60" height="60" fill={ASKO_RED} />
      <path
        d="M30 12 L47 52 H37.2 L30 33.5 L22.8 52 H13 Z"
        fill="#ffffff"
      />
      <text
        x="72"
        y="53"
        fontFamily="'Arial Black', Arial, Helvetica, sans-serif"
        fontWeight="900"
        fontSize="47"
        letterSpacing="1.5"
        fill={wordColor}
      >
        ASKO
      </text>
    </svg>
  );
}
