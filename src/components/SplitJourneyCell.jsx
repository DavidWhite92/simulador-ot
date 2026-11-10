export default function SplitJourneyCell({parts}) {
  return <span style={{display:'grid',gridTemplateColumns:'1fr 1fr',width:'100%',minHeight:31}}>{parts.map((part,i)=><span key={i} style={{display:'flex',alignItems:'center',justifyContent:'center',textAlign:'center',background:part.background,color:part.color || '#111',borderLeft:i?'1px solid #ddd':undefined,padding:'0 4px'}}>{part.text}</span>)}</span>;
}
