export type SofiaPose = "wave" | "read" | "laptop" | "think" | "celebrate" | "guide";
const cells: Record<SofiaPose, [number, number]> = {wave:[0,0],read:[1,0],laptop:[2,0],think:[0,1],celebrate:[1,1],guide:[2,1]};
/** Original transparent character sheet, framed by pose without altering the artwork. */
export default function SofiaCharacter({pose="wave",className=""}:{pose?:SofiaPose;className?:string}) {
  const [column,row]=cells[pose];
  return <svg className={`sofia-character sofia-pose-${pose} ${className}`} viewBox={`${column*512} ${row*512} 512 512`} aria-hidden="true" focusable="false"><image href="/characters/sofia-poses.png" width="1536" height="1024"/></svg>;
}
