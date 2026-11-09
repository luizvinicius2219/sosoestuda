import SofiaCharacter, {type SofiaPose} from "./sofia-character";
export default function Mascot({small=false,className="",pose="wave"}:{small?:boolean;className?:string;pose?:SofiaPose}) {
  return <SofiaCharacter pose={pose} className={`mascot ${small?"mascot-small":""} ${className}`}/>;
}
