export const greylabsPieces = [
  { name: "Studio tee", type: "tee", detail: "An everyday canvas for the Greylabs mark." },
  { name: "Builder hoodie", type: "hoodie", detail: "For long sessions and whatever comes next." },
  { name: "Lab sticker pack", type: "stickers", detail: "A little Greylabs for your laptop and notebook." },
] as const;

export function MerchArt({ type }: { type: string }) {
  return <svg viewBox="0 0 300 220" role="img" aria-label={`Greylabs ${type} design`} className="h-44 w-full">
    {type === "stickers" ? <><rect x="55" y="40" width="120" height="115" rx="24" fill="#ebe9e2" transform="rotate(-10 115 97)" /><rect x="125" y="78" width="115" height="98" rx="25" fill="#c4c5aa" transform="rotate(12 182 127)" /><text x="109" y="107" textAnchor="middle" fontSize="35" fill="#303529" fontWeight="700">G/</text><text x="183" y="130" textAnchor="middle" fontSize="16" fill="#303529" fontWeight="700">BUILD.</text></> : <>
      <path d={type === "hoodie" ? "M112 52 Q112 8 150 8 Q188 8 188 52 L224 72 L256 157 L220 174 L196 114 L196 204 L104 204 L104 114 L80 174 L44 157 L76 72 Z" : "M108 35 Q150 54 192 35 L246 65 L224 112 L199 99 L199 200 L101 200 L101 99 L76 112 L54 65 Z"} fill="#35392f" stroke="#858977" strokeWidth="2" />
      {type === "hoodie" ? <path d="M112 53 Q150 82 188 53 M130 174 H170 L176 193 H124 Z" fill="none" stroke="#858977" strokeWidth="2" /> : null}
      <text x="150" y="120" textAnchor="middle" fontSize="23" fill="#e9e9db" fontWeight="700">GREY/</text><text x="150" y="141" textAnchor="middle" fontSize="10" letterSpacing="4" fill="#c4c5aa">LABS</text>
    </>}
  </svg>;
}
