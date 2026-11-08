type MascotProps = { small?: boolean; className?: string };

export default function Mascot({ small = false, className = "" }: MascotProps) {
  return (
    <svg viewBox="0 0 330 270" fill="none" className={`mascot ${small ? "mascot-small" : ""} ${className}`} aria-hidden="true">
      <ellipse cx="171" cy="247" rx="109" ry="12" fill="#533F93" opacity=".28" />
      <circle cx="173" cy="129" r="100" fill="#B59CEB" opacity=".19" />
      <circle cx="173" cy="129" r="114" stroke="#D6C3F7" strokeDasharray="3 9" opacity=".3" />
      <path d="m58 41 3 10 10 3-10 3-3 10-3-10-10-3 10-3Z" fill="#F9D88E" />
      <path d="m282 117 2.5 8 8 2.5-8 2.5-2.5 8-2.5-8-8-2.5 8-2.5Z" fill="#F9D88E" />
      <path d="m270 26 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="#E6D9FA" />
      <circle cx="95" cy="99" r="3" fill="#D7C4F3" />
      <circle cx="252" cy="73" r="3" fill="#F9D88E" />
      <path d="M57 235c-6-17-3-31-5-44" stroke="#D5D6A8" strokeWidth="3" strokeLinecap="round" />
      <path d="M53 210c-17 1-25-12-22-22 14-2 23 7 22 22Z" fill="#BCCFAB" />
      <path d="M53 204c16-2 21-12 18-22-13 2-19 10-18 22Z" fill="#D6DDB5" />
      <path d="M39 226h33l-6 21H45l-6-21Z" fill="#E9B6A1" />
      <path d="M37 224h37v6H37z" fill="#F2C9B5" />
      <path d="M116 229c-6 5-5 13 6 15 14 2 24 0 23-8l-29-7Zm82 0c6 5 5 13-6 15-14 2-24 0-23-8l29-7Z" fill="#EFBF78" />
      <path d="M104 85c-8-5-16-13-19-24 19 0 35 9 42 19m76 0c8-8 24-17 43-19-3 12-11 22-20 28" fill="#C5ADF0" />
      <path d="M96 104c2-36 27-56 66-56s66 20 69 56l8 83c4 35-22 53-76 53s-79-18-75-53l8-83Z" fill="#C6ACEF" />
      <path d="M105 103c1-20 15-31 32-31 16 0 25 10 28 20 4-10 14-20 29-20 19 0 32 13 32 32v45c-1 33-28 53-62 53s-61-20-61-53l2-46Z" fill="#F3E8FA" />
      <path d="M126 116c0-7 5-12 11-12s11 5 11 12m34 0c0-7 5-12 11-12s11 5 11 12" stroke="#433759" strokeWidth="5" strokeLinecap="round" />
      <circle cx="134" cy="119" r="25" stroke="#7960A4" strokeWidth="3" />
      <circle cx="195" cy="119" r="25" stroke="#7960A4" strokeWidth="3" />
      <path d="M159 117c3-4 7-4 11 0M109 114l-11-4m122 4 10-4" stroke="#7960A4" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="117" cy="144" rx="10" ry="5" fill="#EBAFBB" opacity=".8" />
      <ellipse cx="213" cy="144" rx="10" ry="5" fill="#EBAFBB" opacity=".8" />
      <path d="m155 140 9 12 10-12c-3-6-15-6-19 0Z" fill="#F0BA73" />
      <path d="M153 159c7 6 15 6 22 0" stroke="#B197C5" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M97 179c-10-17-19-17-22-7-5 15 5 35 22 40m134-33c10-17 19-17 22-7 5 15-5 35-22 40" fill="#B69ADD" />
      <path d="m99 170 65 12 66-12v63l-66 11-65-11v-63Z" fill="#E7C28D" />
      <path d="M105 164c21-4 42 2 59 13 20-11 40-17 60-13v63c-20-4-40 2-60 11-17-9-38-15-59-11v-63Z" fill="#FFEFCA" />
      <path d="M164 177v61" stroke="#D2AF7E" strokeWidth="2" />
      <path d="m118 178 31 7m-31 4 31 7m-31 4 23 5m37-20 32-7m-32 18 32-7m-32 18 23-5" stroke="#DEC49E" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M100 182c-15-6-22-1-18 9 3 8 11 11 20 12m126-21c15-6 22-1 18 9-3 8-11 11-20 12" fill="#C6ACEF" />
      <path d="m169 28 69 23-69 24-69-24 69-23Z" fill="#4E3B77" />
      <path d="M130 61v16c22 13 50 13 76 0V61l-37 13-39-13Z" fill="#624B91" />
      <path d="m169 51 58 5v32" stroke="#F0CE85" strokeWidth="3" strokeLinecap="round" />
      <circle cx="169" cy="51" r="4" fill="#F0CE85" />
      <path d="m227 86-6 15h12l-6-15Z" fill="#F0CE85" />
      <path d="M264 218h40v9h-40z" fill="#EFBD8C" />
      <path d="M258 228h46v9h-46z" fill="#C5D4B8" />
      <path d="M262 238h42v8h-42z" fill="#D2C1EB" />
      <path d="M267 221h30m-34 10h34m-30 10h29" stroke="#FFF4DD" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
